import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Pencil, Save, Trash2, Settings2, BarChart3, Clock, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
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

// ============================================================
// WEIBULL RELIABILITY ENGINE
// ============================================================

// Weibull Reliability Function R(t)
function weibull_R(t: number, beta: number, eta: number): number {
    if (t < 0) return 1;
    return Math.exp(-Math.pow(t / eta, beta));
}

// Numerical Integration of R(t) using Simpson's Rule
function integrate_R(t: number, beta: number, eta: number, n: number = 2000): number {
    if (t <= 0) return 0;
    const h = t / n;
    let sum = weibull_R(0, beta, eta) + weibull_R(t, beta, eta);
    for (let i = 1; i < n; i++) {
        const x = i * h;
        sum += (i % 2 === 0 ? 2 : 4) * weibull_R(x, beta, eta);
    }
    return (h / 3) * sum;
}

// Cost Per Unit Time CPUT(t)
function calculate_CPUT(t: number, Cp: number, Cu: number, beta: number, eta: number): number {
    if (t <= 0) return Infinity;
    const Rt = weibull_R(t, beta, eta);
    const integralR = integrate_R(t, beta, eta);
    if (integralR === 0) return Infinity; // Prevent division by zero
    return (Cp * Rt + Cu * (1 - Rt)) / integralR;
}

// Find Optimum Replacement Time (minimize CPUT)
function findOptimumReplacement(Cp: number, Cu: number, beta: number, eta: number): {
    optimumTime: number;
    minCPUT: number;
    curve: { t: number, cput: number }[];
} {
    // First pass to find approximate minimum
    const maxScanT = eta * 4;
    let step = maxScanT / 1000;

    let bestT = 0;
    let bestCPUT = Infinity;

    for (let t = step; t <= maxScanT; t += step) {
        const cost = calculate_CPUT(t, Cp, Cu, beta, eta);
        if (cost < bestCPUT) {
            bestCPUT = cost;
            bestT = t;
        }
    }

    // Determine if Run To Failure is mathematically optimal (Beta <= 1 or Cu <= Cp or minimum at infinity)
    const isRTF = beta <= 1 || Cp >= Cu || bestT >= maxScanT - step * 2;
    const optimumTime = isRTF ? Infinity : bestT;

    // Generate curve up to a visually pleasing boundary (e.g. 2.5x optimum for U-shape)
    const chartMaxT = isRTF ? maxScanT : bestT * 2.5;
    const curve = [];
    const curveStep = chartMaxT / 200;
    for (let t = curveStep; t <= chartMaxT; t += curveStep) {
        curve.push({ t, cput: calculate_CPUT(t, Cp, Cu, beta, eta) });
    }

    return { optimumTime, minCPUT: bestCPUT, curve };
}


// ============================================================
// TYPES & DEFAULTS
// ============================================================

interface ReplacementItem {
    id: string;
    equipment: string;
    tagNumber: string;
    // Current State
    currentAge: number; // Current operating time t

    // Weibull Parameters
    shapeParameter: number; // Beta (β)
    scaleParameter: number; // Eta (η)

    // Cost Parameters
    plannedReplacementCost: number; // Cp
    unplannedFailureCost: number; // Cu (Must be > Cp)

    // Calculated fields
    optimumTime: number;
    minCPUT: number;
    curvePoints: { t: number, cput: number }[];
    status: 'Good' | 'Monitor' | 'Replace Soon' | 'Run To Failure';
}

