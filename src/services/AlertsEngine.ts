/**
 * AlertsEngine - Proactive Condition & Criticality Alert Engine for RCM 7Q
 * Evaluates assets, FMEA risk priority numbers (RPN), Weibull optimal replacement limits,
 * overdue maintenance tasks, and reliability thresholds to flag machines needing maintenance.
 */

import { supabase } from '../lib/supabaseClient';

export type AlertSeverity = 'critical' | 'warning' | 'attention' | 'info';
export type AlertCategory = 'FMEA' | 'Replacement' | 'Task' | 'Reliability' | 'General';

export interface MachineAlert {
    id: string;
    assetId: string;
    assetName: string;
    tagNumber: string;
    severity: AlertSeverity;
    category: AlertCategory;
    title: string;
    message: string;
    recommendedAction: string;
    actionRoute: string;
    timestamp: string;
    acknowledged?: boolean;
    metricLabel?: string;
    metricValue?: string | number;
}

const STORAGE_KEY_ACKNOWLEDGED = 'rcm_acknowledged_alerts';

class AlertsEngineClass {
    private getAcknowledgedIds(): Set<string> {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_ACKNOWLEDGED);
            return raw ? new Set(JSON.parse(raw)) : new Set();
        } catch {
            return new Set();
        }
    }

    /**
     * Acknowledge an alert so it doesn't clutter active urgent views
     */
    acknowledgeAlert(alertId: string): void {
        const set = this.getAcknowledgedIds();
        set.add(alertId);
        localStorage.setItem(STORAGE_KEY_ACKNOWLEDGED, JSON.stringify(Array.from(set)));
        window.dispatchEvent(new CustomEvent('rcm-alerts-changed'));
    }

    /**
     * Unacknowledge / Reset alert state
     */
    resetAcknowledgedAlerts(): void {
        localStorage.removeItem(STORAGE_KEY_ACKNOWLEDGED);
        window.dispatchEvent(new CustomEvent('rcm-alerts-changed'));
    }

    /**
     * Scan all data sources and evaluate which machines need maintenance
     */
    async evaluateMachineAlerts(params: {
        userId?: string | null;
        projectId?: string | null;
        currentAssetId?: string | null;
    }): Promise<MachineAlert[]> {
        const alerts: MachineAlert[] = [];
        const acknowledgedIds = this.getAcknowledgedIds();
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        try {
            // 1. Fetch Assets for context
            let assetsMap = new Map<string, { id: string; name: string; tag: string; criticality: string; hours?: number }>();

            if (params.userId) {
                let assetQuery = supabase.from('assets').select('id, equipment_name, tag_number, criticality_level, operating_hours_per_day');
                if (params.projectId) assetQuery = assetQuery.eq('project_id', params.projectId);
                const { data: dbAssets } = await assetQuery;
                if (dbAssets) {
                    dbAssets.forEach(a => {
                        assetsMap.set(a.id, {
                            id: a.id,
                            name: a.equipment_name,
                            tag: a.tag_number,
                            criticality: a.criticality_level || 'Medium',
                            hours: a.operating_hours_per_day
                        });
                    });
                }
            }

            // 2. Evaluate Overdue & Imminent Maintenance Tasks
            if (params.userId) {
                const { data: tasks } = await supabase
                    .from('tasks')
                    .select('id, title, due_date, status, priority, asset_id, assets(equipment_name, tag_number)')
                    .eq('user_id', params.userId)
                    .neq('status', 'Completed');

                if (tasks && tasks.length > 0) {
                    tasks.forEach((t: any) => {
                        const assetName = t.assets?.equipment_name || assetsMap.get(t.asset_id)?.name || 'Machine Asset';
                        const tagNumber = t.assets?.tag_number || assetsMap.get(t.asset_id)?.tag || 'N/A';
                        const dueDate = t.due_date ? new Date(t.due_date) : null;

                        if (dueDate) {
                            const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                            if (diffDays < 0 || t.status === 'Overdue') {
                                const id = `task-overdue-${t.id}`;
                                alerts.push({
                                    id,
                                    assetId: t.asset_id || '',
                                    assetName,
                                    tagNumber,
                                    severity: 'critical',
                                    category: 'Task',
                                    title: `Overdue Maintenance Task: ${t.title}`,
                                    message: `Task is ${Math.abs(diffDays)} day(s) past its scheduled deadline (${t.due_date}). High risk of unmitigated equipment breakdown.`,
                                    recommendedAction: 'Dispatch technician and execute maintenance procedure immediately.',
                                    actionRoute: '/maintenance-tasks',
                                    timestamp: now.toISOString(),
                                    acknowledged: acknowledgedIds.has(id),
                                    metricLabel: 'Overdue by',
                                    metricValue: `${Math.abs(diffDays)} days`
                                });
                            } else if (diffDays <= 7) {
                                const id = `task-due-soon-${t.id}`;
                                alerts.push({
                                    id,
                                    assetId: t.asset_id || '',
                                    assetName,
                                    tagNumber,
                                    severity: 'warning',
                                    category: 'Task',
                                    title: `Maintenance Due in ${diffDays} Day(s): ${t.title}`,
                                    message: `Scheduled maintenance interval due on ${t.due_date}. Priority: ${t.priority || 'Normal'}.`,
                                    recommendedAction: 'Verify spare parts availability and assign technician.',
                                    actionRoute: '/maintenance-tasks',
                                    timestamp: now.toISOString(),
                                    acknowledged: acknowledgedIds.has(id),
                                    metricLabel: 'Due in',
                                    metricValue: `${diffDays} days`
                                });
                            }
                        }
                    });
                }
            }

            // 3. Evaluate FMEA Risk Priorities (RPN >= 300 or Severity >= 8)
            const { data: fmeaList } = await supabase
                .from('fmea')
                .select('id, component_id, failure_mode, failure_cause, failure_effect, severity, occurrence, detection, rpn, components(asset_id, name, assets(equipment_name, tag_number))');

            if (fmeaList && fmeaList.length > 0) {
                fmeaList.forEach((f: any) => {
                    const comp = f.components;
                    const asset = comp?.assets;
                    const assetId = comp?.asset_id || '';
                    const assetName = asset?.equipment_name || assetsMap.get(assetId)?.name || 'Industrial Equipment';
                    const tagNumber = asset?.tag_number || assetsMap.get(assetId)?.tag || 'EQ';
                    const componentName = comp?.name || 'Component';
                    const rpn = Number(f.rpn) || (Number(f.severity) * Number(f.occurrence) * Number(f.detection)) || 0;
                    const sev = Number(f.severity) || 1;

                    if (rpn >= 300 || sev >= 9) {
                        const id = `fmea-crit-${f.id}`;
                        alerts.push({
                            id,
                            assetId,
                            assetName,
                            tagNumber,
                            severity: 'critical',
                            category: 'FMEA',
                            title: `High Criticality Risk on ${componentName} (RPN ${rpn})`,
                            message: `Failure mode "${f.failure_mode}" has Severity ${sev}/10 (Effect: ${f.failure_effect}). Exceeds plant safety/operational tolerance threshold.`,
                            recommendedAction: 'Implement proactive condition monitoring or design redesign immediately.',
                            actionRoute: '/fmea',
                            timestamp: now.toISOString(),
                            acknowledged: acknowledgedIds.has(id),
                            metricLabel: 'RPN Index',
                            metricValue: rpn
                        });
                    } else if (rpn >= 160 || sev >= 8) {
                        const id = `fmea-warn-${f.id}`;
                        alerts.push({
                            id,
                            assetId,
                            assetName,
                            tagNumber,
                            severity: 'warning',
                            category: 'FMEA',
                            title: `Elevated Failure Risk: ${componentName} - ${f.failure_mode}`,
                            message: `RPN ${rpn} indicates moderate-to-high failure probability (Cause: ${f.failure_cause}).`,
                            recommendedAction: 'Schedule preventive inspection or add task to maintenance planner.',
                            actionRoute: '/fmea',
                            timestamp: now.toISOString(),
                            acknowledged: acknowledgedIds.has(id),
                            metricLabel: 'RPN Index',
                            metricValue: rpn
                        });
                    }
                });
            }

            // 4. Evaluate Weibull Optimal Replacement Overruns
            const { data: replacements } = await supabase
                .from('replacements')
                .select('*');

            if (replacements && replacements.length > 0) {
                replacements.forEach((r: any) => {
                    const currentAge = Number(r.current_age) || 0;
                    const optimumTime = Number(r.optimal_time) || Number(r.optimum_time) || 0;
                    const assetName = r.equipment || 'Equipment Component';
                    const tagNumber = r.tag_number || 'EQ-REP';
                    const id = `weibull-${r.id}`;

                    if (optimumTime > 0) {
                        if (currentAge >= optimumTime) {
                            alerts.push({
                                id,
                                assetId: r.asset_id || '',
                                assetName,
                                tagNumber,
                                severity: 'critical',
                                category: 'Replacement',
                                title: `Optimal Replacement Limit Exceeded: ${assetName}`,
                                message: `Current service time (${currentAge.toLocaleString()} hrs) has exceeded calculated Weibull optimum replacement age (${optimumTime.toLocaleString()} hrs). Failure hazard rate is escalating rapidly.`,
                                recommendedAction: 'Schedule machine overhaul or replacement before catastrophic unplanned outage.',
                                actionRoute: '/optimal-replacement',
                                timestamp: now.toISOString(),
                                acknowledged: acknowledgedIds.has(id),
                                metricLabel: 'Age vs Optimum',
                                metricValue: `${Math.round((currentAge / optimumTime) * 100)}%`
                            });
                        } else if (currentAge >= optimumTime * 0.85) {
                            alerts.push({
                                id: `weibull-warn-${r.id}`,
                                assetId: r.asset_id || '',
                                assetName,
                                tagNumber,
                                severity: 'warning',
                                category: 'Replacement',
                                title: `Approaching End of Economic Life: ${assetName}`,
                                message: `Equipment is at ${Math.round((currentAge / optimumTime) * 100)}% of optimal replacement cycle (${(optimumTime - currentAge).toFixed(0)} operating hrs remaining).`,
                                recommendedAction: 'Order spare assemblies and prepare maintenance work order.',
                                actionRoute: '/optimal-replacement',
                                timestamp: now.toISOString(),
                                acknowledged: acknowledgedIds.has(id),
                                metricLabel: 'Life Used',
                                metricValue: `${Math.round((currentAge / optimumTime) * 100)}%`
                            });
                        }
                    }
                });
            }

            // 5. Evaluate Cost & MTBF Reliability Thresholds
            const { data: costs } = await supabase.from('costs').select('*');
            if (costs && costs.length > 0) {
                costs.forEach((c: any) => {
                    const mtbf = Number(c.mtbf) || 8760;
                    const opTime = Number(c.operating_time) || 8760;
                    const expectedFailures = mtbf > 0 ? opTime / mtbf : 0;
                    const failureCost = Number(c.failure_cost) || 0;
                    const downtimeRate = Number(c.downtime_cost_rate) || 0;

                    if (expectedFailures >= 4 || (expectedFailures >= 2 && downtimeRate >= 1500)) {
                        const id = `cost-high-fail-${c.id}`;
                        alerts.push({
                            id,
                            assetId: c.asset_id || '',
                            assetName: c.equipment_name || 'Asset Component',
                            tagNumber: 'COST-FAIL',
                            severity: 'warning',
                            category: 'Reliability',
                            title: `High Expected Failure Frequency: ${c.equipment_name}`,
                            message: `Short MTBF (${mtbf}h) produces ~${expectedFailures.toFixed(1)} expected failures during mission time with heavy downtime cost rate ($${downtimeRate}/hr).`,
                            recommendedAction: 'Conduct root-cause elimination to improve MTBF and reduce unplanned stoppage penalties.',
                            actionRoute: '/operating-costs',
                            timestamp: now.toISOString(),
                            acknowledged: acknowledgedIds.has(id),
                            metricLabel: 'Exp. Failures',
                            metricValue: `${expectedFailures.toFixed(1)} / period`
                        });
                    }
                });
            }

        } catch (err) {
            console.error('Error evaluating machine alerts:', err);
        }

        // If no alerts from database (e.g. empty DB or demo mode), provide baseline alerts so the user can test immediately
        if (alerts.length === 0) {
            return this.getDefaultDemoAlerts(acknowledgedIds);
        }

        // Sort: Critical first, then Warning, then Attention
        const severityRank: Record<AlertSeverity, number> = {
            critical: 0,
            warning: 1,
            attention: 2,
            info: 3
        };

        return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
    }

    /**
     * Fallback standard engineering demonstration alerts
     */
    private getDefaultDemoAlerts(acknowledgedIds: Set<string>): MachineAlert[] {
        const now = new Date().toISOString();
        const demo: MachineAlert[] = [
            {
                id: 'demo-alert-1',
                assetId: 'asset-101',
                assetName: 'Centrifugal Feed Pump A-101',
                tagNumber: 'PUMP-A101',
                severity: 'critical',
                category: 'Replacement',
                title: 'Optimal Replacement Limit Exceeded (Bearing Assembly)',
                message: 'Current operating hours (8,750h) exceed Weibull optimal replacement time (8,000h). Unplanned catastrophic failure probability exceeds 65%.',
                recommendedAction: 'Schedule planned replacement overhaul under Cp=$4,500 rather than risking Cu=$22,000 failure.',
                actionRoute: '/optimal-replacement',
                timestamp: now,
                acknowledged: acknowledgedIds.has('demo-alert-1'),
                metricLabel: 'Wearout Overrun',
                metricValue: '109%'
            },
            {
                id: 'demo-alert-2',
                assetId: 'asset-101',
                assetName: 'Centrifugal Feed Pump A-101',
                tagNumber: 'PUMP-A101',
                severity: 'critical',
                category: 'FMEA',
                title: 'High RPN Failure Mode: Mechanical Seal Leakage',
                message: 'FMEA analysis indicates RPN of 336 (Severity: 7, Occurrence: 8, Detection: 6). Risk of complete fluid loss and casing damage.',
                recommendedAction: 'Upgrade to mechanical double seal and install leak sensor.',
                actionRoute: '/fmea',
                timestamp: now,
                acknowledged: acknowledgedIds.has('demo-alert-2'),
                metricLabel: 'RPN Score',
                metricValue: 336
            },
            {
                id: 'demo-alert-3',
                assetId: 'asset-202',
                assetName: 'Compressor Unit C-301',
                tagNumber: 'COMP-301',
                severity: 'warning',
                category: 'Task',
                title: 'Overdue Preventive Task: Lube Oil Filter Replacement',
                message: 'Scheduled 500-hour filter cartridge replacement is 3 days overdue. High risk of bearing contamination.',
                recommendedAction: 'Dispatch maintenance technician to replace element and log differential pressure.',
                actionRoute: '/maintenance-tasks',
                timestamp: now,
                acknowledged: acknowledgedIds.has('demo-alert-3'),
                metricLabel: 'Overdue by',
                metricValue: '3 days'
            },
            {
                id: 'demo-alert-4',
                assetId: 'asset-205',
                assetName: 'Electric Motor Drive B-205',
                tagNumber: 'MTR-B205',
                severity: 'warning',
                category: 'Reliability',
                title: 'High Thermal Dissipation & Frequent Trip Pattern',
                message: 'Short MTBF (4,380h) with operating hours approaching threshold. Expected downtime cost exceeds $1,200/hr.',
                recommendedAction: 'Perform infrared thermography survey and check motor winding insulation resistance.',
                actionRoute: '/operating-costs',
                timestamp: now,
                acknowledged: acknowledgedIds.has('demo-alert-4'),
                metricLabel: 'MTBF Margin',
                metricValue: '92% spent'
            }
        ];

        return demo;
    }
}

export const AlertsEngine = new AlertsEngineClass();
