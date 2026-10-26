import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import { AlertTriangle, Plus, Calculator, TrendingUp } from 'lucide-react';
import { analyzeFMEA } from '../lib/rcm-engine/fmea';
import { useSidebar } from '../contexts/SidebarContext';
import type { FMEAResult } from '../types/rcm';

export default function FMEAAnalysis() {
    const { isMobile } = useSidebar();
    const [severity, setSeverity] = useState(5);
    const [occurrence, setOccurrence] = useState(5);
    const [detection, setDetection] = useState(5);
    const [failureMode, setFailureMode] = useState('');
    const [failureCause, setFailureCause] = useState('');
    const [failureEffect, setFailureEffect] = useState('');

    // Mock existing FMEA results
    const [fmeaResults, setFmeaResults] = useState<FMEAResult[]>([
        {
            fmea_id: '1',
            asset_id: '1',
            failure_mode: 'Bearing failure',
            failure_cause: 'Lack of lubrication',
            failure_effect: 'Complete pump shutdown, production loss',
            severity: 9,
            occurrence: 6,
            detection: 7,
            rpn: 378,
            risk_level: 'High' as const,
            recommended_action: 'Implement predictive vibration monitoring. Analyze root causes and ensure proper lubrication schedule.',
        },
        {
            fmea_id: '2',
            asset_id: '2',
            failure_mode: 'Motor winding degradation',
            failure_cause: 'Thermal stress from overloading',
            failure_effect: 'Motor failure, HVAC system down',
            severity: 8,
            occurrence: 4,
            detection: 6,
            rpn: 192,
            risk_level: 'Medium' as const,
            recommended_action: 'Continue current maintenance with periodic review. Consider condition-based monitoring.',
        },
    ]);

    const currentRPN = severity * occurrence * detection;
    const getRiskLevel = (rpn: number): 'Low' | 'Medium' | 'High' => {
        if (rpn <= 100) return 'Low';
        if (rpn <= 300) return 'Medium';
        return 'High';
    };
    const currentRiskLevel = getRiskLevel(currentRPN);

    const handleAddFMEA = () => {
        if (!failureMode || !failureCause || !failureEffect) {
            alert('Please fill in all fields');
            return;
        }

        const newFMEA = analyzeFMEA({
            fmea_id: `${Date.now()}`,
            asset_id: '1',
            failure_mode: failureMode,
            failure_cause: failureCause,
            failure_effect: failureEffect,
            severity,
            occurrence,
            detection,
        });

        setFmeaResults([newFMEA, ...fmeaResults]);

        // Reset form
        setFailureMode('');
        setFailureCause('');
        setFailureEffect('');
        setSeverity(5);
        setOccurrence(5);
        setDetection(5);
    };

    return (
        <>
            <Sidebar />
            <PageContainer style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-2xl)', paddingTop: isMobile ? 'calc(60px + var(--spacing-md))' : 'var(--spacing-2xl)' }}>
                {/* Header */}
                <div className="animate-fade-in" style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <h1 style={{ marginBottom: 'var(--spacing-sm)', fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)' }}>FMEA Analysis</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-lg)' }}>
                        {isMobile ? 'RPN calculation and risk assessment' : 'Failure Mode and Effects Analysis with automated RPN calculation.'}
                    </p>
                </div>

                {/* Responsive Layout - Stack on mobile, side-by-side on desktop */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr',
                    gap: 'var(--spacing-xl)',
                    alignItems: 'start'
                }}>
                    {/* Input Form */}
                    <div className="card-glass animate-slide-in" style={{ position: isMobile ? 'relative' : 'sticky', top: isMobile ? 'auto' : 'var(--spacing-xl)' }}>
                        <h3 style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)' }}>
                            <Plus size={isMobile ? 20 : 24} color="var(--primary-500)" />
                            New FMEA Entry
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {/* Failure Mode */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    Failure Mode
                                </label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., Seal failure"
                                    value={failureMode}
                                    onChange={(e) => setFailureMode(e.target.value)}
                                />
                            </div>

                            {/* Failure Cause */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    Failure Cause
                                </label>
                                <textarea
                                    className="textarea"
                                    placeholder="e.g., Wear due to contamination"
                                    value={failureCause}
                                    onChange={(e) => setFailureCause(e.target.value)}
                                    style={{ minHeight: isMobile ? '50px' : '60px' }}
                                />
                            </div>

                            {/* Failure Effect */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    Failure Effect
                                </label>
                                <textarea
                                    className="textarea"
                                    placeholder="e.g., Fluid leakage, production stoppage"
                                    value={failureEffect}
                                    onChange={(e) => setFailureEffect(e.target.value)}
                                    style={{ minHeight: isMobile ? '50px' : '60px' }}
                                />
                            </div>

                            {/* Severity */}
                            <div>
                                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    <span>Severity</span>
                                    <span style={{ color: 'var(--primary-500)' }}>{severity}</span>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={severity}
                                    onChange={(e) => setSeverity(parseInt(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--spacing-xs)' }}>
                                    1 = Minor / 10 = Catastrophic
                                </p>
                            </div>

                            {/* Occurrence */}
                            <div>
                                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    <span>Occurrence</span>
                                    <span style={{ color: 'var(--primary-500)' }}>{occurrence}</span>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={occurrence}
                                    onChange={(e) => setOccurrence(parseInt(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--spacing-xs)' }}>
                                    1 = Very Unlikely / 10 = Inevitable
                                </p>
                            </div>

                            {/* Detection */}
                            <div>
                                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    <span>Detection</span>
                                    <span style={{ color: 'var(--primary-500)' }}>{detection}</span>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={detection}
                                    onChange={(e) => setDetection(parseInt(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--spacing-xs)' }}>
                                    1 = Almost Certain / 10 = Cannot Detect
                                </p>
                            </div>

                            {/* RPN Display */}
                            <div style={{
                                padding: 'var(--spacing-md)',
                                background: currentRiskLevel === 'High' ? 'rgba(255, 26, 26, 0.1)' :
                                    currentRiskLevel === 'Medium' ? 'rgba(255, 200, 32, 0.1)' : 'rgba(20, 169, 114, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                border: `2px solid ${currentRiskLevel === 'High' ? 'var(--danger-500)' :
                                    currentRiskLevel === 'Medium' ? 'var(--warning-500)' : 'var(--success-500)'
                                    }`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
                                    <Calculator size={isMobile ? 20 : 24} color={
                                        currentRiskLevel === 'High' ? 'var(--danger-500)' :
                                            currentRiskLevel === 'Medium' ? 'var(--warning-500)' : 'var(--success-500)'
                                    } />
                                    <div>
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Risk Priority Number</p>
                                        <h2 style={{ fontSize: isMobile ? 'var(--font-size-2xl)' : 'var(--font-size-3xl)', fontWeight: 800, margin: 0 }}>{currentRPN}</h2>
                                    </div>
                                </div>
                                <span className={`badge badge-${currentRiskLevel === 'High' ? 'danger' : currentRiskLevel === 'Medium' ? 'warning' : 'success'}`}>
                                    {currentRiskLevel} Risk
                                </span>
                            </div>

                            <button className="btn btn-primary" onClick={handleAddFMEA} style={{ width: '100%' }}>
                                <Plus size={20} />
                                Add FMEA Entry
                            </button>
                        </div>
                    </div>

                    {/* Results List */}
                    <div>
                        <div style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            justifyContent: 'space-between',
                            alignItems: isMobile ? 'flex-start' : 'center',
                            marginBottom: 'var(--spacing-lg)',
                            gap: 'var(--spacing-sm)'
                        }}>
                            <h3 style={{ margin: 0, fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)' }}>FMEA Results ({fmeaResults.length})</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <TrendingUp size={20} color="var(--text-tertiary)" />
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>
                                    Sorted by RPN
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {fmeaResults.map((result, index) => (
                                <div key={result.fmea_id} className="card-glass animate-slide-in" style={{ animationDelay: `${index * 50}ms` }}>
                                    {/* Header */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: isMobile ? 'column' : 'row',
                                        justifyContent: 'space-between',
                                        alignItems: isMobile ? 'flex-start' : 'start',
                                        marginBottom: 'var(--spacing-md)',
                                        gap: 'var(--spacing-sm)'
                                    }}>
                                        <div style={{ flex: 1, width: '100%' }}>
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: isMobile ? 'column' : 'row',
                                                alignItems: isMobile ? 'flex-start' : 'center',
                                                gap: 'var(--spacing-sm)',
                                                marginBottom: 'var(--spacing-sm)'
                                            }}>
                                                <h4 style={{ fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)', margin: 0 }}>{result.failure_mode}</h4>
                                                <span className={`badge badge-${result.risk_level === 'High' ? 'danger' : result.risk_level === 'Medium' ? 'warning' : 'success'}`}>
                                                    RPN: {result.rpn}
                                                </span>
                                            </div>
                                            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                                <strong>Cause:</strong> {result.failure_cause}
                                            </p>
                                            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', margin: 0, marginTop: '0.25rem' }}>
                                                <strong>Effect:</strong> {result.failure_effect}
                                            </p>
                                        </div>
                                        {!isMobile && (
                                            <AlertTriangle size={24} color={
                                                result.risk_level === 'High' ? 'var(--danger-500)' :
                                                    result.risk_level === 'Medium' ? 'var(--warning-500)' : 'var(--success-500)'
                                            } />
                                        )}
                                    </div>

                                    {/* S-O-D Values */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: 'var(--spacing-sm)',
                                        marginBottom: 'var(--spacing-md)',
                                        textAlign: 'center'
                                    }}>
                                        <div>
                                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Severity</p>
                                            <p style={{ fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>{result.severity}</p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Occurrence</p>
                                            <p style={{ fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>{result.occurrence}</p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Detection</p>
                                            <p style={{ fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>{result.detection}</p>
                                        </div>
                                    </div>

                                    {/* Recommended Action */}
                                    <div style={{
                                        padding: 'var(--spacing-md)',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-sm)',
                                        borderLeft: '3px solid var(--primary-500)',
                                    }}>
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                                            Recommended Action
                                        </p>
                                        <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                            {result.recommended_action}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </PageContainer>
        </>
    );
}
