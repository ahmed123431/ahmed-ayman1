/**
 * ComprehensiveMaintenanceTasks
 *
 * Data sources (in priority order):
 *  1. logic_tree  → primary RCM task source; provides real component, failure_mode,
 *                   and strategy_code (TBM / CBM / PM / OC). Joined through fmea.
 *  2. replacements → Weibull CPUT optimal replacement; task_type = RR.
 *  3. ai_interval_results → supplementary; deduplicated per asset (only latest kept)
 *                           because legacy rows have no failure_mode_id FK linkage.
 *
 * Deduplication key:  asset_id + component_name + failure_mode + task_type
 * Column order:       # | Component | Task Name | Failure Mode | Type | Interval | Last Calculated
 *
 * Each component retains its own independent P-F curve isolation. No data is mixed
 * across different component IDs or component names within the same query.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAssetContext } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Clock, RefreshCw } from 'lucide-react';

// ─── Shape of one display row ─────────────────────────────────────────────────
interface TaskRow {
    dedupKey: string;       // composite key used for deduplication
    source: 'LT' | 'RR' | 'AI';
    asset_id: string;
    asset_name: string;
    component_name: string; // actual component (never the asset name)
    task_name: string;      // RCM task description
    failure_mode: string;   // from FMEA / Logic Tree
    task_type: string;      // strategy_code: TBM, CBM, PM, OC, RR  (never 'AI')
    assigned_interval: string;
    last_updated: string;
}

interface Props {
    showAssetNames?: boolean;
}

// ─── Strategy-code badge colours ─────────────────────────────────────────────
const BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
    RR:  { bg: '#ede9fe', fg: '#7c3aed' },
    TBM: { bg: '#fef3c7', fg: '#92400e' },
    CBM: { bg: '#d1fae5', fg: '#065f46' },
    PM:  { bg: '#dbeafe', fg: '#1d4ed8' },
    OC:  { bg: '#fee2e2', fg: '#991b1b' },
};
const badge = (t: string) => BADGE_COLORS[t] ?? { bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' };

// ─── Component ────────────────────────────────────────────────────────────────
export default function ComprehensiveMaintenanceTasks({ showAssetNames = false }: Props) {
    const { currentAssetId } = useAssetContext();
    const { user } = useAuth();
    const [rows, setRows]     = useState<TaskRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const loadAggregated = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setErrorMsg(null);

        try {
            // ── 1. Asset name lookup ──────────────────────────────────────────
            const { data: assetRows } = await supabase
                .from('assets')
                .select('id, equipment_name')
                .eq('user_id', user.id);

            const assetMap: Record<string, string> = {};
            (assetRows || []).forEach((a: any) => { assetMap[a.id] = a.equipment_name; });

            // ── 2. AI intervals indexed STRICTLY by failure_mode_id ─────────
            //    Each row in ai_interval_results must carry a failure_mode_id FK
            //    so intervals are isolated per failure mode. No asset-level fallback
            //    is used — that would broadcast one mode's interval to all others.
            let aiQuery = supabase
                .from('ai_interval_results')
                .select('id, asset_id, failure_mode_id, recommended_interval, interval_unit, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (currentAssetId && !showAssetNames) {
                aiQuery = aiQuery.eq('asset_id', currentAssetId);
            }
            const { data: aiData } = await aiQuery;

            // Strict lookup: failure_mode_id → formatted interval (newest first).
            // No asset-level fallback — prevents broadcast overwrite across failure modes.
            const aiByFmea: Record<string, string> = {};
            for (const r of (aiData || [])) {
                if (r.failure_mode_id && !aiByFmea[r.failure_mode_id]) {
                    aiByFmea[r.failure_mode_id] = `${r.recommended_interval} ${r.interval_unit}`.trim();
                }
            }

            // ── 3. Fetch Logic Tree joined with FMEA ──────────────────────────
            //    Each LT row is strictly bound to one failure_mode_id → one component.
            //    P-F curve isolation: no data crosses between failure_mode_id rows.
            let ltQuery = supabase
                .from('logic_tree')
                .select(`
                    id,
                    failure_mode_id,
                    strategy,
                    strategy_code,
                    task_description,
                    last_updated,
                    asset_id,
                    fmea:failure_mode_id (
                        id, component, failure_mode, component_id, asset_id,
                        components ( id, name )
                    )
                `)
                .eq('user_id', user.id)
                .order('last_updated', { ascending: false });

            if (currentAssetId && !showAssetNames) {
                ltQuery = ltQuery.eq('asset_id', currentAssetId);
            }
            const { data: ltData, error: ltErr } = await ltQuery;
            if (ltErr) throw ltErr;

            // ── 4. Fetch Replacements (RR) — each is component-isolated ───────
            let repQuery = supabase
                .from('replacements')
                .select('id, asset_id, equipment, optimum_time, created_at, updated_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (currentAssetId && !showAssetNames) {
                repQuery = repQuery.eq('asset_id', currentAssetId);
            }
            const { data: repData, error: repErr } = await repQuery;
            if (repErr) throw repErr;

            // ── 5. Map Logic Tree → TaskRow with NUMERICAL interval ───────────
            const ltRows: TaskRow[] = (ltData || []).map((lt: any) => {
                const fmea = Array.isArray(lt.fmea) ? lt.fmea[0] : lt.fmea;
                const compRef = Array.isArray(fmea?.components) ? fmea.components[0] : fmea?.components;
                const compName  = compRef?.name || fmea?.component || 'Unknown Component';
                const failMode  = fmea?.failure_mode || '—';
                const taskType  = lt.strategy_code   || 'PM';
                const taskName  = lt.task_description?.trim()
                    ? lt.task_description
                    : (lt.strategy_code ? `${lt.strategy_code} Task` : 'Maintenance Task');

                // Resolve NUMERICAL interval — strict per-failure-mode match only.
                // No asset-level fallback: prevents a single calculation from
                // broadcasting its interval to all other failure modes on this asset.
                const interval = aiByFmea[lt.failure_mode_id] || 'Pending — Run AI Calculation';

                return {
                    dedupKey: `${lt.asset_id}|${lt.failure_mode_id || compName}|${taskType}`,
                    source: 'LT' as const,
                    asset_id: lt.asset_id,
                    asset_name: assetMap[lt.asset_id] || lt.asset_id,
                    component_name: compName,
                    task_name: taskName,
                    failure_mode: failMode,
                    task_type: taskType,
                    assigned_interval: interval,
                    last_updated: lt.last_updated || new Date().toISOString(),
                };
            });

            // ── 6. Map Replacements → TaskRow (RR) ───────────────────────────
            //    The numerical interval IS the optimum_time — straightforward.
            const rrRows: TaskRow[] = (repData || []).map((r: any) => {
                const tOpt = r.optimum_time;
                const interval = (!tOpt || Number(tOpt) > 1e9)
                    ? 'RTF (Run-To-Failure)'
                    : `${Math.round(Number(tOpt))} h`;
                const compName = r.equipment || 'Unknown Component';

                return {
                    dedupKey: `${r.asset_id}|RR|${compName}`,
                    source: 'RR' as const,
                    asset_id: r.asset_id,
                    asset_name: assetMap[r.asset_id] || r.asset_id,
                    component_name: compName,
                    task_name: 'Scheduled Replacement',
                    failure_mode: '—',
                    task_type: 'RR',
                    assigned_interval: interval,
                    last_updated: r.updated_at || r.created_at,
                };
            });

            // ── 7. Merge & deduplicate on composite key ───────────────────────
            //    Priority: LT > RR. First occurrence of each dedupKey wins.
            const seen   = new Set<string>();
            const merged = [...ltRows, ...rrRows].filter(row => {
                if (seen.has(row.dedupKey)) return false;
                seen.add(row.dedupKey);
                return true;
            });

            // ── 8. Keep only rows that have a real calculated interval ─────────
            //    Exclude Logic-Tree rows still awaiting an AI calculation.
            //    RR rows always have a concrete interval (optimum_time or RTF).
            const calculated = merged.filter(
                row => row.assigned_interval !== 'Pending — Run AI Calculation'
            );

            setRows(calculated);
        } catch (err: any) {
            console.error('[ComprehensiveMaintenanceTasks]', err);
            setErrorMsg(err.message || 'Failed to load maintenance data');
        } finally {
            setLoading(false);
        }
    }, [user, currentAssetId, showAssetNames]);

    useEffect(() => {
        loadAggregated();
    }, [loadAggregated]);

    const fmt = (iso: string) => {
        const d = new Date(iso);
        return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };

    // ─── Column header helper ─────────────────────────────────────────────────
    const TH = ({ children, center = false, w }: { children: React.ReactNode; center?: boolean; w?: string }) => (
        <th style={{
            padding: '11px 14px',
            borderBottom: '2px solid var(--border-color)',
            textAlign: center ? 'center' : 'left',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            width: w,
            whiteSpace: 'nowrap',
        }}>
            {children}
        </th>
    );

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
        }}>
            {/* ── Header ── */}
            <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-tertiary)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ClipboardList size={20} color="var(--primary-500)" />
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 600 }}>
                        Comprehensive Maintenance Tasks
                    </h3>
                    {rows.length > 0 && (
                        <span style={{
                            background: 'var(--primary-500)', color: 'white',
                            borderRadius: '999px', fontSize: '11px', fontWeight: 700, padding: '1px 8px',
                        }}>
                            {rows.length}
                        </span>
                    )}
                </div>
                <button
                    onClick={loadAggregated}
                    disabled={loading}
                    title="Refresh"
                    style={{
                        background: 'none', border: '1px solid var(--border-color)',
                        cursor: loading ? 'wait' : 'pointer',
                        color: 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        fontSize: '12px', padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                    }}
                >
                    <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
                    {loading ? 'Loading…' : 'Refresh'}
                </button>
            </div>

            {/* ── Table ── */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{
                    width: '100%', minWidth: '900px',
                    borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px',
                }}>
                    <thead style={{ background: 'var(--bg-tertiary)' }}>
                        <tr>
                            <TH w="40px">#</TH>
                            <TH>Component</TH>
                            <TH>Task Name</TH>
                            <TH>Failure Mode</TH>
                            <TH center w="90px">Type</TH>
                            <TH center w="170px">Assigned Interval</TH>
                            <TH center w="155px">Last Calculated</TH>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '52px', color: 'var(--text-tertiary)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                        <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                        Loading maintenance tasks…
                                    </div>
                                </td>
                            </tr>
                        ) : errorMsg ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#ef4444', fontSize: '13px' }}>
                                    ⚠ {errorMsg}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '52px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                                    <ClipboardList size={36} style={{ opacity: 0.25, display: 'block', margin: '0 auto 12px' }} />
                                    No maintenance tasks with calculated intervals found.
                                    <div style={{ marginTop: '6px', fontSize: '12px', opacity: 0.7 }}>
                                        Run an AI Interval Calculation or save an Optimal Replacement to populate this table.
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => {
                                const { bg, fg } = badge(row.task_type);
                                const isEven = idx % 2 === 0;
                                return (
                                    <tr
                                        key={row.dedupKey}
                                        style={{
                                            borderBottom: idx < rows.length - 1 ? '1px solid var(--border-color)' : 'none',
                                            background: isEven ? 'var(--bg-primary)' : 'transparent',
                                            transition: 'background 0.12s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = isEven ? 'var(--bg-primary)' : 'transparent')}
                                    >
                                        {/* # */}
                                        <td style={{ padding: '12px 14px', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '12px' }}>
                                            {idx + 1}
                                        </td>

                                        {/* Component */}
                                        <td style={{ padding: '12px 14px' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {row.component_name}
                                            </div>
                                            {showAssetNames && (
                                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                                    {row.asset_name}
                                                </div>
                                            )}
                                        </td>

                                        {/* Task Name */}
                                        <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>
                                            {row.task_name}
                                        </td>

                                        {/* Failure Mode */}
                                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontStyle: row.failure_mode === '—' ? 'italic' : 'normal' }}>
                                            {row.failure_mode}
                                        </td>

                                        {/* Type */}
                                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                            <span style={{
                                                background: bg, color: fg,
                                                borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                                                padding: '3px 10px', display: 'inline-block', letterSpacing: '0.3px',
                                            }}>
                                                {row.task_type}
                                            </span>
                                        </td>

                                        {/* Assigned Interval */}
                                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#10b981', fontSize: '13px' }}>
                                            {row.assigned_interval}
                                        </td>

                                        {/* Last Calculated */}
                                        <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                <Clock size={11} />
                                                {fmt(row.last_updated)}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
