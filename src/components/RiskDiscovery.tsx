import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, MessageSquare, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

export interface RiskDiscoveryQuestion {
    id: string;
    label: string;
    question: string;
    response: 'Yes' | 'No' | null;
    comments: string;
    category: 'technology' | 'application' | 'history' | 'safety' | 'regulation' | 'mission' | 'supplier' | 'environment' | 'complexity' | 'custom';
}

export interface RiskDiscoveryData {
    questions: RiskDiscoveryQuestion[];
    markedForDetailedAnalysis: boolean;
    lastUpdated: string;
}

const DEFAULT_QUESTIONS: RiskDiscoveryQuestion[] = [
    {
        id: 'q1',
        label: 'New Technology',
        question: 'Will the design involve new technology?',
        response: null,
        comments: '',
        category: 'technology',
    },
    {
        id: 'q2',
        label: 'New Application',
        question: 'Will the design apply existing technology in a new way?',
        response: null,
        comments: '',
        category: 'application',
    },
    {
        id: 'q3',
        label: 'Historical Problems',
        question: 'Is there a history of problems for a similar design?',
        response: null,
        comments: '',
        category: 'history',
    },
    {
        id: 'q4',
        label: 'Safety Issues',
        question: 'Is there a potential for safety-related issues?',
        response: null,
        comments: '',
        category: 'safety',
    },
    {
        id: 'q5',
        label: 'Regulation Issues',
        question: 'Is there a potential for regulation-related issues?',
        response: null,
        comments: '',
        category: 'regulation',
    },
    {
        id: 'q6',
        label: 'Mission-Critical',
        question: 'Is this a mission-critical item?',
        response: null,
        comments: '',
        category: 'mission',
    },
    {
        id: 'q7',
        label: 'Supplier Capability',
        question: 'Are there concerns about the supplier\'s capability?',
        response: null,
        comments: '',
        category: 'supplier',
    },
    {
        id: 'q8',
        label: 'Environmental Impact',
        question: 'Could failure result in environmental harm or regulatory violation?',
        response: null,
        comments: '',
        category: 'environment',
    },
    {
        id: 'q9',
        label: 'System Complexity',
        question: 'Does the system have high complexity or interdependencies?',
        response: null,
        comments: '',
        category: 'complexity',
    },
];

interface RiskDiscoveryProps {
    storageKey: string;
    isMobile?: boolean;
}

