import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    ShieldAlert,
    Clock,
    RefreshCw,
    Wrench,
    CheckCircle,
    Filter,
    Search,
    ArrowRight,
    Sparkles,
    Loader2,
    Eye,
    ChevronRight,
    ExternalLink,
    Activity,
    Info,
    RotateCcw
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import AssetSelector from '../components/AssetSelector';
import { useSidebar } from '../contexts/SidebarContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAssetContext } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { AlertsEngine, type MachineAlert, type AlertSeverity, type AlertCategory } from '../services/AlertsEngine';
import { GeminiService } from '../services/GeminiService';

export default function Alerts() {
    const navigate = useNavigate();
    const { isMobile } = useSidebar();
    const { t, direction } = useLanguage();
    const { user } = useAuth();
    const { currentProjectId, currentAssetId, currentAsset } = useAssetContext();

    const [alerts, setAlerts] = useState<MachineAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSeverity, setSelectedSeverity] = useState<string>('All');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [showAcknowledged, setShowAcknowledged] = useState(false);

    // Gemini AI Insights state
    const [aiLoading, setAiLoading] = useState(false);
    const [aiInsights, setAiInsights] = useState<string | null>(null);
    const [focusedAlert, setFocusedAlert] = useState<MachineAlert | null>(null);

    const loadAlerts = async () => {
        setLoading(true);
        try {
            const list = await AlertsEngine.evaluateMachineAlerts({
                userId: user?.id,
                projectId: currentProjectId,
                currentAssetId: currentAssetId
            });
            setAlerts(list);
        } catch (err) {
            console.error('Error loading alerts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAlerts();

        const handleAlertsChanged = () => {
            loadAlerts();
        };

        window.addEventListener('rcm-alerts-changed', handleAlertsChanged);
        return () => window.removeEventListener('rcm-alerts-changed', handleAlertsChanged);
    }, [user, currentProjectId, currentAssetId]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadAlerts();
        setIsRefreshing(false);
    };

    const handleAcknowledge = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        AlertsEngine.acknowledgeAlert(id);
    };

    const handleResetAcknowledged = () => {
        AlertsEngine.resetAcknowledgedAlerts();
    };

    // Filter alerts
    const filteredAlerts = useMemo(() => {
        return alerts.filter(a => {
            if (!showAcknowledged && a.acknowledged) return false;
            if (selectedSeverity !== 'All' && a.severity !== selectedSeverity.toLowerCase()) return false;
            if (selectedCategory !== 'All' && a.category !== selectedCategory) return false;
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchName = a.assetName.toLowerCase().includes(term);
                const matchTag = a.tagNumber.toLowerCase().includes(term);
                const matchTitle = a.title.toLowerCase().includes(term);
                const matchMsg = a.message.toLowerCase().includes(term);
                if (!matchName && !matchTag && !matchTitle && !matchMsg) return false;
            }
            return true;
        });
    }, [alerts, showAcknowledged, selectedSeverity, selectedCategory, searchTerm]);

    // KPI Summary
    const stats = useMemo(() => {
        const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;
        const warningCount = alerts.filter(a => a.severity === 'warning' && !a.acknowledged).length;
        const taskAlerts = alerts.filter(a => a.category === 'Task' && !a.acknowledged).length;
        const acknowledgedCount = alerts.filter(a => a.acknowledged).length;
        return { criticalCount, warningCount, taskAlerts, acknowledgedCount, total: alerts.length };
    }, [alerts]);

    // Ask Gemini AI to analyze all alerts
    const handleAnalyzeAlertsWithGemini = async () => {
        setAiLoading(true);
        setAiInsights(null);

        try {
            const prompt = `Review the following machine maintenance alerts for our industrial plant and provide an executive maintenance dispatch prioritization plan:
            
${alerts.map(a => `• [${a.severity.toUpperCase()}] ${a.assetName} (${a.tagNumber}): ${a.title} - ${a.message} (Action: ${a.recommendedAction})`).join('\n')}

Format your answer with:
1. 🚨 **Immediate Critical Actions (Next 24-48 Hours)**: Which machines must be taken offline or serviced first to avoid catastrophic failure?
2. ⚙️ **Preventive & Work Order Strategy**: Group tasks by technician specialty (Mechanical, Electrical, Instrumentation).
3. 💡 **RCM 7 Questions Root-Cause Insight**: Why are these failures clustering (lubrication, wear-out, contamination)?`;

            const reply = await GeminiService.sendChatMessage(prompt, {
                projectName: 'Graduation Plant Project',
                currentAsset: currentAsset ? { name: currentAsset.equipment_name, tag: currentAsset.tag_number } : null,
                alerts: alerts.map(a => ({ severity: a.severity, title: a.title, message: a.message, assetName: a.assetName }))
            });

            setAiInsights(reply);
        } catch (err: any) {
            setAiInsights(`Failed to generate Gemini AI insights: ${err?.message}`);
        } finally {
            setAiLoading(false);
        }
    };

    // Ask Gemini AI about a single alert
    const handleAskAiAboutAlert = async (alert: MachineAlert, e: React.MouseEvent) => {
        e.stopPropagation();
        setFocusedAlert(alert);
        setAiLoading(true);

        try {
            const prompt = `As a Senior Reliability Centered Maintenance (RCM) Engineer, analyze this specific equipment maintenance alert:
Machine: ${alert.assetName} (Tag: ${alert.tagNumber})
Alert Category: ${alert.category}
Alert Title: ${alert.title}
Diagnosis: ${alert.message}
Current Recommendation: ${alert.recommendedAction}

Provide a deep engineering assessment:
1. Root cause likelihood.
2. Consequences if not addressed within 7 days (Safety, Environmental, Downtime cost).
3. Step-by-step standard maintenance procedure (SMP) to resolve this alert.`;

            const reply = await GeminiService.sendChatMessage(prompt, {
                currentAsset: { name: alert.assetName, tag: alert.tagNumber },
                alerts: [{ severity: alert.severity, title: alert.title, message: alert.message, assetName: alert.assetName }]
            });

            setAiInsights(reply);
        } catch (err: any) {
            setAiInsights(`Error getting AI response: ${err?.message}`);
        } finally {
            setAiLoading(false);
        }
    };

    const getSeverityBadge = (severity: AlertSeverity) => {
        switch (severity) {
            case 'critical':
                return {
                    bg: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#ef4444',
                    text: 'CRITICAL',
                    icon: AlertTriangle,
                };
            case 'warning':
                return {
                    bg: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#f59e0b',
                    text: 'WARNING',
                    icon: Clock,
                };
            case 'attention':
                return {
                    bg: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    color: '#3b82f6',
                    text: 'ATTENTION',
                    icon: Activity,
                };
            default:
                return {
                    bg: 'rgba(107, 114, 128, 0.15)',
                    border: '1px solid rgba(107, 114, 128, 0.4)',
                    color: '#9ca3af',
                    text: 'INFO',
                    icon: Info,
                };
        }
    };

    return (
        <>
            <Sidebar />
            <PageContainer>
                <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
                    {/* Page Header */}
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
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ef4444'
                                }}>
                                    <ShieldAlert size={22} />
                                </div>
                                <h1 style={{ margin: 0, fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)' }}>
                                    Machine Maintenance Alerts
                                </h1>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                Real-time monitoring of equipment requiring maintenance based on RPN risks, Weibull wear-out limits, and overdue tasks.
                            </p>
                        </div>

                        {/* Top Action Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                            <button
                                onClick={handleAnalyzeAlertsWithGemini}
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
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                {aiLoading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} color="#ffe066" />}
                                <span>{aiLoading ? 'Analyzing...' : 'Ask Gemini AI'}</span>
                            </button>

                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 14px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    cursor: isRefreshing ? 'wait' : 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                }}
                            >
                                <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
                                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                            </button>

                            <AssetSelector />
                        </div>
                    </div>

                    {/* KPI Summary Cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-xl)'
                    }}>
                        {/* Critical Alerts */}
                        <div className="card" style={{
                            padding: 'var(--spacing-md)',
                            borderLeft: '4px solid #ef4444',
                            background: 'var(--bg-card)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                    Critical Overruns
                                </span>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#ef4444'
                                }}>
                                    <AlertTriangle size={16} />
                                </div>
                            </div>
                            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>
                                {stats.criticalCount}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                Immediate overhaul / risk mitigation
                            </div>
                        </div>

                        {/* Warning Alerts */}
                        <div className="card" style={{
                            padding: 'var(--spacing-md)',
                            borderLeft: '4px solid #f59e0b',
                            background: 'var(--bg-card)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                    Upcoming / Monitor
                                </span>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#f59e0b'
                                }}>
                                    <Clock size={16} />
                                </div>
                            </div>
                            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>
                                {stats.warningCount}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                Approaching MTBF or service cycle
                            </div>
                        </div>

                        {/* Overdue / Due Tasks */}
                        <div className="card" style={{
                            padding: 'var(--spacing-md)',
                            borderLeft: '4px solid #8b5cf6',
                            background: 'var(--bg-card)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                    Task Schedules
                                </span>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: 'rgba(139, 92, 246, 0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#8b5cf6'
                                }}>
                                    <Wrench size={16} />
                                </div>
                            </div>
                            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: '#8b5cf6', lineHeight: 1 }}>
                                {stats.taskAlerts}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                PM tasks pending or overdue
                            </div>
                        </div>

                        {/* Acknowledged / Total */}
                        <div className="card" style={{
                            padding: 'var(--spacing-md)',
                            borderLeft: '4px solid #10b981',
                            background: 'var(--bg-card)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                    Total Monitored
                                </span>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#10b981'
                                }}>
                                    <CheckCircle size={16} />
                                </div>
                            </div>
                            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                                {stats.total}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                {stats.acknowledgedCount} acknowledged
                            </div>
                        </div>
                    </div>

                    {/* Gemini AI Insights Panel (Collapsible / Banner) */}
                    {aiInsights && (
                        <div
                            className="card-glass animate-fade-in"
                            style={{
                                padding: 'var(--spacing-lg)',
                                marginBottom: 'var(--spacing-xl)',
                                border: '1px solid rgba(14, 165, 233, 0.4)',
                                background: 'linear-gradient(180deg, rgba(14, 165, 233, 0.08) 0%, rgba(2, 132, 199, 0.02) 100%)',
                                borderRadius: 'var(--radius-lg)',
                                position: 'relative'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                    <Sparkles size={20} color="#0ea5e9" />
                                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}>
                                        {focusedAlert ? `Gemini AI Diagnostic Assessment for ${focusedAlert.assetName}` : 'Gemini AI Plant Maintenance Prioritization'}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => { setAiInsights(null); setFocusedAlert(null); }}
                                    className="btn btn-ghost"
                                    style={{ padding: '4px 8px', minWidth: 'auto', fontSize: '12px' }}
                                >
                                    Dismiss
                                </button>
                            </div>

                            <div
                                style={{
                                    fontSize: 'var(--font-size-sm)',
                                    lineHeight: 1.7,
                                    color: 'var(--text-primary)',
                                    maxHeight: '400px',
                                    overflowY: 'auto',
                                    paddingRight: 'var(--spacing-sm)'
                                }}
                                dangerouslySetInnerHTML={{
                                    __html: aiInsights
                                        .replace(/&/g, '&amp;')
                                        .replace(/</g, '&lt;')
                                        .replace(/>/g, '&gt;')
                                        .replace(/^# (.*$)/gim, '<h3 style="font-size:1.15em;font-weight:700;margin:12px 0 6px 0;color:var(--primary-500)">$1</h3>')
                                        .replace(/^## (.*$)/gim, '<h4 style="font-size:1.05em;font-weight:600;margin:10px 0 4px 0;color:var(--text-primary)">$1</h4>')
                                        .replace(/^### (.*$)/gim, '<h5 style="font-size:0.95em;font-weight:600;margin:8px 0 2px 0;color:var(--text-secondary)">$1</h5>')
                                        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                                        .replace(/`([^`]+)`/g, '<code style="background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;font-size:0.9em">$1</code>')
                                        .replace(/\n/g, '<br/>')
                                }}
                            />
                        </div>
                    )}

                    {/* Filter Bar */}
                    <div className="card" style={{
                        padding: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-lg)',
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'stretch' : 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--spacing-md)',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                    }}>
                        {/* Search Input */}
                        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                            <input
                                type="text"
                                className="input"
                                placeholder="Search by equipment, component, or tag..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '36px', width: '100%' }}
                            />
                        </div>

                        {/* Dropdown Filters */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                            {/* Severity Filter */}
                            <select
                                className="input"
                                value={selectedSeverity}
                                onChange={(e) => setSelectedSeverity(e.target.value)}
                                style={{ width: 'auto', minWidth: '130px' }}
                            >
                                <option value="All">All Severities</option>
                                <option value="Critical">🔴 Critical Only</option>
                                <option value="Warning">🟠 Warning Only</option>
                                <option value="Attention">🔵 Attention Only</option>
                            </select>

                            {/* Category Filter */}
                            <select
                                className="input"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                style={{ width: 'auto', minWidth: '140px' }}
                            >
                                <option value="All">All Categories</option>
                                <option value="FMEA">FMEA Risk (RPN)</option>
                                <option value="Replacement">Optimal Replacement</option>
                                <option value="Task">Maintenance Tasks</option>
                                <option value="Reliability">Reliability / MTBF</option>
                            </select>

                            {/* Show Acknowledged Checkbox */}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', cursor: 'pointer', userSelect: 'none' }}>
                                <input
                                    type="checkbox"
                                    checked={showAcknowledged}
                                    onChange={(e) => setShowAcknowledged(e.target.checked)}
                                />
                                Show Acknowledged
                            </label>

                            {stats.acknowledgedCount > 0 && (
                                <button
                                    onClick={handleResetAcknowledged}
                                    className="btn btn-ghost"
                                    style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    title="Unacknowledge all alerts"
                                >
                                    <RotateCcw size={12} />
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Alerts List */}
                    {loading ? (
                        <div className="card" style={{ padding: 'var(--spacing-3xl)', textAlign: 'center' }}>
                            <Loader2 size={32} className="spin" style={{ margin: '0 auto var(--spacing-md) auto', color: 'var(--primary-500)' }} />
                            <p style={{ color: 'var(--text-secondary)' }}>Scanning machine health parameters and telemetry...</p>
                        </div>
                    ) : filteredAlerts.length === 0 ? (
                        <div className="card" style={{ padding: 'var(--spacing-3xl)', textAlign: 'center' }}>
                            <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto var(--spacing-md) auto' }} />
                            <h3 style={{ margin: 0, marginBottom: '8px' }}>No Active Machine Maintenance Alerts</h3>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', maxWidth: '480px', margin: '0 auto' }}>
                                All equipment is operating within normal reliability parameters, MTBF thresholds, and scheduled maintenance limits.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {filteredAlerts.map(alert => {
                                const badge = getSeverityBadge(alert.severity);
                                const BadgeIcon = badge.icon;

                                return (
                                    <div
                                        key={alert.id}
                                        className="card"
                                        style={{
                                            padding: 'var(--spacing-lg)',
                                            borderLeft: `5px solid ${badge.color}`,
                                            background: alert.acknowledged ? 'rgba(0,0,0,0.02)' : 'var(--bg-card)',
                                            opacity: alert.acknowledged ? 0.75 : 1,
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: isMobile ? 'column' : 'row',
                                            justifyContent: 'space-between',
                                            alignItems: isMobile ? 'flex-start' : 'center',
                                            gap: 'var(--spacing-md)',
                                            marginBottom: 'var(--spacing-sm)'
                                        }}>
                                            {/* Left Header */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                                                {/* Severity Pill */}
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '3px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: badge.bg,
                                                    border: badge.border,
                                                    color: badge.color,
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.5px'
                                                }}>
                                                    <BadgeIcon size={12} />
                                                    {badge.text}
                                                </span>

                                                {/* Category Pill */}
                                                <span style={{
                                                    padding: '3px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: 'var(--bg-tertiary)',
                                                    color: 'var(--text-secondary)',
                                                    fontSize: '11px',
                                                    fontWeight: 600
                                                }}>
                                                    {alert.category}
                                                </span>

                                                {/* Equipment Tag */}
                                                <span style={{
                                                    padding: '3px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: 'rgba(14, 165, 233, 0.1)',
                                                    color: 'var(--primary-500)',
                                                    fontSize: '11px',
                                                    fontWeight: 700
                                                }}>
                                                    {alert.tagNumber}
                                                </span>

                                                <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
                                                    {alert.assetName}
                                                </strong>
                                            </div>

                                            {/* Metric Badge if applicable */}
                                            {alert.metricLabel && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: 'var(--bg-tertiary)',
                                                    padding: '4px 10px',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontSize: '12px'
                                                }}>
                                                    <span style={{ color: 'var(--text-tertiary)' }}>{alert.metricLabel}:</span>
                                                    <strong style={{ color: badge.color }}>{alert.metricValue}</strong>
                                                </div>
                                            )}
                                        </div>

                                        {/* Title & Diagnosis */}
                                        <h4 style={{ margin: '0 0 6px 0', fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>
                                            {alert.title}
                                        </h4>
                                        <p style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            {alert.message}
                                        </p>

                                        {/* Action Recommendation Box */}
                                        <div style={{
                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                            background: 'rgba(14, 165, 233, 0.05)',
                                            borderLeft: '3px solid var(--primary-500)',
                                            borderRadius: 'var(--radius-sm)',
                                            marginBottom: 'var(--spacing-md)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-sm)'
                                        }}>
                                            <Wrench size={16} color="var(--primary-500)" style={{ flexShrink: 0 }} />
                                            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                                                <strong>Recommended Action:</strong> {alert.recommendedAction}
                                            </span>
                                        </div>

                                        {/* Action Buttons Footer */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: 'var(--spacing-sm)',
                                            paddingTop: 'var(--spacing-sm)',
                                            borderTop: '1px solid var(--border-color)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                                                <button
                                                    onClick={() => navigate(alert.actionRoute)}
                                                    className="btn btn-primary"
                                                    style={{
                                                        padding: '6px 14px',
                                                        fontSize: '12px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <span>Open in {alert.category === 'Task' ? 'Tasks' : alert.category}</span>
                                                    <ArrowRight size={14} />
                                                </button>

                                                <button
                                                    onClick={(e) => handleAskAiAboutAlert(alert, e)}
                                                    className="btn btn-ghost"
                                                    style={{
                                                        padding: '6px 12px',
                                                        fontSize: '12px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        color: 'var(--primary-500)',
                                                        border: '1px solid rgba(14, 165, 233, 0.3)'
                                                    }}
                                                >
                                                    <Sparkles size={14} />
                                                    <span>AI Diagnosis</span>
                                                </button>
                                            </div>

                                            <div>
                                                {!alert.acknowledged ? (
                                                    <button
                                                        onClick={(e) => handleAcknowledge(alert.id, e)}
                                                        className="btn btn-ghost"
                                                        style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--text-tertiary)' }}
                                                    >
                                                        <CheckCircle size={14} style={{ marginRight: '4px' }} />
                                                        Acknowledge
                                                    </button>
                                                ) : (
                                                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                                        Acknowledged
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </PageContainer>
        </>
    );
}
