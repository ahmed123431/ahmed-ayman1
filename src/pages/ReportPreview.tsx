import { useRef, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, FileEdit, FileSpreadsheet } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import { useLanguage } from '../contexts/LanguageContext';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

// Removed unused BarChart

// ── Weibull CPUT Engine (for Optimal Replacement Curve rendering) ────────────
function weibull_R(t: number, beta: number, eta: number): number {
    if (t < 0) return 1;
    return Math.exp(-Math.pow(t / eta, beta));
}
function integrate_R(t: number, beta: number, eta: number, n: number = 2000): number {
    if (t <= 0) return 0;
    const h = t / n;
    let sum = weibull_R(0, beta, eta) + weibull_R(t, beta, eta);
    for (let i = 1; i < n; i++) { sum += (i % 2 === 0 ? 2 : 4) * weibull_R(i * h, beta, eta); }
    return (h / 3) * sum;
}
function calculate_CPUT(t: number, Cp: number, Cu: number, beta: number, eta: number): number {
    if (t <= 0) return Infinity;
    const Rt = weibull_R(t, beta, eta);
    const intR = integrate_R(t, beta, eta);
    if (intR === 0) return Infinity;
    return (Cp * Rt + Cu * (1 - Rt)) / intR;
}
function generateCPUTCurve(Cp: number, Cu: number, beta: number, eta: number) {
    const maxScanT = eta * 4;
    let bestT = 0, bestCPUT = Infinity;
    const step = maxScanT / 1000;
    for (let t = step; t <= maxScanT; t += step) {
        const c = calculate_CPUT(t, Cp, Cu, beta, eta);
        if (c < bestCPUT) { bestCPUT = c; bestT = t; }
    }
    const isRTF = beta <= 1 || Cp >= Cu || bestT >= maxScanT - step * 2;
    const optimumTime = isRTF ? Infinity : bestT;
    const chartMaxT = isRTF ? maxScanT : bestT * 2.5;
    const points: { t: number; cput: number }[] = [];
    const curveStep = chartMaxT / 200;
    for (let t = curveStep; t <= chartMaxT; t += curveStep) {
        points.push({ t, cput: calculate_CPUT(t, Cp, Cu, beta, eta) });
    }
    return { optimumTime, minCPUT: bestCPUT, points };
}
// ── PF Curve data generator ─────────────────────────────────────────────────
function generatePFCurvePoints(pDays: number, fDays: number) {
    let unit = 'Days', divisor = 1;
    if (fDays >= 730) { unit = 'Years'; divisor = 365.25; }
    else if (fDays >= 60) { unit = 'Months'; divisor = 30.437; }
    else if (fDays >= 14) { unit = 'Weeks'; divisor = 7; }
    const chartF = fDays / divisor, chartP = pDays / divisor;
    const pts: { time: number; condition: number }[] = [];
    for (let i = 0; i <= 100; i++) {
        const x = chartF * (i / 100);
        pts.push({ time: +x.toFixed(4), condition: +(100 * (1 - Math.pow(x / chartF, 3))).toFixed(4) });
    }
    const pCond = 100 * (1 - Math.pow(chartP / chartF, 3));
    return { points: pts, pTime: +chartP.toFixed(4), pCondition: +pCond.toFixed(4), fTime: +chartF.toFixed(4), unit, intervalDays: fDays - pDays };
}


