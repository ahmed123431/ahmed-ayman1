import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Check, X as XIcon, Loader2, GitBranch } from 'lucide-react';
import LogicTreeAnalysis, { type LTAResult } from './LogicTreeAnalysis';
import CBMPFCurve from './CBMPFCurve';
import { useAuth } from '../contexts/AuthContext';
import { useAssetContext } from '../contexts/AssetContext';
import { supabase } from '../lib/supabaseClient';

// ============================================================
// RCM LOGIC TREE TABLE
// A tabular view of the RCM Decision Logic Tree for all FMEA items.
// Each row = one failure mode, each column = one RCM decision question.
// Cells can receive output from external webhooks.
// ============================================================

interface FMEAItem {
    id: string;
    component: string;
    function?: string;
    failureMode: string;
    failureCause: string;
    failureEffect: string;
    severity: number;
    occurrence: number;
    detection: number;
    rpn: number;
    riskLevel: string;
}

export interface LogicTreeRow {
    fmeaId: string;
    hiddenConsequence: boolean | null;
    criticalRisk: boolean | null;
    operationalRisk: boolean | null;
    financialRisk: boolean | null;
    cbmFeasibility: boolean | null;
    tbmFeasibility: boolean | null;
    // Legacy fields kept for backward-compat with old localStorage data
    hiddenFailure?: boolean | null;
    cbmAppropriate?: boolean | null;
    cbmWorthDoing?: boolean | null;
    tbmAppropriate?: boolean | null;
    tbmWorthDoing?: boolean | null;
    criticalFunction?: boolean | null;
    strategy: string;
    strategyCode: string;
    taskDescription: string;
    frequency: string;
    source: 'manual' | 'n8n';
    lastUpdated: string;
}

const QUESTION_COLS = [
    { key: 'hiddenConsequence', label: 'Hidden Consequence?', short: 'Hidden', tooltip: 'Is the loss of function hidden from the operating crew?' },
    { key: 'criticalRisk', label: 'Critical Risk?', short: 'Critical', tooltip: 'Does the failure introduce a hazard to safety or environment?' },
    { key: 'operationalRisk', label: 'Operational Risk?', short: 'Oper.', tooltip: 'Does the failure directly degrade production or service delivery?' },
    { key: 'financialRisk', label: 'Financial Risk?', short: 'Finan.', tooltip: 'Is the impact isolated to direct financial repair costs?' },
    { key: 'cbmFeasibility', label: 'CBM Feasible?', short: 'CBM?', tooltip: 'Predictive Feasibility: Is there a measurable degradation parameter?' },
    { key: 'tbmFeasibility', label: 'TBM Feasible?', short: 'TBM?', tooltip: 'Preventive Feasibility: Does it exhibit a predictable wear-out age?' },
];

const STRATEGIES: Record<string, { label: string; code: string; color: string }> = {
    CBM: { label: 'Predictive Monitoring (CBM)', code: 'CBM', color: '#10b981' },
    TBM: { label: 'Interval Maintenance (TBM)', code: 'TBM', color: '#10b981' },
    FFT: { label: 'Availability Testing (FFT)', code: 'FFT', color: '#10b981' },
    CMB: { label: 'Combined Tasks (CBM + TBM)', code: 'CMB', color: '#10b981' },
    RTF: { label: 'Corrective Maintenance (RTF)', code: 'RTF', color: '#64748b' },
    RD: { label: 'Mandatory Engineering Redesign', code: 'RD', color: '#ef4444' },
};

function createEmptyRow(fmeaId: string): LogicTreeRow {
    return {
        fmeaId,
        hiddenConsequence: null,
        criticalRisk: null,
        operationalRisk: null,
        financialRisk: null,
        cbmFeasibility: null,
        tbmFeasibility: null,
        strategy: '',
        strategyCode: '',
        taskDescription: '',
        frequency: '',
        source: 'manual',
        lastUpdated: '',
    };
}

interface LogicTreeTableProps {
    fmeaData: FMEAItem[];
    storageKey: string;
    isMobile: boolean;
}

