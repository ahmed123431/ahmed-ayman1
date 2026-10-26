import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    DollarSign,
    TrendingDown,
    TrendingUp,
    Calculator,
    PieChart as PieIcon,
    BarChart3,
    Activity,
    Clock,
    Wrench,
    AlertTriangle,
    Sparkles,
    Loader2,
    RefreshCw,
    Sliders,
    ArrowRight,
    ExternalLink
} from 'lucide-react';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    AreaChart,
    Area
} from 'recharts';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import AssetSelector from '../components/AssetSelector';
import { useSidebar } from '../contexts/SidebarContext';
import { useAssetContext } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { GeminiService } from '../services/GeminiService';

interface CostRecord {
    id: string;
    equipmentName: string;
    acquisitionCost: number;
    failureCost: number;
    downtimeCostRate: number;
    plannedMaintCost: number;
    operatingTime: number;
    mtbf: number;
    mttr: number;
    pmTasksPerYear: number;
    totalOperatingCost: number;
    expectedFailures: number;
    expectedDowntime: number;
    systemUptime: number;
    costPerOperatingHour: number;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function CostAnalysis() {
    const navigate = useNavigate();
    const { isMobile } = useSidebar();
    const { user } = useAuth();
    const { currentAssetId, currentAsset } = useAssetContext();

    const [costItems, setCostItems] = useState<CostRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // ROI Simulator Controls
    const [simFailureReduction, setSimFailureReduction] = useState(45); // 45% reduction
    const [simDowntimeReduction, setSimDowntimeReduction] = useState(40); // 40% reduction
    const [simCbmInvestment, setSimCbmInvestment] = useState(15000); // $15k investment

    // Gemini AI State
    const [aiLoading, setAiLoading] = useState(false);
    const [aiCostAdvice, setAiCostAdvice] = useState<string | null>(null);

    const loadCosts = async () => {
        setLoading(true);
        try {
            let query = supabase.from('costs').select('*');
            if (currentAssetId) {
                query = query.eq('asset_id', currentAssetId);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                const mapped: CostRecord[] = data.map((item: any) => {
                    const acquisitionCost = Number(item.acquisition_cost) || 10000;
                    const failureCost = Number(item.failure_cost) || 5000;
                    const downtimeCostRate = Number(item.downtime_cost_rate) || 1000;
                    const plannedMaintCost = Number(item.planned_maint_cost) || 800;
                    const operatingTime = Number(item.operating_time) || 8760;
                    const mtbf = Number(item.mtbf) || 8760;
                    const mttr = Number(item.mttr) || 4;
                    const pmTasksPerYear = Number(item.pm_tasks_per_year) || 4;

                    const expectedFailures = mtbf > 0 ? operatingTime / mtbf : 0;
                    const expectedDowntime = expectedFailures * mttr;
                    const systemUptime = Math.max(0, operatingTime - expectedDowntime);
                    const totalPMCost = plannedMaintCost * (pmTasksPerYear * (operatingTime / 8760));

                    const totalOperatingCost =
                        acquisitionCost +
                        (expectedFailures * failureCost) +
                        (expectedDowntime * downtimeCostRate) +
                        totalPMCost;

                    const costPerOperatingHour = systemUptime > 0 ? totalOperatingCost / systemUptime : 0;

                    return {
                        id: item.id,
                        equipmentName: item.equipment_name || 'Component',
                        acquisitionCost,
                        failureCost,
                        downtimeCostRate,
                        plannedMaintCost,
                        operatingTime,
                        mtbf,
                        mttr,
                        pmTasksPerYear,
                        totalOperatingCost,
                        expectedFailures,
                        expectedDowntime,
                        systemUptime,
                        costPerOperatingHour
                    };
                });
                setCostItems(mapped);
            } else {
                // Baseline default assets for clear initial demonstration
                setCostItems(getDefaultCostData());
            }
        } catch (err) {
            console.error('Error loading costs:', err);
            setCostItems(getDefaultCostData());
        } finally {
            setLoading(false);
        }
    };

    function getDefaultCostData(): CostRecord[] {
        return [
            {
                id: '1',
                equipmentName: 'Centrifugal Pump A-101',
                acquisitionCost: 45000,
                failureCost: 12000,
                downtimeCostRate: 2500,
                plannedMaintCost: 1500,
                operatingTime: 8760,
                mtbf: 4380,
                mttr: 6,
                pmTasksPerYear: 4,
                totalOperatingCost: 105000,
                expectedFailures: 2.0,
                expectedDowntime: 12,
                systemUptime: 8748,
                costPerOperatingHour: 12.0
            },
            {
                id: '2',
                equipmentName: 'Motor Drive B-205',
                acquisitionCost: 28000,
                failureCost: 8500,
                downtimeCostRate: 1800,
                plannedMaintCost: 900,
                operatingTime: 8760,
                mtbf: 8760,
                mttr: 4,
                pmTasksPerYear: 2,
                totalOperatingCost: 51000,
                expectedFailures: 1.0,
                expectedDowntime: 4,
                systemUptime: 8756,
                costPerOperatingHour: 5.8
            },
            {
                id: '3',
                equipmentName: 'Compressor Unit C-301',
                acquisitionCost: 65000,
                failureCost: 18000,
                downtimeCostRate: 3200,
                plannedMaintCost: 2400,
                operatingTime: 8760,
                mtbf: 5840,
                mttr: 8,
                pmTasksPerYear: 3,
                totalOperatingCost: 135000,
                expectedFailures: 1.5,
                expectedDowntime: 12,
                systemUptime: 8748,
                costPerOperatingHour: 15.4
            },
            {
                id: '4',
                equipmentName: 'Conveyor Drive Belt D-102',
                acquisitionCost: 12000,
                failureCost: 4200,
                downtimeCostRate: 1100,
                plannedMaintCost: 600,
                operatingTime: 8760,
                mtbf: 2920,
                mttr: 3,
                pmTasksPerYear: 6,
                totalOperatingCost: 38000,
                expectedFailures: 3.0,
                expectedDowntime: 9,
                systemUptime: 8751,
                costPerOperatingHour: 4.3
            }
        ];
    }

    useEffect(() => {
        loadCosts();
    }, [currentAssetId, user]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadCosts();
        setIsRefreshing(false);
    };

    // Aggregate Calculations
    const aggregate = useMemo(() => {
        let totalAcquisition = 0;
        let totalFailurePenalties = 0;
        let totalDowntimeLosses = 0;
        let totalPMMaint = 0;
        let totalOperatingCost = 0;
        let totalUptime = 0;
        let totalDowntime = 0;

        costItems.forEach(c => {
            const failPenalty = c.expectedFailures * c.failureCost;
            const dtLoss = c.expectedDowntime * c.downtimeCostRate;
            const pmCost = c.plannedMaintCost * (c.pmTasksPerYear * (c.operatingTime / 8760));

            totalAcquisition += c.acquisitionCost;
            totalFailurePenalties += failPenalty;
            totalDowntimeLosses += dtLoss;
            totalPMMaint += pmCost;
            totalOperatingCost += c.totalOperatingCost;
            totalUptime += c.systemUptime;
            totalDowntime += c.expectedDowntime;
        });

        const avgCostPerHour = totalUptime > 0 ? totalOperatingCost / totalUptime : 0;

        // Simulated RCM Savings based on slider parameters
        const savedFailures = totalFailurePenalties * (simFailureReduction / 100);
        const savedDowntime = totalDowntimeLosses * (simDowntimeReduction / 100);
        const grossAnnualSavings = savedFailures + savedDowntime;
        const netAnnualSavings = Math.max(0, grossAnnualSavings - (simCbmInvestment * 0.15)); // 15% annual maintenance of CBM tools
        const roi = simCbmInvestment > 0 ? (netAnnualSavings / simCbmInvestment) * 100 : 0;
        const paybackPeriod = netAnnualSavings > 0 ? simCbmInvestment / netAnnualSavings : 0;

        return {
            totalOperatingCost,
            totalAcquisition,
            totalFailurePenalties,
            totalDowntimeLosses,
            totalPMMaint,
            totalUptime,
            totalDowntime,
            avgCostPerHour,
            grossAnnualSavings,
            netAnnualSavings,
            roi,
            paybackPeriod
        };
    }, [costItems, simFailureReduction, simDowntimeReduction, simCbmInvestment]);

    // Data for Cost Breakdown Pie Chart
    const pieData = useMemo(() => [
        { name: 'Downtime Losses', value: Math.round(aggregate.totalDowntimeLosses) },
        { name: 'Failure Penalties', value: Math.round(aggregate.totalFailurePenalties) },
        { name: 'Planned Maintenance', value: Math.round(aggregate.totalPMMaint) },
        { name: 'Acquisition Amortized', value: Math.round(aggregate.totalAcquisition * 0.15) },
    ], [aggregate]);

    // Data for Asset Cost Comparison Bar Chart
    const barData = useMemo(() => {
        return costItems.map(c => ({
            name: c.equipmentName.length > 18 ? c.equipmentName.slice(0, 16) + '...' : c.equipmentName,
            totalCost: Math.round(c.totalOperatingCost / 1000),
            downtimeCost: Math.round((c.expectedDowntime * c.downtimeCostRate) / 1000),
            maintCost: Math.round((c.plannedMaintCost * c.pmTasksPerYear) / 1000),
        }));
    }, [costItems]);

    // 5-Year Cumulative Trajectory (Area Chart: Conventional Run-to-Failure vs RCM Optimized)
    const trajectoryData = useMemo(() => {
        const annualBase = aggregate.totalOperatingCost;
        const annualRcm = aggregate.totalOperatingCost - aggregate.netAnnualSavings;

        return [
            { year: 'Year 1', Conventional: Math.round(annualBase / 1000), RCM: Math.round((annualRcm + simCbmInvestment) / 1000) },
            { year: 'Year 2', Conventional: Math.round((annualBase * 2.1) / 1000), RCM: Math.round((annualRcm * 2 + simCbmInvestment) / 1000) },
            { year: 'Year 3', Conventional: Math.round((annualBase * 3.3) / 1000), RCM: Math.round((annualRcm * 3 + simCbmInvestment) / 1000) },
            { year: 'Year 4', Conventional: Math.round((annualBase * 4.6) / 1000), RCM: Math.round((annualRcm * 4 + simCbmInvestment) / 1000) },
            { year: 'Year 5', Conventional: Math.round((annualBase * 6.0) / 1000), RCM: Math.round((annualRcm * 5 + simCbmInvestment) / 1000) },
        ];
    }, [aggregate, simCbmInvestment]);

    // Ask Gemini AI to generate financial insights
    const handleGenerateAiCostAdvice = async () => {
        setAiLoading(true);
        setAiCostAdvice(null);

        try {
            const prompt = `As a Chief Industrial Plant Reliability & Financial Engineer, review our RCM cost analysis data:
- Total Annual Operating Cost: $${aggregate.totalOperatingCost.toLocaleString()}
- Downtime Production Losses: $${aggregate.totalDowntimeLosses.toLocaleString()} (${aggregate.totalDowntime.toFixed(0)} downtime hours)
- Direct Failure Penalties: $${aggregate.totalFailurePenalties.toLocaleString()}
- Planned Preventive Maintenance: $${aggregate.totalPMMaint.toLocaleString()}
- Average Cost per Operating Hour: $${aggregate.avgCostPerHour.toFixed(2)}/hr
- Equipment Inventory: ${costItems.map(c => `${c.equipmentName}: Total $${c.totalOperatingCost.toLocaleString()} (MTBF: ${c.mtbf}h, Downtime Rate: $${c.downtimeCostRate}/h)`).join('; ')}

Provide an executive RCM financial optimization report:
1. 💡 **Top Cost Drivers ("Bad Actors")**: Which 1 or 2 machines generate the highest financial drain and why?
2. 📉 **Direct Savings Roadmap**: Exactly how to achieve 35-45% reduction in downtime losses through RCM proactive tasks.
3. 🎯 **ROI & Sensor Justification**: How to justify vibration/temperature CBM instrumentation investment to executive management based on payback period.`;

            const reply = await GeminiService.sendChatMessage(prompt, {
                projectName: 'Graduation Plant Project',
                currentAsset: currentAsset ? { name: currentAsset.equipment_name, tag: currentAsset.tag_number } : null,
                costs: {
                    totalCost: aggregate.totalOperatingCost,
                    downtimeLosses: aggregate.totalDowntimeLosses,
                    maintenanceCost: aggregate.totalPMMaint,
                    avgCostPerHour: aggregate.avgCostPerHour
                }
            });

            setAiCostAdvice(reply);
        } catch (err: any) {
            setAiCostAdvice(`Error generating AI cost advice: ${err?.message}`);
        } finally {
            setAiLoading(false);
        }
    };

    const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
    const fmtK = (n: number) => `$${(n / 1000).toFixed(1)}K`;

    return (
        <>
            <Sidebar />
            <PageContainer>
                <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'stretch' : 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-xl)'
                    }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: '4px' }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#10b981'
                                }}>
                                    <DollarSign size={22} />
                                </div>
                                <h1 style={{ margin: 0, fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)' }}>
                                    RCM Life Cycle Cost & ROI Analysis
                                </h1>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                Life cycle cost evaluation, downtime loss modeling, and proactive RCM financial savings projections.
                            </p>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                            <button
                                onClick={handleGenerateAiCostAdvice}
                                disabled={aiLoading}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 14px',
                                    borderRadius: 'var(--radius-md)',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                    color: 'white',
                                    cursor: aiLoading ? 'wait' : 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)',
                                }}
                            >
                                {aiLoading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} color="#ffe066" />}
                                <span>{aiLoading ? 'Analyzing...' : 'AI Cost Optimization'}</span>
                            </button>

                            <button
                                onClick={() => navigate('/operating-costs')}
                                className="btn btn-ghost"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 14px',
                                    fontSize: '13px',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)'
                                }}
                                title="Edit Component Cost Parameters"
                            >
                                <Wrench size={16} />
                                <span>Component Parameters</span>
                            </button>

                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="btn btn-ghost"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 14px',
                                    fontSize: '13px',
                                    border: '1px solid var(--border-color)'
                                }}
                            >
                                <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
                            </button>

                            <AssetSelector />
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-xl)'
                    }}>
                        {/* Total Cost */}
                        <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '4px solid var(--primary-500)', background: 'var(--bg-card)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                    Total Annual Cost
                                </span>
                                <DollarSign size={18} color="var(--primary-500)" />
                            </div>
                            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--primary-500)', lineHeight: 1 }}>
                                {fmt(aggregate.totalOperatingCost)}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                ~${aggregate.avgCostPerHour.toFixed(2)} per operating hour
                            </div>
                        </div>

                        {/* Downtime Losses */}
                        <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '4px solid #ef4444', background: 'var(--bg-card)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                    Downtime Losses
                                </span>
                                <Clock size={18} color="#ef4444" />
                            </div>
                            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>
                                {fmt(aggregate.totalDowntimeLosses)}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                {aggregate.totalDowntime.toFixed(0)} hours lost production
                            </div>
                        </div>

                        {/* Projected Annual Savings */}
                        <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '4px solid #10b981', background: 'var(--bg-card)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                    Projected RCM Savings
                                </span>
                                <TrendingUp size={18} color="#10b981" />
                            </div>
                            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>
                                {fmt(aggregate.netAnnualSavings)}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                {(aggregate.netAnnualSavings > 0 && aggregate.totalOperatingCost > 0)
                                    ? `~${Math.round((aggregate.netAnnualSavings / aggregate.totalOperatingCost) * 100)}% budget reduction`
                                    : 'Via failure reduction'}
                            </div>
                        </div>

                        {/* Projected ROI */}
                        <div className="card" style={{ padding: 'var(--spacing-md)', borderLeft: '4px solid #8b5cf6', background: 'var(--bg-card)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                    Projected ROI
                                </span>
                                <Calculator size={18} color="#8b5cf6" />
                            </div>
                            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: '#8b5cf6', lineHeight: 1 }}>
                                {Math.round(aggregate.roi)}%
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                Payback period: ~{aggregate.paybackPeriod.toFixed(1)} years
                            </div>
                        </div>
                    </div>

                    {/* Gemini AI Advice Banner */}
                    {aiCostAdvice && (
                        <div
                            className="card-glass animate-fade-in"
                            style={{
                                padding: 'var(--spacing-lg)',
                                marginBottom: 'var(--spacing-xl)',
                                border: '1px solid rgba(14, 165, 233, 0.4)',
                                background: 'linear-gradient(180deg, rgba(14, 165, 233, 0.08) 0%, rgba(2, 132, 199, 0.02) 100%)',
                                borderRadius: 'var(--radius-lg)',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                    <Sparkles size={20} color="#0ea5e9" />
                                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}>
                                        Gemini AI Financial & Cost Optimization Assessment
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setAiCostAdvice(null)}
                                    className="btn btn-ghost"
                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                >
                                    Dismiss
                                </button>
                            </div>
                            <div
                                style={{
                                    fontSize: 'var(--font-size-sm)',
                                    lineHeight: 1.7,
                                    color: 'var(--text-primary)',
                                    maxHeight: '380px',
                                    overflowY: 'auto'
                                }}
                                dangerouslySetInnerHTML={{
                                    __html: aiCostAdvice
                                        .replace(/&/g, '&amp;')
                                        .replace(/</g, '&lt;')
                                        .replace(/>/g, '&gt;')
                                        .replace(/^# (.*$)/gim, '<h3 style="font-size:1.15em;font-weight:700;margin:12px 0 6px 0;color:var(--primary-500)">$1</h3>')
                                        .replace(/^## (.*$)/gim, '<h4 style="font-size:1.05em;font-weight:600;margin:10px 0 4px 0;color:var(--text-primary)">$1</h4>')
                                        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                                        .replace(/\n/g, '<br/>')
                                }}
                            />
                        </div>
                    )}

                    {/* Charts Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: 'var(--spacing-xl)',
                        marginBottom: 'var(--spacing-xl)'
                    }}>
                        {/* Cost Breakdown Donut Chart */}
                        <div className="card" style={{ padding: 'var(--spacing-lg)', background: 'var(--bg-card)' }}>
                            <h3 style={{ margin: '0 0 var(--spacing-md) 0', fontSize: 'var(--font-size-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <PieIcon size={18} color="var(--primary-500)" />
                                Annual Maintenance & Loss Breakdown
                            </h3>
                            <div style={{ height: '280px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={95}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Cost']} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Cost per Asset Bar Chart */}
                        <div className="card" style={{ padding: 'var(--spacing-lg)', background: 'var(--bg-card)' }}>
                            <h3 style={{ margin: '0 0 var(--spacing-md) 0', fontSize: 'var(--font-size-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <BarChart3 size={18} color="#10b981" />
                                Cost Drivers by Equipment ($K)
                            </h3>
                            <div style={{ height: '280px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={barData}>
                                        <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={11} />
                                        <YAxis stroke="var(--text-tertiary)" fontSize={11} />
                                        <Tooltip formatter={(val: any) => [`$${val}K`, '']} />
                                        <Legend />
                                        <Bar dataKey="totalCost" name="Total Cost ($K)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="downtimeCost" name="Downtime Loss ($K)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Interactive RCM ROI & Savings Simulator */}
                    <div className="card" style={{
                        padding: 'var(--spacing-xl)',
                        marginBottom: 'var(--spacing-xl)',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-lg)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-md)' }}>
                            <Sliders size={20} color="var(--primary-500)" />
                            <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>
                                Interactive RCM Savings & ROI Simulator
                            </h3>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-lg)' }}>
                            Simulate how implementing proactive RCM tasks and predictive sensors reduces downtime losses and failure penalties.
                        </p>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                            gap: 'var(--spacing-xl)',
                            marginBottom: 'var(--spacing-lg)'
                        }}>
                            {/* Slider 1: Failure Reduction */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                        Failure Reduction
                                    </label>
                                    <strong style={{ color: '#10b981' }}>{simFailureReduction}%</strong>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="80"
                                    step="5"
                                    value={simFailureReduction}
                                    onChange={(e) => setSimFailureReduction(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: '#10b981' }}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                    Target reduction in unplanned breakdowns via PM/CBM
                                </div>
                            </div>

                            {/* Slider 2: Downtime Reduction */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                        Downtime Reduction
                                    </label>
                                    <strong style={{ color: '#0ea5e9' }}>{simDowntimeReduction}%</strong>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="80"
                                    step="5"
                                    value={simDowntimeReduction}
                                    onChange={(e) => setSimDowntimeReduction(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: '#0ea5e9' }}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                    Faster restoration and planned task turnaround
                                </div>
                            </div>

                            {/* Slider 3: CBM / Tech Investment */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                        CBM & Sensor Investment
                                    </label>
                                    <strong style={{ color: '#8b5cf6' }}>${simCbmInvestment.toLocaleString()}</strong>
                                </div>
                                <input
                                    type="range"
                                    min="5000"
                                    max="60000"
                                    step="5000"
                                    value={simCbmInvestment}
                                    onChange={(e) => setSimCbmInvestment(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: '#8b5cf6' }}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                    One-time sensors, vibration tools, & software setup
                                </div>
                            </div>
                        </div>

                        {/* Simulation Output Banner */}
                        <div style={{
                            padding: 'var(--spacing-md)',
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: 'var(--radius-md)',
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                            gap: 'var(--spacing-md)',
                            textAlign: 'center'
                        }}>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                    Net Annual Cash Savings
                                </div>
                                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                                    {fmt(aggregate.netAnnualSavings)} / yr
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                    Return on Investment (ROI)
                                </div>
                                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: '#8b5cf6', marginTop: '4px' }}>
                                    {Math.round(aggregate.roi)}%
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                    Capital Payback Period
                                </div>
                                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--primary-500)', marginTop: '4px' }}>
                                    {aggregate.paybackPeriod.toFixed(1)} years
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5-Year Cumulative Cost Trajectory Chart */}
                    <div className="card" style={{ padding: 'var(--spacing-lg)', background: 'var(--bg-card)' }}>
                        <h3 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--font-size-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrendingDown size={18} color="#10b981" />
                            5-Year Financial Projection: Conventional Breakdown Maintenance vs. RCM ($K)
                        </h3>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-md)' }}>
                            Demonstrates long-term compounding cost savings achieved by investing in proactive RCM task intervals.
                        </p>
                        <div style={{ height: '300px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trajectoryData}>
                                    <XAxis dataKey="year" stroke="var(--text-tertiary)" fontSize={12} />
                                    <YAxis stroke="var(--text-tertiary)" fontSize={12} />
                                    <Tooltip formatter={(val: any) => [`$${val}K`, '']} />
                                    <Legend />
                                    <Area type="monotone" dataKey="Conventional" name="Run-to-Failure / Reactive ($K)" stroke="#ef4444" fill="rgba(239, 68, 68, 0.2)" />
                                    <Area type="monotone" dataKey="RCM" name="RCM Proactive Program ($K)" stroke="#10b981" fill="rgba(16, 185, 129, 0.2)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </PageContainer>
        </>
    );
}