const DEFAULT_REPLACEMENT: ReplacementItem[] = [
    (() => {
        const item = { id: '1', equipment: 'Centrifugal Pump Bearing', tagNumber: 'PUMP-BRG-1', currentAge: 8500, shapeParameter: 2.5, scaleParameter: 15000, plannedReplacementCost: 4500, unplannedFailureCost: 22000 };
        const calc = findOptimumReplacement(item.plannedReplacementCost, item.unplannedFailureCost, item.shapeParameter, item.scaleParameter);
        return { ...item, optimumTime: calc.optimumTime, minCPUT: calc.minCPUT, curvePoints: calc.curve, status: 'Monitor' as const };
    })(),
    (() => {
        const item = { id: '2', equipment: 'Conveyor Drive Belt', tagNumber: 'CVR-BLT-1', currentAge: 3200, shapeParameter: 3.2, scaleParameter: 5000, plannedReplacementCost: 800, unplannedFailureCost: 9500 };
        const calc = findOptimumReplacement(item.plannedReplacementCost, item.unplannedFailureCost, item.shapeParameter, item.scaleParameter);
        return { ...item, optimumTime: calc.optimumTime, minCPUT: calc.minCPUT, curvePoints: calc.curve, status: 'Replace Soon' as const };
    })(),
    (() => {
        const item = { id: '3', equipment: 'Exhaust Fan Motor', tagNumber: 'FAN-MOT-1', currentAge: 12000, shapeParameter: 1.8, scaleParameter: 40000, plannedReplacementCost: 3000, unplannedFailureCost: 15000 };
        const calc = findOptimumReplacement(item.plannedReplacementCost, item.unplannedFailureCost, item.shapeParameter, item.scaleParameter);
        return { ...item, optimumTime: calc.optimumTime, minCPUT: calc.minCPUT, curvePoints: calc.curve, status: 'Good' as const };
    })(),
];

