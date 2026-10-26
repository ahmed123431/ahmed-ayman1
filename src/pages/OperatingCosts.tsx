import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, DollarSign, Clock, Wrench, Pencil, Save, Trash2, AlertTriangle, TrendingUp, Activity, RefreshCw, Loader2 } from 'lucide-react';
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
// OPERATING COST ANALYSIS
// Based on ReliaSoft methodology.
//
// Formula:
//   Total Operating Cost = C_acq + (E[N_f] × C_f) + (E[T_d] × C_d) + Σ C_pm
//
// Where:
//   C_acq  = Acquisition cost (initial purchase)
//   E[N_f] = Expected number of failures over operating time
//   C_f    = Direct cost per unplanned failure event
//   E[T_d] = Expected total downtime (hours) = E[N_f] × MTTR
//   C_d    = Downtime cost rate ($/hour)
//   C_pm   = Planned maintenance cost per task × number of PM tasks
// ============================================================

interface CostItem {
    id: string;
    equipmentName: string;
    // --- Input Parameters ---
    acquisitionCost: number;       // C_acq ($) — initial equipment cost
    failureCost: number;           // C_f ($/event) — direct cost per unplanned failure
    downtimeCostRate: number;      // C_d ($/hour) — lost production / penalty per hour
    plannedMaintCost: number;      // C_pm ($/task) — cost for one scheduled PM task
    operatingTime: number;         // t (hours) — total mission / simulation time
    // --- Reliability Parameters ---
    mtbf: number;                  // Mean Time Between Failures (hours)
    mttr: number;                  // Mean Time To Repair (hours)
    pmTasksPerYear: number;        // Number of planned maintenance tasks per year
    // --- Calculated Output (stored for search/reports) ---
    totalOperatingCost: number;
    expectedFailures: number;
    expectedDowntime: number;
    systemUptime: number;
    costPerOperatingHour: number;
}

// Calculation engine — pure function for the formula
function calculateRCMCosts(params: {
    acquisitionCost: number;
    failureCost: number;
    downtimeCostRate: number;
    plannedMaintCost: number;
    operatingTime: number;
    mtbf: number;
    mttr: number;
    pmTasksPerYear: number;
}) {
    const { acquisitionCost, failureCost, downtimeCostRate, plannedMaintCost, operatingTime, mtbf, mttr, pmTasksPerYear } = params;

    // E[N_f] = Operating Time / MTBF
    const expectedFailures = mtbf > 0 ? operatingTime / mtbf : 0;

    // E[T_d] = E[N_f] × MTTR
    const expectedDowntime = expectedFailures * mttr;

    // System Uptime = Operating Time - Downtime
    const systemUptime = Math.max(0, operatingTime - expectedDowntime);

    // Number of PM tasks over mission time
    const yearsInMission = operatingTime / 8760; // 8760 hours/year
    const totalPMTasks = pmTasksPerYear * yearsInMission;
    const totalPMCost = plannedMaintCost * totalPMTasks;

    // Total Operating Cost = C_acq + (E[N_f] × C_f) + (E[T_d] × C_d) + Σ C_pm
    const totalOperatingCost =
        acquisitionCost +
        (expectedFailures * failureCost) +
        (expectedDowntime * downtimeCostRate) +
        totalPMCost;

    // Cost per Operating Hour = Total Cost / System Uptime
    const costPerOperatingHour = systemUptime > 0 ? totalOperatingCost / systemUptime : 0;

    return {
        totalOperatingCost,
        expectedFailures,
        expectedDowntime,
        systemUptime,
        costPerOperatingHour,
        totalPMCost,
        failurePenalty: expectedFailures * failureCost,
        downtimePenalty: expectedDowntime * downtimeCostRate,
    };
}