export default function RiskDiscovery({ storageKey, isMobile = false }: RiskDiscoveryProps) {
    const discoveryKey = `${storageKey}-discovery`;

    const [data, setData] = useState<RiskDiscoveryData>(() => {
        const stored = localStorage.getItem(discoveryKey);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch { /* ignore */ }
        }
        return {
            questions: DEFAULT_QUESTIONS,
            markedForDetailedAnalysis: false,
            lastUpdated: '',
        };
    });

    const [expandedComments, setExpandedComments] = useState<string | null>(null);
    const [showAddQuestion, setShowAddQuestion] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newQuestion, setNewQuestion] = useState('');

    // Persist
    useEffect(() => {
        localStorage.setItem(discoveryKey, JSON.stringify(data));
    }, [data, discoveryKey]);

    const updateQuestion = (id: string, updates: Partial<RiskDiscoveryQuestion>) => {
        setData(prev => ({
            ...prev,
            questions: prev.questions.map(q => q.id === id ? { ...q, ...updates } : q),
            lastUpdated: new Date().toISOString(),
        }));
    };

    const toggleResponse = (id: string) => {
        const q = data.questions.find(q => q.id === id);
        if (!q) return;
        const next: 'Yes' | 'No' | null = q.response === null ? 'Yes' : q.response === 'Yes' ? 'No' : null;
        updateQuestion(id, { response: next });
    };

    const handleAddQuestion = () => {
        if (!newLabel.trim() || !newQuestion.trim()) return;
        const newQ: RiskDiscoveryQuestion = {
            id: `custom_${Date.now()}`,
            label: newLabel.trim(),
            question: newQuestion.trim(),
            response: null,
            comments: '',
            category: 'custom',
        };
        setData(prev => ({
            ...prev,
            questions: [...prev.questions, newQ],
            lastUpdated: new Date().toISOString(),
        }));
        setNewLabel('');
        setNewQuestion('');
        setShowAddQuestion(false);
    };

    const handleDeleteQuestion = (id: string) => {
        setData(prev => ({
            ...prev,
            questions: prev.questions.filter(q => q.id !== id),
            lastUpdated: new Date().toISOString(),
        }));
    };

    const handleReset = () => {
        setData({
            questions: DEFAULT_QUESTIONS,
            markedForDetailedAnalysis: false,
            lastUpdated: new Date().toISOString(),
        });
    };

    const answeredCount = data.questions.filter(q => q.response !== null).length;
    const yesCount = data.questions.filter(q => q.response === 'Yes').length;
    const noCount = data.questions.filter(q => q.response === 'No').length;
    const totalCount = data.questions.length;
    const progress = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

    // Risk score: more "Yes" = higher risk
    const riskScore = totalCount > 0 ? Math.round((yesCount / totalCount) * 100) : 0;
    const riskLevel = riskScore >= 60 ? 'High' : riskScore >= 30 ? 'Medium' : 'Low';
    const riskColor = riskLevel === 'High' ? 'var(--danger-500)' : riskLevel === 'Medium' ? 'var(--warning-500)' : 'var(--success-500)';

    const getLabelColor = (response: 'Yes' | 'No' | null) => {
        if (response === 'Yes') return { bg: '#ef4444', color: '#fff' };
        if (response === 'No') return { bg: '#22c55e', color: '#fff' };
        return { bg: 'var(--bg-tertiary)', color: 'var(--text-primary)' };
    };

    return (
        <div>
            {/* Summary Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-xl)',
            }}>
                <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>Progress</div>
                    <div style={{ color: 'var(--primary-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                        {answeredCount}/{totalCount}
                    </div>
                    <div style={{
                        height: '4px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '2px',
                        marginTop: '6px',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${progress}%`,
                            background: 'var(--primary-500)',
                            borderRadius: '2px',
                            transition: 'width 0.4s ease',
                        }} />
                    </div>
                </div>
                <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>Risk Indicators (Yes)</div>
                    <div style={{ color: 'var(--danger-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>{yesCount}</div>
                </div>
                <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>No Risk (No)</div>
                    <div style={{ color: 'var(--success-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>{noCount}</div>
                </div>
                <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>Risk Discovery Level</div>
                    <div style={{ color: riskColor, fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>{answeredCount === totalCount ? riskLevel : '—'}</div>
                </div>
            </div>

            {/* Question Table */}
            <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
            }}>
                {/* Table Header */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '180px 1fr 100px 50px',
                    gap: 'var(--spacing-md)',
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    background: 'var(--bg-tertiary)',
                    borderBottom: '2px solid var(--border-color)',
                    fontWeight: '700',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-secondary)',
                    alignItems: 'center',
                }}>
                    {!isMobile && <div>Label</div>}
                    <div>{isMobile ? 'Risk Discovery Questions' : 'Question'}</div>
                    {!isMobile && <div style={{ textAlign: 'center' }}>Response</div>}
                    {!isMobile && <div style={{ textAlign: 'center' }}>💬</div>}
                </div>

                {/* Question Rows */}
                {data.questions.map((q, index) => {
                    const labelStyle = getLabelColor(q.response);
                    const isExpanded = expandedComments === q.id;
                    const isCustom = q.category === 'custom';

                    return (
                        <div key={q.id}>
                            {/* Main Row */}
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : '180px 1fr 100px 50px',
                                    gap: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-md)',
                                    padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-md) var(--spacing-lg)',
                                    borderBottom: isExpanded ? 'none' : (index < data.questions.length - 1 ? '1px solid var(--border-color)' : 'none'),
                                    alignItems: 'center',
                                    transition: 'background 0.15s ease',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                {/* Label */}
                                {isMobile ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '4px 12px',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: 'var(--font-size-xs)',
                                            fontWeight: '700',
                                            background: labelStyle.bg,
                                            color: labelStyle.color,
                                            transition: 'all 0.3s ease',
                                        }}>
                                            {q.label}
                                        </span>
                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                            <button
                                                onClick={() => toggleResponse(q.id)}
                                                style={{
                                                    padding: '4px 14px',
                                                    borderRadius: 'var(--radius-full)',
                                                    fontSize: 'var(--font-size-sm)',
                                                    fontWeight: '700',
                                                    border: '2px solid',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    background: q.response === 'Yes' ? '#ef4444' : q.response === 'No' ? '#22c55e' : 'transparent',
                                                    color: q.response !== null ? '#fff' : 'var(--text-secondary)',
                                                    borderColor: q.response === 'Yes' ? '#ef4444' : q.response === 'No' ? '#22c55e' : 'var(--border-color)',
                                                }}
                                            >
                                                {q.response || '—'}
                                            </button>
                                            <button
                                                onClick={() => setExpandedComments(isExpanded ? null : q.id)}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                                                    color: q.comments ? 'var(--primary-500)' : 'var(--text-tertiary)',
                                                }}
                                            >
                                                <MessageSquare size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                    }}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '5px 14px',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: 'var(--font-size-sm)',
                                            fontWeight: '700',
                                            background: labelStyle.bg,
                                            color: labelStyle.color,
                                            transition: 'all 0.3s ease',
                                            minWidth: '140px',
                                            textAlign: 'center',
                                        }}>
                                            {q.label}
                                        </span>
                                        {isCustom && (
                                            <button
                                                onClick={() => handleDeleteQuestion(q.id)}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                                                    padding: '2px', fontSize: '12px', lineHeight: 1,
                                                }}
                                                title="Remove custom question"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Question text (mobile: below label) */}
                                <div style={{
                                    color: 'var(--text-primary)',
                                    fontSize: 'var(--font-size-sm)',
                                    lineHeight: 1.5,
                                }}>
                                    {q.question}
                                </div>

                                {/* Response button (desktop only) */}
                                {!isMobile && (
                                    <div style={{ textAlign: 'center' }}>
                                        <button
                                            onClick={() => toggleResponse(q.id)}
                                            style={{
                                                padding: '5px 20px',
                                                borderRadius: 'var(--radius-full)',
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: '700',
                                                border: '2px solid',
                                                cursor: 'pointer',
                                                transition: 'all 0.25s ease',
                                                background: q.response === 'Yes' ? '#ef4444' : q.response === 'No' ? '#22c55e' : 'transparent',
                                                color: q.response !== null ? '#fff' : 'var(--text-tertiary)',
                                                borderColor: q.response === 'Yes' ? '#ef4444' : q.response === 'No' ? '#22c55e' : 'var(--border-color)',
                                                minWidth: '68px',
                                            }}
                                        >
                                            {q.response || '—'}
                                        </button>
                                    </div>
                                )}

                                {/* Comments toggle (desktop only) */}
                                {!isMobile && (
                                    <div style={{ textAlign: 'center' }}>
                                        <button
                                            onClick={() => setExpandedComments(isExpanded ? null : q.id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                color: q.comments ? 'var(--primary-500)' : 'var(--text-tertiary)',
                                                transition: 'color 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                            title={q.comments ? 'View/edit comment' : 'Add comment'}
                                        >
                                            {isExpanded ? <ChevronUp size={16} /> : q.comments ? <MessageSquare size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Expanded Comment Area */}
                            {isExpanded && (
                                <div style={{
                                    padding: '0 var(--spacing-lg) var(--spacing-md)',
                                    borderBottom: index < data.questions.length - 1 ? '1px solid var(--border-color)' : 'none',
                                }}>
                                    <div style={{
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: 'var(--spacing-md)',
                                    }}>
                                        <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '6px', display: 'block' }}>
                                            💬 Comments — {q.label}
                                        </label>
                                        <textarea
                                            className="input"
                                            value={q.comments}
                                            onChange={(e) => updateQuestion(q.id, { comments: e.target.value })}
                                            placeholder={`Add notes for "${q.label}"... e.g., specific concerns, references, evidence`}
                                            style={{
                                                minHeight: '70px',
                                                resize: 'vertical',
                                                fontSize: 'var(--font-size-sm)',
                                                background: 'var(--bg-secondary)',
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Bottom Actions: Mark for analysis + Add question + Reset */}
            <div style={{
                marginTop: 'var(--spacing-lg)',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: 'var(--spacing-md)',
                alignItems: isMobile ? 'stretch' : 'center',
                justifyContent: 'space-between',
            }}>
                {/* Mark for detailed analysis */}
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    cursor: 'pointer',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: data.markedForDetailedAnalysis ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${data.markedForDetailedAnalysis ? 'var(--danger-500)' : 'var(--border-color)'}`,
                    transition: 'all 0.2s ease',
                }}>
                    <input
                        type="checkbox"
                        checked={data.markedForDetailedAnalysis}
                        onChange={(e) => setData(prev => ({ ...prev, markedForDetailedAnalysis: e.target.checked, lastUpdated: new Date().toISOString() }))}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--danger-500)' }}
                    />
                    <AlertTriangle size={16} color={data.markedForDetailedAnalysis ? 'var(--danger-500)' : 'var(--text-tertiary)'} />
                    <span style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        color: data.markedForDetailedAnalysis ? 'var(--danger-500)' : 'var(--text-secondary)',
                    }}>
                        Mark item for more detailed analysis
                    </span>
                </label>

                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowAddQuestion(!showAddQuestion)}
                        style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        + Add Question
                    </button>
                    <button
                        className="btn btn-ghost"
                        onClick={handleReset}
                        style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-tertiary)' }}
                        title="Reset all answers"
                    >
                        <RotateCcw size={14} /> Reset
                    </button>
                </div>
            </div>

            {/* Add Custom Question Form */}
            {showAddQuestion && (
                <div className="card" style={{ marginTop: 'var(--spacing-md)', padding: 'var(--spacing-lg)' }}>
                    <h4 style={{ margin: '0 0 var(--spacing-md)', fontSize: 'var(--font-size-md)' }}>Add Custom Risk Discovery Question</h4>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '200px 1fr',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-md)',
                    }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)' }}>Label</label>
                            <input
                                className="input"
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                placeholder="e.g., Supply Chain"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)' }}>Question</label>
                            <input
                                className="input"
                                value={newQuestion}
                                onChange={(e) => setNewQuestion(e.target.value)}
                                placeholder="e.g., Are there supply chain risks for critical spare parts?"
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" onClick={() => setShowAddQuestion(false)} style={{ fontSize: 'var(--font-size-sm)' }}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleAddQuestion} disabled={!newLabel.trim() || !newQuestion.trim()} style={{ fontSize: 'var(--font-size-sm)' }}>
                            Add Question
                        </button>
                    </div>
                </div>
            )}

            {/* Risk Discovery Summary (when all answered) */}
            {answeredCount === totalCount && totalCount > 0 && (
                <div className="card" style={{
                    marginTop: 'var(--spacing-xl)',
                    padding: 'var(--spacing-lg)',
                    borderLeft: `4px solid ${riskColor}`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                        {riskLevel === 'Low' ? <CheckCircle2 size={20} color={riskColor} /> : <AlertTriangle size={20} color={riskColor} />}
                        <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', color: riskColor }}>
                            Risk Discovery Assessment: {riskLevel} Risk
                        </h3>
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-md)',
                    }}>
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-sm)', background: 'rgba(239,68,68,0.06)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--danger-500)' }}>{yesCount}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Risk Indicators Identified</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-sm)', background: 'rgba(34,197,94,0.06)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--success-500)' }}>{noCount}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>No Concerns</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-sm)', background: `${riskColor}10`, borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: riskColor }}>{riskScore}%</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Risk Discovery Score</div>
                        </div>
                    </div>

                    {/* Show flagged questions */}
                    {yesCount > 0 && (
                        <div>
                            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 'var(--spacing-sm)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Flagged Risk Areas
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                                {data.questions.filter(q => q.response === 'Yes').map(q => (
                                    <span key={q.id} style={{
                                        padding: '4px 10px',
                                        background: '#ef444420',
                                        color: '#ef4444',
                                        borderRadius: 'var(--radius-full)',
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 600,
                                    }}>
                                        ⚠ {q.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {data.markedForDetailedAnalysis && (
                        <div style={{
                            marginTop: 'var(--spacing-md)',
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            background: 'rgba(239,68,68,0.08)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                        }}>
                            <AlertTriangle size={16} color="var(--danger-500)" />
                            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--danger-500)' }}>
                                This item is marked for more detailed analysis
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