export default function LogicTreeTable({ fmeaData, storageKey, isMobile }: LogicTreeTableProps) {
    const { user } = useAuth();
    const { currentAssetId } = useAssetContext();

    const [rows, setRows] = useState<LogicTreeRow[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    
    const n8nUrl = localStorage.getItem('n8n_logic_tree_webhook') || '';
    const [n8nLoading, setN8nLoading] = useState(false);
    const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

    const [ltaOpen, setLtaOpen] = useState(false);
    const [ltaTarget, setLtaTarget] = useState<FMEAItem | null>(null);

    const [cbmCurveOpen, setCbmCurveOpen] = useState(false);
    const [cbmCurveTarget, setCbmCurveTarget] = useState<FMEAItem | null>(null);

    // Build savedResults map for passing to LTA modal
    const savedLtaResults: Record<string, LTAResult> = {};
    rows.forEach(row => {
        if (row.strategyCode) {
            savedLtaResults[row.fmeaId] = {
                strategy: row.strategy,
                strategyCode: row.strategyCode,
                answers: {
                    hidden_consequence: row.hiddenConsequence,
                    critical_risk: row.criticalRisk,
                    operational_risk: row.operationalRisk,
                    financial_risk: row.financialRisk,
                    cbm_feasibility: row.cbmFeasibility,
                    tbm_feasibility: row.tbmFeasibility,
                },
                completedAt: row.lastUpdated,
                path: [],
            };
        }
    });

    const handleOpenLTA = (item: FMEAItem) => {
        setLtaTarget(item);
        setLtaOpen(true);
    };

    const handleSaveLTAResult = (failureModeId: string, result: LTAResult) => {
        // Directly save the strategy determined by the Logic Tree Analysis
        setRows(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(r => r.fmeaId === failureModeId);
            if (idx >= 0) {
                const row = { ...updated[idx] };
                // Map new answer keys to row columns
                row.hiddenConsequence = result.answers.hidden_consequence ?? null;
                row.criticalRisk = result.answers.critical_risk ?? null;
                row.operationalRisk = result.answers.operational_risk ?? null;
                row.financialRisk = result.answers.financial_risk ?? null;
                row.cbmFeasibility = result.answers.cbm_feasibility ?? null;
                row.tbmFeasibility = result.answers.tbm_feasibility ?? null;
                // Directly set the strategy from the LTA result
                row.strategy = result.strategy;
                row.strategyCode = result.strategyCode;
                row.source = 'manual';
                row.lastUpdated = new Date().toISOString();
                updated[idx] = row;
            }
            return updated;
        });

        // Trigger P-F curve directly if CBM or CMB is the result
        if (result.strategyCode === 'CBM' || result.strategyCode === 'CMB') {
            setCbmCurveTarget(ltaTarget);
            setCbmCurveOpen(true);
        }
    };

    // Fetch initial logic tree data from Supabase
    useEffect(() => {
        let isMounted = true;
        const loadLogicTree = async () => {
            if (!user || !currentAssetId) return;
            const { data } = await supabase.from('logic_tree').select('*').eq('asset_id', currentAssetId);
            if (isMounted) {
                if (data && data.length > 0) {
                    const loadedRows = data.map(d => ({
                        fmeaId: d.failure_mode_id,
                        hiddenConsequence: d.hidden_consequence,
                        criticalRisk: d.critical_risk,
                        operationalRisk: d.operational_risk,
                        financialRisk: d.financial_risk,
                        cbmFeasibility: d.cbm_feasibility,
                        tbmFeasibility: d.tbm_feasibility,
                        strategy: d.strategy || '',
                        strategyCode: d.strategy_code || '',
                        taskDescription: d.task_description || '',
                        frequency: d.frequency || '',
                        source: d.source as 'manual' | 'n8n' || 'manual',
                        lastUpdated: d.last_updated || '',
                    }));
                    setRows(loadedRows);
                }
                setIsLoaded(true);
            }
        };
        loadLogicTree();
        return () => { isMounted = false; };
    }, [user, currentAssetId]);

    // Sync rows with FMEA data — add missing, keep existing
    useEffect(() => {
        if (!isLoaded) return;
        setRows(prev => {
            const existing = new Map(prev.map(r => [r.fmeaId, r]));
            return fmeaData.map(item => existing.get(item.id) || createEmptyRow(item.id));
        });
    }, [fmeaData, isLoaded]);

    // Persist to Supabase
    useEffect(() => {
        if (!isLoaded || rows.length === 0 || !user || !currentAssetId) return;
        
        const saveToSupabase = async () => {
            const upsertData = rows.map(r => ({
                user_id: user.id,
                asset_id: currentAssetId,
                failure_mode_id: r.fmeaId,
                hidden_consequence: r.hiddenConsequence,
                critical_risk: r.criticalRisk,
                operational_risk: r.operationalRisk,
                financial_risk: r.financialRisk,
                cbm_feasibility: r.cbmFeasibility,
                tbm_feasibility: r.tbmFeasibility,
                strategy: r.strategy,
                strategy_code: r.strategyCode,
                task_description: r.taskDescription,
                frequency: r.frequency,
                source: r.source,
                last_updated: r.lastUpdated || new Date().toISOString()
            }));
            
            // Only update logic tree state for these FMEA items
            await supabase.from('logic_tree').upsert(upsertData, { onConflict: 'failure_mode_id' });
        };

        const timeout = setTimeout(saveToSupabase, 1000);
        return () => clearTimeout(timeout);
    }, [rows, user, currentAssetId, isLoaded]);

    // Listen for n8n webhook events
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.type === 'logic_tree_update' && Array.isArray(detail.data)) {
                applyN8nData(detail.data);
            }
        };
        window.addEventListener('n8n-data', handler);
        return () => window.removeEventListener('n8n-data', handler);
    }, []);

    const applyN8nData = useCallback((data: any[]) => {
        setRows(prev => {
            const updated = [...prev];
            data.forEach((incoming: any) => {
                const idx = updated.findIndex(r => r.fmeaId === incoming.fmeaId);
                if (idx >= 0) {
                    const merged: LogicTreeRow = {
                        ...updated[idx],
                        hiddenConsequence: incoming.hiddenConsequence ?? updated[idx].hiddenConsequence,
                        criticalRisk: incoming.criticalRisk ?? updated[idx].criticalRisk,
                        operationalRisk: incoming.operationalRisk ?? updated[idx].operationalRisk,
                        financialRisk: incoming.financialRisk ?? updated[idx].financialRisk,
                        cbmFeasibility: incoming.cbmFeasibility ?? updated[idx].cbmFeasibility,
                        tbmFeasibility: incoming.tbmFeasibility ?? updated[idx].tbmFeasibility,
                        taskDescription: incoming.taskDescription ?? updated[idx].taskDescription,
                        frequency: incoming.frequency ?? updated[idx].frequency,
                        source: 'n8n',
                        lastUpdated: new Date().toISOString(),
                    };
                    merged.strategy = incoming.strategy || updated[idx].strategy || '';
                    merged.strategyCode = incoming.strategyCode || updated[idx].strategyCode || '';
                    updated[idx] = merged;
                }
            });
            return updated;
        });
    }, []);

    const handleCellClick = (rowIdx: number, colKey: string) => {
        setRows(prev => {
            const updated = [...prev];
            const row = { ...updated[rowIdx] };
            const current = row[colKey as keyof LogicTreeRow] as boolean | null;
            // Cycle: null → true → false → null
            if (current === null) (row as any)[colKey] = true;
            else if (current === true) (row as any)[colKey] = false;
            else (row as any)[colKey] = null;

            row.source = 'manual';
            row.lastUpdated = new Date().toISOString();
            updated[rowIdx] = row;
            return updated;
        });
    };

    const handleFetchFromN8n = async () => {
        setN8nLoading(true);
        try {
            const payload = fmeaData.map(item => {
                const row = rows.find(r => r.fmeaId === item.id) || createEmptyRow(item.id);
                return {
                    fmeaId: item.id,
                    component: item.component,
                    failureMode: item.failureMode,
                    failureCause: item.failureCause,
                    failureEffect: item.failureEffect,
                    rpn: item.rpn,
                    riskLevel: item.riskLevel,
                    answers: {
                        hiddenConsequence: row.hiddenConsequence,
                        criticalRisk: row.criticalRisk,
                        operationalRisk: row.operationalRisk,
                        financialRisk: row.financialRisk,
                        cbmFeasibility: row.cbmFeasibility,
                        tbmFeasibility: row.tbmFeasibility,
                    },
                };
            });

            if (n8nUrl) {
                const res = await fetch(n8nUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'refresh_logic_tree', items: payload }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        applyN8nData(data);
                    } else if (data?.results && Array.isArray(data.results)) {
                        applyN8nData(data.results);
                    }
                } else {
                    console.error('Error from n8n:', await res.text());
                }
            } else {
                // No n8n URL configured — nothing to fetch
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        } catch (error) {
            console.error('Failed to sync logic tree with n8n:', error);
        } finally {
            setN8nLoading(false);
        }
    };

    const renderCell = (value: boolean | null) => {
        if (value === true) return <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#10b98120', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} color="#10b981" strokeWidth={3} /></div>;
        if (value === false) return <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ef444420', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><XIcon size={14} color="#ef4444" strokeWidth={3} /></div>;
        return <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-tertiary)', border: '2px dashed var(--border-color)' }} />;
    };

    const thStyle: React.CSSProperties = {
        padding: '10px 8px',
        textAlign: 'center',
        fontSize: '11px',
        fontWeight: 700,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        borderBottom: '2px solid var(--border-color)',
        borderRight: '1px solid var(--border-color)',
        whiteSpace: 'nowrap',
        position: 'sticky',
        top: 0,
        background: 'var(--bg-tertiary)',
        zIndex: 2,
    };

    const tdStyle: React.CSSProperties = {
        padding: '8px',
        borderBottom: '1px solid var(--border-color)',
        borderRight: '1px solid var(--border-color)',
        textAlign: 'center',
        verticalAlign: 'middle',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
    };

    return (
        <div>
            {/* Header Row with Controls */}
            <div style={{
                display: 'flex',
                alignItems: isMobile ? 'stretch' : 'center',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                gap: 'var(--spacing-sm)',
                marginBottom: 'var(--spacing-lg)',
            }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        RCM Decision Logic Tree
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                        Click "Analyze" to determine the maintenance strategy for each failure mode
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                    <button
                        onClick={handleFetchFromN8n}
                        disabled={n8nLoading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 14px', borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            cursor: n8nLoading ? 'wait' : 'pointer',
                            fontSize: '13px', fontWeight: 600,
                            opacity: n8nLoading ? 0.7 : 1,
                        }}
                    >
                        {n8nLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                        {n8nLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Logic Tree Table */}
            <div className="card" style={{ overflow: 'auto', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '750px' }}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, textAlign: 'left', minWidth: '40px' }}>#</th>
                            <th style={{ ...thStyle, textAlign: 'left', minWidth: '130px' }}>Component</th>
                            <th style={{ ...thStyle, textAlign: 'left', minWidth: '150px' }}>Failure Mode</th>
                            <th style={{ ...thStyle, minWidth: '100px', textAlign: 'center' }}>Analysis</th>
                            {QUESTION_COLS.map(col => (
                                <th
                                    key={col.key}
                                    style={{ ...thStyle, minWidth: '70px', cursor: 'help' }}
                                    onMouseEnter={(e) => setTooltip({ text: col.tooltip, x: e.clientX, y: e.clientY })}
                                    onMouseLeave={() => setTooltip(null)}
                                >
                                    {col.short}
                                </th>
                            ))}
                            <th style={{ ...thStyle, minWidth: '140px' }}>Strategy</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fmeaData.map((item, idx) => {
                            const row = rows.find(r => r.fmeaId === item.id) || createEmptyRow(item.id);
                            const stratInfo = row.strategyCode ? STRATEGIES[row.strategyCode] : null;

                            return (
                                <tr
                                    key={item.id}
                                    style={{ transition: 'background 0.15s ease' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <td style={{ ...tdStyle, textAlign: 'left', fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                                        {idx + 1}
                                    </td>
                                    
                                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                                        {item.component}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500, fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {item.failureMode}
                                    </td>

                                    {/* Actions -> Analysis */}
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <button
                                            onClick={() => handleOpenLTA(item)}
                                            disabled={n8nLoading}
                                            title="Open Logic Tree Wizard"
                                            style={{
                                                padding: '4px 10px',
                                                borderRadius: 'var(--radius-full)',
                                                background: 'var(--bg-tertiary)',
                                                color: 'var(--text-tertiary)',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                border: '1px dashed var(--border-color)',
                                                cursor: n8nLoading ? 'wait' : 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                transition: 'all 0.2s ease',
                                                whiteSpace: 'nowrap',
                                                opacity: n8nLoading ? 0.6 : 1
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.color = '#0ea5e9'; e.currentTarget.style.background = '#0ea5e908'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                        >
                                            <GitBranch size={12} /> Analyze
                                        </button>
                                    </td>

                                    {QUESTION_COLS.map(col => {
                                        const val = row[col.key as keyof LogicTreeRow] as boolean | null;
                                        return (
                                            <td
                                                key={col.key}
                                                style={{
                                                    ...tdStyle,
                                                    cursor: 'pointer',
                                                    background: val === true ? '#10b98108' : val === false ? '#ef444408' : undefined,
                                                }}
                                                onClick={() => handleCellClick(idx, col.key)}
                                                title={`${col.label}: Click to toggle`}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    {renderCell(val)}
                                                </div>
                                            </td>
                                        );
                                    })}

                                    {/* Strategy */}
                                    <td style={{ ...tdStyle, cursor: 'default' }}>
                                        {stratInfo ? (
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                padding: '4px 10px', borderRadius: '100px',
                                                background: `${stratInfo.color}15`,
                                                color: stratInfo.color,
                                                fontSize: '11px', fontWeight: 700,
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {stratInfo.code === 'CMB' ? 'CBM + TBM' : stratInfo.code}
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>—</span>
                                        )}
                                    </td>


                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div style={{
                    position: 'fixed',
                    left: tooltip.x + 12,
                    top: tooltip.y - 10,
                    padding: '8px 12px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    maxWidth: '280px',
                    zIndex: 9999,
                    pointerEvents: 'none',
                }}>
                    {tooltip.text}
                </div>
            )}

            {/* Legend */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--spacing-md)',
                marginTop: 'var(--spacing-lg)',
                padding: 'var(--spacing-md)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
            }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginRight: 'var(--spacing-sm)' }}>Legend:</div>
                {Object.values(STRATEGIES).map(s => (
                    <div key={s.code} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        <span style={{
                            display: 'inline-block', width: '10px', height: '10px',
                            borderRadius: '50%', background: s.color,
                        }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{s.code === 'CMB' ? 'CBM + TBM' : s.code} = {s.label}</span>
                    </div>
                ))}
            </div>

            {/* Logic Tree Analysis Modal */}
            <LogicTreeAnalysis
                isOpen={ltaOpen}
                onClose={() => { setLtaOpen(false); setLtaTarget(null); }}
                failureMode={ltaTarget}
                onSaveResult={handleSaveLTAResult}
                savedResults={savedLtaResults}
            />

            {/* P-F Curve Analysis Modal */}
            <CBMPFCurve
                isOpen={cbmCurveOpen}
                onClose={() => { setCbmCurveOpen(false); setCbmCurveTarget(null); }}
                onSkip={() => { setCbmCurveOpen(false); setCbmCurveTarget(null); }}
                failureModeInfo={cbmCurveTarget ? {
                    component: cbmCurveTarget.component,
                    failureMode: cbmCurveTarget.failureMode
                } : undefined}
            />

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
}