const DEFAULT_COSTS: CostItem[] = [
    (() => {
        const p = { acquisitionCost: 8500, failureCost: 6300, downtimeCostRate: 1200, plannedMaintCost: 850, operatingTime: 43800, mtbf: 8760, mttr: 4, pmTasksPerYear: 4 };
        const c = calculateRCMCosts(p);
        return { id: '1', equipmentName: 'Bearing Assembly', ...p, ...c };
    })(),
    (() => {
        const p = { acquisitionCost: 6500, failureCost: 8000, downtimeCostRate: 1200, plannedMaintCost: 1200, operatingTime: 43800, mtbf: 4380, mttr: 6, pmTasksPerYear: 6 };
        const c = calculateRCMCosts(p);
        return { id: '2', equipmentName: 'Mechanical Seal', ...p, ...c };
    })(),
    (() => {
        const p = { acquisitionCost: 25000, failureCost: 13000, downtimeCostRate: 1200, plannedMaintCost: 2500, operatingTime: 43800, mtbf: 26280, mttr: 24, pmTasksPerYear: 2 };
        const c = calculateRCMCosts(p);
        return { id: '3', equipmentName: 'Electric Motor', ...p, ...c };
    })(),
    (() => {
        const p = { acquisitionCost: 12000, failureCost: 8200, downtimeCostRate: 1200, plannedMaintCost: 1500, operatingTime: 43800, mtbf: 17520, mttr: 8, pmTasksPerYear: 3 };
        const c = calculateRCMCosts(p);
        return { id: '4', equipmentName: 'Impeller', ...p, ...c };
    })(),
];

const generateId = () => new Date().getTime().toString();

