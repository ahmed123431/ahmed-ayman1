import { useState, useMemo, useEffect } from 'react';
import { X, Calendar, Activity, ChevronRight, AlertTriangle, Settings, Eye, Pencil, Save, Maximize2, Minimize2 } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Label, ReferenceArea
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useAssetContext } from '../contexts/AssetContext';
import { supabase } from '../lib/supabaseClient';



interface CBMPFCurveProps {
    isOpen: boolean;
    onClose: () => void;
    onSkip: () => void;
    failureModeInfo?: {
        component: string;
        failureMode: string;
    };
}

export default function CBMPFCurve({ isOpen, onClose, onSkip, failureModeInfo }: CBMPFCurveProps) {
    const { user } = useAuth();
    const { currentAssetId, currentAsset } = useAssetContext();

    // Form State
    const [assetName, setAssetName] = useState(currentAsset?.equipment_name || '');
    const [componentName, setComponentName] = useState(failureModeInfo?.component || '');
    const [date0, setDate0] = useState('');
    const [dateP, setDateP] = useState('');
    const [dateF, setDateF] = useState('');
    
    // Editing State (tracks the Supabase row id when updating an existing curve)
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Chart State
    const [generatedData, setGeneratedData] = useState<any>(null);
    const [isZoomed, setIsZoomed] = useState(false);



    const calculatedDurations = useMemo(() => {
        if (!date0 || !dateP || !dateF) return null;
        const d0 = new Date(date0).getTime();
        const dp = new Date(dateP).getTime();
        const df = new Date(dateF).getTime();
        
        if (isNaN(d0) || isNaN(dp) || isNaN(df)) return null;
        
        const pDays = Math.round((dp - d0) / (1000 * 3600 * 24));
        const fDays = Math.round((df - d0) / (1000 * 3600 * 24));
        return { pDays, fDays };
    }, [date0, dateP, dateF]);

    // Chart Generation
    const handleGenerate = (durations = calculatedDurations) => {
        if (!durations) return;
        const { pDays, fDays } = durations;

        if (pDays <= 0 || fDays <= 0 || pDays >= fDays) {
            alert('Dates must be chronological: Installation < Point P < Point F.');
            return;
        }

        let unit = 'Days';
        let divisor = 1;
        if (fDays >= 730) { unit = 'Years'; divisor = 365.25; }
        else if (fDays >= 60) { unit = 'Months'; divisor = 30.437; }
        else if (fDays >= 14) { unit = 'Weeks'; divisor = 7; }

        const points = [];
        const numPoints = 100;
        const chartF = fDays / divisor;
        const chartP = pDays / divisor;

        for (let i = 0; i <= numPoints; i++) {
            const xVal = chartF * (i / numPoints);
            const timeRatio = xVal / chartF;
            const condition = 100 * (1 - Math.pow(timeRatio, 3));
            points.push({
                time: Number(xVal.toFixed(4)),
                condition: Number(condition.toFixed(4))
            });
        }
        
        const pRatio = chartP / chartF;
        const pCondition = 100 * (1 - Math.pow(pRatio, 3));

        setGeneratedData({
            points,
            pTime: Number(chartP.toFixed(4)),
            pCondition: Number(pCondition.toFixed(4)),
            fTime: Number(chartF.toFixed(4)),
            fCondition: 0,
            unit,
            intervalDays: fDays - pDays,
            pDays,
            fDays
        });
    };

    // Auto-fetch existing curve for this component from Supabase
    useEffect(() => {
        if (!isOpen) return;

        if (failureModeInfo) {
            setComponentName(failureModeInfo.component);
            setAssetName(currentAsset?.equipment_name || 'Selected Asset'); 
        }

        if (!currentAssetId || !user || !failureModeInfo) {
            // Reset when context is missing
            setEditingId(null);
            setGeneratedData(null);
            return;
        }

        const fetchCurve = async () => {
            try {
                const { data, error } = await supabase
                    .from('cbm_curves')
                    .select('*')
                    .eq('asset_id', currentAssetId)
                    .eq('component_name', failureModeInfo.component)
                    .maybeSingle();

                if (data && !error) {
                    setEditingId(data.id);
                    setDate0(data.date0);
                    setDateP(data.date_p);
                    setDateF(data.date_f);
                    // Inline generation to avoid stale closure
                    const pDays = data.p_days;
                    const fDays = data.f_days;
                    let unit = 'Days';
                    let divisor = 1;
                    if (fDays >= 730) { unit = 'Years'; divisor = 365.25; }
                    else if (fDays >= 60) { unit = 'Months'; divisor = 30.437; }
                    else if (fDays >= 14) { unit = 'Weeks'; divisor = 7; }
                    const chartF = fDays / divisor;
                    const chartP = pDays / divisor;
                    const points = [];
                    for (let i = 0; i <= 100; i++) {
                        const xVal = chartF * (i / 100);
                        const timeRatio = xVal / chartF;
                        const condition = 100 * (1 - Math.pow(timeRatio, 3));
                        points.push({ time: Number(xVal.toFixed(4)), condition: Number(condition.toFixed(4)) });
                    }
                    const pRatio = chartP / chartF;
                    const pCondition = 100 * (1 - Math.pow(pRatio, 3));
                    setGeneratedData({
                        points,
                        pTime: Number(chartP.toFixed(4)),
                        pCondition: Number(pCondition.toFixed(4)),
                        fTime: Number(chartF.toFixed(4)),
                        fCondition: 0,
                        unit,
                        intervalDays: fDays - pDays,
                        pDays,
                        fDays
                    });
                } else {
                    setEditingId(null);
                    setDate0('');
                    setDateP('');
                    setDateF('');
                    setGeneratedData(null);
                }
            } catch (err) {
                console.error('Error fetching CBM curve:', err);
            }
        };
        fetchCurve();
    }, [isOpen, failureModeInfo?.component, currentAssetId, user?.id]);

    if (!isOpen) return null;

    const handleSaveCurve = async () => {
        if (!assetName || !componentName || !generatedData || !date0 || !dateP || !dateF) {
            alert('Please fill out all fields and generate the curve before saving.');
            return;
        }
        
        if (!user || !currentAssetId) {
            alert('Authentication or Asset context missing. Please select an asset first.');
            return;
        }

        setIsSaving(true);
        try {
            const curveData = {
                user_id: user.id,
                asset_id: currentAssetId,
                asset_name: assetName,
                component_name: componentName,
                date0,
                date_p: dateP,
                date_f: dateF,
                p_days: generatedData.pDays,
                f_days: generatedData.fDays,
                updated_at: new Date().toISOString()
            };

            if (editingId) {
                const { error } = await supabase.from('cbm_curves').update(curveData).eq('id', editingId);
                if (error) throw error;
                alert('Curve updated successfully!');
            } else {
                const { data, error } = await supabase.from('cbm_curves').insert([curveData]).select().single();
                if (error) throw error;
                setEditingId(data.id);
                alert('Curve saved successfully!');
            }
        } catch (err: any) {
            console.error('Error saving curve:', err);
            alert('Failed to save curve: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };



    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length && generatedData) {
            return (
                <div style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)'
                }}>
                    <p style={{ margin: '0 0 4px', fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                        Time: {payload[0].payload.time} {generatedData.unit}
                    </p>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--primary-500)' }}>
                        Resistance: {payload[0].value}%
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <>
            <div
                onClick={onSkip}
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 9998,
                    animation: 'fadeIn 0.2s ease',
                }}
            />

            <div
                style={{
                    position: 'fixed',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '96%',
                    maxWidth: '1200px',
                    maxHeight: '94vh',
                    background: 'var(--bg-secondary)',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideUp 0.3s ease',
                }}
            >
                {/* Header Area */}
                <div style={{
                    padding: '24px',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)',
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ 
                                background: '#10b98120', color: '#10b981', 
                                padding: '4px 10px', borderRadius: '100px', 
                                fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' 
                            }}>
                                CBM STRATEGY SELECTED
                            </span>
                            <ChevronRight size={14} color="var(--text-tertiary)" />
                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                                Next Step
                            </span>
                        </div>
                        <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Activity size={24} color="var(--primary-500)" />
                            CBM Analysis & P-F Curve
                        </h2>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                            Build, analyze, and manage isolated degradation curves for each specific component.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={onSkip} style={{
                            padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)',
                            borderRadius: '10px', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600
                        }}>
                            Skip Step
                        </button>
                        <button onClick={onClose} style={{
                            padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                            borderRadius: '10px', cursor: 'pointer', color: 'var(--text-secondary)'
                        }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        {/* Form Area */}
                        <div style={{ 
                            background: 'var(--bg-primary)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '16px', 
                            padding: '24px',
                            display: 'flex', flexDirection: 'column', gap: '16px'
                        }}>
                            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                Intelligent Date-to-Duration Setup
                            </h3>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Asset Name <span style={{color:'var(--danger-500)'}}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={assetName}
                                        onChange={(e) => setAssetName(e.target.value)}
                                        className="input"
                                        placeholder="e.g. Pump A-101"
                                        style={{ width: '100%', background: 'var(--bg-secondary)' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Component Name <span style={{color:'var(--danger-500)'}}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={componentName}
                                        onChange={(e) => setComponentName(e.target.value)}
                                        className="input"
                                        placeholder="e.g. Main Bearing"
                                        style={{ width: '100%', background: 'var(--bg-secondary)' }}
                                    />
                                </div>
                            </div>

                            <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0' }} />

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Installation Date (T0)
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-tertiary)' }} />
                                    <input
                                        type="date"
                                        value={date0}
                                        onChange={(e) => setDate0(e.target.value)}
                                        className="input"
                                        style={{ paddingLeft: '38px', width: '100%', background: 'var(--bg-secondary)' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Potential Failure Date (P)
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <AlertTriangle size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#f59e0b' }} />
                                        <input
                                            type="date"
                                            value={dateP}
                                            onChange={(e) => setDateP(e.target.value)}
                                            className="input"
                                            style={{ paddingLeft: '38px', width: '100%', background: 'var(--bg-secondary)' }}
                                        />
                                    </div>
                                    {calculatedDurations?.pDays !== undefined && !isNaN(calculatedDurations.pDays) && (
                                        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--primary-500)', fontWeight: 600 }}>
                                            Time to P: {calculatedDurations.pDays} Days
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Functional Failure Date (F)
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <X size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#ef4444' }} />
                                        <input
                                            type="date"
                                            value={dateF}
                                            onChange={(e) => setDateF(e.target.value)}
                                            className="input"
                                            style={{ paddingLeft: '38px', width: '100%', background: 'var(--bg-secondary)' }}
                                        />
                                    </div>
                                    {calculatedDurations?.fDays !== undefined && !isNaN(calculatedDurations.fDays) && (
                                        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--primary-500)', fontWeight: 600 }}>
                                            Time to F: {calculatedDurations.fDays} Days
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                <button 
                                    onClick={() => handleGenerate()}
                                    disabled={!calculatedDurations}
                                    style={{ 
                                        flex: 1, padding: '12px', borderRadius: '10px', 
                                        background: 'transparent', 
                                        border: '2px solid var(--primary-500)', 
                                        color: (!calculatedDurations) ? 'var(--text-tertiary)' : 'var(--primary-500)',
                                        fontWeight: 700, cursor: (!calculatedDurations) ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <Activity size={18} />
                                    Generate Component Curve
                                </button>
                                <button 
                                    onClick={handleSaveCurve}
                                    disabled={!generatedData || !assetName || !componentName || isSaving}
                                    style={{ 
                                        flex: 1, padding: '12px', borderRadius: '10px', 
                                        background: (!generatedData || !assetName || !componentName || isSaving) ? 'var(--bg-secondary)' : 'var(--primary-500)', 
                                        border: '1px solid var(--border-color)', 
                                        color: (!generatedData || !assetName || !componentName || isSaving) ? 'var(--text-tertiary)' : 'white',
                                        fontWeight: 700, cursor: (!generatedData || !assetName || !componentName || isSaving) ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <Save size={18} />
                                    {isSaving ? 'Saving...' : editingId ? 'Update Component Data' : 'Save to Database'}
                                </button>
                            </div>
                        </div>

                        {/* Chart Area */}
                        <div style={isZoomed ? {
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            zIndex: 10000,
                            background: 'var(--bg-primary)',
                            padding: '40px',
                            display: 'flex', flexDirection: 'column'
                        } : { 
                            background: 'var(--bg-primary)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '16px', 
                            padding: '24px 24px 24px 0', 
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            position: 'relative',
                            minHeight: '500px'
                        }}>
                            {generatedData ? (
                                <>
                                    <div style={{ paddingLeft: '24px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            Degradation Curve: {componentName || 'Unnamed Component'}
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-500)', background: '#10b98115', padding: '4px 10px', borderRadius: '100px' }}>
                                                P-F Interval: {generatedData.intervalDays} Days
                                            </div>
                                            <button 
                                                onClick={() => setIsZoomed(!isZoomed)}
                                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '6px', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                                title={isZoomed ? "Minimize Curve" : "Maximize Curve"}
                                            >
                                                {isZoomed ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={isZoomed ? '100%' : 420}>
                                        <LineChart data={generatedData.points} margin={{ top: 40, right: 60, left: 20, bottom: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                            <XAxis 
                                                dataKey="time" 
                                                type="number" 
                                                domain={[0, 'dataMax']}
                                                stroke="var(--text-tertiary)"
                                                tick={{ fontSize: 12 }}
                                                tickFormatter={(val) => Math.round(val).toString()}
                                                dy={10}
                                            >
                                                <Label
                                                    value={`Time Since Installation (${generatedData.unit})`}
                                                    position="bottom"
                                                    style={{ textAnchor: 'middle', fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}
                                                    dy={20}
                                                />
                                            </XAxis>
                                            <YAxis 
                                                domain={[0, 100]} 
                                                tick={false}
                                                axisLine={{ stroke: 'var(--text-tertiary)' }}
                                            >
                                                <Label
                                                    value="Resistance to Failure"
                                                    angle={-90}
                                                    position="insideLeft"
                                                    style={{ textAnchor: 'middle', fill: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}
                                                    dx={20}
                                                />
                                            </YAxis>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Line 
                                                type="natural" 
                                                dataKey="condition" 
                                                stroke="var(--primary-500)" 
                                                strokeWidth={4} 
                                                dot={false}
                                                activeDot={{ r: 6, fill: 'var(--primary-500)', stroke: 'var(--bg-primary)', strokeWidth: 2 }}
                                            />
                                            <ReferenceArea 
                                                x1={generatedData.pTime} 
                                                x2={generatedData.fTime} 
                                                fill="#10b981" 
                                                fillOpacity={0.08} 
                                            />
                                            <ReferenceDot 
                                                x={0} 
                                                y={100} 
                                                r={8} 
                                                fill="#3b82f6" 
                                                stroke="var(--bg-primary)" 
                                                strokeWidth={3} 
                                            >
                                                <Label value="Point A: Degradation Begins" position="top" fill="#3b82f6" fontSize={13} fontWeight={700} dy={-10} />
                                            </ReferenceDot>
                                            <ReferenceDot 
                                                x={generatedData.pTime} 
                                                y={generatedData.pCondition} 
                                                r={8} 
                                                fill="#f59e0b" 
                                                stroke="var(--bg-primary)" 
                                                strokeWidth={3} 
                                            >
                                                <Label value="Point P: Potential Failure" position="top" fill="#f59e0b" fontSize={13} fontWeight={700} dy={-10} />
                                            </ReferenceDot>
                                            <ReferenceDot 
                                                x={generatedData.fTime} 
                                                y={generatedData.fCondition} 
                                                r={8} 
                                                fill="#ef4444" 
                                                stroke="var(--bg-primary)" 
                                                strokeWidth={3} 
                                            >
                                                <Label value="Point F: Functional Failure" position="top" fill="#ef4444" fontSize={13} fontWeight={700} dy={-15} />
                                            </ReferenceDot>
                                        </LineChart>
                                    </ResponsiveContainer>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                    <Activity size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                                    <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: 'var(--text-secondary)' }}>Ready to Generate</h3>
                                    <p style={{ margin: 0, fontSize: '14px', maxWidth: '300px', display: 'inline-block' }}>
                                        Enter the component's installation and failure dates to preview its unique P-F curve.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div style={{ 
                    padding: '20px 24px', 
                    borderTop: '1px solid var(--border-color)', 
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    flexShrink: 0
                }}>
                    <button 
                        onClick={onClose} 
                        style={{ 
                            padding: '10px 24px', 
                            borderRadius: '10px', 
                            background: 'var(--primary-500)', 
                            border: 'none', 
                            color: 'white',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Done & Continue <ChevronRight size={18} />
                    </button>
                </div>
            </div>
        </>
    );
}
