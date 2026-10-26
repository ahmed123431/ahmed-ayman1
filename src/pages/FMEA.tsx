import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Pencil, Save, Trash2, ChevronDown, GitBranch, TableProperties, RefreshCw, Loader2 } from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import LogicTreeTable from '../components/LogicTreeTable';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import GlobalSearch from '../components/GlobalSearch';
import AssetSelector from '../components/AssetSelector';
import { useSidebar } from '../contexts/SidebarContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useSearch } from '../contexts/SearchContext';
import { useAssetContext } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import CreatableSelect from 'react-select/creatable';

interface FMEAItem {
    id: string;
    componentId?: string;
    component: string;
    function?: string;
    functionalFailure?: string;
    failureMode: string;
    failureCause: string;
    failureEffect: string;
    severity: number;
    occurrence: number;
    detection: number;
    rpn: number;
    riskLevel: string;
    criticalityIndex?: number;
    recommendedAction?: string;
    revisedRpn?: number;
}

function calculateRowSpans(data: FMEAItem[]) {
    const spans = {
        component: new Array(data.length).fill(0),
        function: new Array(data.length).fill(0),
        functionalFailure: new Array(data.length).fill(0),
    };

    let i = 0;
    while (i < data.length) {
        let componentCount = 1;
        while (i + componentCount < data.length && data[i + componentCount].component === data[i].component) {
            componentCount++;
        }
        spans.component[i] = componentCount;

        let j = i;
        while (j < i + componentCount) {
            let functionCount = 1;
            while (j + functionCount < i + componentCount && data[j + functionCount].function === data[j].function) {
                functionCount++;
            }
            spans.function[j] = functionCount;

            let k = j;
            while (k < j + functionCount) {
                let failureCount = 1;
                while (k + failureCount < j + functionCount && data[k + failureCount].functionalFailure === data[k].functionalFailure) {
                    failureCount++;
                }
                spans.functionalFailure[k] = failureCount;
                k += failureCount;
            }
            j += functionCount;
        }
        i += componentCount;
    }

    return spans;
}

const DEFAULT_FMEA: FMEAItem[] = [
    { id: '1', component: 'Bearing', function: 'Reduce shaft friction and support radial loads', failureMode: 'Bearing Seizure', failureCause: 'Lack of lubrication', failureEffect: 'Complete Shutdown', severity: 10, occurrence: 6, detection: 4, rpn: 240, riskLevel: 'Medium', recommendedAction: 'Install automated lubrication system', revisedRpn: 80 },
    { id: '2', component: 'Seal', function: 'Prevent fluid leakage from pump casing', failureMode: 'Leakage', failureCause: 'Wear and tear', failureEffect: 'Reduced Efficiency', severity: 7, occurrence: 8, detection: 6, rpn: 336, riskLevel: 'High', recommendedAction: 'Upgrade to mechanical double seal', revisedRpn: 112 },
    { id: '3', component: 'Motor', function: 'Convert electrical energy to mechanical rotation', failureMode: 'Overheating', failureCause: 'Cooling system failure', failureEffect: 'Performance Degradation', severity: 8, occurrence: 5, detection: 5, rpn: 200, riskLevel: 'Medium', recommendedAction: 'Install vibration & temperature sensors', revisedRpn: 120 },
    { id: '4', component: 'Impeller', function: 'Transfer energy to fluid to increase pressure', failureMode: 'Erosion', failureCause: 'Abrasive particles', failureEffect: 'Flow Reduction', severity: 6, occurrence: 7, detection: 7, rpn: 294, riskLevel: 'Medium', recommendedAction: 'Apply hard-facing coating', revisedRpn: 126 },
];