export default function OperatingCosts() {
    const navigate = useNavigate();
    const { isMobile } = useSidebar();
    const { t } = useLanguage();
    const { registerPageData, unregisterPageData } = useSearch();
    const { storageKeyFor, currentAssetId } = useAssetContext();
    const { user } = useAuth();
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });

    const [costData, setCostData] = useState<CostItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch Cost data from Supabase
    const loadCostData = async () => {
        if (!user || !currentAssetId) {
            setCostData([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('costs')
                .select('*')
                .eq('asset_id', currentAssetId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                setCostData([]);
            } else {
                setCostData(data.map(item => {
                    const calc = calculateRCMCosts({
                        acquisitionCost: Number(item.acquisition_cost),
                        failureCost: Number(item.failure_cost),
                        downtimeCostRate: Number(item.downtime_cost_rate),
                        plannedMaintCost: Number(item.planned_maint_cost),
                        operatingTime: Number(item.operating_time),
                        mtbf: Number(item.mtbf),
                        mttr: Number(item.mttr),
                        pmTasksPerYear: Number(item.pm_tasks_per_year),
                    });
                    return {
                        id: item.id,
                        equipmentName: item.equipment_name,
                        acquisitionCost: Number(item.acquisition_cost),
                        failureCost: Number(item.failure_cost),
                        downtimeCostRate: Number(item.downtime_cost_rate),
                        plannedMaintCost: Number(item.planned_maint_cost),
                        operatingTime: Number(item.operating_time),
                        mtbf: Number(item.mtbf),
                        mttr: Number(item.mttr),
                        pmTasksPerYear: Number(item.pm_tasks_per_year),
                        ...calc
                    };
                }));
            }
        } catch (error) {
            console.error('Error loading cost data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCostData();
    }, [currentAssetId, user]);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadCostData();
        setIsRefreshing(false);
    };

    // Form state — parameters
    const [newEquipmentName, setNewEquipmentName] = useState('');
    const [newAcquisitionCost, setNewAcquisitionCost] = useState(0);
    const [newFailureCost, setNewFailureCost] = useState(0);
    const [newDowntimeCostRate, setNewDowntimeCostRate] = useState(0);
    const [newPlannedMaintCost, setNewPlannedMaintCost] = useState(0);
    const [newOperatingTime, setNewOperatingTime] = useState(8760); // Default: 1 year
    const [newMTBF, setNewMTBF] = useState(8760);
    const [newMTTR, setNewMTTR] = useState(4);
    const [newPMTasksPerYear, setNewPMTasksPerYear] = useState(4);

    // Register search
    useEffect(() => {
        registerPageData('costs', {
            items: costData,
            searchFields: ['equipmentName'],
            resultType: 'cost',
            formatResult: (item: CostItem) => ({
                displayTitle: item.equipmentName,
                displaySubtitle: `Total: $${item.totalOperatingCost.toLocaleString()} • E[Nf]: ${item.expectedFailures.toFixed(1)} • Cost/Hr: $${item.costPerOperatingHour.toFixed(2)}/hr`,
            })
        });
        return () => unregisterPageData('costs');
    }, [costData, registerPageData, unregisterPageData]);

    // Live preview of calculations for the form
    const formPreview = useMemo(() => {
        return calculateRCMCosts({
            acquisitionCost: newAcquisitionCost,
            failureCost: newFailureCost,
            downtimeCostRate: newDowntimeCostRate,
            plannedMaintCost: newPlannedMaintCost,
            operatingTime: newOperatingTime,
            mtbf: newMTBF,
            mttr: newMTTR,
            pmTasksPerYear: newPMTasksPerYear,
        });
    }, [newAcquisitionCost, newFailureCost, newDowntimeCostRate, newPlannedMaintCost, newOperatingTime, newMTBF, newMTTR, newPMTasksPerYear]);

    const handleAdd = async () => {
        if (!currentAssetId) {
            alert('Please select an asset first using the dropdown at the top.');
            return;
        }
        if (!newEquipmentName) {
            alert('Please enter a component name.');
            return;
        }
        if (!user) return;
        
        try {
            const { error } = await supabase
                .from('costs')
                .insert([{
                    user_id: user.id,
                    asset_id: currentAssetId,
                    equipment_name: newEquipmentName,
                    acquisition_cost: newAcquisitionCost,
                    failure_cost: newFailureCost,
                    downtime_cost_rate: newDowntimeCostRate,
                    planned_maint_cost: newPlannedMaintCost,
                    operating_time: newOperatingTime,
                    mtbf: newMTBF,
                    mttr: newMTTR,
                    pm_tasks_per_year: newPMTasksPerYear
                }]);

            if (error) throw error;
            await loadCostData();

            setShowAddModal(false);
            resetForm();
        } catch (error) {
            console.error('Error adding cost item:', error);
            alert('Failed to add component. Please check your connection.');
        }
    };

    const resetForm = () => {
        setNewEquipmentName('');
        setNewAcquisitionCost(0);
        setNewFailureCost(0);
        setNewDowntimeCostRate(0);
        setNewPlannedMaintCost(0);
        setNewOperatingTime(8760);
        setNewMTBF(8760);
        setNewMTTR(4);
        setNewPMTasksPerYear(4);
        setEditingId(null);
    };

    const handleEdit = (item: CostItem) => {
        setNewEquipmentName(item.equipmentName);
        setNewAcquisitionCost(item.acquisitionCost);
        setNewFailureCost(item.failureCost);
        setNewDowntimeCostRate(item.downtimeCostRate);
        setNewPlannedMaintCost(item.plannedMaintCost);
        setNewOperatingTime(item.operatingTime);
        setNewMTBF(item.mtbf);
        setNewMTTR(item.mttr);
        setNewPMTasksPerYear(item.pmTasksPerYear);
        setEditingId(item.id);
        setShowAddModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingId || !newEquipmentName) return;
        
        try {
            const { error } = await supabase
                .from('costs')
                .update({
                    equipment_name: newEquipmentName,
                    acquisition_cost: newAcquisitionCost,
                    failure_cost: newFailureCost,
                    downtime_cost_rate: newDowntimeCostRate,
                    planned_maint_cost: newPlannedMaintCost,
                    operating_time: newOperatingTime,
                    mtbf: newMTBF,
                    mttr: newMTTR,
                    pm_tasks_per_year: newPMTasksPerYear
                })
                .eq('id', editingId);

            if (error) throw error;
            await loadCostData();

            setShowAddModal(false);
            resetForm();
        } catch (error) {
            console.error('Error updating cost item:', error);
        }
    };

    const handleDelete = (item: CostItem) => {
        setDeleteConfirm({ isOpen: true, id: item.id, name: item.equipmentName });
    };

    const confirmDelete = async () => {
        try {
            const { error } = await supabase
                .from('costs')
                .delete()
                .eq('id', deleteConfirm.id);

            if (error) throw error;
            await loadCostData();
        } catch (error) {
            console.error('Error deleting cost item:', error);
        } finally {
            setDeleteConfirm({ isOpen: false, id: '', name: '' });
        }
    };

    // ========================================
    // AGGREGATE DASHBOARD CALCULATIONS
    // ========================================
    const dashboard = useMemo(() => {
        const totalCost = costData.reduce((s, c) => s + c.totalOperatingCost, 0);
        const totalUptime = costData.reduce((s, c) => s + c.systemUptime, 0);
        const totalDowntime = costData.reduce((s, c) => s + c.expectedDowntime, 0);
        const totalFailures = costData.reduce((s, c) => s + c.expectedFailures, 0);
        const avgCostPerHour = totalUptime > 0 ? totalCost / totalUptime : 0;
        const totalAcquisition = costData.reduce((s, c) => s + c.acquisitionCost, 0);
        return { totalCost, totalUptime, totalDowntime, totalFailures, avgCostPerHour, totalAcquisition };
    }, [costData]);

    // Format large numbers
    const fmt = (n: number) => {
        if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
        if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
        return `$${n.toFixed(0)}`;
    };
    const fmtHr = (h: number) => {
        if (h >= 8760) return `${(h / 8760).toFixed(1)} years`;
        if (h >= 720) return `${(h / 720).toFixed(1)} months`;
        return `${h.toFixed(0)} hrs`;
    };

    return (
        <>
            <Sidebar />
            <PageContainer>
                <div className="container" style={{ maxWidth: '1600px', margin: '0 auto' }}>
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
                                <h1 style={{ marginBottom: 'var(--spacing-xs)', fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)' }}>
                                    {t('costs.title')}
                                </h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)' }}>
                                    Life Cycle Cost Analysis
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
                            <GlobalSearch pageType="costs" />
                            <AssetSelector />
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowAddModal(true)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)', width: isMobile ? '100%' : 'auto', flex: isMobile ? 1 : 'none' }}
                            >
                                <Plus size={20} />
                                {t('costs.addEquipment')}
                            </button>
                        </div>
                    </div>

                    {/* ========================================
                       DASHBOARD — 5 KPI Cards
                       ======================================== */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-xl)'
                    }}>
                        {/* Total Cost */}
                        <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '4px solid var(--primary-500)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                <DollarSign size={18} color="var(--primary-500)" />
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Total Cost
                                </span>
                            </div>
                            <div style={{ color: 'var(--primary-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                {fmt(dashboard.totalCost)}
                            </div>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginTop: '4px' }}>
                                Acquisition: {fmt(dashboard.totalAcquisition)}
                            </div>
                        </div>

                        {/* System Uptime */}
                        <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '4px solid var(--success-500)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                <Activity size={18} color="var(--success-500)" />
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    System Uptime
                                </span>
                            </div>
                            <div style={{ color: 'var(--success-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                {dashboard.totalUptime.toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </div>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginTop: '4px' }}>
                                Hours ({fmtHr(dashboard.totalUptime)})
                            </div>
                        </div>

                        {/* System Downtime */}
                        <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '4px solid var(--danger-500)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                <Clock size={18} color="var(--danger-500)" />
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    System Downtime
                                </span>
                            </div>
                            <div style={{ color: 'var(--danger-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                {dashboard.totalDowntime.toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </div>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginTop: '4px' }}>
                                Hours ({fmtHr(dashboard.totalDowntime)})
                            </div>
                        </div>

                        {/* Expected Number of Failures */}
                        <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '4px solid var(--warning-500)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                <AlertTriangle size={18} color="var(--warning-500)" />
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Expected Failures
                                </span>
                            </div>
                            <div style={{ color: 'var(--warning-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                {dashboard.totalFailures.toFixed(1)}
                            </div>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginTop: '4px' }}>
                                Based on MTBF
                            </div>
                        </div>

                        {/* Cost per Operating Hour */}
                        <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '4px solid #8b5cf6', gridColumn: isMobile ? 'span 2' : 'span 1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                <TrendingUp size={18} color="#8b5cf6" />
                                <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Cost per Op. Hour
                                </span>
                            </div>
                            <div style={{ color: '#8b5cf6', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                ${dashboard.avgCostPerHour.toFixed(2)}/Hr
                            </div>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginTop: '4px' }}>
                                Total Cost / Uptime
                            </div>
                        </div>
                    </div>

                    {/* ========================================
                       COMPONENT TABLE
                       ======================================== */}
                    <div style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-color)',
                        overflow: 'auto'
                    }}>
                        <table style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                            <thead style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                <tr>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-lg)', borderBottom: '2px solid var(--border-color)' }}>Component</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'right' }}>Acquisition Cost</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'right' }}>Failure Cost</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'right' }}>Downtime Cost Rate</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'right' }}>Planned Task Cost</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>MTBF</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>MTTR</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>Expected Failures</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>Expected Downtime</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'right', color: 'var(--primary-500)' }}>Total Operating Cost</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'right', color: '#8b5cf6' }}>Cost/Op Hour ($/Hr)</th>
                                    <th style={{ padding: 'var(--spacing-md) var(--spacing-sm)', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={12} style={{ textAlign: 'center', padding: 'var(--spacing-3xl)', color: 'var(--text-tertiary)' }}>
                                            <div className="animate-pulse" style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>Loading costs...</div>
                                        </td>
                                    </tr>
                                ) : costData.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} style={{ textAlign: 'center', padding: 'var(--spacing-3xl)', color: 'var(--text-tertiary)' }}>
                                            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>No cost entries found for this asset.</div>
                                            <div style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-sm)' }}>Click "Add Component" to get started.</div>
                                        </td>
                                    </tr>
                                ) : costData.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        style={{ transition: 'background var(--transition-fast)', borderBottom: index < costData.length - 1 ? '1px solid var(--border-color)' : 'none' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', color: 'var(--text-primary)', fontWeight: 600 }}>{item.equipmentName}</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(item.acquisitionCost)}</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(item.failureCost)}</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'right', color: 'var(--text-secondary)' }}>${item.downtimeCostRate.toLocaleString()}</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(item.plannedMaintCost)}</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }}>{fmtHr(item.mtbf)}</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center', color: 'var(--text-secondary)' }}>{item.mttr}h</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center' }}>
                                            <span style={{ fontWeight: 600, color: item.expectedFailures >= 5 ? 'var(--danger-500)' : item.expectedFailures >= 2 ? 'var(--warning-500)' : 'var(--success-500)' }}>
                                                {item.expectedFailures.toFixed(1)}
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center' }}>
                                            <span style={{ fontWeight: 600, color: item.expectedDowntime >= 100 ? 'var(--danger-500)' : 'var(--text-secondary)' }}>
                                                {item.expectedDowntime.toFixed(0)}h
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'right', fontWeight: 700, color: 'var(--primary-500)' }}>{fmt(item.totalOperatingCost)}</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'right', fontWeight: 600, color: '#8b5cf6' }}>${item.costPerOperatingHour.toFixed(2)}</td>
                                        <td style={{ padding: 'var(--spacing-md) var(--spacing-sm)', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-xs)' }}>
                                                <button onClick={() => handleEdit(item)} className="btn btn-ghost" style={{ padding: 'var(--spacing-xs)', minWidth: 'auto', color: 'var(--primary-500)' }} title="Edit">
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(item)} className="btn btn-ghost" style={{ padding: 'var(--spacing-xs)', minWidth: 'auto', color: 'var(--danger-500)' }} title="Delete">
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

            {/* ========================================
               ADD / EDIT EQUIPMENT MODAL
               ======================================== */}
            {showAddModal && (
                <>
                    <div
                        onClick={() => { setShowAddModal(false); resetForm(); }}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', zIndex: 9998 }}
                    />
                    <div
                        className="card-glass"
                        style={{
                            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: isMobile ? '95%' : '90%', maxWidth: '750px',
                            padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)',
                            zIndex: 9999, maxHeight: '90vh', overflowY: 'auto',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                            <h2 style={{ margin: 0, fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)' }}>
                                {editingId ? 'Edit Component' : 'Add Component'}
                            </h2>
                            <button onClick={() => { setShowAddModal(false); resetForm(); }} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {/* Equipment Name */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    Component Name <span style={{ color: 'var(--danger-500)' }}>*</span>
                                </label>
                                <input className="input" value={newEquipmentName} onChange={(e) => setNewEquipmentName(e.target.value)} placeholder="e.g., Centrifugal Pump A" />
                            </div>

                            {/* Section 1: Cost Parameters */}
                            <div style={{ padding: 'var(--spacing-sm) var(--spacing-md)', background: 'rgba(26,122,184,0.06)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--primary-500)' }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--primary-500)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--spacing-sm)' }}>
                                    Cost Parameters
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                            Acquisition Cost ($)
                                        </label>
                                        <input type="number" className="input" min={0} value={newAcquisitionCost || ''} onChange={(e) => setNewAcquisitionCost(Number(e.target.value))} placeholder="Initial equipment cost" />
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Initial purchase price of equipment</div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                            Failure Cost ($/event)
                                        </label>
                                        <input type="number" className="input" min={0} value={newFailureCost || ''} onChange={(e) => setNewFailureCost(Number(e.target.value))} placeholder="Cost per failure event" />
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Direct cost per unplanned failure</div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                            Downtime Cost Rate ($/hr)
                                        </label>
                                        <input type="number" className="input" min={0} value={newDowntimeCostRate || ''} onChange={(e) => setNewDowntimeCostRate(Number(e.target.value))} placeholder="Lost production per hour" />
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Penalty or lost revenue per hour of downtime</div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                            Planned Maint. Cost ($/task)
                                        </label>
                                        <input type="number" className="input" min={0} value={newPlannedMaintCost || ''} onChange={(e) => setNewPlannedMaintCost(Number(e.target.value))} placeholder="Cost per PM task" />
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Cost for one scheduled preventive maintenance</div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Reliability & Operating Parameters */}
                            <div style={{ padding: 'var(--spacing-sm) var(--spacing-md)', background: 'rgba(16,185,129,0.06)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid #10b981' }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--spacing-sm)' }}>
                                    Reliability & Operating Parameters
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                            Operating Time (hours)
                                        </label>
                                        <input type="number" className="input" min={1} value={newOperatingTime} onChange={(e) => setNewOperatingTime(Number(e.target.value))} />
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Total mission time ({fmtHr(newOperatingTime)})</div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                            PM Tasks per Year
                                        </label>
                                        <input type="number" className="input" min={0} value={newPMTasksPerYear} onChange={(e) => setNewPMTasksPerYear(Number(e.target.value))} />
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Number of planned maintenance tasks annually</div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                            MTBF (hours)
                                        </label>
                                        <input type="number" className="input" min={1} value={newMTBF} onChange={(e) => setNewMTBF(Number(e.target.value))} />
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Mean Time Between Failures ({fmtHr(newMTBF)})</div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                            MTTR (hours)
                                        </label>
                                        <input type="number" className="input" min={0.5} step={0.5} value={newMTTR} onChange={(e) => setNewMTTR(Number(e.target.value))} />
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Mean Time To Repair</div>
                                    </div>
                                </div>
                            </div>

                            {/* ========================================
                               LIVE CALCULATED OUTPUT PREVIEW
                               ======================================== */}
                            <div style={{
                                padding: 'var(--spacing-md)',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)',
                            }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--spacing-sm)' }}>
                                    Calculated Output (Live)
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 'var(--spacing-sm)', textAlign: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Total Cost</div>
                                        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--primary-500)' }}>
                                            {fmt(formPreview.totalOperatingCost)}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Uptime</div>
                                        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--success-500)' }}>
                                            {formPreview.systemUptime.toFixed(0)}h
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Downtime</div>
                                        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--danger-500)' }}>
                                            {formPreview.expectedDowntime.toFixed(0)}h
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Exp. Failures</div>
                                        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--warning-500)' }}>
                                            {formPreview.expectedFailures.toFixed(1)}
                                        </div>
                                    </div>
                                    <div style={{ gridColumn: isMobile ? 'span 2' : 'span 1' }}>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Cost/Hr</div>
                                        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: '#8b5cf6' }}>
                                            ${formPreview.costPerOperatingHour.toFixed(2)}/Hr
                                        </div>
                                    </div>
                                </div>
                                {/* Cost breakdown */}
                                <div style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                    {fmt(newAcquisitionCost)} (Acquisition) + {fmt(formPreview.failurePenalty)} (Failures) + {fmt(formPreview.downtimePenalty)} (Downtime) + {fmt(formPreview.totalPMCost)} (PM) = <strong style={{ color: 'var(--primary-500)' }}>{fmt(formPreview.totalOperatingCost)}</strong>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)' }}>
                                <button className="btn btn-secondary" onClick={() => { setShowAddModal(false); resetForm(); }} style={{ flex: 1 }}>Cancel</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={editingId ? handleSaveEdit : handleAdd}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)' }}
                                    disabled={!newEquipmentName}
                                >
                                    {editingId ? <><Save size={18} /> Save Changes</> : <><Wrench size={18} /> Add Component</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <ConfirmDeleteModal
                isOpen={deleteConfirm.isOpen}
                title="Delete Component"
                message="Are you sure you want to delete this component entry? This action cannot be undone."
                itemName={deleteConfirm.name}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
            />
        </>
    );
}