export default function OptimalReplacement() {
    const navigate = useNavigate();
    const { isMobile } = useSidebar();
    const { t } = useLanguage();
    const { registerPageData, unregisterPageData } = useSearch();
    const { storageKeyFor } = useAssetContext();
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [viewChartId, setViewChartId] = useState<string | null>(null);

    const { currentAssetId } = useAssetContext();
    const { user } = useAuth();
    const [replacementData, setReplacementData] = useState<ReplacementItem[]>([]);
    const [loading, setLoading] = useState(true);

    const loadReplacements = async () => {
        if (!user || !currentAssetId) {
            setReplacementData([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('replacements')
                .select('*')
                .eq('asset_id', currentAssetId);

            if (error) throw error;

            if (data) {
                setReplacementData(data.map(item => {
                    const calc = findOptimumReplacement(
                        Number(item.planned_replacement_cost),
                        Number(item.unplanned_failure_cost),
                        Number(item.shape_parameter),
                        Number(item.scale_parameter)
                    );
                    return {
                        id: item.id,
                        equipment: item.equipment,
                        tagNumber: item.tag_number,
                        currentAge: Number(item.current_age),
                        shapeParameter: Number(item.shape_parameter),
                        scaleParameter: Number(item.scale_parameter),
                        plannedReplacementCost: Number(item.planned_replacement_cost),
                        unplannedFailureCost: Number(item.unplanned_failure_cost),
                        optimumTime: calc.optimumTime,
                        minCPUT: calc.minCPUT,
                        curvePoints: calc.curve,
                        status: item.status as any
                    };
                }));
            }
        } catch (err) {
            console.error('Error fetching replacements:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReplacements();
    }, [user, currentAssetId]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadReplacements();
        setIsRefreshing(false);
    };

    // Status Engine
    const determineStatus = (currentAge: number, optimalTime: number, beta: number): ReplacementItem['status'] => {
        if (beta <= 1) return 'Run To Failure';
        const remaining = optimalTime - currentAge;
        if (remaining <= 0) return 'Replace Soon';
        if (remaining <= optimalTime * 0.15) return 'Monitor'; // Within 15% of optimum
        return 'Good';
    };

    // Register search
    useEffect(() => {
        registerPageData('replacement', {
            items: replacementData,
            searchFields: ['equipment', 'tagNumber', 'status'],
            resultType: 'replacement',
            formatResult: (item: ReplacementItem) => ({
                displayTitle: item.equipment,
                displaySubtitle: `${item.tagNumber} • Optimal: ${item.optimumTime === Infinity ? 'RTF' : item.optimumTime.toFixed(0) + 'h'} • Min Cost: $${item.minCPUT.toFixed(2)}/h`,
                badge: {
                    label: item.status,
                    variant: item.status === 'Replace Soon' ? 'danger' as const : item.status === 'Monitor' ? 'warning' as const : 'success' as const
                }
            })
        });
        return () => unregisterPageData('replacement');
    }, [replacementData, registerPageData, unregisterPageData]);

    // Form inputs
    const [newEquipment, setNewEquipment] = useState('');
    const [newTagNumber, setNewTagNumber] = useState('');
    const [newAge, setNewAge] = useState<number | ''>('');
    const [newBeta, setNewBeta] = useState<number | ''>(2.0);
    const [newEta, setNewEta] = useState<number | ''>(10000);
    const [newCp, setNewCp] = useState<number | ''>('');
    const [newCu, setNewCu] = useState<number | ''>('');

    const resetForm = () => {
        setNewEquipment(''); setNewTagNumber(''); setNewAge('');
        setNewBeta(2.0); setNewEta(10000); setNewCp(''); setNewCu('');
        setEditingId(null);
    };

    const handleEdit = (item: ReplacementItem) => {
        setNewEquipment(item.equipment); setNewTagNumber(item.tagNumber); setNewAge(item.currentAge);
        setNewBeta(item.shapeParameter); setNewEta(item.scaleParameter);
        setNewCp(item.plannedReplacementCost); setNewCu(item.unplannedFailureCost);
        setEditingId(item.id); setShowAddModal(true);
    };

    const handleSave = async () => {
        if (!currentAssetId) {
            alert('Please select an asset first using the dropdown at the top.');
            return;
        }
        if (!newEquipment) {
            alert('Please enter equipment name.');
            return;
        }
        if (!user) return;

        const beta = Number(newBeta);
        const eta = Number(newEta);
        const Cp = Number(newCp);
        const Cu = Number(newCu);
        const currentAge = typeof newAge === 'number' ? newAge : 0;

        const calc = findOptimumReplacement(Cp, Cu, beta, eta);
        const status = determineStatus(currentAge, calc.optimumTime, beta);

        try {
            if (editingId) {
                const { error } = await supabase.from('replacements').update({
                    equipment: newEquipment,
                    tag_number: newTagNumber,
                    current_age: currentAge,
                    shape_parameter: beta,
                    scale_parameter: eta,
                    planned_replacement_cost: Cp,
                    unplanned_failure_cost: Cu,
                    optimum_time: calc.optimumTime === Infinity ? -1 : calc.optimumTime,
                    min_cput: calc.minCPUT,
                    status
                }).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('replacements').insert([{
                    user_id: user.id,
                    asset_id: currentAssetId,
                    equipment: newEquipment,
                    tag_number: newTagNumber,
                    current_age: currentAge,
                    shape_parameter: beta,
                    scale_parameter: eta,
                    planned_replacement_cost: Cp,
                    unplanned_failure_cost: Cu,
                    optimum_time: calc.optimumTime === Infinity ? -1 : calc.optimumTime,
                    min_cput: calc.minCPUT,
                    status
                }]);
                if (error) throw error;
            }

            // UPSERT into maintenance_tasks
            const { error: mtError } = await supabase.from('maintenance_tasks').upsert({
                user_id: user.id,
                asset_id: currentAssetId,
                component_name: newEquipment,
                component_id: null,
                failure_mode_id: null,
                task_name: 'Scheduled Replacement',
                task_type: 'RR',
                assigned_interval: calc.optimumTime === Infinity ? 'RTF' : `${calc.optimumTime.toFixed(0)} h`,
                last_updated: new Date().toISOString()
            }, {
                onConflict: 'asset_id, failure_mode_id, task_type'
            });
            if (mtError) console.error('Failed to upsert maintenance_tasks:', mtError);

            // ================================================================
            // Sync to `tasks` schedule table
            // ================================================================
            if (calc.optimumTime !== Infinity) {
                try {
                    // Fetch operating_hours_per_day from the asset
                    const { data: assetData } = await supabase
                        .from('assets')
                        .select('operating_hours_per_day, equipment_name')
                        .eq('id', currentAssetId)
                        .single();

                    const operatingHoursPerDay = Number(assetData?.operating_hours_per_day) || 8;
                    const intervalInDays = Math.ceil(calc.optimumTime / operatingHoursPerDay);

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

                    const scheduledTaskPayload = {
                        user_id: user.id,
                        asset_id: currentAssetId,
                        task_name: `Scheduled Replacement — ${newEquipment}`,
                        description: `Optimal replacement task calculated via Weibull analysis. Optimum time: ${calc.optimumTime.toFixed(0)} hours (≈ ${intervalInDays} days). Current Age: ${currentAge}h.`,
                        frequency: frequencyLabel,
                        task_type: 'Replacement',
                        priority: status === 'Replace Soon' ? 'High' : 'Medium',
                        status: 'Pending',
                        due_date: dueDate.toISOString(),
                        source: 'replacement',
                        component_name: newEquipment,
                        failure_mode: null,
                        interval_value: calc.optimumTime,
                        interval_unit: 'hours',
                        estimated_duration: 4,
                        completion_percentage: 0,
                    };

                    // Check if a task already exists for this replacement in the tasks table
                    const { data: existingTask } = await supabase
                        .from('tasks')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('asset_id', currentAssetId)
                        .eq('task_name', `Scheduled Replacement — ${newEquipment}`)
                        .eq('source', 'replacement')
                        .maybeSingle();

                    if (existingTask?.id) {
                        await supabase.from('tasks').update(scheduledTaskPayload).eq('id', existingTask.id);
                    } else {
                        await supabase.from('tasks').insert(scheduledTaskPayload);
                    }
                } catch (taskErr) {
                    console.error('Warning: Replacement result saved but failed to sync to tasks schedule:', taskErr);
                }
            }

            await loadReplacements();
            setShowAddModal(false);
            resetForm();
        } catch (error) {
            console.error('Error saving replacement:', error);
            alert('Failed to save replacement data. Please check your connection.');
        }
    };

    const getStatusBadge = (status: string) => {
        if (status === 'Replace Soon') return 'badge-danger';
        if (status === 'Monitor') return 'badge-warning';
        if (status === 'Run To Failure') return 'badge-secondary';
        return 'badge-success';
    };

    return (
        <>
            <Sidebar />
            <PageContainer>
                <div className="container" style={{ maxWidth: '1600px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                            <button onClick={() => navigate('/')} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}><ArrowLeft size={20} /></button>
                            <div>
                                <h1 style={{ marginBottom: 'var(--spacing-xs)', fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)' }}>{t('replacement.title')}</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)' }}>
                                    Weibull CPUT Optimization Engine
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', width: isMobile ? '100%' : 'auto' }}>
                            <button
                                onClick={handleRefresh}
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
                                {isMobile ? '' : (isRefreshing ? 'Refreshing...' : 'Refresh')}
                            </button>
                            <GlobalSearch pageType="replacement" />
                            <AssetSelector />
                            <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)', width: isMobile ? '100%' : 'auto', flex: isMobile ? 1 : 'none' }}>
                                <Plus size={20} />
                                {t('replacement.addEquipment')}
                            </button>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
                        <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>Total Equipment</div>
                            <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>{replacementData.length}</div>
                        </div>
                        <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '4px solid var(--danger-500)' }}>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>Replace Soon</div>
                            <div style={{ color: 'var(--danger-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>{replacementData.filter(e => e.status === 'Replace Soon').length}</div>
                        </div>
                        <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '4px solid var(--warning-500)' }}>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>Monitor Zone</div>
                            <div style={{ color: 'var(--warning-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>{replacementData.filter(e => e.status === 'Monitor').length}</div>
                        </div>
                        <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '4px solid var(--text-secondary)' }}>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>Run To Failure (β ≤ 1)</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>{replacementData.filter(e => e.status === 'Run To Failure').length}</div>
                        </div>
                    </div>

                    {/* Desktop Table View */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflow: 'auto' }}>
                        <table style={{ width: '100%', minWidth: '1300px', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                            <thead style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                <tr>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-lg)', borderBottom: '2px solid var(--border-color)' }}>Component</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)' }}>Tag No.</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>Cur. Age (h)</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>β (Shape)</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>η (Scale)</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>Planned Cost</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>Unplanned Cost</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>t<sub>opt</sub> (Optimum)</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>Min CPUT ($/h)</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>Status</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={11} style={{ textAlign: 'center', padding: 'var(--spacing-3xl)' }}>
                                            <div className="animate-pulse" style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Loading...</div>
                                        </td>
                                    </tr>
                                ) : replacementData.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} style={{ textAlign: 'center', padding: 'var(--spacing-3xl)' }}>
                                            <div style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>No entries found for this asset.</div>
                                        </td>
                                    </tr>
                                ) : replacementData.map((item, index) => (
                                    <tr key={item.id} style={{ borderBottom: index < replacementData.length - 1 ? '1px solid var(--border-color)' : 'none', transition: 'background var(--transition-fast)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontWeight: 600 }}>{item.equipment}</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', color: 'var(--text-secondary)' }}>{item.tagNumber}</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center' }}>{item.currentAge}h</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center' }}>
                                            <span style={{ fontWeight: 600, color: item.shapeParameter <= 1 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{item.shapeParameter.toFixed(2)}</span>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center', color: 'var(--text-secondary)' }}>{item.scaleParameter.toFixed(0)}</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center', color: 'var(--success-500)' }}>${item.plannedReplacementCost.toLocaleString()}</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center', color: 'var(--danger-500)' }}>${item.unplannedFailureCost.toLocaleString()}</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {item.optimumTime === Infinity ? 'RTF' : `${item.optimumTime.toFixed(0)} h`}
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center', fontWeight: 700, color: '#8b5cf6' }}>
                                            ${item.minCPUT.toFixed(3)}/h
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center' }}>
                                            <span className={`badge ${getStatusBadge(item.status)}`}>{item.status}</span>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-xs)' }}>
                                                <button onClick={() => setViewChartId(item.id)} className="btn btn-ghost" style={{ padding: 'var(--spacing-xs)', minWidth: 'auto', color: '#8b5cf6' }} title="View CPUT Plot">
                                                    <BarChart3 size={16} />
                                                </button>
                                                <button onClick={() => handleEdit(item)} className="btn btn-ghost" style={{ padding: 'var(--spacing-xs)', minWidth: 'auto', color: 'var(--primary-500)' }} title="Edit">
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => { setDeleteConfirm({ isOpen: true, id: item.id, name: item.equipment }) }} className="btn btn-ghost" style={{ padding: 'var(--spacing-xs)', minWidth: 'auto', color: 'var(--danger-500)' }} title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>


                </div>
            </PageContainer>

            {/* Modal: Add/Edit Formula Inputs */}
            {showAddModal && (
                <>
                    <div onClick={() => { setShowAddModal(false); resetForm(); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', zIndex: 9998 }} />
                    <div className="card-glass" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: isMobile ? '95%' : '90%', maxWidth: '650px', padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)', zIndex: 9999, maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                            <h2 style={{ margin: 0, fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)' }}>{editingId ? 'Edit Component' : 'Add Component'}</h2>
                            <button onClick={() => { setShowAddModal(false); resetForm(); }} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                <div><label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Component Name <span style={{ color: 'var(--danger-500)' }}>*</span></label><input className="input" value={newEquipment} onChange={e => setNewEquipment(e.target.value)} placeholder="e.g., Pump BRG" /></div>
                                <div><label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Tag Number <span style={{ color: 'var(--danger-500)' }}>*</span></label><input className="input" value={newTagNumber} onChange={e => setNewTagNumber(e.target.value)} placeholder="e.g., PUMP-001" /></div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Current Operating Age (hours)</label>
                                <input type="number" className="input" value={newAge === '' ? '' : newAge} onChange={e => setNewAge(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Total hours since last replacement (t)" />
                            </div>
                            <div style={{ padding: 'var(--spacing-md)', background: 'rgba(26,122,184,0.06)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--primary-500)' }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--primary-500)', textTransform: 'uppercase', marginBottom: 'var(--spacing-sm)' }}>Weibull Parameters</div>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                    <div><label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Shape Parameter (β)</label><input type="number" step={0.1} min={0.1} className="input" value={newBeta === '' ? '' : newBeta} onChange={e => setNewBeta(e.target.value === '' ? '' : Number(e.target.value))} /><div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>β &gt; 1 indicates wear-out (required for PM).</div></div>
                                    <div><label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Scale Parameter (η)</label><input type="number" min={1} className="input" value={newEta === '' ? '' : newEta} onChange={e => setNewEta(e.target.value === '' ? '' : Number(e.target.value))} /><div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Characteristic life in hours.</div></div>
                                </div>
                            </div>
                            <div style={{ padding: 'var(--spacing-md)', background: 'rgba(16,185,129,0.06)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid #10b981' }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: 'var(--spacing-sm)' }}>Cost Parameters</div>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                    <div><label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Planned Repl. Cost</label><input type="number" min={0} className="input" value={newCp === '' ? '' : newCp} onChange={e => setNewCp(e.target.value === '' ? '' : Number(e.target.value))} placeholder="$" /></div>
                                    <div><label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Unplanned Failure Cost</label><input type="number" min={0} className="input" value={newCu === '' ? '' : newCu} onChange={e => setNewCu(e.target.value === '' ? '' : Number(e.target.value))} placeholder="$" /><div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Must be &gt; Planned Cost (includes downtime).</div></div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)' }}>
                                <button className="btn btn-secondary" onClick={() => { setShowAddModal(false); resetForm(); }} style={{ flex: 1 }}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)' }} disabled={!newEquipment || !newTagNumber || newBeta === '' || newEta === '' || newCp === '' || newCu === ''}>
                                    {editingId ? 'Save Changes' : 'Calculate & Add'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Modal: U-Shaped CPUT Curve */}
            {viewChartId && (() => {
                const item = replacementData.find(d => d.id === viewChartId);
                if (!item) return null;
                // Basic SVG line chart generation
                const points = item.curvePoints;
                const rtf = item.optimumTime === Infinity;

                let pointsStr = "";
                let minCputY = 0;
                let minCputX = 0;
                let maxT = 1;
                let maxCPUT = 1;

                if (points.length > 0) {
                    const width = 600;
                    const height = 300;

                    // Adaptive CPUT capping to filter out the vertical asymptote at t=0
                    const minCPUTValue = Math.min(...points.map(p => p.cput));
                    maxCPUT = minCPUTValue * 4;

                    const validPoints = points.filter(p => p.cput <= maxCPUT);
                    if (validPoints.length > 0) {
                        maxT = Math.max(...validPoints.map(p => p.t));

                        let trackedMinCput = Infinity;
                        pointsStr = validPoints.map((p, i) => {
                            const x = (p.t / maxT) * width;
                            const y = height - ((p.cput / maxCPUT) * height);

                            if (rtf) {
                                // For RTF, optimum is at the far right of the chart
                                if (i === validPoints.length - 1) { minCputX = x; minCputY = y; }
                            } else {
                                // For U-shape, find the lowest valid point to place the annotation
                                if (p.cput < trackedMinCput) {
                                    trackedMinCput = p.cput;
                                    minCputX = x;
                                    minCputY = y;
                                }
                            }
                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ');
                    }
                }

                const percentX = (minCputX / 600) * 100;
                const percentY = (minCputY / 300) * 100;

                // Adaptive translation to prevent cutoff
                const translateX = percentX > 85 ? '-100%' : percentX < 15 ? '0%' : '-50%';
                const translateY = percentY < 20 ? '0%' : '-100%';
                const paddingStyle = translateY === '0%' ? { paddingTop: '12px' } : { paddingBottom: '12px' };

                return (
                    <>
                        <div onClick={() => setViewChartId(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', zIndex: 9998 }} />
                        <div className="card-glass" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: '700px', padding: 'var(--spacing-xl)', zIndex: 9999 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
                                <div>
                                    <h2 style={{ margin: 0 }}>CPUT Plot Analysis: {item.equipment}</h2>
                                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Cost Per Unit Time vs. Preventive Replacement Interval</p>
                                </div>
                                <button onClick={() => setViewChartId(null)} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}><X size={20} /></button>
                            </div>

                            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
                                {rtf && (
                                    <div style={{ padding: 'var(--spacing-md)', textAlign: 'center', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-lg)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <AlertTriangle size={24} color="var(--warning-500)" />
                                            <h3 style={{ margin: 0, color: 'var(--warning-600)' }}>Run-To-Failure Optimality</h3>
                                        </div>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                                            Preventive replacement is not cost-effective. The optimal strategy is Run-To-Failure.
                                        </p>
                                    </div>
                                )}

                                {/* SVG Chart */}
                                <div style={{ position: 'relative', width: 'calc(100% - 60px)', marginLeft: '50px', marginTop: '20px', aspectRatio: '2', background: 'var(--bg-secondary)', borderLeft: '2px solid var(--border-color)', borderBottom: '2px solid var(--border-color)', marginBottom: '40px' }}>
                                    <svg width="100%" height="100%" viewBox="0 0 600 300" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                                        {/* Grid lines */}
                                        <line x1="0" y1="75" x2="600" y2="75" stroke="var(--border-color)" strokeDasharray="4 4" />
                                        <line x1="0" y1="150" x2="600" y2="150" stroke="var(--border-color)" strokeDasharray="4 4" />
                                        <line x1="0" y1="225" x2="600" y2="225" stroke="var(--border-color)" strokeDasharray="4 4" />
                                        {/* Plot line */}
                                        <path d={pointsStr} fill="none" stroke="#8b5cf6" strokeWidth="3" />

                                        {/* Projection Lines to Axes */}
                                        {(minCputX > 0 || minCputY > 0) && (
                                            <>
                                                <line x1={minCputX} y1={minCputY} x2={minCputX} y2="300" stroke="#8b5cf6" strokeDasharray="5 5" strokeWidth="1.5" opacity="0.6" />
                                                <line x1={0} y1={minCputY} x2={minCputX} y2={minCputY} stroke="#8b5cf6" strokeDasharray="5 5" strokeWidth="1.5" opacity="0.6" />
                                                <circle cx={minCputX} cy={minCputY} r="6" fill="#8b5cf6" stroke="var(--bg-secondary)" strokeWidth="3" />
                                            </>
                                        )}
                                    </svg>
                                    {/* Axis Labels */}
                                    <div style={{ position: 'absolute', bottom: '-24px', right: '0', fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{maxT.toFixed(0)}h</div>
                                    <div style={{ position: 'absolute', bottom: '-24px', left: '0', fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>0h</div>
                                    <div style={{ position: 'absolute', top: '0', left: '-8px', transform: 'translateX(-100%)', fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>${maxCPUT.toFixed(2)}/h</div>

                                    <div style={{ position: 'absolute', bottom: '-40px', left: '50%', transform: 'translateX(-50%)', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Replacement Interval (t)</div>
                                    <div style={{ position: 'absolute', top: '50%', left: '-50px', transform: 'translate(-50%, -50%) rotate(-90deg)', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>CPUT ($/h)</div>

                                    {/* Optimum Annotation */}
                                    <div style={{ position: 'absolute', left: `${percentX}%`, top: `${percentY}%`, transform: `translate(${translateX}, ${translateY})`, ...paddingStyle, zIndex: 10 }}>
                                        <div style={{ background: '#8b5cf6', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(139,92,246,0.3)', border: '2px solid rgba(255,255,255,0.2)' }}>
                                            Optimum: {rtf ? 'Run-To-Failure' : `${item.optimumTime.toFixed(0)}h`}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Shape (β) / Scale (η)</div>
                                    <div style={{ fontWeight: 600 }}>{item.shapeParameter} / {item.scaleParameter}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Cost Ratio (Unplanned / Planned)</div>
                                    <div style={{ fontWeight: 600 }}>{(item.unplannedFailureCost / item.plannedReplacementCost).toFixed(2)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Minimum CPUT</div>
                                    <div style={{ fontWeight: 600, color: '#8b5cf6' }}>${item.minCPUT.toFixed(3)}/hr</div>
                                </div>
                            </div>
                        </div>
                    </>
                );
            })()}

            <ConfirmDeleteModal
                isOpen={deleteConfirm.isOpen}
                title="Delete Equipment"
                message="Are you sure you want to delete this equipment entry? This action cannot be undone."
                itemName={deleteConfirm.name}
                onConfirm={async () => {
                    try {
                        const { error } = await supabase.from('replacements').delete().eq('id', deleteConfirm.id);
                        if (error) throw error;
                        await loadReplacements();
                    } catch (error) {
                        console.error('Error deleting replacement:', error);
                    } finally {
                        setDeleteConfirm({ isOpen: false, id: '', name: '' });
                    }
                }}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
            />
        </>
    );
}
