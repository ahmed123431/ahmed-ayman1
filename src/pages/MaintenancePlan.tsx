import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import GlobalSearch from '../components/GlobalSearch';
import AssetSelector from '../components/AssetSelector';
import ComprehensiveMaintenanceTasks from '../components/ComprehensiveMaintenanceTasks';
import { useLanguage } from '../contexts/LanguageContext';
import { useSidebar } from '../contexts/SidebarContext';
import {
    ClipboardList, AlertTriangle, ChevronRight, ChevronUp,
    Calendar, Clock, CheckCircle, Wrench, Settings,
    Cpu, Activity, Eye, RefreshCw, RotateCcw, Loader2, Send, X,
    Calculator, Sparkles, ShieldCheck, FileText, Brain, Save, ExternalLink
} from 'lucide-react';
import { useAssetContext } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

// ========================================
// Types
// ========================================

interface Asset {
    id: string;
    equipment_name: string;
    tag_number: string;
    quantity?: number;
    system: string;
    manufacturer: string;
    specifications?: string;
    status?: string;
    model?: string;
    criticality_level?: 'High' | 'Medium' | 'Low';
    installation_date?: string;
    operating_hours_per_day?: number;
    projectId?: string;
}

interface FMEAItem {
    id: string;
    component: string;
    failureMode: string;
    failureCause: string;
    failureEffect: string;
    severity: number;
    occurrence: number;
    detection: number;
    rpn: number;
    riskLevel: string;
}



interface CostItem {
    id: string;
    equipmentName: string;
    downtimeCostPerHour: number;
    repairCost: number;
    replacementCost: number;
    sparePartsCost: number;
    laborCostPerHour: number;
    operatingHoursPerDay: number;
    operatingCostPerHour: number;
    annualOperatingCost: number;
    annualMaintenanceCost: number;
    costPerFailure: number;
}



interface MaintenanceTaskItem {
    id: string;
    taskName: string;
    assetName: string;
    taskType: string;
    priority: string;
    status: string;
    assignedTo: string;
    dueDate: string;
    estimatedDuration: number;
    description: string;
    frequency: string;
    lastCompleted: string;
    completionPercentage: number;
}

interface AIIntervalResult {
    // ── Database identity ──────────────────────────────────────────────────────
    id?: string;
    created_at?: string;           // timestamp kept for audit, NOT used as label

    // ── Targeting context (primary identifiers) ────────────────────────────────
    // These fields are the canonical label for each result.
    // A result is identified by its failure mode, not by its date.
    component_id?: string;
    component_name?: string;     // e.g. "Bearing"
    failure_mode_id?: string;
    failure_mode?: string;     // e.g. "Bearing Seizure" — PRIMARY LABEL

    // ── AI output ─────────────────────────────────────────────────────────────
    recommended_interval: string;
    interval_unit: string;
    data_confidence: string;
    recommended_action: string;
    justification_summary: string;
}

// ========================================
// Default sample data
// ========================================

const defaultFMEA: FMEAItem[] = [
    { id: '1', component: 'Bearing', failureMode: 'Bearing Seizure', failureCause: 'Lack of lubrication', failureEffect: 'Complete Shutdown', severity: 10, occurrence: 6, detection: 4, rpn: 240, riskLevel: 'Medium' },
    { id: '2', component: 'Seal', failureMode: 'Leakage', failureCause: 'Wear and tear', failureEffect: 'Reduced Efficiency', severity: 7, occurrence: 8, detection: 6, rpn: 336, riskLevel: 'High' },
    { id: '3', component: 'Motor', failureMode: 'Overheating', failureCause: 'Cooling system failure', failureEffect: 'Performance Degradation', severity: 8, occurrence: 5, detection: 5, rpn: 200, riskLevel: 'Medium' },
    { id: '4', component: 'Impeller', failureMode: 'Erosion', failureCause: 'Abrasive particles', failureEffect: 'Flow Reduction', severity: 6, occurrence: 7, detection: 7, rpn: 294, riskLevel: 'Medium' },
];



const defaultCosts: CostItem[] = [
    { id: '1', equipmentName: 'Centrifugal Pump A', downtimeCostPerHour: 500, repairCost: 2500, replacementCost: 45000, sparePartsCost: 1500, laborCostPerHour: 75, operatingHoursPerDay: 16, operatingCostPerHour: 25, annualOperatingCost: 146000, annualMaintenanceCost: 18500, costPerFailure: 4500 },
    { id: '2', equipmentName: 'Heat Exchanger B', downtimeCostPerHour: 800, repairCost: 5000, replacementCost: 85000, sparePartsCost: 3000, laborCostPerHour: 85, operatingHoursPerDay: 24, operatingCostPerHour: 35, annualOperatingCost: 306600, annualMaintenanceCost: 28000, costPerFailure: 9400 },
    { id: '3', equipmentName: 'Compressor C', downtimeCostPerHour: 1200, repairCost: 8000, replacementCost: 120000, sparePartsCost: 5000, laborCostPerHour: 95, operatingHoursPerDay: 20, operatingCostPerHour: 50, annualOperatingCost: 365000, annualMaintenanceCost: 42000, costPerFailure: 15800 },
];



const defaultTasks: MaintenanceTaskItem[] = [];

// ========================================
// Frequency-based plan definitions
// ========================================

interface PlanFrequency {
    key: string;
    label: string;
    desc: string;
    icon: typeof ClipboardList;
    color: string;
    bgColor: string;
    borderColor: string;
}

const PLAN_FREQUENCIES: PlanFrequency[] = [
    { key: 'daily', label: 'Daily Checks', desc: 'Pressure monitoring, visual inspections', icon: Eye, color: '#1a7ab8', bgColor: 'rgba(26, 122, 184, 0.06)', borderColor: 'rgba(26, 122, 184, 0.4)' },
    { key: 'weekly', label: 'Weekly Tasks', desc: 'Electrical & seal inspections', icon: Wrench, color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.06)', borderColor: 'rgba(245, 158, 11, 0.4)' },
    { key: 'monthly', label: 'Monthly Checks', desc: 'Motor analysis, hydraulic performance', icon: Settings, color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.06)', borderColor: 'rgba(139, 92, 246, 0.4)' },
    { key: 'quarterly', label: 'Quarterly Service', desc: 'Alignment, impeller, lubrication', icon: RotateCcw, color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.06)', borderColor: 'rgba(34, 197, 94, 0.4)' },
    { key: 'semiannual', label: 'Semi-Annual', desc: 'Motor rewind, performance validation', icon: Cpu, color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.06)', borderColor: 'rgba(239, 68, 68, 0.4)' },
    { key: 'annual', label: 'Annual Overhaul', desc: 'Seal replacement, bearing swap', icon: Calendar, color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.06)', borderColor: 'rgba(6, 182, 212, 0.4)' },
];

// Map task frequency strings to plan keys
function mapFrequencyToKey(freq: string): string {
    const f = freq.toLowerCase();
    if (f === 'daily') return 'daily';
    if (f === 'weekly' || f === 'bi-weekly') return 'weekly';
    if (f === 'monthly' || f === 'bi-monthly') return 'monthly';
    if (f === 'quarterly') return 'quarterly';
    if (f.includes('semi') || f.includes('semi-annual')) return 'semiannual';
    if (f === 'annually' || f === 'annual') return 'annual';
    return 'monthly'; // Default
}