export default function FMEA() {
    const navigate = useNavigate();
    const { isMobile } = useSidebar();
    const { t, direction } = useLanguage();
    const { registerPageData, unregisterPageData } = useSearch();
    const { currentAssetId, storageKeyFor } = useAssetContext();
    const { user } = useAuth();
    const [fmeaData, setFmeaData] = useState<FMEAItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });
    const [ratingPopup, setRatingPopup] = useState<'severity' | 'occurrence' | 'detection' | null>(null);
    const [fmeaTab, setFmeaTab] = useState<'analysis' | 'logicTree'>('analysis');

    const [isRefreshing, setIsRefreshing] = useState(false);
    const n8nUrl = localStorage.getItem('n8n_fmea_webhook') || '';

    const handleRefreshAll = async () => {
        setIsRefreshing(true);
        try {
            // Build payload: user-input columns only
            const payload = fmeaData.map(item => ({
                fmeaId: item.id,
                component: item.component,
                function: item.function || '',
                functionalFailure: item.functionalFailure || '',
                failureMode: item.failureMode,
                failureCause: item.failureCause,
                failureEffect: item.failureEffect,
                severity: item.severity,
                occurrence: item.occurrence,
                detection: item.detection,
            }));

            if (n8nUrl) {
                // Real fetch from n8n
                const res = await fetch(n8nUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'analyze_fmea', items: payload }),
                });
                if (res.ok) {
                    const data = await res.json();
                    let results: any[] = [];
                    if (Array.isArray(data)) results = data;
                    else if (data?.results && Array.isArray(data.results)) results = data.results;
                    applyRefreshResults(results);
                } else {
                    console.error('Error from n8n:', await res.text());
                }
            } else {
                // Simulate n8n response for demo
                await new Promise(resolve => setTimeout(resolve, 1500));
                const simulated = fmeaData.map(item => {
                    const criticalityIndex = item.severity * item.occurrence;
                    const rpn = criticalityIndex * item.detection;
                    const riskLevel = calculateRiskLevel(rpn);
                    return {
                        fmeaId: item.id,
                        severity: item.severity,
                        occurrence: item.occurrence,
                        detection: item.detection,
                        rpn,
                        riskLevel,
                        criticalityIndex,
                        recommendedAction: riskLevel === 'High' ? 'Requires immediate design/process control changes' : (riskLevel === 'Medium' ? 'Consider additional preventive controls' : 'Maintain standard operating procedures'),
                        revisedRpn: Math.max(1, Math.floor(rpn * 0.4)),
                    };
                });
                applyRefreshResults(simulated);
            }
        } catch (err) {
            console.error('Failed to refresh FMEA data:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    const applyRefreshResults = (results: any[]) => {
        if (results.length === 0) return;
        setFmeaData(prev => {
            const updated = [...prev];
            results.forEach((incoming: any) => {
                const idx = updated.findIndex(f => f.id === incoming.fmeaId);
                if (idx >= 0) {
                    const s = incoming.severity ?? updated[idx].severity;
                    const o = incoming.occurrence ?? updated[idx].occurrence;
                    const d = incoming.detection ?? updated[idx].detection;
                    const calculatedRpn = s * o * d;
                    updated[idx] = {
                        ...updated[idx],
                        severity: s,
                        occurrence: o,
                        detection: d,
                        rpn: incoming.rpn ?? calculatedRpn,
                        riskLevel: incoming.riskLevel ?? calculateRiskLevel(incoming.rpn ?? calculatedRpn),
                        criticalityIndex: incoming.criticalityIndex ?? (s * o),
                        recommendedAction: incoming.recommendedAction ?? updated[idx].recommendedAction,
                        revisedRpn: incoming.revisedRpn ?? updated[idx].revisedRpn,
                    };
                }
            });
            return updated;
        });
    };

    // Fetch FMEA data from Supabase
    const loadFmeaData = async () => {
        if (!user || !currentAssetId) {
            setFmeaData([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('fmea')
                .select('*, components(name)')
                .eq('asset_id', currentAssetId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                // If we want to seed defaults, we could do it here, but let's just return empty array for now
                setFmeaData([]);
            } else {
                const mappedData = data.map(item => ({
                    id: item.id,
                    componentId: item.component_id,
                    component: item.components?.name || item.component || 'Unknown',
                    function: item.function,
                    functionalFailure: item.functional_failure,
                    failureMode: item.failure_mode,
                    failureCause: item.failure_cause,
                    failureEffect: item.failure_effect,
                    severity: item.severity,
                    occurrence: item.occurrence,
                    detection: item.detection,
                    rpn: item.rpn,
                    riskLevel: item.risk_level,
                    criticalityIndex: item.criticality_index,
                    recommendedAction: item.recommended_action,
                    revisedRpn: item.revised_rpn
                }));

                // Group by Component -> Function -> Functional Failure for RowSpan merging
                mappedData.sort((a, b) => {
                    if (a.component !== b.component) return a.component.localeCompare(b.component);
                    if (a.function !== b.function) return (a.function || '').localeCompare(b.function || '');
                    if (a.functionalFailure !== b.functionalFailure) return (a.functionalFailure || '').localeCompare(b.functionalFailure || '');
                    return 0;
                });

                setFmeaData(mappedData);
            }
        } catch (error) {
            console.error('Error loading FMEA data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFmeaData();
    }, [currentAssetId, user]);

    // Form state
    const [componentOptions, setComponentOptions] = useState<any[]>([]);
    const [newComponentId, setNewComponentId] = useState<string>('');
    const [componentSearch, setComponentSearch] = useState<string>('');
    const [showComponentDropdown, setShowComponentDropdown] = useState(false);
    const [isCreatingComponent, setIsCreatingComponent] = useState(false);

    useEffect(() => {
        if (showAddModal && currentAssetId) {
            const loadComponentOptions = async () => {
                const { data } = await supabase.from('components').select('id, name').eq('asset_id', currentAssetId);
                if (data) setComponentOptions(data);
            };
            loadComponentOptions();
        }
    }, [showAddModal, currentAssetId]);

    const handleCreateComponent = async () => {
        if (!componentSearch || !currentAssetId || !user) return;
        setIsCreatingComponent(true);
        try {
            const { data, error } = await supabase.from('components').insert({
                user_id: user.id,
                asset_id: currentAssetId,
                name: componentSearch,
            }).select().single();

            if (error) throw error;
            if (data) {
                setComponentOptions(prev => [...prev, data]);
                setNewComponentId(data.id);
                setComponentSearch(data.name);
            }
        } catch (error) {
            console.error('Error creating component:', error);
            alert('Failed to create component.');
        } finally {
            setIsCreatingComponent(false);
            setShowComponentDropdown(false);
        }
    };

    const [newComponent, setNewComponent] = useState('');
    const [newFunction, setNewFunction] = useState('');
    const [newFunctionalFailure, setNewFunctionalFailure] = useState('');
    const [newFailureMode, setNewFailureMode] = useState('');
    const [newFailureCause, setNewFailureCause] = useState('');
    const [newFailureEffect, setNewFailureEffect] = useState('');

    const [functionOptions, setFunctionOptions] = useState<{ value: string, label: string, id: string }[]>([]);
    const [failureOptions, setFailureOptions] = useState<{ value: string, label: string }[]>([]);

    useEffect(() => {
        if (showAddModal) {
            const fetchOptions = async () => {
                // Fetch all functions
                const { data: funcData } = await supabase.from('functions').select('id, name, component_id');
                // Fetch all functional failures
                const { data: failData } = await supabase.from('functional_failures').select('id, name, function_id');

                // We also check existing fmea records to populate historical data
                let fmeaQuery = supabase.from('fmea').select('function, functional_failure, component_id');
                if (newComponentId) {
                    fmeaQuery = fmeaQuery.eq('component_id', newComponentId);
                }
                const { data: fmeaData } = await fmeaQuery;

                let funcs: { value: string, label: string, id: string }[] = [];
                let fails: { value: string, label: string }[] = [];

                if (funcData) {
                    // Filter functions by selected component if one is selected, otherwise show all
                    const filteredFuncs = newComponentId
                        ? funcData.filter(f => f.component_id === newComponentId)
                        : funcData;
                    funcs = filteredFuncs.map(d => ({ value: d.name, label: d.name, id: d.id }));
                }

                if (failData) {
                    // Filter failures by selected function if one is selected
                    const selectedFuncObj = funcData?.find(f => f.name === newFunction);
                    const filteredFails = selectedFuncObj
                        ? failData.filter(f => f.function_id === selectedFuncObj.id)
                        : failData;
                    fails = filteredFails.map(d => ({ value: d.name, label: d.name }));
                }

                // Append historical data from fmea table if not already present, respecting mapping
                if (fmeaData) {
                    fmeaData.forEach(row => {
                        if (row.function && !funcs.some(f => f.value === row.function)) {
                            funcs.push({ value: row.function, label: row.function, id: '' });
                        }
                        // Only add functional failures that are mapped to the currently selected function
                        if (row.functional_failure && row.function === newFunction && !fails.some(f => f.value === row.functional_failure)) {
                            fails.push({ value: row.functional_failure, label: row.functional_failure });
                        }
                    });
                }

                setFunctionOptions(funcs);
                setFailureOptions(fails);
            };
            fetchOptions();
        }
    }, [showAddModal, newComponentId, newFunction]);

    const selectedFuncId = functionOptions.find(o => o.value === newFunction)?.id;
    const [newSeverity, setNewSeverity] = useState(5);
    const [newOccurrence, setNewOccurrence] = useState(5);
    const [newDetection, setNewDetection] = useState(5);
    const [newAction, setNewAction] = useState('');
    const [newRevisedRpn, setNewRevisedRpn] = useState<number | ''>('');

    // ========================================
    // FMEA RANKING CRITERIA DATA
    // ========================================
    const severityCriteria = [
        { rank: 10, effect: 'Hazardous – without warning', criteria: 'Very high severity ranking when a potential failure mode affects safe operation and/or involves noncompliance with regulations without warning.' },
        { rank: 9, effect: 'Hazardous – with warning', criteria: 'Very high severity ranking when a potential failure mode affects safe operation and/or involves noncompliance with regulations with warning.' },
        { rank: 8, effect: 'Very High', criteria: 'Product/item inoperable, with loss of primary function.' },
        { rank: 7, effect: 'High', criteria: 'Product/item operable, but at a reduced level of performance. Customer dissatisfied.' },
        { rank: 6, effect: 'Moderate', criteria: 'Product/item operable but may cause rework/repair and/or damage to equipment.' },
        { rank: 5, effect: 'Low', criteria: 'Product/item operable but may cause slight inconvenience to related operations.' },
        { rank: 4, effect: 'Very Low', criteria: 'Product/item operable but possesses some defects (aesthetic and otherwise) noticeable to most customers.' },
        { rank: 3, effect: 'Minor', criteria: 'Product/item operable but may possess some defects noticeable by discriminating against customers.' },
        { rank: 2, effect: 'Very Minor', criteria: 'Product/item operable but follows company policy.' },
        { rank: 1, effect: 'None', criteria: 'No effect.' },
    ];

    const occurrenceCriteria = [
        { rank: 10, probability: 'Very High: Failure is almost inevitable', rate: '1 in 2' },
        { rank: 9, probability: 'Very High: Failure is almost inevitable', rate: '1 in 3' },
        { rank: 8, probability: 'High: Repeated Failures', rate: '1 in 8' },
        { rank: 7, probability: 'High: Repeated Failures', rate: '1 in 20' },
        { rank: 6, probability: 'Moderate: Occasional Failures', rate: '1 in 80' },
        { rank: 5, probability: 'Moderate: Occasional Failures', rate: '1 in 400' },
        { rank: 4, probability: 'Moderate: Occasional Failures', rate: '1 in 2,000' },
        { rank: 3, probability: 'Low: Relatively Few Failures', rate: '1 in 15,000' },
        { rank: 2, probability: 'Low: Relatively Few Failures', rate: '1 in 150,000' },
        { rank: 1, probability: 'Remote: Failure is Unlikely', rate: '1 in 1,500,000' },
    ];

    const detectionCriteria = [
        { rank: 10, detection: 'Absolute Uncertainty', criteria: 'Design Control will not and/or cannot detect a potential cause/mechanism and subsequent failure mode.' },
        { rank: 9, detection: 'Very Remote', criteria: 'Very remote chance the Design Control will detect a potential cause/mechanism and subsequent failure mode.' },
        { rank: 8, detection: 'Remote', criteria: 'Remote chance the Design Control will detect a potential cause/mechanism and subsequent failure mode.' },
        { rank: 7, detection: 'Very Low', criteria: 'Very low chance the Design Control will detect a potential cause/mechanism and subsequent failure mode.' },
        { rank: 6, detection: 'Low', criteria: 'Low chance Design Control will detect a potential cause/mechanism and subsequent failure mode.' },
        { rank: 5, detection: 'Moderate', criteria: 'Moderate chance the Design Control will detect a potential cause/mechanism and subsequent failure mode.' },
        { rank: 4, detection: 'Moderately High', criteria: 'Moderately high chance the Design Control will detect a potential cause/mechanism and subsequent failure mode.' },
        { rank: 3, detection: 'High', criteria: 'High chance Design Control will detect a potential cause/mechanism and subsequent failure mode.' },
        { rank: 2, detection: 'Very High', criteria: 'Very high chance the Design Control will detect a potential cause/mechanism and subsequent failure mode.' },
        { rank: 1, detection: 'Almost Certain', criteria: 'Design Control will certainly detect a potential cause/mechanism and subsequent failure mode.' },
    ];

    const getSeverityLabel = (rank: number) => severityCriteria.find(s => s.rank === rank)?.effect || '';
    const getOccurrenceLabel = (rank: number) => occurrenceCriteria.find(o => o.rank === rank)?.probability?.split(':')[0] || '';
    const getDetectionLabel = (rank: number) => detectionCriteria.find(d => d.rank === rank)?.detection || '';

    const getRankColor = (rank: number) => {
        if (rank >= 8) return 'var(--danger-500)';
        if (rank >= 5) return 'var(--warning-500)';
        return 'var(--success-500)';
    };

    // Register FMEA data with search context
    useEffect(() => {
        registerPageData('fmea', {
            items: fmeaData,
            searchFields: ['component', 'failureMode', 'failureCause', 'failureEffect', 'riskLevel'],
            resultType: 'fmea',
            formatResult: (item: FMEAItem) => ({
                displayTitle: `${item.component} - ${item.failureMode}`,
                displaySubtitle: `Cause: ${item.failureCause} • RPN: ${item.rpn}`,
                badge: {
                    label: item.riskLevel,
                    variant: item.riskLevel === 'High' ? 'danger' as const : item.riskLevel === 'Medium' ? 'warning' as const : 'success' as const
                }
            })
        });
        return () => unregisterPageData('fmea');
    }, [fmeaData, registerPageData, unregisterPageData]);

    // Risk Level based on RPN (Range: 1-1000)
    const calculateRiskLevel = (rpn: number): string => {
        if (rpn >= 200) return 'Critical';
        if (rpn >= 100) return 'High';
        if (rpn >= 50) return 'Moderate';
        return 'Low';
    };

    // Criticality Index = Severity × Occurrence (range 1-100)
    const calculateCriticality = (s: number, o: number): number => s * o;

    const getCriticalityColor = (cm: number): string => {
        if (cm >= 60) return 'var(--danger-500)';
        if (cm >= 30) return 'var(--warning-500)';
        return 'var(--success-500)';
    };

    const getCriticalityLabel = (cm: number): string => {
        if (cm >= 60) return 'Critical';
        if (cm >= 30) return 'Significant';
        return 'Marginal';
    };

    const handleAddFMEA = async () => {
        if (!currentAssetId) {
            alert('Please select an asset first using the dropdown at the top.');
            return;
        }
        if (!newComponentId || !newFailureMode || !newFailureCause || !newFailureEffect) {
            alert('Please select a component and enter failure mode, cause and effect.');
            return;
        }
        if (!user) return;

        const rpn = newSeverity * newOccurrence * newDetection;
        const riskLevel = calculateRiskLevel(rpn);
        const criticalityIndex = calculateCriticality(newSeverity, newOccurrence);

        try {
            let funcId = selectedFuncId;
            if (newFunction && newComponentId && !funcId) {
                const { data } = await supabase.from('functions').insert({ component_id: newComponentId, name: newFunction }).select().single();
                if (data) funcId = data.id;
            }
            if (newFunctionalFailure && funcId) {
                const existingFailure = failureOptions.find(o => o.value === newFunctionalFailure);
                if (!existingFailure) {
                    await supabase.from('functional_failures').insert({ function_id: funcId, name: newFunctionalFailure });
                }
            }

            const { error } = await supabase
                .from('fmea')
                .insert([{
                    user_id: user.id,
                    asset_id: currentAssetId,
                    component_id: newComponentId,
                    function: newFunction,
                    functional_failure: newFunctionalFailure,
                    failure_mode: newFailureMode,
                    failure_cause: newFailureCause,
                    failure_effect: newFailureEffect,
                    severity: newSeverity,
                    occurrence: newOccurrence,
                    detection: newDetection,
                    rpn,
                    risk_level: riskLevel,
                    criticality_index: criticalityIndex,
                    recommended_action: newAction,
                    revised_rpn: newRevisedRpn === '' ? null : newRevisedRpn
                }]);

            if (error) throw error;
            await loadFmeaData();

            setShowAddModal(false);
            resetForm();
        } catch (error) {
            console.error('Error adding FMEA:', error);
        }
    };

    const resetForm = () => {
        setNewComponentId('');
        setComponentSearch('');
        setNewComponent('');
        setNewFunction('');
        setNewFunctionalFailure('');
        setNewFailureMode('');
        setNewFailureCause('');
        setNewFailureEffect('');
        setNewSeverity(5);
        setNewOccurrence(5);
        setNewDetection(5);
        setNewAction('');
        setNewRevisedRpn('');
        setEditingId(null);
    };

    const handleEditFMEA = (item: FMEAItem) => {
        setNewComponentId(item.componentId || '');
        setComponentSearch(item.component);
        setNewComponent(item.component);
        setNewFunction(item.function || '');
        setNewFunctionalFailure(item.functionalFailure || '');
        setNewFailureMode(item.failureMode);
        setNewFailureCause(item.failureCause);
        setNewFailureEffect(item.failureEffect);
        setNewSeverity(item.severity);
        setNewOccurrence(item.occurrence);
        setNewDetection(item.detection);
        setNewAction(item.recommendedAction || '');
        setNewRevisedRpn(item.revisedRpn ?? '');
        setEditingId(item.id);
        setShowAddModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingId || !newComponentId || !newFailureMode || !newFailureCause || !newFailureEffect) return;
        const rpn = newSeverity * newOccurrence * newDetection;
        const riskLevel = calculateRiskLevel(rpn);
        const criticalityIndex = calculateCriticality(newSeverity, newOccurrence);

        try {
            let funcId = selectedFuncId;
            if (newFunction && newComponentId && !funcId) {
                const { data } = await supabase.from('functions').insert({ component_id: newComponentId, name: newFunction }).select().single();
                if (data) funcId = data.id;
            }
            if (newFunctionalFailure && funcId) {
                const existingFailure = failureOptions.find(o => o.value === newFunctionalFailure);
                if (!existingFailure) {
                    await supabase.from('functional_failures').insert({ function_id: funcId, name: newFunctionalFailure });
                }
            }

            const { error } = await supabase
                .from('fmea')
                .update({
                    component_id: newComponentId,
                    function: newFunction,
                    functional_failure: newFunctionalFailure,
                    failure_mode: newFailureMode,
                    failure_cause: newFailureCause,
                    failure_effect: newFailureEffect,
                    severity: newSeverity,
                    occurrence: newOccurrence,
                    detection: newDetection,
                    rpn,
                    risk_level: riskLevel,
                    criticality_index: criticalityIndex,
                    recommended_action: newAction,
                    revised_rpn: newRevisedRpn === '' ? null : newRevisedRpn
                })
                .eq('id', editingId);

            if (error) throw error;
            await loadFmeaData();

            setShowAddModal(false);
            resetForm();
        } catch (error) {
            console.error('Error updating FMEA:', error);
        }
    };

    const handleDeleteFMEA = (item: FMEAItem) => {
        setDeleteConfirm({ isOpen: true, id: item.id, name: item.component });
    };

    const confirmDeleteFMEA = async () => {
        try {
            const { error } = await supabase
                .from('fmea')
                .delete()
                .eq('id', deleteConfirm.id);

            if (error) throw error;
            await loadFmeaData();
        } catch (error) {
            console.error('Error deleting FMEA:', error);
        } finally {
            setDeleteConfirm({ isOpen: false, id: '', name: '' });
        }
    };

    const getRPNColor = (rpn: number) => {
        if (rpn >= 200) return '#ef4444'; // Red/danger
        if (rpn >= 100) return '#f97316'; // Orange
        if (rpn >= 50) return '#f59e0b'; // Yellow/warning
        return '#10b981'; // Green
    };

    const getRiskBadge = (level: string) => {
        switch (level) {
            case 'Critical': return 'badge-danger';
            case 'High': return 'badge-orange';
            case 'Moderate': return 'badge-warning';
            case 'Low': return 'badge-success';
            default: return 'badge-primary';
        }
    };

    return (
        <>
            <Sidebar />
            <PageContainer>
                <div className="container" style={{ maxWidth: '1400px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'stretch' : 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-xl)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                            <button onClick={() => navigate('/')} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}>
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 style={{ marginBottom: 'var(--spacing-xs)', fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)' }}>{t('fmea.title')}</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)' }}>
                                    {t('fmea.subtitle')}
                                </p>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                            width: isMobile ? '100%' : 'auto'
                        }}>
                            <AssetSelector />
                            <GlobalSearch pageType="fmea" />
                            {fmeaTab === 'analysis' && (
                                <>
                                    <button
                                        onClick={handleRefreshAll}
                                        disabled={isRefreshing}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '8px 14px', borderRadius: 'var(--radius-md)',
                                            border: 'none',
                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                            color: 'white',
                                            cursor: isRefreshing ? 'wait' : 'pointer',
                                            fontSize: '13px', fontWeight: 600,
                                            opacity: isRefreshing ? 0.7 : 1,
                                        }}
                                    >
                                        {isRefreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setShowAddModal(true)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 'var(--spacing-sm)',
                                            width: isMobile ? '100%' : 'auto',
                                            flex: isMobile ? 1 : 'none'
                                        }}
                                    >
                                        <Plus size={20} />
                                        {t('fmea.add')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div style={{
                        display: 'flex',
                        gap: '0',
                        marginBottom: 'var(--spacing-xl)',
                        borderBottom: '2px solid var(--border-color)',
                    }}>
                        <button
                            onClick={() => setFmeaTab('analysis')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: 'var(--spacing-sm) var(--spacing-lg)',
                                background: 'none',
                                border: 'none',
                                borderBottom: fmeaTab === 'analysis' ? '2px solid var(--primary-500)' : '2px solid transparent',
                                marginBottom: '-2px',
                                cursor: 'pointer',
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: fmeaTab === 'analysis' ? '700' : '500',
                                color: fmeaTab === 'analysis' ? 'var(--primary-500)' : 'var(--text-tertiary)',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <GitBranch size={16} />
                            FMEA Analysis
                        </button>
                        <button
                            onClick={() => setFmeaTab('logicTree')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: 'var(--spacing-sm) var(--spacing-lg)',
                                background: 'none',
                                border: 'none',
                                borderBottom: fmeaTab === 'logicTree' ? '2px solid #ff6d00' : '2px solid transparent',
                                marginBottom: '-2px',
                                cursor: 'pointer',
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: fmeaTab === 'logicTree' ? '700' : '500',
                                color: fmeaTab === 'logicTree' ? '#ff6d00' : 'var(--text-tertiary)',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <TableProperties size={16} />
                            Logic Tree
                        </button>
                    </div>

                    {fmeaTab === 'logicTree' ? (
                        <LogicTreeTable fmeaData={fmeaData} storageKey={storageKeyFor('fmea')} isMobile={isMobile} />
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(160px, 1fr))',
                                gap: 'var(--spacing-md)',
                                marginBottom: 'var(--spacing-xl)'
                            }}>
                                {/* Total Failure Modes */}
                                <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                        {t('fmea.totalFailureModes')}
                                    </div>
                                    <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                        {fmeaData.length}
                                    </div>
                                </div>
                                {/* Moderate Risk 50–99 */}
                                <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '3px solid #EAB308' }}>
                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                        Moderate Risk (50–99)
                                    </div>
                                    <div style={{ color: '#EAB308', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                        {fmeaData.filter(f => f.rpn >= 50 && f.rpn <= 99).length}
                                    </div>
                                </div>
                                {/* High Risk 100–199 */}
                                <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '3px solid #EA580C' }}>
                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                        High Risk (100–199)
                                    </div>
                                    <div style={{ color: '#EA580C', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                        {fmeaData.filter(f => f.rpn >= 100 && f.rpn <= 199).length}
                                    </div>
                                </div>
                                {/* Critical RPN ≥ 200 */}
                                <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '3px solid #DC2626' }}>
                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                        Critical (RPN ≥ 200)
                                    </div>
                                    <div style={{ color: '#DC2626', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                        {fmeaData.filter(f => f.rpn >= 200).length}
                                    </div>
                                </div>
                                {/* Average RPN */}
                                <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                        {t('fmea.averageRpn')}
                                    </div>
                                    <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                        {fmeaData.length > 0 ? Math.round(fmeaData.reduce((sum, f) => sum + f.rpn, 0) / fmeaData.length) : 0}
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                background: 'var(--bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--border-color)',
                                overflow: 'auto'
                            }}>
                                {loading ? (
                                    <div style={{ textAlign: 'center', padding: 'var(--spacing-3xl)', color: 'var(--text-tertiary)' }}>
                                        <div className="animate-pulse" style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>Loading FMEA data...</div>
                                    </div>
                                ) : fmeaData.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 'var(--spacing-3xl)', color: 'var(--text-tertiary)' }}>
                                        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>No FMEA entries found for this asset.</div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-sm)' }}>Click "Add Entry" to get started.</div>
                                    </div>
                                ) : (
                                    <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                                        <thead style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            <tr>
                                                <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '1px solid var(--border-color)', width: '8%' }}>{t('fmea.component')}</th>
                                                <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '1px solid var(--border-color)', width: '10%' }}>Function</th>
                                                <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '1px solid var(--border-color)', width: '10%' }}>Functional Failure</th>
                                                <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '1px solid var(--border-color)', width: '10%' }}>{t('fmea.failureMode')}</th>
                                                <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '1px solid var(--border-color)', width: '10%' }}>{t('fmea.cause')}</th>
                                                <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '1px solid var(--border-color)', width: '10%' }}>{t('fmea.effect')}</th>
                                                <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '1px solid var(--border-color)', width: '5%', textAlign: 'center' }}>S</th>
                                                <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '1px solid var(--border-color)', width: '5%', textAlign: 'center' }}>O</th>
                                                <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '1px solid var(--border-color)', width: '5%', textAlign: 'center' }}>D</th>
                                                <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '1px solid var(--border-color)', width: '7%', textAlign: 'center' }}>Failure Criticality</th>
                                                <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '1px solid var(--border-color)', width: '6%', textAlign: 'center' }}>RPN</th>
                                                <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '1px solid var(--border-color)', width: '10%', textAlign: 'center' }}>{t('fmea.riskLevel')}</th>
                                                <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '1px solid var(--border-color)', width: '6%', textAlign: 'center' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const spans = calculateRowSpans(fmeaData);
                                                return fmeaData.map((item, index) => (
                                                    <tr
                                                        key={item.id}
                                                        style={{ transition: 'background var(--transition-fast)', borderBottom: index < fmeaData.length - 1 ? '1px solid var(--border-color)' : 'none' }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        {spans.component[index] > 0 && (
                                                            <td rowSpan={spans.component[index]} style={{ padding: 'var(--spacing-md) var(--spacing-sm)', color: 'var(--text-primary)', fontWeight: 600, verticalAlign: 'top', borderRight: '1px solid var(--border-color)' }}>{item.component}</td>
                                                        )}
                                                        {spans.function[index] > 0 && (
                                                            <td rowSpan={spans.function[index]} style={{ padding: 'var(--spacing-md) var(--spacing-sm)', color: 'var(--text-secondary)', verticalAlign: 'top', borderRight: '1px solid var(--border-color)' }}>{item.function || '-'}</td>
                                                        )}
                                                        {spans.functionalFailure[index] > 0 && (
                                                            <td rowSpan={spans.functionalFailure[index]} style={{ padding: 'var(--spacing-md) var(--spacing-sm)', color: 'var(--text-secondary)', verticalAlign: 'top', borderRight: '1px solid var(--border-color)' }}>{item.functionalFailure || '-'}</td>
                                                        )}
                                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', color: 'var(--text-secondary)' }}>{item.failureMode}</td>
                                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', color: 'var(--text-secondary)' }}>{item.failureCause}</td>
                                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', color: 'var(--text-secondary)' }}>{item.failureEffect}</td>
                                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', color: 'var(--text-secondary)', textAlign: 'center' }}>{item.severity}</td>
                                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', color: 'var(--text-secondary)', textAlign: 'center' }}>{item.occurrence}</td>
                                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', color: 'var(--text-secondary)', textAlign: 'center' }}>{item.detection}</td>
                                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center' }}>
                                                            {(() => {
                                                                const cm = item.criticalityIndex ?? calculateCriticality(item.severity, item.occurrence);
                                                                return (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                                        <span style={{
                                                                            fontSize: '14px',
                                                                            fontWeight: '700',
                                                                            color: getCriticalityColor(cm),
                                                                        }}>
                                                                            {cm}
                                                                        </span>
                                                                        <span style={{
                                                                            fontSize: '9px',
                                                                            fontWeight: '600',
                                                                            color: getCriticalityColor(cm),
                                                                            textTransform: 'uppercase',
                                                                            letterSpacing: '0.5px',
                                                                            opacity: 0.8,
                                                                        }}>
                                                                            {getCriticalityLabel(cm)}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center' }}>
                                                            <span style={{
                                                                fontSize: '15px',
                                                                fontWeight: '700',
                                                                color: '#000000'
                                                            }}>
                                                                {item.rpn}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center' }}>
                                                            {(() => {
                                                                const rl = item.rpn >= 200 ? 'Critical'
                                                                    : item.rpn >= 100 ? 'High'
                                                                        : item.rpn >= 50 ? 'Moderate'
                                                                            : 'Low';
                                                                const bg = rl === 'Critical' ? '#fee2e2'
                                                                    : rl === 'High' ? '#ffedd5'
                                                                        : rl === 'Moderate' ? '#fef3c7'
                                                                            : '#dcfce7';
                                                                const fg = rl === 'Critical' ? '#DC2626'
                                                                    : rl === 'High' ? '#EA580C'
                                                                        : rl === 'Moderate' ? '#EAB308'
                                                                            : '#16A34A';
                                                                return (
                                                                    <span style={{
                                                                        background: bg,
                                                                        color: fg,
                                                                        padding: '4px 12px',
                                                                        borderRadius: '20px',
                                                                        fontSize: '11px',
                                                                        fontWeight: '800',
                                                                        textTransform: 'uppercase'
                                                                    }}>{rl}</span>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-xs)', opacity: 0.6, transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                                                                <button onClick={() => handleEditFMEA(item)} className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto', color: 'var(--text-secondary)' }} title="Edit"><Pencil size={16} /></button>
                                                                <button onClick={() => handleDeleteFMEA(item)} className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto', color: 'var(--text-secondary)' }} title="Delete"><Trash2 size={16} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </PageContainer>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>

            {/* Add FMEA Modal */}
            {showAddModal && (
                <>
                    <div
                        onClick={() => { setShowAddModal(false); resetForm(); }}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.7)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 9998,
                        }}
                    />
                    <div
                        className="card-glass"
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '90%',
                            maxWidth: '650px',
                            padding: 'var(--spacing-xl)',
                            zIndex: 9999,
                            maxHeight: '90vh',
                            overflowY: 'auto',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                            <h2 style={{ margin: 0 }}>{editingId ? 'Edit FMEA Entry' : t('fmea.add')}</h2>
                            <button onClick={() => { setShowAddModal(false); resetForm(); }} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <div style={{ position: 'relative' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    {t('fmea.component')} <span style={{ color: 'var(--danger-500)' }}>*</span>
                                </label>
                                <input
                                    className="input"
                                    value={componentSearch}
                                    onChange={(e) => {
                                        setComponentSearch(e.target.value);
                                        setNewComponentId(''); // Clear selected ID if typing
                                        setShowComponentDropdown(true);
                                    }}
                                    onFocus={() => setShowComponentDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowComponentDropdown(false), 200)}
                                    placeholder="Search or create component..."
                                />
                                {showComponentDropdown && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0,
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                        borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '4px'
                                    }}>
                                        {componentOptions.filter(c => c.name.toLowerCase().includes(componentSearch.toLowerCase())).map(c => (
                                            <div
                                                key={c.id}
                                                style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-primary)' }}
                                                onClick={() => {
                                                    setNewComponentId(c.id);
                                                    setComponentSearch(c.name);
                                                    setShowComponentDropdown(false);
                                                }}
                                            >
                                                {c.name}
                                            </div>
                                        ))}
                                        {componentSearch && !componentOptions.some(c => c.name.toLowerCase() === componentSearch.toLowerCase()) && (
                                            <div
                                                style={{ padding: '10px 12px', cursor: 'pointer', color: 'var(--primary-500)', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                onClick={handleCreateComponent}
                                            >
                                                {isCreatingComponent ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                                                Create "{componentSearch}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    Function
                                </label>
                                <CreatableSelect
                                    isClearable
                                    isDisabled={!newComponentId}
                                    options={functionOptions}
                                    value={newFunction ? { value: newFunction, label: newFunction } : null}
                                    onChange={(newValue) => setNewFunction(newValue ? newValue.value : '')}
                                    onCreateOption={(inputValue) => setNewFunction(inputValue)}
                                    placeholder={newComponentId ? "Select or type new function..." : "Select a component first"}
                                    formatCreateLabel={(inputValue) => `Create new function "${inputValue}"`}
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            background: 'var(--bg-secondary)',
                                            borderColor: 'var(--border-color)',
                                            color: 'var(--text-primary)',
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)',
                                            zIndex: 9999
                                        }),
                                        singleValue: (base) => ({ ...base, color: 'var(--text-primary)' }),
                                        input: (base) => ({ ...base, color: 'var(--text-primary)' })
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    Functional Failure
                                </label>
                                <CreatableSelect
                                    isClearable
                                    isDisabled={!newFunction}
                                    options={failureOptions}
                                    value={newFunctionalFailure ? { value: newFunctionalFailure, label: newFunctionalFailure } : null}
                                    onChange={(newValue) => setNewFunctionalFailure(newValue ? newValue.value : '')}
                                    onCreateOption={(inputValue) => setNewFunctionalFailure(inputValue)}
                                    placeholder={newFunction ? "Select or type new failure..." : "Select a function first"}
                                    formatCreateLabel={(inputValue) => `Create new failure "${inputValue}"`}
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            background: 'var(--bg-secondary)',
                                            borderColor: 'var(--border-color)',
                                            color: 'var(--text-primary)',
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)',
                                            zIndex: 9999
                                        }),
                                        singleValue: (base) => ({ ...base, color: 'var(--text-primary)' }),
                                        input: (base) => ({ ...base, color: 'var(--text-primary)' })
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    {t('fmea.failureMode')} <span style={{ color: 'var(--danger-500)' }}>*</span>
                                </label>
                                <input className="input" value={newFailureMode} onChange={(e) => setNewFailureMode(e.target.value)} placeholder={t('fmea.failureModePlaceholder')} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    {t('fmea.cause')} <span style={{ color: 'var(--danger-500)' }}>*</span>
                                </label>
                                <input className="input" value={newFailureCause} onChange={(e) => setNewFailureCause(e.target.value)} placeholder={t('fmea.causePlaceholder')} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    {t('fmea.effect')} <span style={{ color: 'var(--danger-500)' }}>*</span>
                                </label>
                                <input className="input" value={newFailureEffect} onChange={(e) => setNewFailureEffect(e.target.value)} placeholder={t('fmea.effectPlaceholder')} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-md)' }}>
                                {/* Severity Button */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                        {t('fmea.severity')} (S)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setRatingPopup('severity')}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                            background: 'var(--bg-tertiary)',
                                            border: `2px solid ${getRankColor(newSeverity)}40`,
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 'var(--spacing-sm)',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = getRankColor(newSeverity); e.currentTarget.style.background = `${getRankColor(newSeverity)}08`; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${getRankColor(newSeverity)}40`; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <span style={{
                                                width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
                                                background: `${getRankColor(newSeverity)}18`,
                                                color: getRankColor(newSeverity),
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 700, fontSize: 'var(--font-size-sm)',
                                            }}>{newSeverity}</span>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                                                {getSeverityLabel(newSeverity)}
                                            </span>
                                        </div>
                                        <ChevronDown size={16} color="var(--text-tertiary)" />
                                    </button>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>{t('fmea.severityHint')}</div>
                                </div>
                                {/* Occurrence Button */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                        {t('fmea.occurrence')} (O)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setRatingPopup('occurrence')}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                            background: 'var(--bg-tertiary)',
                                            border: `2px solid ${getRankColor(newOccurrence)}40`,
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 'var(--spacing-sm)',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = getRankColor(newOccurrence); e.currentTarget.style.background = `${getRankColor(newOccurrence)}08`; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${getRankColor(newOccurrence)}40`; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <span style={{
                                                width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
                                                background: `${getRankColor(newOccurrence)}18`,
                                                color: getRankColor(newOccurrence),
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 700, fontSize: 'var(--font-size-sm)',
                                            }}>{newOccurrence}</span>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                                                {getOccurrenceLabel(newOccurrence)}
                                            </span>
                                        </div>
                                        <ChevronDown size={16} color="var(--text-tertiary)" />
                                    </button>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>{t('fmea.occurrenceHint')}</div>
                                </div>
                                {/* Detection Button */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                        {t('fmea.detection')} (D)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setRatingPopup('detection')}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                            background: 'var(--bg-tertiary)',
                                            border: `2px solid ${getRankColor(newDetection)}40`,
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 'var(--spacing-sm)',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = getRankColor(newDetection); e.currentTarget.style.background = `${getRankColor(newDetection)}08`; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${getRankColor(newDetection)}40`; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <span style={{
                                                width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
                                                background: `${getRankColor(newDetection)}18`,
                                                color: getRankColor(newDetection),
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 700, fontSize: 'var(--font-size-sm)',
                                            }}>{newDetection}</span>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                                                {getDetectionLabel(newDetection)}
                                            </span>
                                        </div>
                                        <ChevronDown size={16} color="var(--text-tertiary)" />
                                    </button>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>{t('fmea.detectionHint')}</div>
                                </div>
                            </div>

                            <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginTop: 'var(--spacing-sm)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>Failure Criticality (Cm)</div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: getCriticalityColor(newSeverity * newOccurrence) }}>
                                                {newSeverity * newOccurrence}
                                            </div>
                                            <span style={{
                                                fontSize: '11px', fontWeight: 700,
                                                color: getCriticalityColor(newSeverity * newOccurrence),
                                                textTransform: 'uppercase', letterSpacing: '0.5px',
                                                padding: '2px 8px',
                                                background: `${getCriticalityColor(newSeverity * newOccurrence)}15`,
                                                borderRadius: '10px',
                                            }}>
                                                {getCriticalityLabel(newSeverity * newOccurrence)}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                            S({newSeverity}) × O({newOccurrence}) = {newSeverity * newOccurrence}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>{t('fmea.calculatedRpn')}</div>
                                        <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: getRPNColor(newSeverity * newOccurrence * newDetection) }}>
                                            {newSeverity * newOccurrence * newDetection}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: direction === 'rtl' ? 'left' : 'right' }}>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>{t('fmea.riskLevel')}</div>
                                        <span className={`badge ${getRiskBadge(calculateRiskLevel(newSeverity * newOccurrence * newDetection))}`} style={{ marginTop: '4px' }}>
                                            {t(`fmea.${calculateRiskLevel(newSeverity * newOccurrence * newDetection).toLowerCase()}`)}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--spacing-sm)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Cm = S × O | Critical ≥ 60, Significant 30-59, Marginal &lt; 30</span>
                                    <span>RPN = S × O × D | High ≥ 300, Medium 100-299, Low &lt; 100</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
                                <button className="btn btn-secondary" onClick={() => { setShowAddModal(false); resetForm(); }} style={{ flex: 1 }}>{t('common.cancel')}</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={editingId ? handleSaveEdit : handleAddFMEA}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)' }}
                                    disabled={!newComponentId || !newFailureMode || !newFailureCause || !newFailureEffect}
                                >
                                    {editingId ? <><Save size={18} /> Save Changes</> : t('fmea.add')}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ========================================
               RATING SELECTION POPUP
               ======================================== */}
            {ratingPopup && (
                <>
                    <div
                        onClick={() => setRatingPopup(null)}
                        style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0, 0, 0, 0.6)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 10000,
                        }}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '90%',
                            maxWidth: ratingPopup === 'occurrence' ? '700px' : '780px',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-xl)',
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
                            zIndex: 10001,
                            maxHeight: '85vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Popup Header */}
                        <div style={{
                            padding: 'var(--spacing-lg) var(--spacing-xl)',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexShrink: 0,
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>
                                    {ratingPopup === 'severity' && `${t('fmea.severity')} — Severity Ranking Criteria`}
                                    {ratingPopup === 'occurrence' && `${t('fmea.occurrence')} — Probability of Failure`}
                                    {ratingPopup === 'detection' && `${t('fmea.detection')} — Detection Ranking Criteria`}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>
                                    {ratingPopup === 'severity' && 'Select a ranking based on the severity of the failure effect'}
                                    {ratingPopup === 'occurrence' && 'Select a ranking based on how often the failure mode occurs'}
                                    {ratingPopup === 'detection' && 'Select a ranking based on the likelihood of detection'}
                                </p>
                            </div>
                            <button onClick={() => setRatingPopup(null)} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Table Content */}
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {/* ---- SEVERITY TABLE ---- */}
                            {ratingPopup === 'severity' && (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-tertiary)', position: 'sticky', top: 0, zIndex: 1 }}>
                                            <th style={{ padding: 'var(--spacing-sm) var(--spacing-md)', textAlign: 'center', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-secondary)', width: '60px', borderBottom: '2px solid var(--border-color)' }}>Rank</th>
                                            <th style={{ padding: 'var(--spacing-sm) var(--spacing-md)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-secondary)', width: '140px', borderBottom: '2px solid var(--border-color)' }}>Effect</th>
                                            <th style={{ padding: 'var(--spacing-sm) var(--spacing-md)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)' }}>Criteria: Severity of Effect</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {severityCriteria.map((item) => {
                                            const isSelected = newSeverity === item.rank;
                                            return (
                                                <tr
                                                    key={item.rank}
                                                    onClick={() => { setNewSeverity(item.rank); setRatingPopup(null); }}
                                                    style={{
                                                        cursor: 'pointer',
                                                        background: isSelected ? `${getRankColor(item.rank)}12` : 'transparent',
                                                        borderBottom: '1px solid var(--border-color)',
                                                        transition: 'background 0.15s ease',
                                                    }}
                                                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', textAlign: 'center', verticalAlign: 'top' }}>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                            width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
                                                            background: isSelected ? getRankColor(item.rank) : `${getRankColor(item.rank)}15`,
                                                            color: isSelected ? 'white' : getRankColor(item.rank),
                                                            fontWeight: 700, fontSize: 'var(--font-size-sm)',
                                                            border: isSelected ? 'none' : `1px solid ${getRankColor(item.rank)}30`,
                                                        }}>{item.rank}</span>
                                                    </td>
                                                    <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', fontWeight: 600, fontSize: 'var(--font-size-sm)', color: isSelected ? getRankColor(item.rank) : 'var(--text-primary)', verticalAlign: 'top' }}>
                                                        {item.effect}
                                                    </td>
                                                    <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                        {item.criteria}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}

                            {/* ---- OCCURRENCE TABLE ---- */}
                            {ratingPopup === 'occurrence' && (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-tertiary)', position: 'sticky', top: 0, zIndex: 1 }}>
                                            <th style={{ padding: 'var(--spacing-sm) var(--spacing-md)', textAlign: 'center', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-secondary)', width: '60px', borderBottom: '2px solid var(--border-color)' }}>Rank</th>
                                            <th style={{ padding: 'var(--spacing-sm) var(--spacing-md)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)' }}>Probability of Failure</th>
                                            <th style={{ padding: 'var(--spacing-sm) var(--spacing-md)', textAlign: 'center', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-secondary)', width: '140px', borderBottom: '2px solid var(--border-color)' }}>Possible Failure Rates</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {occurrenceCriteria.map((item) => {
                                            const isSelected = newOccurrence === item.rank;
                                            return (
                                                <tr
                                                    key={item.rank}
                                                    onClick={() => { setNewOccurrence(item.rank); setRatingPopup(null); }}
                                                    style={{
                                                        cursor: 'pointer',
                                                        background: isSelected ? `${getRankColor(item.rank)}12` : 'transparent',
                                                        borderBottom: '1px solid var(--border-color)',
                                                        transition: 'background 0.15s ease',
                                                    }}
                                                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', textAlign: 'center' }}>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                            width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
                                                            background: isSelected ? getRankColor(item.rank) : `${getRankColor(item.rank)}15`,
                                                            color: isSelected ? 'white' : getRankColor(item.rank),
                                                            fontWeight: 700, fontSize: 'var(--font-size-sm)',
                                                            border: isSelected ? 'none' : `1px solid ${getRankColor(item.rank)}30`,
                                                        }}>{item.rank}</span>
                                                    </td>
                                                    <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', fontWeight: 600, fontSize: 'var(--font-size-sm)', color: isSelected ? getRankColor(item.rank) : 'var(--text-primary)' }}>
                                                        {item.probability}
                                                    </td>
                                                    <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', textAlign: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                        <span style={{
                                                            padding: '2px 10px',
                                                            borderRadius: 'var(--radius-full)',
                                                            background: `${getRankColor(item.rank)}10`,
                                                            color: getRankColor(item.rank),
                                                            fontWeight: 600,
                                                            fontSize: 'var(--font-size-xs)',
                                                        }}>{item.rate}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}

                            {/* ---- DETECTION TABLE ---- */}
                            {ratingPopup === 'detection' && (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-tertiary)', position: 'sticky', top: 0, zIndex: 1 }}>
                                            <th style={{ padding: 'var(--spacing-sm) var(--spacing-md)', textAlign: 'center', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-secondary)', width: '60px', borderBottom: '2px solid var(--border-color)' }}>Rank</th>
                                            <th style={{ padding: 'var(--spacing-sm) var(--spacing-md)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-secondary)', width: '160px', borderBottom: '2px solid var(--border-color)' }}>Detection</th>
                                            <th style={{ padding: 'var(--spacing-sm) var(--spacing-md)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)' }}>Criteria: Likelihood of Detection</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detectionCriteria.map((item) => {
                                            const isSelected = newDetection === item.rank;
                                            return (
                                                <tr
                                                    key={item.rank}
                                                    onClick={() => { setNewDetection(item.rank); setRatingPopup(null); }}
                                                    style={{
                                                        cursor: 'pointer',
                                                        background: isSelected ? `${getRankColor(item.rank)}12` : 'transparent',
                                                        borderBottom: '1px solid var(--border-color)',
                                                        transition: 'background 0.15s ease',
                                                    }}
                                                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', textAlign: 'center', verticalAlign: 'top' }}>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                            width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
                                                            background: isSelected ? getRankColor(item.rank) : `${getRankColor(item.rank)}15`,
                                                            color: isSelected ? 'white' : getRankColor(item.rank),
                                                            fontWeight: 700, fontSize: 'var(--font-size-sm)',
                                                            border: isSelected ? 'none' : `1px solid ${getRankColor(item.rank)}30`,
                                                        }}>{item.rank}</span>
                                                    </td>
                                                    <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', fontWeight: 600, fontSize: 'var(--font-size-sm)', color: isSelected ? getRankColor(item.rank) : 'var(--text-primary)', verticalAlign: 'top' }}>
                                                        {item.detection}
                                                    </td>
                                                    <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                        {item.criteria}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </>
            )}

            <ConfirmDeleteModal
                isOpen={deleteConfirm.isOpen}
                title="Delete FMEA Entry"
                message="Are you sure you want to delete this FMEA entry? This action cannot be undone."
                itemName={deleteConfirm.name}
                onConfirm={confirmDeleteFMEA}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
            />
        </>
    );
}