export default function ReportPreview() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { t } = useLanguage();
    const { isMobile } = useSidebar();
    const reportRef = useRef<HTMLDivElement>(null);

    const reportName = searchParams.get('name') || 'Executive RCM Summary';
    const projectId = searchParams.get('projectId');
    const assetId = searchParams.get('assetId');

    const [targetAssets, setTargetAssets] = useState<any[]>([]);
    const [assetDataMap, setAssetDataMap] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [projectName, setProjectName] = useState<string>('');
    const { user } = useAuth();

    useEffect(() => {
        const fetchReportData = async () => {
            if (!user) return;
            setLoading(true);
            
            try {
                let assets = [];
                if (assetId) {
                    const { data } = await supabase.from('assets').select('*').eq('id', assetId);
                    assets = data || [];
                } else if (projectId) {
                    const { data } = await supabase.from('assets').select('*').eq('project_id', projectId);
                    assets = data || [];
                } else {
                    const { data } = await supabase.from('assets').select('*').eq('user_id', user.id);
                    assets = data || [];
                }
                
                setTargetAssets(assets);

                // Fetch project name
                if (projectId) {
                    const { data: proj } = await supabase.from('projects').select('name').eq('id', projectId).single();
                    if (proj) setProjectName(proj.name);
                } else if (assets.length > 0 && assets[0].project_id) {
                    const { data: proj } = await supabase.from('projects').select('name').eq('id', assets[0].project_id).single();
                    if (proj) setProjectName(proj.name);
                }
                
                const newAssetDataMap: Record<string, any> = {};
                for (const asset of assets) {
                    const [
                        { data: unifiedData },
                        { data: tasksData },
                        { data: risksData },
                        { data: costsData },
                        { data: replacementData },
                        { data: sparesData },
                        { data: ltData },
                        { data: aiData },
                        { data: fmeaDirect },
                        { data: cbmCurvesData },
                        { data: faultsData },
                        { data: componentsData }
                    ] = await Promise.all([
                        supabase.from('v_fmea_logic_tree_report').select('*').eq('asset_id', asset.id),
                        supabase.from('tasks').select('*').eq('asset_id', asset.id),
                        supabase.from('risks').select('*').eq('asset_id', asset.id),
                        supabase.from('costs').select('*').eq('asset_id', asset.id),
                        supabase.from('replacements').select('*').eq('asset_id', asset.id),
                        supabase.from('spares').select('*').eq('asset_id', asset.id),
                        supabase.from('logic_tree').select('id, failure_mode_id, strategy_code, strategy, task_description, last_updated, fmea:failure_mode_id(id, component, failure_mode, component_id, components(id, name))').eq('asset_id', asset.id).order('last_updated', { ascending: false }),
                        supabase.from('ai_interval_results').select('id, failure_mode_id, asset_id, recommended_interval, interval_unit, created_at').eq('asset_id', asset.id).order('created_at', { ascending: false }),
                        supabase.from('fmea').select('*, components(name)').eq('asset_id', asset.id).order('created_at', { ascending: true }),
                        supabase.from('cbm_curves').select('*').eq('asset_id', asset.id),
                        supabase.from('faults').select('*').eq('asset_id', asset.id),
                        supabase.from('components').select('*').eq('asset_id', asset.id)
                    ]);

                    // Build a component-name lookup from the direct fmea query (which joins components table)
                    const componentNameMap: Record<string, string> = {};
                    (fmeaDirect || []).forEach((item: any) => {
                        const resolvedName = item.components?.name || item.component || '';
                        if (item.id && resolvedName) componentNameMap[item.id] = resolvedName;
                    });
                    
                    const componentsMap: Record<string, string> = {};
                    (componentsData || []).forEach((c: any) => {
                        componentsMap[c.id] = c.name;
                    });
                    
                    newAssetDataMap[asset.id] = {
                        fmea: (fmeaDirect || []).map((item: any) => ({
                            id: item.id,
                            component: item.components?.name || item.component || 'Unknown',
                            failureMode: item.failure_mode,
                            failureCause: item.failure_cause,
                            failureEffect: item.failure_effect,
                            severity: item.severity,
                            occurrence: item.occurrence,
                            detection: item.detection,
                            rpn: item.rpn,
                            riskLevel: item.risk_level
                        })),
                        tasks: (tasksData || []).map(item => ({
                            id: item.id,
                            taskName: item.task_name,
                            assetName: item.asset_name,
                            taskType: item.task_type,
                            priority: item.priority,
                            status: item.status,
                            assignedTo: item.assigned_to,
                            dueDate: item.due_date,
                            estimatedDuration: item.estimated_duration,
                            description: item.description,
                            frequency: item.frequency,
                            lastCompleted: item.last_completed,
                            completionPercentage: item.completion_percentage
                        })),
                        risks: (risksData || []).map(item => ({
                            id: item.id,
                            risk: item.risk_description,
                            category: item.category,
                            level: item.level,
                            mitigation: item.mitigation,
                            severity: item.severity,
                            occurrence: item.occurrence,
                            detection: item.detection,
                            rpn: item.rpn
                        })),
                        costs: (costsData || []).map(item => ({
                            id: item.id,
                            equipmentName: item.equipment_name,
                            downtimeCostPerHour: item.downtime_cost_rate,
                            repairCost: item.failure_cost,
                            replacementCost: item.acquisition_cost,
                            costPerFailure: item.failure_cost
                        })),
                        replacement: (replacementData || []).map(item => ({
                            id: item.id,
                            equipment: item.equipment,
                            tagNumber: item.tag_number,
                            currentAge: item.current_age,
                            shapeParameter: item.shape_parameter,
                            scaleParameter: item.scale_parameter,
                            plannedReplacementCost: item.planned_replacement_cost,
                            unplannedFailureCost: item.unplanned_failure_cost,
                            optimumTime: item.optimum_time,
                            minCPUT: item.min_cput,
                            status: item.status
                        })),
                        spares: (sparesData || []).map(item => ({
                            id: item.id,
                            name: item.part_name,
                            partNumber: item.part_number,
                            quantity: item.quantity,
                            unitCost: item.cost,
                            location: item.supplier,
                            reorderPoint: item.min_quantity
                        })),
                        logicTree: (unifiedData || []).filter(item => item.logic_tree_id != null).map(item => {
                            // Resolve component name from direct fmea query
                            const resolvedComponent = componentNameMap[item.failure_mode_id] || item.component || 'N/A';
                            return {
                                id: item.logic_tree_id,
                                failureModeId: item.failure_mode_id,
                                component: resolvedComponent,
                                failureMode: item.failure_mode,
                                hiddenConsequence: item.hidden_consequence,
                                criticalRisk: item.critical_risk,
                                operationalRisk: item.operational_risk,
                                financialRisk: item.financial_risk,
                                cbmFeasibility: item.cbm_feasibility,
                                tbmFeasibility: item.tbm_feasibility,
                                strategy: item.strategy,
                                strategyCode: item.strategy_code,
                                taskDescription: item.task_description,
                                frequency: item.frequency
                            };
                        }),
                        cbmCurves: (cbmCurvesData || []).map((c: any) => ({
                            id: c.id,
                            componentName: c.component_name,
                            pDays: c.p_days,
                            fDays: c.f_days,
                            date0: c.date0,
                            dateP: c.date_p,
                            dateF: c.date_f,
                        })),
                        faults: (faultsData || []).map((f: any) => ({
                            id: f.id,
                            componentName: componentsMap[f.component_id] || f.description?.split(': ')[0] || 'Unknown',
                            failedAtTime: f.failed_at_time,
                            date: f.date
                        })),
                        // ── Live-aggregated Maintenance Tasks (same logic as ComprehensiveMaintenanceTasks) ──
                        maintenanceTasks: (() => {
                            // 1. Build AI interval lookup: failure_mode_id → interval string (newest first)
                            const aiByFmea: Record<string, string> = {};
                            for (const r of (aiData || [])) {
                                if (r.failure_mode_id && !aiByFmea[r.failure_mode_id]) {
                                    aiByFmea[r.failure_mode_id] = `${r.recommended_interval} ${r.interval_unit}`.trim();
                                }
                            }
                            // 2. Map Logic Tree rows → task rows
                            const ltRows = (ltData || []).map((lt: any) => {
                                const fmea = Array.isArray(lt.fmea) ? lt.fmea[0] : lt.fmea;
                                const compRef = Array.isArray(fmea?.components) ? fmea.components[0] : fmea?.components;
                                const compName = compRef?.name || fmea?.component || componentNameMap[lt.failure_mode_id] || 'Unknown Component';
                                const failMode = fmea?.failure_mode || '—';
                                const taskType = lt.strategy_code || 'PM';
                                const taskName = lt.task_description?.trim()
                                    ? lt.task_description
                                    : (lt.strategy_code ? `${lt.strategy_code} Task` : 'Maintenance Task');
                                const interval = aiByFmea[lt.failure_mode_id] || 'Pending';
                                return {
                                    dedupKey: `${asset.id}|${lt.failure_mode_id || compName}|${taskType}`,
                                    componentName: compName,
                                    taskName,
                                    failureMode: failMode,
                                    taskType,
                                    assignedInterval: interval,
                                    lastUpdated: lt.last_updated || new Date().toISOString(),
                                };
                            });
                            // 3. Map Replacements → RR task rows
                            const rrRows = (replacementData || []).map((r: any) => {
                                const tOpt = r.optimum_time;
                                const interval = (!tOpt || Number(tOpt) > 1e9)
                                    ? 'RTF (Run-To-Failure)'
                                    : `${Math.round(Number(tOpt))} h`;
                                return {
                                    dedupKey: `${asset.id}|RR|${r.equipment || 'Unknown'}`,
                                    componentName: r.equipment || 'Unknown Component',
                                    taskName: 'Scheduled Replacement',
                                    failureMode: '—',
                                    taskType: 'RR',
                                    assignedInterval: interval,
                                    lastUpdated: r.updated_at || r.created_at,
                                };
                            });
                            // 4. Merge & deduplicate (LT priority > RR)
                            const seen = new Set<string>();
                            const merged = [...ltRows, ...rrRows].filter(row => {
                                if (seen.has(row.dedupKey)) return false;
                                seen.add(row.dedupKey);
                                return true;
                            });
                            // 5. Only keep rows with a real calculated interval
                            return merged.filter(row => row.assignedInterval !== 'Pending');
                        })()
                    };
                }
                setAssetDataMap(newAssetDataMap);
            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchReportData();
    }, [assetId, projectId, user]);

    const A4_WIDTH_MM = 210;

    const handleDownloadPDF = async () => {
        const jsPDFModule = await import('jspdf');
        const html2canvasModule = await import('html2canvas');
        const jsPDF = jsPDFModule.default;
        const html2canvas = html2canvasModule.default;

        if (!reportRef.current) return;

        const pageDivs = reportRef.current.querySelectorAll<HTMLElement>('.a4-page-capture');
        if (pageDivs.length === 0) return;

        const pdf = new jsPDF('p', 'mm', 'a4');
        const A4_HEIGHT_MM = 297;

        for (let i = 0; i < pageDivs.length; i++) {
            const pageDiv = pageDivs[i];

            const canvas = await html2canvas(pageDiv, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
            });

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = A4_WIDTH_MM;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= A4_HEIGHT_MM;

            while (heightLeft > 0) {
                position -= A4_HEIGHT_MM;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= A4_HEIGHT_MM;
            }
        }

        const pdfBlob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(blobUrl);
    };

    const handleDownloadWord = () => {
        let sectionsHtml = '';

        targetAssets.forEach((asset, idx) => {
            const assetData = assetDataMap[asset.id] || {};
            const fmeaData = assetData.fmea || [];
            const tasksData = assetData.tasks || [];
            const risksData = assetData.risks || [];
            const costsData = assetData.costs || [];
            const replacementData = assetData.replacement || [];
            const sparesData = assetData.spares || [];

            const logicTreeMapped = (assetData.logicTree || []).map((lt: any) => {
                const fmea = fmeaData.find((f: any) => f.id === lt.failureModeId) || {};
                return { ...lt, component: fmea.component || 'N/A', failureMode: fmea.failureMode || 'N/A' };
            });

            sectionsHtml += `
                ${idx > 0 ? '<br clear="all" style="page-break-before:always" />' : ''}
                <div class="Section1">
                    <h1 style="color: #1a7ab8; padding-bottom: 5px;">Asset: ${asset.equipment_name}</h1>
                    <h2>Asset Data</h2>
                    <table>
                        <tr>
                            <th>Tag Number</th>
                            <th>System</th>
                            <th>Manufacturer</th>
                            <th>Model</th>
                            <th>Criticality Level</th>
                            <th>Installation Date</th>
                            <th>Operating Hours/Day</th>
                        </tr>
                        <tr>
                            <td>${asset.tag_number || asset.tagNumber || 'N/A'}</td>
                            <td>${asset.system || 'N/A'}</td>
                            <td>${asset.manufacturer || 'N/A'}</td>
                            <td>${asset.model || 'N/A'}</td>
                            <td>${asset.criticality_level || 'N/A'}</td>
                            <td>${asset.installation_date || 'N/A'}</td>
                            <td>${asset.operating_hours_per_day || 'N/A'}</td>
                        </tr>
                    </table>
            `;

            if (asset.specifications) {
                sectionsHtml += `
                    <h2>Asset Specifications</h2>
                    <p>${asset.specifications}</p>
                `;
            }

            if (assetData.faults && assetData.faults.length > 0) {
                sectionsHtml += `
                    <h2>History of Failures</h2>
                    <table>
                        <tr>
                            <th>Component</th>
                            <th>Failed at Time (Hours)</th>
                            <th>Date</th>
                        </tr>
                        ${assetData.faults.map((f: any) => `
                        <tr>
                            <td>${f.componentName}</td>
                            <td>${f.failedAtTime}</td>
                            <td>${new Date(f.date).toLocaleDateString()}</td>
                        </tr>`).join('')}
                    </table>
                `;
            }

            if (assetData.spares && assetData.spares.length > 0) {
                sectionsHtml += `
                    <h2>Spare Parts List</h2>
                    <table>
                        <tr>
                            <th>Part Name</th>
                            <th>Part Number</th>
                            <th>Quantity</th>
                            <th>Unit Cost</th>
                            <th>Location/Supplier</th>
                        </tr>
                        ${assetData.spares.map((s: any) => `
                        <tr>
                            <td>${s.name}</td>
                            <td>${s.partNumber}</td>
                            <td>${s.quantity}</td>
                            <td>$${s.unitCost}</td>
                            <td>${s.location || '-'}</td>
                        </tr>`).join('')}
                    </table>
                `;
            }

            if (fmeaData.length > 0) {
                sectionsHtml += `
                    <h2>FMEA Analysis — Failure Modes</h2>
                    <table>
                        <tr>
                            <th>Component</th>
                            <th>Failure Mode</th>
                            <th>Cause</th>
                            <th>Effect</th>
                        </tr>
                        ${fmeaData.map((row: any) => `
                        <tr>
                            <td>${row.component}</td>
                            <td>${row.failureMode}</td>
                            <td>${row.failureCause}</td>
                            <td>${row.failureEffect}</td>
                        </tr>`).join('')}
                    </table>
                    <h2>FMEA Analysis — Risk Ratings</h2>
                    <table>
                        <tr>
                            <th>Failure Mode</th>
                            <th>S</th>
                            <th>O</th>
                            <th>D</th>
                            <th>RPN</th>
                            <th>Risk Level</th>
                        </tr>
                        ${fmeaData.map((row: any) => `
                        <tr>
                            <td>${row.failureMode}</td>
                            <td>${row.severity}</td>
                            <td>${row.occurrence}</td>
                            <td>${row.detection}</td>
                            <td>${row.rpn}</td>
                            <td style="color: ${row.riskLevel === 'Critical' ? '#DC2626' : row.riskLevel === 'High' ? '#EA580C' : row.riskLevel === 'Moderate' ? '#EAB308' : '#16A34A'}; font-weight: bold;">${row.riskLevel}</td>
                        </tr>`).join('')}
                    </table>
                `;
            }

            if (logicTreeMapped.length > 0) {
                sectionsHtml += `
                    <h2>RCM Decision Logic Tree</h2>
                    <table>
                        <tr>
                            <th>Component</th>
                            <th>Failure Mode</th>
                            <th>Hidden?</th>
                            <th>Critical?</th>
                            <th>Oper.?</th>
                            <th>Finan.?</th>
                            <th>CBM?</th>
                            <th>TBM?</th>
                            <th>Strategy</th>
                        </tr>
                        ${logicTreeMapped.map((row: any) => `
                        <tr>
                            <td>${row.component}</td>
                            <td>${row.failureMode}</td>
                            <td>${row.hiddenConsequence === null ? '-' : row.hiddenConsequence ? 'Y' : 'N'}</td>
                            <td>${row.criticalRisk === null ? '-' : row.criticalRisk ? 'Y' : 'N'}</td>
                            <td>${row.operationalRisk === null ? '-' : row.operationalRisk ? 'Y' : 'N'}</td>
                            <td>${row.financialRisk === null ? '-' : row.financialRisk ? 'Y' : 'N'}</td>
                            <td>${row.cbmFeasibility === null ? '-' : row.cbmFeasibility ? 'Y' : 'N'}</td>
                            <td>${row.tbmFeasibility === null ? '-' : row.tbmFeasibility ? 'Y' : 'N'}</td>
                            <td>${row.strategyCode || 'N/A'}</td>
                        </tr>`).join('')}
                    </table>
                `;
            }

            if (tasksData.length > 0) {
                sectionsHtml += `
                    <h2>Maintenance Tasks</h2>
                    <table>
                        <tr>
                            <th>Task Name</th>
                            <th>Task Type</th>
                            <th>Frequency</th>
                            <th>Priority</th>
                            <th>Status</th>
                        </tr>
                        ${tasksData.map((row: any) => `
                        <tr>
                            <td>${row.taskName}</td>
                            <td>${row.taskType}</td>
                            <td>${row.frequency || 'N/A'}</td>
                            <td>${row.priority || 'N/A'}</td>
                            <td>${row.status || 'N/A'}</td>
                        </tr>`).join('')}
                    </table>
                `;
            }

            if (risksData.length > 0) {
                sectionsHtml += `
                    <h2>Risk Management</h2>
                    <table>
                        <tr>
                            <th>Risk</th>
                            <th>S</th>
                            <th>O</th>
                            <th>D</th>
                            <th>RPN</th>
                            <th>Level</th>
                            <th>Mitigation</th>
                        </tr>
                        ${risksData.map((row: any) => `
                        <tr>
                            <td>${row.risk}</td>
                            <td>${row.severity || ''}</td>
                            <td>${row.occurrence || ''}</td>
                            <td>${row.detection || ''}</td>
                            <td>${row.rpn || ''}</td>
                            <td>${row.level}</td>
                            <td>${row.mitigation}</td>
                        </tr>`).join('')}
                    </table>
                `;
            }

            if (costsData.length > 0) {
                sectionsHtml += `
                    <h2>Operating Costs</h2>
                    <table>
                        <tr>
                            <th>Component</th>
                            <th>Downtime $/hr</th>
                            <th>Repair Cost</th>
                            <th>Cost/Failure</th>
                        </tr>
                        ${costsData.map((c: any) => `
                        <tr>
                            <td>${c.equipmentName}</td>
                            <td>$${c.downtimeCostPerHour || ''}</td>
                            <td>$${c.repairCost || ''}</td>
                            <td>$${c.costPerFailure || ''}</td>
                        </tr>`).join('')}
                    </table>
                `;
            }

            if (replacementData.length > 0) {
                sectionsHtml += `
                    <h2>Optimal Replacement</h2>
                    <table>
                        <tr>
                            <th>Component</th>
                            <th>Current Age (h)</th>
                            <th>Optimum Time (h)</th>
                            <th>Min CPUT</th>
                            <th>Status</th>
                        </tr>
                        ${replacementData.map((r: any) => `
                        <tr>
                            <td>${r.equipment}</td>
                            <td>${r.currentAge || ''}</td>
                            <td>${r.optimumTime === Infinity ? 'RTF' : (r.optimumTime || '')}</td>
                            <td>${r.minCPUT ? r.minCPUT.toFixed(3) : ''}</td>
                            <td>${r.status}</td>
                        </tr>`).join('')}
                    </table>
                `;
            }

            if (sparesData.length > 0) {
                sectionsHtml += `
                    <h2>Spare Parts</h2>
                    <table>
                        <tr>
                            <th>Part Name</th>
                            <th>Part Number</th>
                            <th>Quantity</th>
                            <th>Unit Cost</th>
                        </tr>
                        ${sparesData.map((row: any) => `
                        <tr>
                            <td>${row.name}</td>
                            <td>${row.partNumber}</td>
                            <td>${row.quantity}</td>
                            <td>$${row.unitCost}</td>
                        </tr>`).join('')}
                    </table>
                `;
            }

            // ── Maintenance Tasks (from Maintenance Plan) ──────────────────────
            if (tasksData.length > 0) {
                sectionsHtml += `
                    <h2>Maintenance Tasks</h2>
                    <table>
                        <tr>
                            <th>Task Name</th>
                            <th>Type</th>
                            <th>Frequency</th>
                            <th>Priority</th>
                            <th>Status</th>
                        </tr>
                        ${tasksData.map((r: any) => `
                        <tr>
                            <td>${r.taskName}</td>
                            <td style="font-weight:bold;color:#1a7ab8">${r.taskType}</td>
                            <td>${r.frequency || 'N/A'}</td>
                            <td>${r.priority || 'N/A'}</td>
                            <td>${r.status || 'N/A'}</td>
                        </tr>`).join('')}
                    </table>
                `;
            }

            sectionsHtml += `</div>`;
        });

        const htmlContent = `
<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta charset="UTF-8">
    <title>${reportName}</title>
    <style>
        @page { size: 210mm 297mm; margin: 25mm 20mm 25mm 20mm; mso-page-orientation: portrait; }
        @page Section1 { size: 210mm 297mm; margin: 25mm 20mm 25mm 20mm; mso-page-orientation: portrait; }
        div.Section1 { page: Section1; }
        body { font-family: 'Calibri', sans-serif; line-height: 1.6; margin: 0; padding: 0; }
        h1 { color: #1a7ab8; border-bottom: 2px solid #1a7ab8; padding-bottom: 10px; }
        h2 { color: #333; margin-top: 30px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px 8px; text-align: left; }
        th { background-color: #1a7ab8; color: white; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        .success { color: #28a745; } .warning { color: #d97706; } .danger { color: #dc3545; }
    </style>
</head>
<body>
    <div class="Section1">
        <h1>${reportName}</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        <p><strong>Generated by:</strong> RCM7Q - Reliability Centered Maintenance System</p>
    </div>
    ${sectionsHtml}
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadExcel = () => {
        const assets = targetAssets;
        const fmeaData: any[] = [];
        const risksData: any[] = [];
        const costsData: any[] = [];
        const replacementData: any[] = [];
        const tasksData: any[] = [];
        const sparesData: any[] = [];
        const logicTreeExport: any[] = [];
        const cbmCurvesData: any[] = [];
        const faultsData: any[] = [];

        assets.forEach((a: any) => {
            const assetData = assetDataMap[a.id] || {};
            const f = assetData.fmea || [];
            f.forEach((row: any) => fmeaData.push({ ...row, assetName: a.equipment_name || a.equipmentName }));

            const r = assetData.risks || [];
            r.forEach((row: any) => risksData.push({ ...row, assetName: a.equipment_name || a.equipmentName }));

            const c = assetData.costs || [];
            c.forEach((row: any) => costsData.push({ ...row, assetName: a.equipment_name || a.equipmentName }));

            const repl = assetData.replacement || [];
            repl.forEach((row: any) => replacementData.push({ ...row, assetName: a.equipment_name || a.equipmentName }));

            const t = assetData.tasks || [];
            t.forEach((row: any) => tasksData.push({ ...row, assetName: a.equipment_name || a.equipmentName }));

            const sp = assetData.spares || [];
            sp.forEach((row: any) => sparesData.push({ ...row, assetName: a.equipment_name || a.equipmentName }));

            const lt = assetData.logicTree || [];
            lt.forEach((row: any) => {
                const fItem = f.find((fi: any) => fi.id === row.failureModeId) || {};
                logicTreeExport.push({ ...row, assetName: a.equipment_name || a.equipmentName, component: fItem.component || 'N/A', failureMode: fItem.failureMode || 'N/A' });
            });

            const cbm = assetData.cbmCurves || [];
            cbm.forEach((row: any) => cbmCurvesData.push({ ...row, assetName: a.equipment_name || a.equipmentName }));

            const fhs = assetData.faults || [];
            fhs.forEach((row: any) => faultsData.push({ ...row, assetName: a.equipment_name || a.equipmentName }));
        });

        const esc = (val: any) => String(val ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const makeSheet = (name: string, headers: string[], rows: string[][]) => {
            let xml = `<Worksheet ss:Name="${esc(name)}"><Table>\n`;
            xml += '<Row>';
            headers.forEach(h => {
                xml += `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`;
            });
            xml += '</Row>\n';
            rows.forEach(row => {
                xml += '<Row>';
                row.forEach((cell, i) => {
                    const isNum = !isNaN(Number(cell)) && cell !== '' && headers[i] !== 'ID' && headers[i] !== 'Tag Number';
                    xml += `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${esc(cell)}</Data></Cell>`;
                });
                xml += '</Row>\n';
            });
            xml += '</Table></Worksheet>\n';
            return xml;
        };

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<?mso-application progid="Excel.Sheet"?>\n';
        xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ';
        xml += 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
        xml += '<Styles><Style ss:ID="header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1a7ab8" ss:Pattern="Solid"/></Style></Styles>\n';

        if (assets.length > 0) {
            xml += makeSheet('Assets',
                ['Component Name', 'Tag Number', 'System', 'Manufacturer', 'Model', 'Criticality', 'Installation Date', 'Operating Hours/Day'],
                assets.map((a: any) => [
                    a.equipment_name || a.equipmentName || '',
                    a.tag_number || a.tagNumber || '',
                    a.system || '',
                    a.manufacturer || '',
                    a.model || '',
                    a.criticality_level || a.criticalityLevel || '',
                    a.installation_date || a.installationDate || '',
                    a.operating_hours_per_day || a.operatingHoursPerDay || ''
                ])
            );
        }

        if (fmeaData.length > 0) {
            xml += makeSheet('FMEA Analysis',
                ['Asset', 'Component', 'Failure Mode', 'Failure Cause', 'Failure Effect', 'Severity', 'Occurrence', 'Detection', 'RPN', 'Risk Level'],
                fmeaData.map((f: any) => [f.assetName, f.component, f.failureMode, f.failureCause, f.failureEffect, String(f.severity), String(f.occurrence), String(f.detection), String(f.rpn), f.riskLevel])
            );
        }

        if (logicTreeExport.length > 0) {
            xml += makeSheet('Logic Tree Analysis',
                ['Asset', 'Component', 'Failure Mode', 'Hidden Consequence', 'Critical Risk', 'Operational Risk', 'Financial Risk', 'CBM Feasibility', 'TBM Feasibility', 'Strategy Code'],
                logicTreeExport.map((l: any) => [
                    l.assetName, 
                    l.component, 
                    l.failureMode, 
                    l.hiddenConsequence === null ? '-' : l.hiddenConsequence ? 'Y' : 'N', 
                    l.criticalRisk === null ? '-' : l.criticalRisk ? 'Y' : 'N', 
                    l.operationalRisk === null ? '-' : l.operationalRisk ? 'Y' : 'N', 
                    l.financialRisk === null ? '-' : l.financialRisk ? 'Y' : 'N', 
                    l.cbmFeasibility === null ? '-' : l.cbmFeasibility ? 'Y' : 'N', 
                    l.tbmFeasibility === null ? '-' : l.tbmFeasibility ? 'Y' : 'N', 
                    l.strategyCode || 'N/A'
                ])
            );
        }

        if (tasksData.length > 0) {
            xml += makeSheet('Maintenance Plan',
                ['Asset', 'Frequency', 'Task Name', 'Task Type'],
                tasksData.map((t: any) => [t.assetName, t.frequency || 'N/A', t.taskName || t.name, t.taskType || t.type || ''])
            );
        }

        if (risksData.length > 0) {
            xml += makeSheet('Risk Management',
                ['Asset', 'Risk Description', 'Category', 'Severity', 'Occurrence', 'Detection', 'RPN', 'Risk Level', 'Mitigation Strategy'],
                risksData.map((r: any) => [r.assetName, r.risk, r.category || '', String(r.severity || ''), String(r.occurrence || ''), String(r.detection || ''), String(r.rpn || ''), r.level, r.mitigation])
            );
        }

        if (costsData.length > 0) {
            xml += makeSheet('Operating Costs',
                ['Asset', 'Component', 'Downtime $/hr', 'Repair Cost', 'Replacement Cost', 'Cost/Failure'],
                costsData.map((c: any) => [c.assetName, c.equipmentName, String(c.downtimeCostPerHour || ''), String(c.repairCost || ''), String(c.replacementCost || ''), String(c.costPerFailure || '')])
            );
        }

        if (replacementData.length > 0) {
            xml += makeSheet('Optimal Replacement',
                ['Asset', 'Component', 'Tag No.', 'Current Age (h)', 'β (Shape)', 'η (Scale)', 'Optimum Time', 'Min CPUT', 'Status'],
                replacementData.map((r: any) => [r.assetName, r.equipment, r.tagNumber || '', String(r.currentAge || ''), String(r.shapeParameter || ''), String(r.scaleParameter || ''), String(r.optimumTime === Infinity ? 'RTF' : (r.optimumTime || '')), String(r.minCPUT ? r.minCPUT.toFixed(3) : ''), r.status])
            );
        }

        if (cbmCurvesData.length > 0) {
            xml += makeSheet('CBM Curves Data',
                ['Asset', 'Component', 'P-Days', 'F-Days', 'Date 0', 'Date P', 'Date F'],
                cbmCurvesData.map((c: any) => [c.assetName, c.componentName, String(c.pDays || ''), String(c.fDays || ''), c.date0 || '', c.dateP || '', c.dateF || ''])
            );
        }

        if (sparesData.length > 0) {
            xml += makeSheet('Spare Parts',
                ['Asset', 'Part Name', 'Part Number', 'Quantity', 'Unit Cost', 'Location'],
                sparesData.map((s: any) => [s.assetName, s.name, s.partNumber, String(s.quantity), String(s.unitCost), s.location || ''])
            );
        }

        if (faultsData.length > 0) {
            xml += makeSheet('Fault History',
                ['Asset', 'Component', 'Failed at Time (Hours)', 'Date'],
                faultsData.map((f: any) => [f.assetName, f.componentName, String(f.failedAtTime || ''), f.date ? new Date(f.date).toLocaleDateString() : 'N/A'])
            );
        }

        xml += '</Workbook>';

        const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const a4PageStyle: React.CSSProperties = {
        background: 'white',
        borderRadius: '2px',
        width: '210mm',
        minHeight: '297mm',
        maxWidth: '100%',
        margin: '0 auto',
        padding: '20mm 15mm',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        color: '#1a1a1a',
        direction: 'ltr',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
    };

    return (
        <>
            <style>{`
                @media print {
                    @page { size: A4; margin: 15mm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .a4-page-capture { width: 210mm !important; min-height: 297mm !important; padding: 0 !important; box-shadow: none !important; page-break-after: always; }
                }
            `}</style>
            <Sidebar />
            <PageContainer>
                <div className="container" style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'stretch' : 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-xl)',
                        position: 'sticky',
                        top: 0,
                        background: 'var(--bg-primary)',
                        zIndex: 10,
                        padding: 'var(--spacing-md) 0'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                            <button onClick={() => navigate(-1)} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}>
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 style={{ fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)', marginBottom: 'var(--spacing-xs)' }}>
                                    {t('reports.preview')}
                                </h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                    {reportName} {targetAssets.length > 0 ? `(${targetAssets.length} Assets)` : ''}
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <Download size={18} />
                                {t('reports.generatePdf')}
                            </button>
                            <button className="btn" onClick={handleDownloadWord} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', background: 'linear-gradient(135deg, #2b5797 0%, #1e3c6e 100%)', border: 'none', color: 'white' }}>
                                <FileEdit size={18} /> Word
                            </button>
                            <button className="btn" onClick={handleDownloadExcel} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', background: 'linear-gradient(135deg, #217346 0%, #175432 100%)', border: 'none', color: 'white' }}>
                                <FileSpreadsheet size={18} /> Excel
                            </button>
                        </div>
                    </div>

                    <div ref={reportRef} style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-3xl)', color: 'var(--text-tertiary)' }}>
                                <div className="animate-pulse" style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>Loading report data...</div>
                            </div>
                        ) : targetAssets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-3xl)', color: 'var(--text-tertiary)' }}>
                                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>No assets found.</div>
                            </div>
                        ) : targetAssets.map((asset) => {
                            const assetData = assetDataMap[asset.id] || {};
                            const fmeaData = assetData.fmea || [];
                            const tasksData = assetData.tasks || [];
                            const risksData = assetData.risks || [];
                            const costsData = assetData.costs || [];
                            const replacementData = assetData.replacement || [];
                            const cbmCurves = assetData.cbmCurves || [];
                            const maintTasks = assetData.maintenanceTasks || [];

                            // logicTree data already has component & failureMode resolved from fetch
                            const logicTreeMapped = assetData.logicTree || [];

                            return (
                                <div key={asset.id} className="a4-page-capture" style={a4PageStyle}>
                                    {/* Project Name Header */}
                                    {projectName && (
                                        <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                                            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Project: {projectName}</span>
                                        </div>
                                    )}
                                    <div style={{ paddingBottom: '20px', marginBottom: '28px' }}>
                                        <h1 style={{ color: '#1a7ab8', fontSize: '28px', margin: 0, marginBottom: '20px' }}>
                                            {asset.equipment_name}
                                        </h1>
                                        
                                        <h2 style={{ color: '#333', fontSize: '20px', marginBottom: '16px' }}>
                                            Asset Data
                                        </h2>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                            <thead>
                                                <tr style={{ background: '#333', color: 'white' }}>
                                                    <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Tag Number</th>
                                                    <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>System</th>
                                                    <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Manufacturer</th>
                                                    <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Model</th>
                                                    <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Criticality</th>
                                                    <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Install Date</th>
                                                    <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>Hours/Day</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr style={{ borderBottom: '1px solid #ddd' }}>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{asset.tag_number || 'N/A'}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{asset.system || 'N/A'}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{asset.manufacturer || 'N/A'}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{asset.model || 'N/A'}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{asset.criticality_level || 'N/A'}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{asset.installation_date || 'N/A'}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{asset.operating_hours_per_day || 'N/A'}</td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        {/* Asset Specifications */}
                                        {asset.specifications && (
                                            <div style={{ marginTop: '20px', padding: '14px 16px', background: '#f0f7ff', border: '1px solid #bdd7ee', borderRadius: '6px' }}>
                                                <h3 style={{ color: '#1a7ab8', fontSize: '15px', margin: '0 0 8px', fontWeight: 700 }}>Asset Specifications</h3>
                                                <p style={{ margin: 0, fontSize: '12px', color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{asset.specifications}</p>
                                            </div>
                                        )}

                                        {/* Failure History */}
                                        {assetData.faults && assetData.faults.length > 0 && (
                                            <div style={{ marginTop: '20px' }}>
                                                <h3 style={{ color: '#eab308', fontSize: '15px', margin: '0 0 8px', fontWeight: 700 }}>History of Failures</h3>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                    <thead>
                                                        <tr style={{ background: '#fef08a', color: '#854d0e' }}>
                                                            <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Component</th>
                                                            <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>Failed at Time (Hours)</th>
                                                            <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {assetData.faults.map((f: any, idx: number) => (
                                                            <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                                                                <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{f.componentName}</td>
                                                                <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{f.failedAtTime}</td>
                                                                <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{f.date ? new Date(f.date).toLocaleDateString() : 'N/A'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {/* Spare Parts List */}
                                        {assetData.spares && assetData.spares.length > 0 && (
                                            <div style={{ marginTop: '20px' }}>
                                                <h3 style={{ color: '#8b5cf6', fontSize: '15px', margin: '0 0 8px', fontWeight: 700 }}>Spare Parts List</h3>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                    <thead>
                                                        <tr style={{ background: '#ddd6fe', color: '#4c1d95' }}>
                                                            <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Part Name</th>
                                                            <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Part Number</th>
                                                            <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>Quantity</th>
                                                            <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>Unit Cost</th>
                                                            <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Location/Supplier</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {assetData.spares.map((s: any, idx: number) => (
                                                            <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                                                                <td style={{ padding: '8px 6px', border: '1px solid #ddd', fontWeight: 600 }}>{s.name}</td>
                                                                <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{s.partNumber}</td>
                                                                <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{s.quantity}</td>
                                                                <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>${s.unitCost}</td>
                                                                <td style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>{s.location || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Optimal Replacement First */}
                                    {replacementData.length > 0 && (<>
                                    <h2 style={{ color: '#333', fontSize: '20px', marginBottom: '16px', marginTop: '20px' }}>
                                        Optimal Replacement
                                    </h2>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ background: '#1ab85a', color: 'white' }}>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Component</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>Current Age (h)</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>Optimum Time (h)</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>Min CPUT</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {replacementData.map((row: any, r: number) => (
                                                <tr key={r} style={{ borderBottom: '1px solid #ddd' }}>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{row.equipment}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{row.currentAge}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{row.optimumTime === Infinity ? 'RTF' : row.optimumTime}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{row.minCPUT ? `$${row.minCPUT.toFixed(3)}/h` : ''}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{row.status}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* CPUT Curves for each component */}
                                    {replacementData.map((comp: any, ci: number) => {
                                        const beta = Number(comp.shapeParameter);
                                        const eta = Number(comp.scaleParameter);
                                        const Cp = Number(comp.plannedReplacementCost);
                                        const Cu = Number(comp.unplannedFailureCost);
                                        if (!beta || !eta || !Cp || !Cu) return null;
                                        const curve = generateCPUTCurve(Cp, Cu, beta, eta);
                                        const pts = curve.points;
                                        const rtf = curve.optimumTime === Infinity;
                                        if (pts.length === 0) return null;
                                        const minVal = Math.min(...pts.map(p => p.cput));
                                        const capCPUT = minVal * 4;
                                        const valid = pts.filter(p => p.cput <= capCPUT);
                                        if (valid.length === 0) return null;
                                        const maxT = Math.max(...valid.map(p => p.t));
                                        const W = 520, H = 200;
                                        let minX = 0, minY = H;
                                        const pathD = valid.map((p, i) => {
                                            const x = (p.t / maxT) * W;
                                            const y = H - (p.cput / capCPUT) * H;
                                            if (p.cput <= minVal * 1.01) { minX = x; minY = y; }
                                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                                        }).join(' ');
                                        return (
                                            <div key={`cput-${ci}`} style={{ marginTop: '20px', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fafafa' }}>
                                                <h3 style={{ color: '#7c3aed', fontSize: '14px', margin: '0 0 4px', fontWeight: 700 }}>CPUT Curve: {comp.equipment}</h3>
                                                <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#6b7280' }}>
                                                    Optimum: {rtf ? 'Run-To-Failure' : `${curve.optimumTime.toFixed(0)} h`} | Min CPUT: ${curve.minCPUT.toFixed(3)}/h | β={beta} | η={eta}
                                                </p>
                                                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="200" style={{ overflow: 'visible' }} preserveAspectRatio="none">
                                                    <line x1="0" y1={H/3} x2={W} y2={H/3} stroke="#e5e7eb" strokeDasharray="4 4" />
                                                    <line x1="0" y1={H*2/3} x2={W} y2={H*2/3} stroke="#e5e7eb" strokeDasharray="4 4" />
                                                    <path d={pathD} fill="none" stroke="#7c3aed" strokeWidth="2.5" />
                                                    {!rtf && <><line x1={minX} y1={minY} x2={minX} y2={H} stroke="#7c3aed" strokeDasharray="4 4" strokeWidth="1" opacity="0.5" />
                                                    <circle cx={minX} cy={minY} r="4" fill="#7c3aed" stroke="#fff" strokeWidth="2" /></>}
                                                </svg>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                                                    <span>0h</span><span>Replacement Interval (t)</span><span>{maxT.toFixed(0)}h</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    </>)}

                                    {/* FMEA — Table 1: Failure Mode Descriptions */}
                                    {fmeaData.length > 0 && (<>
                                    <h2 style={{ color: '#333', fontSize: '20px', marginBottom: '16px', marginTop: '30px' }}>
                                        FMEA Analysis — Failure Modes
                                    </h2>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ background: '#1a7ab8', color: 'white' }}>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Component</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Failure Mode</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Cause</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Effect</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fmeaData.map((row: any, r: number) => (
                                                <tr key={r} style={{ borderBottom: '1px solid #ddd', background: r % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                                                    <td style={{ padding: '7px 6px', border: '1px solid #ddd', fontWeight: 600 }}>{row.component}</td>
                                                    <td style={{ padding: '7px 6px', border: '1px solid #ddd' }}>{row.failureMode}</td>
                                                    <td style={{ padding: '7px 6px', border: '1px solid #ddd' }}>{row.failureCause}</td>
                                                    <td style={{ padding: '7px 6px', border: '1px solid #ddd' }}>{row.failureEffect}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* FMEA — Table 2: Risk Ratings */}
                                    <h2 style={{ color: '#333', fontSize: '20px', marginBottom: '16px', marginTop: '30px' }}>
                                        FMEA Analysis — Risk Ratings
                                    </h2>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ background: '#1a7ab8', color: 'white' }}>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Failure Mode</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd', width: '50px' }}>S</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd', width: '50px' }}>O</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd', width: '50px' }}>D</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd', width: '60px' }}>RPN</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>Risk Level</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fmeaData.map((row: any, r: number) => {
                                                const rl = row.rpn >= 200 ? 'Critical'
                                                    : row.rpn >= 100 ? 'High'
                                                    : row.rpn >= 50 ? 'Moderate'
                                                    : 'Low';
                                                const riskFg = rl === 'Critical' ? '#DC2626'
                                                    : rl === 'High' ? '#EA580C'
                                                    : rl === 'Moderate' ? '#EAB308'
                                                    : '#16A34A';
                                                const riskBg = rl === 'Critical' ? '#fee2e2'
                                                    : rl === 'High' ? '#ffedd5'
                                                    : rl === 'Moderate' ? '#fef3c7'
                                                    : '#dcfce7';
                                                return (
                                                    <tr key={r} style={{ borderBottom: '1px solid #ddd', background: r % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                                                        <td style={{ padding: '7px 6px', border: '1px solid #ddd', fontWeight: 600 }}>{row.failureMode}</td>
                                                        <td style={{ padding: '7px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{row.severity}</td>
                                                        <td style={{ padding: '7px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{row.occurrence}</td>
                                                        <td style={{ padding: '7px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{row.detection}</td>
                                                        <td style={{ padding: '7px 6px', textAlign: 'center', border: '1px solid #ddd', color: '#000000', fontWeight: 700 }}>{row.rpn}</td>
                                                        <td style={{ padding: '7px 6px', textAlign: 'center', border: '1px solid #ddd' }}>
                                                            <span style={{ background: riskBg, color: riskFg, padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>{rl}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    </>)}

                                    {/* Logic Tree Next */}
                                    {logicTreeMapped.length > 0 && (<>
                                    <h2 style={{ color: '#333', fontSize: '20px', marginBottom: '16px', marginTop: '30px' }}>
                                        RCM Decision Logic Tree
                                    </h2>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ background: '#b81a7a', color: 'white' }}>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Component</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Failure Mode</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }} title="Hidden Consequence">H</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }} title="Critical Risk">C</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }} title="Operational Risk">O</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }} title="Financial Risk">F</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }} title="CBM Feasible">CBM?</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }} title="TBM Feasible">TBM?</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>Strategy</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {logicTreeMapped.map((row: any, r: number) => (
                                                <tr key={r} style={{ borderBottom: '1px solid #ddd' }}>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{row.component}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{row.failureMode}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{row.hiddenConsequence === null ? '-' : row.hiddenConsequence ? 'Y' : 'N'}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{row.criticalRisk === null ? '-' : row.criticalRisk ? 'Y' : 'N'}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{row.operationalRisk === null ? '-' : row.operationalRisk ? 'Y' : 'N'}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{row.financialRisk === null ? '-' : row.financialRisk ? 'Y' : 'N'}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{row.cbmFeasibility === null ? '-' : row.cbmFeasibility ? 'Y' : 'N'}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd' }}>{row.tbmFeasibility === null ? '-' : row.tbmFeasibility ? 'Y' : 'N'}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 'bold' }}>{row.strategyCode || 'N/A'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* PF Curves for CBM Failure Modes */}
                                    {(() => {
                                        const cbmModes = logicTreeMapped.filter((lt: any) => lt.strategyCode === 'CBM');
                                        if (cbmModes.length === 0) return null;
                                        return cbmModes.map((lt: any, ci: number) => {
                                            const curve = cbmCurves.find((c: any) =>
                                                c.componentName?.toLowerCase() === lt.component?.toLowerCase()
                                            );
                                            if (!curve || !curve.pDays || !curve.fDays) return null;
                                            const pf = generatePFCurvePoints(curve.pDays, curve.fDays);
                                            const W = 520, H = 180;
                                            const pathD = pf.points.map((p: any, i: number) => {
                                                const x = (p.time / pf.fTime) * W;
                                                const y = H - (p.condition / 100) * H;
                                                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                                            }).join(' ');
                                            const pX = (pf.pTime / pf.fTime) * W;
                                            const pY = H - (pf.pCondition / 100) * H;
                                            const fX = W;
                                            const fY = H;
                                            return (
                                                <div key={`pf-${ci}`} style={{ marginTop: '20px', padding: '16px', border: '1px solid #d1fae5', borderRadius: '8px', background: '#f0fdf4' }}>
                                                    <h3 style={{ color: '#065f46', fontSize: '14px', margin: '0 0 4px', fontWeight: 700 }}>P-F Curve: {lt.component} — {lt.failureMode}</h3>
                                                    <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#6b7280' }}>
                                                        P-F Interval: {pf.intervalDays} Days | Unit: {pf.unit}
                                                    </p>
                                                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="180" style={{ overflow: 'visible' }} preserveAspectRatio="none">
                                                        <rect x={pX} y="0" width={fX - pX} height={H} fill="#10b981" fillOpacity="0.08" />
                                                        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="3" />
                                                        <circle cx="0" cy="0" r="5" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
                                                        <text x="8" y="-4" fill="#3b82f6" fontSize="9" fontWeight="700">A: Start</text>
                                                        <circle cx={pX} cy={pY} r="5" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
                                                        <text x={pX + 6} y={pY - 6} fill="#f59e0b" fontSize="9" fontWeight="700">P: Potential Failure</text>
                                                        <circle cx={fX} cy={fY} r="5" fill="#ef4444" stroke="#fff" strokeWidth="2" />
                                                        <text x={fX - 80} y={fY - 8} fill="#ef4444" fontSize="9" fontWeight="700">F: Failure</text>
                                                    </svg>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                                                        <span>Installation</span><span>Time ({pf.unit})</span><span>{pf.fTime.toFixed(1)} {pf.unit}</span>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                    </>)}

                                    {/* Risk Third */}
                                    {risksData.length > 0 && (<>
                                    <h2 style={{ color: '#333', fontSize: '20px', marginBottom: '16px', marginTop: '30px' }}>
                                        Risk Management
                                    </h2>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ background: '#b85a1a', color: 'white' }}>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Risk</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Level</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Mitigation</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {risksData.map((row: any, r: number) => (
                                                <tr key={r} style={{ borderBottom: '1px solid #ddd' }}>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{row.risk}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{row.level}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{row.mitigation}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    </>)}


                                    
                                    {/* Operating Costs Last */}
                                    {costsData.length > 0 && (<>
                                    <h2 style={{ color: '#333', fontSize: '20px', marginBottom: '16px', marginTop: '30px' }}>
                                        Operating Costs
                                    </h2>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ background: '#5a1ab8', color: 'white' }}>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Component</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Downtime $/hr</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Repair Cost</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Cost/Failure</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {costsData.map((row: any, r: number) => (
                                                <tr key={r} style={{ borderBottom: '1px solid #ddd' }}>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{row.equipmentName}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>${row.downtimeCostPerHour}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>${row.repairCost}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>${row.costPerFailure}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    </>)}

                                    {/* Comprehensive Maintenance Tasks — live-aggregated from logic_tree + AI + replacements */}
                                    {maintTasks.length > 0 && (<>
                                    <h2 style={{ color: '#333', fontSize: '20px', marginBottom: '16px', marginTop: '30px' }}>
                                        Comprehensive Maintenance Tasks
                                    </h2>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ background: '#0f5f8f', color: 'white' }}>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd', width: '30px' }}>#</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Component</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Task Name</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #ddd' }}>Failure Mode</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd', width: '70px' }}>Type</th>
                                                <th style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd', width: '140px' }}>Assigned Interval</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {maintTasks.map((row: any, idx: number) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #ddd', background: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd', color: '#9ca3af', fontWeight: 600 }}>{idx + 1}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd', fontWeight: 600 }}>{row.componentName || 'N/A'}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{row.taskName || 'N/A'}</td>
                                                    <td style={{ padding: '8px 6px', border: '1px solid #ddd', color: '#6b7280', fontStyle: row.failureMode === '—' ? 'italic' : 'normal' }}>{row.failureMode || '—'}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 700, color: '#1a7ab8' }}>{row.taskType || 'N/A'}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 700, color: '#10b981' }}>{row.assignedInterval || 'N/A'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    </>)}


                                </div>

                            );
                        })}
                    </div>
                </div>
            </PageContainer>
        </>
    );
}