// ========================================
// Production webhook URL
// ========================================
const WEBHOOK_URL = 'https://abdulrahman308-n8nfree.hf.space/webhook/RCM-MAINTENANCE';

const formatDateSummary = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ========================================
// Maintenance Plan Component
// ========================================

export default function MaintenancePlan() {
    const { t } = useLanguage();
    const { isMobile } = useSidebar();
    const navigate = useNavigate();
    const { storageKeyFor, currentAssetId, currentProjectId, currentAsset } = useAssetContext();
    const { user } = useAuth();

    const [assets, setAssets] = useState<Asset[]>([]);
    const [fmeaData, setFmeaData] = useState<FMEAItem[]>([]);
    const [costData, setCostData] = useState<CostItem[]>([]);
    const [taskData, setTaskData] = useState<MaintenanceTaskItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [expandedFreq, setExpandedFreq] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

    // AI Interval Results state
    const [aiResult, setAiResult] = useState<AIIntervalResult | null>(null);
    const [aiResultsHistory, setAiResultsHistory] = useState<AIIntervalResult[]>([]);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string>('');
    const [showResultsModal, setShowResultsModal] = useState(false);
    const [isSavingResult, setIsSavingResult] = useState(false);
    const [isFetchingAiResult, setIsFetchingAiResult] = useState(false);

    // AI Config Modal State
    const [showAiConfigModal, setShowAiConfigModal] = useState(false);
    const [aiOptions, setAiOptions] = useState({
        assets: [] as any[], components: [] as any[], fmeas: [] as any[], faults: [] as any[], curves: [] as any[], manuals: [] as any[]
    });
    const [aiSelections, setAiSelections] = useState({
        assetId: '', componentId: '', componentName: '', fmeaId: '', faultId: '', curveId: '', manualId: ''
    });

    const handleOpenAiConfig = async () => {
        if (!user) return;
        setAiSelections({ assetId: currentAssetId || '', componentId: '', componentName: '', fmeaId: '', faultId: '', curveId: '', manualId: '' });
        setShowAiConfigModal(true);
        const { data } = await supabase.from('assets').select('*').eq('user_id', user.id);
        setAiOptions(prev => ({ ...prev, assets: data || [] }));
    };

    useEffect(() => {
        if (aiSelections.assetId) {
            Promise.all([
                supabase.from('components').select('*').eq('asset_id', aiSelections.assetId),
                supabase.from('manuals').select('*').eq('asset_id', aiSelections.assetId)
            ]).then(([compRes, manRes]) => {
                setAiOptions(prev => ({ ...prev, components: compRes.data || [], manuals: manRes.data || [], fmeas: [], faults: [], curves: [] }));
            });
        } else {
            setAiOptions(prev => ({ ...prev, components: [], fmeas: [], faults: [], curves: [], manuals: [] }));
        }
    }, [aiSelections.assetId]);

    useEffect(() => {
        if (aiSelections.componentId && aiSelections.assetId) {
            const comp = aiOptions.components.find(c => c.id === aiSelections.componentId);
            if (comp) {
                const fetchComponentData = async () => {
                    // Strategy 1: fetch FMEA records that have the component_id FK set
                    const { data: fmeaByIdData } = await supabase
                        .from('fmea')
                        .select('*, logic_tree(*), components(id, name)')
                        .eq('asset_id', aiSelections.assetId)
                        .eq('component_id', aiSelections.componentId);

                    // Strategy 2: fetch FMEA records by component name (legacy records where component_id is null)
                    const { data: fmeaByNameData } = await supabase
                        .from('fmea')
                        .select('*, logic_tree(*), components(id, name)')
                        .eq('asset_id', aiSelections.assetId)
                        .eq('component', comp.name)
                        .is('component_id', null);

                    // Merge both result sets, deduplicated by id
                    const merged = [...(fmeaByIdData || []), ...(fmeaByNameData || [])];
                    const seen = new Set<string>();
                    const uniqueFmeas = merged.filter(f => {
                        if (seen.has(f.id)) return false;
                        seen.add(f.id);
                        return true;
                    });

                    // Fetch fault history scoped to this specific component
                    const { data: faultData } = await supabase
                        .from('faults')
                        .select('*')
                        .eq('asset_id', aiSelections.assetId)
                        .eq('component_id', aiSelections.componentId);

                    // Fetch P-F curves scoped to this specific component (by name, since cbm_curves uses component_name text)
                    const { data: curveData } = await supabase
                        .from('cbm_curves')
                        .select('*')
                        .eq('asset_id', aiSelections.assetId)
                        .eq('component_name', comp.name);

                    setAiOptions(prev => ({
                        ...prev,
                        fmeas: uniqueFmeas,
                        faults: faultData || [],
                        curves: curveData || []
                    }));
                };
                fetchComponentData();
            }
        } else {
            setAiOptions(prev => ({ ...prev, fmeas: [], faults: [], curves: [] }));
        }
    }, [aiSelections.componentId, aiOptions.components, aiSelections.assetId]);

    // Auto-dismiss toast after 5 seconds
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(timer);
    }, [toast]);

    useEffect(() => {
        const loadDashboardData = async () => {
            if (!user) return;

            setLoading(true);
            try {
                // Load assets from Supabase
                if (currentAssetId) {
                    const { data: assetData } = await supabase.from('assets').select('*').eq('id', currentAssetId).eq('user_id', user.id);
                    if (assetData) setAssets(assetData);
                } else if (currentProjectId) {
                    const { data: assetData } = await supabase.from('assets').select('*').eq('project_id', currentProjectId).eq('user_id', user.id);
                    if (assetData) setAssets(assetData);
                }

                if (currentAssetId) {
                    // Fetch FMEA
                    const { data: fData } = await supabase
                        .from('fmea')
                        .select('*')
                        .eq('asset_id', currentAssetId);

                    if (fData) {
                        setFmeaData(fData.map(item => ({
                            id: item.id,
                            component: item.component,
                            failureMode: item.failure_mode,
                            failureCause: item.failure_cause,
                            failureEffect: item.failure_effect,
                            severity: item.severity,
                            occurrence: item.occurrence,
                            detection: item.detection,
                            rpn: item.rpn,
                            riskLevel: item.risk_level
                        })));
                    } else {
                        setFmeaData([]);
                    }

                    // Fetch Costs
                    const { data: cData } = await supabase
                        .from('costs')
                        .select('*')
                        .eq('asset_id', currentAssetId);

                    if (cData) {
                        setCostData(cData.map(item => ({
                            id: item.id,
                            equipmentName: item.equipment_name,
                            downtimeCostPerHour: 0,
                            repairCost: 0,
                            replacementCost: 0,
                            sparePartsCost: 0,
                            laborCostPerHour: 0,
                            operatingHoursPerDay: 0,
                            operatingCostPerHour: 0,
                            annualOperatingCost: Number(item.acquisition_cost || 0), // Use as proxy for summary
                            annualMaintenanceCost: 0,
                            costPerFailure: 0,
                        })));
                    } else {
                        setCostData([]);
                    }

                    // Fetch Tasks
                    const { data: tData } = await supabase
                        .from('tasks')
                        .select('*')
                        .eq('asset_id', currentAssetId);

                    if (tData) {
                        setTaskData(tData.map(item => ({
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
                        })));
                    } else {
                        setTaskData([]);
                    }
                }
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadDashboardData();
    }, [currentProjectId, currentAssetId, user]);

    const handleSyncN8n = async () => {
        setIsSyncing(true);
        try {
            // Simulate network request to retrieve updated tasks
            await new Promise(resolve => setTimeout(resolve, 1200));

            // Mock data representing dynamically received maintenance tasks
            const refreshedTasks = [
                { task_name: 'Auto Daily Log Audit', asset_name: assetName || 'System', task_type: 'Condition-Based', priority: 'Medium', status: 'Pending', assigned_to: 'System Auto', due_date: new Date().toISOString().split('T')[0], estimated_duration: 1, description: 'Automated daily data review imported via integration.', frequency: 'Daily', last_completed: null, completion_percentage: 0 },
                { task_name: 'Weekly Filter Inspection', asset_name: assetName || 'System', task_type: 'Preventive', priority: 'High', status: 'Pending', assigned_to: 'System Auto', due_date: new Date().toISOString().split('T')[0], estimated_duration: 2, description: 'Weekly analysis output from automated algorithms.', frequency: 'Weekly', last_completed: null, completion_percentage: 0 },
                { task_name: 'Monthly Diagnostics Check', asset_name: assetName || 'System', task_type: 'Predictive', priority: 'Medium', status: 'Pending', assigned_to: 'System Auto', due_date: new Date().toISOString().split('T')[0], estimated_duration: 3, description: 'Monthly diagnostics generated by system monitoring.', frequency: 'Monthly', last_completed: null, completion_percentage: 0 },
                { task_name: 'Quarterly Output Calibration', asset_name: assetName || 'System', task_type: 'Preventive', priority: 'Medium', status: 'Pending', assigned_to: 'System Auto', due_date: new Date().toISOString().split('T')[0], estimated_duration: 4, description: 'Quarterly parameter setup dictated by operational limits.', frequency: 'Quarterly', last_completed: null, completion_percentage: 0 }
            ];

            if (user && currentAssetId) {
                const inserts = refreshedTasks.map(t => ({ ...t, user_id: user.id, asset_id: currentAssetId }));
                await supabase.from('tasks').insert(inserts);
                // Trigger reload
                // Instead of full reload, just let it be for now or reload by triggering effect
            }
        } catch (error) {
            console.error('Failed to refresh maintenance tasks:', error);
        } finally {
            setIsSyncing(false);
            window.location.reload(); // Quick refresh to show new tasks
        }
    };

    // ========================================
    // Run AI Calculation (from Modal)
    // ========================================
    const handleRunAiCalculation = async () => {
        setShowAiConfigModal(false);
        setIsSubmitting(true);
        setToast(null);

        try {
            const assetData = aiOptions.assets.find(a => a.id === aiSelections.assetId);
            const componentData = aiOptions.components.find(c => c.id === aiSelections.componentId);
            const fmeaData = aiOptions.fmeas.find(f => f.id === aiSelections.fmeaId);
            const componentFaults = aiOptions.faults;
            const curveData = aiOptions.curves.find(c => c.id === aiSelections.curveId);
            const manualData = aiOptions.manuals.find(m => m.id === aiSelections.manualId);

            const formData = new FormData();
            formData.append('asset_info', JSON.stringify(assetData || { id: aiSelections.assetId }));
            formData.append('component_info', JSON.stringify(componentData || {}));
            formData.append('timestamp', new Date().toISOString());

            if (componentFaults && componentFaults.length > 0) formData.append('fault_history', JSON.stringify(componentFaults));
            if (fmeaData) {
                const { logic_tree, ...fmeaRecord } = fmeaData;
                formData.append('fmea_data', JSON.stringify([fmeaRecord]));
                if (logic_tree) formData.append('maintenance_strategy', JSON.stringify(Array.isArray(logic_tree) ? logic_tree : [logic_tree]));
            }
            if (curveData) formData.append('pf_curves', JSON.stringify([curveData]));

            // Explicit targeting context — tells n8n exactly which row this belongs to
            const ltRec = Array.isArray(fmeaData?.logic_tree) ? fmeaData.logic_tree[0] : fmeaData?.logic_tree;
            formData.append('targeting_context', JSON.stringify({
                component_id: aiSelections.componentId,
                component_name: componentData?.name || aiSelections.componentName,
                failure_mode_id: aiSelections.fmeaId,
                failure_mode: fmeaData?.failure_mode || '',
                task_type: ltRec?.strategy_code || ltRec?.strategy || 'AI',
            }));
            if (manualData && manualData.file_path) {
                formData.append('manuals_metadata', JSON.stringify([{ id: manualData.id, title: manualData.title }]));
                const { data: blob } = await supabase.storage.from('app-files').download(manualData.file_path);
                if (blob) {
                    formData.append('manual_file', blob, manualData.title || 'manual.pdf');
                }
            }

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                try {
                    const responseData = await response.json();

                    // Capture the targeting context from current aiSelections
                    // so the result object is permanently identified by its
                    // component + failure mode, not by a timestamp.
                    const fmeaRecord = aiOptions.fmeas.find(f => f.id === aiSelections.fmeaId);
                    const compRef = Array.isArray(fmeaRecord?.components) ? fmeaRecord?.components[0] : fmeaRecord?.components;
                    const resolvedComponentName =
                        compRef?.name || fmeaRecord?.component || componentData?.name || aiSelections.componentName || '';
                    const resolvedFailureMode =
                        fmeaRecord?.failure_mode || aiSelections.fmeaId || 'Unknown Mode';

                    const result: AIIntervalResult = {
                        id: 'new_unsaved',
                        created_at: new Date().toISOString(),
                        // ── Identity (primary label fields) ──
                        component_id: aiSelections.componentId,
                        component_name: resolvedComponentName,
                        failure_mode_id: aiSelections.fmeaId,
                        failure_mode: resolvedFailureMode,
                        // ── AI output ──
                        recommended_interval: String(responseData.recommended_interval ?? responseData.Recommended_Interval ?? 'N/A'),
                        interval_unit: String(responseData.interval_unit ?? responseData.Interval_Unit ?? 'Hours'),
                        data_confidence: String(responseData.data_confidence ?? responseData.Data_Confidence ?? 'Unverified - Requires Engineering Review'),
                        recommended_action: String(responseData.recommended_action ?? responseData.Recommended_Action ?? 'N/A'),
                        justification_summary: String(responseData.justification_summary ?? responseData.Justification_Summary ?? 'No justification provided.'),
                    };
                    setAiResult(result);

                    // Load existing history for this failure mode (not the whole asset)
                    const { data: histData } = await supabase
                        .from('ai_interval_results')
                        .select('*')
                        .eq('asset_id', currentAssetId)
                        .eq('failure_mode_id', aiSelections.fmeaId)
                        .order('created_at', { ascending: false });

                    const normalizedHistData: AIIntervalResult[] = (histData || []).map((row: any) => {
                        const fRecord = aiOptions.fmeas.find(f => f.id === row.failure_mode_id);
                        const cRef = Array.isArray(fRecord?.components) ? fRecord?.components[0] : fRecord?.components;
                        return {
                            id: row.id,
                            created_at: row.created_at,
                            component_id: row.component_id,
                            component_name: row.component_name || cRef?.name || fRecord?.component || resolvedComponentName,
                            failure_mode_id: row.failure_mode_id,
                            failure_mode: row.failure_mode_name || fRecord?.failure_mode || resolvedFailureMode,
                            recommended_interval: row.recommended_interval || 'N/A',
                            interval_unit: row.interval_unit || 'Hours',
                            data_confidence: row.data_confidence || 'Unverified - Requires Engineering Review',
                            recommended_action: row.recommended_action || 'N/A',
                            justification_summary: row.justification_summary || 'No justification provided.',
                        };
                    });
                    setAiResultsHistory([result, ...normalizedHistData]);
                    setSelectedHistoryId('new_unsaved');

                    setShowResultsModal(true);
                    setToast({ type: 'success', message: `AI analysis complete for "${resolvedFailureMode}"! Review the results below.` });
                } catch {
                    setToast({ type: 'warning', message: 'Data sent successfully, but the response could not be parsed.' });
                }
            } else {
                setToast({ type: 'error', message: `Webhook request failed with status ${response.status}: ${response.statusText}` });
            }
        } catch (err: any) {
            console.error('Webhook submission error:', err);
            setToast({ type: 'error', message: `Submission failed: ${err.message || 'Network error'}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    // ========================================
    // Save AI result to database
    // ========================================
    const handleApproveAndSave = async () => {
        if (!aiResult || !user || !currentAssetId) return;

        // Guard: a specific failure mode MUST be selected to prevent broadcast saves
        if (!aiSelections.fmeaId) {
            setToast({ type: 'error', message: 'Cannot save: no Failure Mode was selected. Please re-run the calculation and choose a specific Failure Mode.' });
            return;
        }

        setIsSavingResult(true);
        try {
            // 1. Save AI interval result — strictly identified by failure_mode_id.
            //    failure_mode_name is saved as a text column so history records
            //    are labeled by failure mode name, not by date.
            const { data, error } = await supabase.from('ai_interval_results').insert({
                user_id: user.id,
                asset_id: currentAssetId,
                component_id: aiResult.component_id || aiSelections.componentId || null,
                component_name: aiResult.component_name || aiSelections.componentName || null,
                failure_mode_id: aiResult.failure_mode_id || aiSelections.fmeaId,  // required
                failure_mode_name: aiResult.failure_mode
                    || aiOptions.fmeas.find(f => f.id === (aiResult.failure_mode_id || aiSelections.fmeaId))?.failure_mode
                    || null,  // primary label — resolved from AI result or FMEA lookup
                recommended_interval: aiResult.recommended_interval,
                interval_unit: aiResult.interval_unit,
                data_confidence: aiResult.data_confidence,
                recommended_action: aiResult.recommended_action,
                justification_summary: aiResult.justification_summary,
                approved: true,
            }).select().single();
            if (error) throw error;

            setAiResult({ ...aiResult, id: data.id, created_at: data.created_at });
            setSelectedHistoryId(data.id);
            setAiResultsHistory(prev => prev.map(r => r.id === 'new_unsaved' ? { ...data, failure_mode: aiResult.failure_mode, component_name: aiResult.component_name } : r));

            // 2. Resolve component + failure mode names — prefer from enriched aiResult
            //    (bound at calculation time), fall back to live aiSelections then FMEA lookup.
            const fmeaRecord = aiOptions.fmeas.find(f => f.id === (aiResult.failure_mode_id || aiSelections.fmeaId));
            const compRef = Array.isArray(fmeaRecord?.components) ? fmeaRecord?.components[0] : fmeaRecord?.components;
            const componentName = aiResult.component_name
                || compRef?.name
                || fmeaRecord?.component
                || aiSelections.componentName
                || aiOptions.components.find(c => c.id === aiSelections.componentId)?.name
                || 'Unknown Component';
            const failureModeName = aiResult.failure_mode || fmeaRecord?.failure_mode || 'Maintenance Task';

            // logic_tree is a JOIN array in Supabase — extract first row safely
            const logicTreeRec = Array.isArray(fmeaRecord?.logic_tree)
                ? fmeaRecord.logic_tree[0]
                : fmeaRecord?.logic_tree;
            const taskType = logicTreeRec?.strategy_code || logicTreeRec?.strategy || 'AI';

            // 3. Strict SELECT → UPDATE/INSERT on failure_mode_id (no broadcast)
            const fmeaIdToUse = aiResult.failure_mode_id || aiSelections.fmeaId;
            const { data: existing } = await supabase
                .from('maintenance_tasks')
                .select('id')
                .eq('user_id', user.id)
                .eq('asset_id', currentAssetId)
                .eq('failure_mode_id', fmeaIdToUse)
                .maybeSingle();

            const taskPayload = {
                component_id: aiResult.component_id || aiSelections.componentId || null,
                component_name: componentName,
                task_name: failureModeName,
                task_type: taskType,
                assigned_interval: `${aiResult.recommended_interval} ${aiResult.interval_unit}`,
                last_updated: new Date().toISOString(),
            };

            if (existing?.id) {
                // Update ONLY this specific row by primary key — no other rows touched
                const { error: upErr } = await supabase
                    .from('maintenance_tasks')
                    .update(taskPayload)
                    .eq('id', existing.id);
                if (upErr) console.error('Failed to update maintenance_tasks:', upErr);
            } else {
                // Insert new row — strictly scoped to this failure_mode_id
                const { error: inErr } = await supabase
                    .from('maintenance_tasks')
                    .insert({
                        user_id: user.id,
                        asset_id: currentAssetId,
                        failure_mode_id: fmeaIdToUse,
                        ...taskPayload,
                    });
                if (inErr) console.error('Failed to insert maintenance_tasks:', inErr);
            }

            // ================================================================
            // 4. Convert AI interval to days and create a scheduled task
            //    in the `tasks` table for the Maintenance Tasks page
            // ================================================================
            try {
                // Fetch operating_hours_per_day from the asset
                const { data: assetData } = await supabase
                    .from('assets')
                    .select('operating_hours_per_day, equipment_name')
                    .eq('id', currentAssetId)
                    .single();

                const operatingHoursPerDay = Number(assetData?.operating_hours_per_day) || 8;
                const intervalValue = parseFloat(aiResult.recommended_interval) || 0;
                const intervalUnit = (aiResult.interval_unit || 'hours').toLowerCase().trim();

                // Convert interval to days based on unit
                let intervalInDays = 0;
                if (intervalUnit.includes('hour')) {
                    intervalInDays = Math.ceil(intervalValue / operatingHoursPerDay);
                } else if (intervalUnit.includes('day')) {
                    intervalInDays = Math.ceil(intervalValue);
                } else if (intervalUnit.includes('week')) {
                    intervalInDays = Math.ceil(intervalValue * 7);
                } else if (intervalUnit.includes('month')) {
                    intervalInDays = Math.ceil(intervalValue * 30);
                } else if (intervalUnit.includes('year')) {
                    intervalInDays = Math.ceil(intervalValue * 365);
                } else {
                    // Fallback: treat as days
                    intervalInDays = Math.ceil(intervalValue);
                }

                // Calculate due date from current date
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + intervalInDays);

                // Determine frequency label for display
                const frequencyLabel = intervalInDays <= 1 ? 'Daily'
                    : intervalInDays <= 7 ? 'Weekly'
                    : intervalInDays <= 31 ? 'Monthly'
                    : intervalInDays <= 92 ? 'Quarterly'
                    : intervalInDays <= 183 ? 'Semi-Annual'
                    : 'Annual';

                // Check if a task already exists for this failure mode in the tasks table
                const { data: existingTask } = await supabase
                    .from('tasks')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('asset_id', currentAssetId)
                    .eq('failure_mode', failureModeName)
                    .eq('source', 'ai_calculated')
                    .maybeSingle();

                const scheduledTaskPayload = {
                    task_name: `${failureModeName} — ${componentName}`,
                    description: `AI-calculated maintenance task: ${aiResult.recommended_action || failureModeName}. Interval: ${aiResult.recommended_interval} ${aiResult.interval_unit} (≈ ${intervalInDays} days). Confidence: ${aiResult.data_confidence || 'N/A'}.`,
                    frequency: frequencyLabel,
                    task_type: taskType === 'CBM' ? 'Condition-Based' : taskType === 'TBM' ? 'Preventive' : taskType === 'AI' ? 'Predictive' : 'Preventive',
                    priority: (aiResult.data_confidence || '').toLowerCase().includes('high') ? 'High' : 'Medium',
                    status: 'Pending',
                    due_date: dueDate.toISOString(),
                    source: 'ai_calculated',
                    component_name: componentName,
                    failure_mode: failureModeName,
                    interval_value: intervalValue,
                    interval_unit: intervalUnit,
                    estimated_duration: 2,
                    completion_percentage: 0,
                };

                if (existingTask?.id) {
                    await supabase.from('tasks').update(scheduledTaskPayload).eq('id', existingTask.id);
                } else {
                    await supabase.from('tasks').insert({
                        user_id: user.id,
                        asset_id: currentAssetId,
                        ...scheduledTaskPayload,
                    });
                }
                console.log(`✅ Scheduled task created: ${failureModeName} — due in ${intervalInDays} days (${intervalValue} ${intervalUnit} ÷ ${operatingHoursPerDay} hrs/day)`);
            } catch (taskErr) {
                console.error('Warning: AI result saved but failed to create scheduled task:', taskErr);
            }

            setToast({ type: 'success', message: 'AI interval result approved and saved to database!' });
            setShowResultsModal(false);
        } catch (err: any) {
            console.error('Save error:', err);
            setToast({ type: 'error', message: `Failed to save: ${err.message}` });
        } finally {
            setIsSavingResult(false);
        }
    };

    // ========================================
    // Fetch latest AI result from database
    // ========================================
    const handleViewAiResults = async () => {
        if (!currentAssetId) {
            setToast({ type: 'warning', message: 'Please select an asset first.' });
            return;
        }

        setIsFetchingAiResult(true);
        try {
            const { data, error } = await supabase
                .from('ai_interval_results')
                .select('*')
                .eq('asset_id', currentAssetId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                if (aiResult && aiResult.id === 'new_unsaved') {
                    setShowResultsModal(true);
                } else {
                    setToast({ type: 'warning', message: 'No AI results yet. Click "Calculate Interval" first.' });
                }
                return;
            }

            const normalizedData: AIIntervalResult[] = data.map((row: any) => {
                const fRecord = aiOptions.fmeas.find(f => f.id === row.failure_mode_id);
                const cRef = Array.isArray(fRecord?.components) ? fRecord?.components[0] : fRecord?.components;
                return {
                    id: row.id,
                    created_at: row.created_at,
                    component_id: row.component_id,
                    component_name: row.component_name || cRef?.name || fRecord?.component,
                    failure_mode_id: row.failure_mode_id,
                    failure_mode: row.failure_mode_name || fRecord?.failure_mode, // fallback to dynamically resolved name
                    recommended_interval: row.recommended_interval || 'N/A',
                    interval_unit: row.interval_unit || 'Hours',
                    data_confidence: row.data_confidence || 'Unverified - Requires Engineering Review',
                    recommended_action: row.recommended_action || 'N/A',
                    justification_summary: row.justification_summary || 'No justification provided.',
                };
            });

            let historyList = normalizedData;
            if (aiResult && aiResult.id === 'new_unsaved') {
                historyList = [aiResult, ...normalizedData];
            }

            setAiResultsHistory(historyList);

            if (aiResult && aiResult.id === 'new_unsaved') {
                setSelectedHistoryId('new_unsaved');
            } else {
                const latest = normalizedData[0];
                setAiResult(latest);
                setSelectedHistoryId(latest.id || '');
            }
            setShowResultsModal(true);
        } catch (err: any) {
            console.error('Fetch AI result error:', err);
            setToast({ type: 'error', message: `Failed to load results: ${err.message}` });
        } finally {
            setIsFetchingAiResult(false);
        }
    };

    // Group tasks by frequency
    const tasksByFrequency = useMemo(() => {
        const map: Record<string, MaintenanceTaskItem[]> = {};
        PLAN_FREQUENCIES.forEach(f => { map[f.key] = []; });
        taskData.forEach(task => {
            const key = mapFrequencyToKey(task.frequency);
            if (map[key]) map[key].push(task);
        });
        return map;
    }, [taskData]);

    // Stats
    const assetName = currentAsset?.equipment_name || (assets.length > 0 ? assets[0].equipment_name : null);
    const highRiskCount = fmeaData.filter(f => f.riskLevel === 'High').length;
    const overdueTasks = taskData.filter(t => t.status === 'Overdue').length;
    const completedTasks = taskData.filter(t => t.status === 'Completed').length;
    const totalAnnualCost = costData.reduce((s, c) => s + c.annualOperatingCost, 0);

    return (
        <>
            <Sidebar />
            <PageContainer>
                <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-2xl)' }}>
                    {/* Toast Notification */}
                    {toast && (
                        <div
                            style={{
                                position: 'fixed',
                                top: '24px',
                                right: '24px',
                                zIndex: 9999,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-sm)',
                                padding: '12px 20px',
                                borderRadius: 'var(--radius-lg)',
                                background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.12)'
                                    : toast.type === 'error' ? 'rgba(239, 68, 68, 0.12)'
                                        : 'rgba(245, 158, 11, 0.12)',
                                border: `1px solid ${toast.type === 'success' ? 'rgba(16, 185, 129, 0.4)'
                                    : toast.type === 'error' ? 'rgba(239, 68, 68, 0.4)'
                                        : 'rgba(245, 158, 11, 0.4)'}`,
                                backdropFilter: 'blur(12px)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                                maxWidth: '480px',
                                animation: 'fadeIn 0.3s ease',
                            }}
                        >
                            {toast.type === 'success' ? <CheckCircle size={18} color="#10b981" />
                                : toast.type === 'error' ? <AlertTriangle size={18} color="#ef4444" />
                                    : <AlertTriangle size={18} color="#f59e0b" />}
                            <span style={{
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 500,
                                color: toast.type === 'success' ? '#10b981'
                                    : toast.type === 'error' ? '#ef4444'
                                        : '#f59e0b',
                                flex: 1,
                            }}>{toast.message}</span>
                            <button
                                onClick={() => setToast(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-tertiary)' }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {/* Header */}
                    <div className="animate-fade-in" style={{ marginBottom: 'var(--spacing-2xl)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', gap: 'var(--spacing-md)' }}>
                            {/* Title block */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
                                    background: 'linear-gradient(135deg, #1a7ab8 0%, #0f4c75 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(26,122,184,0.3)',
                                    flexShrink: 0,
                                }}>
                                    <ClipboardList size={24} color="white" />
                                </div>
                                <h1 style={{ margin: 0, fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)' }}>
                                    {t('mp.title')}
                                </h1>
                            </div>

                            {/* Action row — all controls in one horizontal line */}
                            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                                <button
                                    onClick={handleSyncN8n}
                                    disabled={isSyncing}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '8px 14px', borderRadius: 'var(--radius-md)',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: 'white',
                                        cursor: isSyncing ? 'wait' : 'pointer',
                                        fontSize: '13px', fontWeight: 600,
                                        opacity: isSyncing ? 0.7 : 1,
                                    }}
                                >
                                    {isSyncing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                                    {isSyncing ? 'Refreshing...' : 'Refresh'}
                                </button>
                                <button
                                    id="calculate-interval-btn"
                                    onClick={handleOpenAiConfig}
                                    disabled={isSubmitting}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '8px 16px', borderRadius: 'var(--radius-md)',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                        color: 'white',
                                        cursor: isSubmitting ? 'wait' : 'pointer',
                                        fontSize: '13px', fontWeight: 700,
                                        opacity: isSubmitting ? 0.7 : 1,
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
                                        minHeight: '36px',
                                        whiteSpace: 'nowrap',
                                    }}
                                    title="Send data to AI agent and calculate maintenance interval"
                                >
                                    {isSubmitting ? <Loader2 size={16} className="spin" /> : <Calculator size={16} />}
                                    {isSubmitting ? 'Analyzing...' : 'Calculate Interval'}
                                </button>
                                <GlobalSearch pageType="maintenance" />
                                <AssetSelector />
                            </div>
                        </div>
                    </div>

                    {/* No assets alert */}
                    {assets.length === 0 && (
                        <div className="animate-fade-in" style={{
                            background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-lg)',
                            display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)',
                        }}>
                            <AlertTriangle size={24} color="#f59e0b" />
                            <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{t('mp.noAssetsTitle')}</div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{t('mp.noAssetsMsg')}</div>
                            </div>
                        </div>
                    )}

                    {/* Summary Stats */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-3xl)', color: 'var(--text-tertiary)' }}>
                            <div className="animate-pulse" style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>Loading plan data...</div>
                        </div>
                    ) : (
                        <>
                            <div className="animate-fade-in" style={{
                                display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                                gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-2xl)', animationDelay: '100ms',
                            }}>
                                {[
                                    { label: t('mp.registeredAssets'), value: assets.length, color: '#1a7ab8', icon: '🏭' },
                                    { label: t('mp.highRiskItems'), value: highRiskCount, color: '#ef4444', icon: '⚠️' },
                                    { label: t('mp.overdueTasks'), value: overdueTasks, color: '#f59e0b', icon: '⏰' },
                                    { label: t('mp.totalAnnualCost'), value: `$${(totalAnnualCost / 1000).toFixed(0)}K`, color: '#8b5cf6', icon: '💰' },
                                ].map((stat, i) => (
                                    <div key={i} className="card-glass" style={{ padding: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                        <div style={{ fontSize: '28px' }}>{stat.icon}</div>
                                        <div>
                                            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{stat.label}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ===== MAINTENANCE PLAN GRID ===== */}
                            <div className="animate-fade-in" style={{ marginBottom: 'var(--spacing-2xl)', animationDelay: '200ms' }}>
                                <div className="card" style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
                                    <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                        <h2 style={{ fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', margin: 0 }}>
                                            <ClipboardList size={20} style={{ color: 'var(--primary-500)' }} />
                                            Maintenance Plan
                                        </h2>
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)', lineHeight: 1.6 }}>
                                        Comprehensive maintenance plan for <strong>{assetName || 'all assets'}</strong> covering daily, weekly, monthly, quarterly, semi-annual, and annual tasks.
                                    </p>
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
                                        {PLAN_FREQUENCIES.map((freq, i) => {
                                            const freqTasks = tasksByFrequency[freq.key] || [];
                                            if (freqTasks.length === 0) return null;
                                            const isAct = expandedFreq === freq.key;
                                            const IconComp = freq.icon;
                                            return (
                                                <div key={i} onClick={() => setExpandedFreq(isAct ? null : freq.key)}
                                                    style={{
                                                        padding: 'var(--spacing-md)', background: isAct ? freq.bgColor : 'var(--bg-tertiary)',
                                                        borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'all 0.2s ease',
                                                        border: isAct ? `1px solid ${freq.borderColor}` : '1px solid transparent',
                                                        borderLeft: `3px solid ${freq.color}`,
                                                        transform: isAct ? 'translateY(-2px)' : 'none',
                                                        boxShadow: isAct ? `0 4px 16px ${freq.color}20` : 'none',
                                                    }}
                                                    onMouseEnter={(e) => { if (!isAct) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${freq.color}15`; } }}
                                                    onMouseLeave={(e) => { if (!isAct) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; } }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: '4px' }}>
                                                        <IconComp size={18} color={freq.color} />
                                                        <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>{freq.label}</span>
                                                        {freqTasks.length > 0 && (
                                                            <span style={{ marginLeft: 'auto', background: `${freq.color}20`, color: freq.color, padding: '1px 8px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 700 }}>{freqTasks.length}</span>
                                                        )}
                                                    </div>
                                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>{freq.desc}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {expandedFreq && (() => {
                                        const freq = PLAN_FREQUENCIES.find(f => f.key === expandedFreq);
                                        const freqTasks = tasksByFrequency[expandedFreq] || [];
                                        if (!freq) return null;
                                        return (
                                            <div style={{ background: freq.bgColor, borderRadius: 'var(--radius-lg)', border: `1px solid ${freq.borderColor}`, padding: 'var(--spacing-lg)', animation: 'fadeIn 0.3s ease' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                                        <freq.icon size={20} color={freq.color} />
                                                        <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', color: freq.color }}>{freq.label} — Detailed Tasks</h3>
                                                    </div>
                                                    <button onClick={() => setExpandedFreq(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-tertiary)' }}><ChevronUp size={18} /></button>
                                                </div>
                                                {freqTasks.length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                                        {freqTasks.map(task => (
                                                            <div key={task.id} style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)', borderLeft: `3px solid ${freq.color}`, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 'var(--spacing-md)', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between' }}>
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: '2px' }}>{task.taskName}</div>
                                                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>{task.assetName} • {task.assignedTo}</div>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                    <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 600, background: task.status === 'Completed' ? 'rgba(34,197,94,0.1)' : task.status === 'In Progress' ? 'rgba(26,122,184,0.1)' : task.status === 'Overdue' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: task.status === 'Completed' ? '#22c55e' : task.status === 'In Progress' ? '#1a7ab8' : task.status === 'Overdue' ? '#ef4444' : '#f59e0b' }}>{task.status}</span>
                                                                    <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 600, background: task.priority === 'Critical' ? 'rgba(239,68,68,0.1)' : task.priority === 'High' ? 'rgba(249,115,22,0.1)' : 'rgba(139,92,246,0.1)', color: task.priority === 'Critical' ? '#ef4444' : task.priority === 'High' ? '#f97316' : '#8b5cf6' }}>{task.priority}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>No tasks assigned to this frequency yet.</div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
                                        {[
                                            { label: 'Total Tasks', count: taskData.length, color: 'var(--text-primary)', icon: ClipboardList },
                                            { label: 'Completed', count: completedTasks, color: '#22c55e', icon: CheckCircle },
                                            { label: 'In Progress', count: taskData.filter(t => t.status === 'In Progress').length, color: '#1a7ab8', icon: Clock },
                                            { label: 'Overdue', count: overdueTasks, color: '#ef4444', icon: AlertTriangle },
                                        ].map((item, i) => (
                                            <div key={i} style={{ background: `${item.color}08`, borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-md)', textAlign: 'center', border: `1px solid ${item.color}20` }}>
                                                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: item.color }}>{item.count}</div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>{item.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Comprehensive Maintenance Tasks Table */}
                    <div style={{ marginTop: 'var(--spacing-2xl)' }}>
                        <ComprehensiveMaintenanceTasks showAssetNames={false} />
                    </div>

                    {/* Navigation Buttons */}
                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-2xl)', flexWrap: 'wrap' }}>
                        <button onClick={() => navigate('/maintenance-tasks')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            <Wrench size={18} /> Open Maintenance Tasks <ChevronRight size={16} />
                        </button>
                        <button onClick={() => navigate('/reports')} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            <Activity size={18} /> View Reports <ChevronRight size={16} />
                        </button>
                        <button
                            onClick={handleViewAiResults}
                            disabled={isFetchingAiResult}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                                padding: '10px 20px', borderRadius: 'var(--radius-md)',
                                border: 'none',
                                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                                color: 'white',
                                cursor: isFetchingAiResult ? 'wait' : 'pointer',
                                fontSize: 'var(--font-size-sm)', fontWeight: 600,
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 12px rgba(139, 92, 246, 0.4)',
                                opacity: isFetchingAiResult ? 0.7 : 1,
                            }}
                        >
                            {isFetchingAiResult ? <Loader2 size={18} className="spin" /> : <Brain size={18} />}
                            {isFetchingAiResult ? 'Loading...' : 'View AI Interval Results'}
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {/* ===== FULLSCREEN LOADING OVERLAY ===== */}
                {isSubmitting && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)',
                        zIndex: 10000, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: '24px',
                    }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 40px rgba(99, 102, 241, 0.5)',
                            animation: 'pulse 2s ease-in-out infinite',
                        }}>
                            <Loader2 size={32} color="white" className="spin" />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                                <Sparkles size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                                AI Agent Analyzing...
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', maxWidth: '400px', lineHeight: 1.6 }}>
                                Analyzing failure history and calculating optimal maintenance intervals...
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== AI RESULTS MODAL ===== */}
                {showResultsModal && aiResult && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)',
                        zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px', animation: 'fadeIn 0.3s ease',
                    }}
                        onClick={() => setShowResultsModal(false)}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: 'var(--bg-secondary)', borderRadius: '16px',
                                border: '1px solid var(--border-color)',
                                width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
                                boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
                                animation: 'fadeIn 0.3s ease',
                            }}
                        >
                            {/* Modal Header */}
                            <div style={{
                                padding: '24px 24px 16px', borderBottom: '1px solid var(--border-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                    }}>
                                        <Brain size={22} color="white" />
                                    </div>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>AI Interval Results</h2>
                                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                            {aiResult.component_name
                                                ? <>{aiResult.component_name} &rsaquo; <strong>{aiResult.failure_mode || 'Unknown Mode'}</strong></>
                                                : currentAsset?.equipment_name || 'Selected Asset'
                                            }
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowResultsModal(false)} style={{
                                    background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                                    borderRadius: '8px', cursor: 'pointer', padding: '6px',
                                    color: 'var(--text-tertiary)', display: 'flex',
                                }}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                {/* History Selector */}
                                <div style={{ marginBottom: '10px' }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        Calculation History
                                    </label>
                                    <select
                                        value={selectedHistoryId}
                                        onChange={(e) => {
                                            const id = e.target.value;
                                            setSelectedHistoryId(id);
                                            const record = aiResultsHistory.find(r => r.id === id);
                                            if (record) setAiResult(record);
                                        }}
                                        style={{
                                            width: '100%', padding: '10px 14px', borderRadius: '8px',
                                            background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                                            color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                                        }}
                                    >
                                        {aiResultsHistory.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.id === 'new_unsaved'
                                                    ? `✦ New (Unsaved) — ${r.recommended_interval} ${r.interval_unit}`
                                                    : r.failure_mode
                                                        ? `${r.failure_mode} — ${r.recommended_interval} ${r.interval_unit}`
                                                        : `${formatDateSummary(r.created_at || '')} — ${r.recommended_interval} ${r.interval_unit}`
                                                }
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Primary Metric */}
                                <div style={{
                                    textAlign: 'center', padding: '28px 20px',
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
                                    borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)',
                                }}>
                                    <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '8px', fontWeight: 500 }}>
                                        Recommended Maintenance Interval
                                    </div>
                                    <div style={{
                                        fontSize: '48px', fontWeight: 800, lineHeight: 1.1,
                                        background: aiResult.recommended_interval === 'N/A'
                                            ? 'var(--text-tertiary)'
                                            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                    }}>
                                        {aiResult.recommended_interval === 'N/A'
                                            ? 'N/A'
                                            : `${aiResult.recommended_interval} ${aiResult.interval_unit}`}
                                    </div>
                                </div>

                                {/* Confidence Badge */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <ShieldCheck size={18} color={
                                        aiResult.data_confidence === 'Verified Data' ? '#10b981' :
                                            aiResult.data_confidence === 'Unverified - Requires Engineering Review' ? '#f59e0b' : '#3b82f6'
                                    } />
                                    <span style={{
                                        padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                                        background: aiResult.data_confidence === 'Verified Data' ? 'rgba(16, 185, 129, 0.12)' :
                                            aiResult.data_confidence === 'Unverified - Requires Engineering Review' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                                        color: aiResult.data_confidence === 'Verified Data' ? '#10b981' :
                                            aiResult.data_confidence === 'Unverified - Requires Engineering Review' ? '#f59e0b' : '#3b82f6',
                                        border: `1px solid ${aiResult.data_confidence === 'Verified Data' ? 'rgba(16, 185, 129, 0.3)' :
                                            aiResult.data_confidence === 'Unverified - Requires Engineering Review' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                                    }}>
                                        {aiResult.data_confidence}
                                    </span>
                                </div>

                                {/* Recommended Action */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <FileText size={16} color="var(--primary-500)" />
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Recommended Action
                                        </span>
                                    </div>
                                    <p style={{
                                        margin: 0, fontSize: '14px', lineHeight: 1.7,
                                        color: 'var(--text-primary)', fontWeight: 500,
                                    }}>
                                        {aiResult.recommended_action}
                                    </p>
                                </div>

                                {/* Justification Block */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <Sparkles size={16} color="#8b5cf6" />
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            AI Justification & Math
                                        </span>
                                    </div>
                                    <div style={{
                                        padding: '16px', borderRadius: '10px',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '13px', lineHeight: 1.8,
                                        color: 'var(--text-secondary)', whiteSpace: 'pre-wrap',
                                    }}>
                                        {aiResult.justification_summary}
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div style={{
                                padding: '16px 24px 24px',
                                borderTop: '1px solid var(--border-color)',
                                display: 'flex', gap: '12px', justifyContent: 'flex-end',
                            }}>
                                <button
                                    onClick={() => setShowResultsModal(false)}
                                    style={{
                                        padding: '10px 20px', borderRadius: '10px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                                        cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                    }}
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleApproveAndSave}
                                    disabled={isSavingResult}
                                    style={{
                                        padding: '10px 24px', borderRadius: '10px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: 'white', cursor: isSavingResult ? 'wait' : 'pointer',
                                        fontSize: '13px', fontWeight: 700,
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        opacity: isSavingResult ? 0.7 : 1,
                                        boxShadow: '0 2px 12px rgba(16, 185, 129, 0.4)',
                                    }}
                                >
                                    {isSavingResult ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                                    {isSavingResult ? 'Saving...' : 'Approve & Save to Database'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== AI CONFIGURATION MODAL ===== */}
                {showAiConfigModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)',
                        zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px', animation: 'fadeIn 0.3s ease',
                    }}
                        onClick={() => setShowAiConfigModal(false)}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: 'var(--bg-secondary)', borderRadius: '16px',
                                border: '1px solid var(--border-color)',
                                width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
                                boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
                            }}
                        >
                            {/* Header */}
                            <div style={{
                                padding: '24px 24px 16px', borderBottom: '1px solid var(--border-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Settings size={20} color="var(--primary-500)" />
                                    Configure AI Calculation Data
                                </h2>
                                <button onClick={() => setShowAiConfigModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
                            </div>

                            {/* Body - Dropdowns */}
                            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                {/* 1. Target Asset */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>1. Target Asset</label>
                                    <select
                                        className="form-input"
                                        value={aiSelections.assetId}
                                        onChange={(e) => setAiSelections(prev => ({ ...prev, assetId: e.target.value, componentId: '', fmeaId: '', faultId: '', curveId: '', manualId: '' }))}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="">Select Asset...</option>
                                        {aiOptions.assets.map(a => <option key={a.id} value={a.id}>{a.equipment_name}</option>)}
                                    </select>
                                </div>

                                {/* 2. Target Component */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>2. Target Component</label>
                                    <select
                                        className="form-input"
                                        value={aiSelections.componentId}
                                        onChange={(e) => {
                                            const comp = aiOptions.components.find(c => c.id === e.target.value);
                                            setAiSelections(prev => ({ ...prev, componentId: e.target.value, componentName: comp ? comp.name : '', fmeaId: '', faultId: '', curveId: '' }));
                                        }}
                                        disabled={!aiSelections.assetId || aiOptions.components.length === 0}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', opacity: (!aiSelections.assetId || aiOptions.components.length === 0) ? 0.5 : 1 }}
                                    >
                                        <option value="">Select Component...</option>
                                        {aiOptions.components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                {/* 3. Target Failure Mode & Strategy */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        3. Target Failure Mode &amp; Strategy
                                    </label>
                                    <select
                                        className="form-input"
                                        value={aiSelections.fmeaId}
                                        onChange={(e) => setAiSelections(prev => ({ ...prev, fmeaId: e.target.value }))}
                                        disabled={!aiSelections.componentId || aiOptions.fmeas.length === 0}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${aiSelections.componentId && aiOptions.fmeas.length === 0 ? '#f59e0b' : 'var(--border-color)'}`, background: 'var(--bg-primary)', color: 'var(--text-primary)', opacity: (!aiSelections.componentId) ? 0.5 : 1 }}
                                    >
                                        {!aiSelections.componentId
                                            ? <option value="">— Select a Component first —</option>
                                            : aiOptions.fmeas.length === 0
                                                ? <option value="">⚠ No Failure Modes found for this component</option>
                                                : <option value="">Select Failure Mode...</option>
                                        }
                                        {aiOptions.fmeas.map(f => {
                                            const strat = Array.isArray(f.logic_tree) ? f.logic_tree[0]?.strategy : f.logic_tree?.strategy;
                                            return <option key={f.id} value={f.id}>{f.failure_mode} {strat ? `(${strat})` : ''}</option>;
                                        })}
                                    </select>
                                    {aiSelections.componentId && aiOptions.fmeas.length === 0 && (
                                        <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#f59e0b' }}>
                                            No FMEA entries were found for this component. Add failure modes in the FMEA module first.
                                        </p>
                                    )}
                                    {aiSelections.componentId && aiOptions.fmeas.length > 0 && (
                                        <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#10b981' }}>
                                            ✓ {aiOptions.fmeas.length} failure mode{aiOptions.fmeas.length !== 1 ? 's' : ''} found for this component.
                                        </p>
                                    )}
                                </div>

                                {/* 4. Component Failure History */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>4. Component Failure History</label>
                                    <div style={{
                                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                                        border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
                                        color: aiSelections.componentId ? (aiOptions.faults.length > 0 ? '#10b981' : 'var(--text-secondary)') : 'var(--text-secondary)',
                                        fontWeight: 500, fontSize: '14px',
                                        display: 'flex', alignItems: 'center', gap: '8px'
                                    }}>
                                        {aiSelections.componentId ? (
                                            aiOptions.faults.length > 0 ? (
                                                <><CheckCircle size={16} /> Data Ready: {aiOptions.faults.length} Fault Record{aiOptions.faults.length !== 1 ? 's' : ''} attached</>
                                            ) : (
                                                <><AlertTriangle size={16} /> 0 Fault Records found</>
                                            )
                                        ) : (
                                            <><Clock size={16} /> Waiting for component selection...</>
                                        )}
                                    </div>
                                </div>

                                {/* 5. Component P-F Curve */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>5. Component P-F Curve</label>
                                    <select
                                        className="form-input"
                                        value={aiSelections.curveId}
                                        onChange={(e) => setAiSelections(prev => ({ ...prev, curveId: e.target.value }))}
                                        disabled={!aiSelections.componentId || aiOptions.curves.length === 0}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', opacity: (!aiSelections.componentId || aiOptions.curves.length === 0) ? 0.5 : 1 }}
                                    >
                                        <option value="">Select P-F Curve...</option>
                                        {aiOptions.curves.map(c => <option key={c.id} value={c.id}>P-F Curve: {c.p_days} P-F Interval Days</option>)}
                                    </select>
                                </div>

                                {/* 6. Reference Manual */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>6. Reference Manual</label>
                                    <select
                                        className="form-input"
                                        value={aiSelections.manualId}
                                        onChange={(e) => setAiSelections(prev => ({ ...prev, manualId: e.target.value }))}
                                        disabled={!aiSelections.assetId || aiOptions.manuals.length === 0}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', opacity: (!aiSelections.assetId || aiOptions.manuals.length === 0) ? 0.5 : 1 }}
                                    >
                                        <option value="">Select Manual...</option>
                                        {aiOptions.manuals.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                                    </select>
                                </div>

                            </div>

                            {/* Footer */}
                            <div style={{
                                padding: '16px 24px 24px', borderTop: '1px solid var(--border-color)',
                                display: 'flex', gap: '12px', justifyContent: 'flex-end',
                            }}>
                                <button
                                    onClick={() => setShowAiConfigModal(false)}
                                    style={{
                                        padding: '10px 20px', borderRadius: '10px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                                        cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRunAiCalculation}
                                    disabled={!aiSelections.assetId || !aiSelections.componentId || !aiSelections.fmeaId}
                                    style={{
                                        padding: '10px 24px', borderRadius: '10px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                        color: 'white', cursor: (!aiSelections.assetId || !aiSelections.componentId || !aiSelections.fmeaId) ? 'not-allowed' : 'pointer',
                                        fontSize: '13px', fontWeight: 700,
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        opacity: (!aiSelections.assetId || !aiSelections.componentId || !aiSelections.fmeaId) ? 0.5 : 1,
                                        boxShadow: '0 2px 12px rgba(99, 102, 241, 0.4)',
                                    }}
                                >
                                    <Calculator size={16} />
                                    Run AI Calculation
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </PageContainer>
        </>
    );
}

// Spin animation for loading spinners
const spinStyle = document.createElement('style');
spinStyle.textContent = `
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .spin { animation: spin 1s linear infinite; }
`;
if (!document.head.querySelector('[data-mp-spin]')) {
    spinStyle.setAttribute('data-mp-spin', '1');
    document.head.appendChild(spinStyle);
}
