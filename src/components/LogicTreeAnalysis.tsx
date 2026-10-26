import { useState, useEffect } from 'react';
import { X, RotateCcw, ChevronRight, CheckCircle2, AlertTriangle, Shield, Wrench, Eye, RefreshCw, Settings, Zap, Search } from 'lucide-react';

// ============================================================
// RCM LOGIC TREE ANALYSIS (LTA) COMPONENT
// Based on the RCM Decision Tree methodology:
//
// 1. HIDDEN CONSEQUENCE → Is the loss of function hidden?
//    YES → CBM → TBM → FFI → Redesign
//    NO  ↓
// 2. CRITICAL RISK → Safety/environment hazard?
//    YES → CBM → TBM → FFI → Redesign
//    NO  ↓
// 3. OPERATIONAL RISK → Production/service degradation?
//    YES → CBM → TBM → Combination → Redesign
//    NO  ↓
// 4. FINANCIAL RISK → Isolated to repair costs?
//    YES → CBM → TBM → Corrective (RTF)
// ============================================================

interface LogicTreeProps {
    isOpen: boolean;
    onClose: () => void;
    failureMode: {
        id: string;
        component: string;
        failureMode: string;
        failureCause: string;
        failureEffect: string;
        rpn: number;
        riskLevel: string;
    } | null;
    onSaveResult?: (_failureModeId: string, _result: LTAResult) => void;
    savedResults?: Record<string, LTAResult>;
}

export interface LTAResult {
    strategy: string;
    strategyCode: string;
    answers: Record<string, boolean | null>;
    completedAt: string;
    path: string[];
}

type QuestionStep =
    | 'hidden_consequence'
    | 'critical_risk'
    | 'operational_risk'
    | 'financial_risk'
    | 'cbm_feasibility'
    | 'tbm_feasibility'
    | 'fft_feasibility'
    | 'combination_feasibility'
    | 'result';

type ConsequenceBranch = 'hidden' | 'critical' | 'operational' | 'financial' | null;

interface DecisionQuestion {
    id: QuestionStep;
    question: string;
    title: string;
    description: string;
    yesLabel: string;
    noLabel: string;
    icon: typeof Shield;
    color: string;
}

const QUESTIONS: Record<string, DecisionQuestion> = {
    hidden_consequence: {
        id: 'hidden_consequence',
        title: '1. HIDDEN CONSEQUENCE',
        question: 'Is the loss of function hidden from the operating crew?',
        description: 'A hidden failure is one that will not become evident to the operating crew under normal circumstances. If the failure occurs on its own, would the operating crew be unaware of it during normal operations?',
        yesLabel: 'Yes — Loss of function is hidden from operators',
        noLabel: 'No — Failure is evident to operators',
        icon: Eye,
        color: '#1e3a5f',
    },
    critical_risk: {
        id: 'critical_risk',
        title: '2. CRITICAL RISK',
        question: 'Does the failure introduce a hazard to safety or environment?',
        description: 'Determine whether this failure mode could cause injury to personnel, loss of life, or significant environmental damage that would violate safety regulations or environmental laws.',
        yesLabel: 'Yes — Safety or environmental hazard exists',
        noLabel: 'No — No safety or environmental risk',
        icon: Shield,
        color: '#1e3a5f',
    },
    operational_risk: {
        id: 'operational_risk',
        title: '3. OPERATIONAL RISK',
        question: 'Does the failure directly degrade production or service delivery?',
        description: 'Determine whether this failure mode has a direct and significant impact on the operational capability — including production output, quality, or customer service delivery.',
        yesLabel: 'Yes — Production or service is degraded',
        noLabel: 'No — No significant operational impact',
        icon: Zap,
        color: '#1e3a5f',
    },
    financial_risk: {
        id: 'financial_risk',
        title: '4. FINANCIAL RISK',
        question: 'Is the impact isolated to direct financial repair costs?',
        description: 'If the failure has no hidden, safety, environmental, or operational consequences, does it only result in the direct cost of repair or replacement?',
        yesLabel: 'Yes — Only direct repair costs are involved',
        noLabel: 'No — Other indirect costs exist',
        icon: AlertTriangle,
        color: '#1e3a5f',
    },
    cbm_feasibility: {
        id: 'cbm_feasibility',
        title: 'Predictive Feasibility (CBM)',
        question: 'Is there a measurable degradation parameter?',
        description: 'Condition-Based Maintenance (CBM) uses monitoring techniques (vibration analysis, thermography, oil analysis, etc.) to detect the onset of failure. Is there a reliable, measurable parameter that indicates degradation is occurring?',
        yesLabel: 'Yes — A measurable condition indicator exists',
        noLabel: 'No — Cannot reliably monitor degradation',
        icon: Settings,
        color: '#4a7a8c',
    },
    tbm_feasibility: {
        id: 'tbm_feasibility',
        title: 'Preventive Feasibility (TBM)',
        question: 'Does it exhibit a predictable wear-out age?',
        description: 'Time-Based Maintenance (TBM) involves performing maintenance at scheduled time or usage intervals. Is there a well-defined wear-out pattern or age-related failure characteristic that allows effective scheduling?',
        yesLabel: 'Yes — Failure follows a predictable wear-out pattern',
        noLabel: 'No — Failure is random, no wear-out pattern',
        icon: RefreshCw,
        color: '#4a7a8c',
    },
    fft_feasibility: {
        id: 'fft_feasibility',
        title: 'Detective Feasibility (FFT)',
        question: 'Can a routine test verify operational readiness?',
        description: 'Failure Finding Task (FFT) is a scheduled test or inspection designed to detect hidden failures. Can a routine functional test or inspection reliably confirm the item is still operational?',
        yesLabel: 'Yes — A routine test can verify readiness',
        noLabel: 'No — No practical test exists',
        icon: Search,
        color: '#4a7a8c',
    },
    combination_feasibility: {
        id: 'combination_feasibility',
        title: 'Combination Feasibility',
        question: 'Can a combination of tasks reduce the risk to a safe level?',
        description: 'When no single maintenance strategy is sufficient, consider whether combining multiple approaches (e.g., CBM + TBM, or CBM + operational procedures) can adequately manage the risk to an acceptable level.',
        yesLabel: 'Yes — A combination of tasks can manage the risk',
        noLabel: 'No — No feasible task combination exists',
        icon: Wrench,
        color: '#5ba3a3',
    },
};

// RCM Decision Tree outcomes
const OUTCOMES: Record<string, { label: string; code: string; description: string; color: string; bgColor: string; icon: typeof Shield }> = {
    predictive_monitoring: {
        label: 'Predictive Monitoring (CBM)',
        code: 'CBM',
        description: 'Implement condition monitoring to track the health indicator. Schedule maintenance actions when the monitored parameter reaches a predetermined threshold.',
        color: '#10b981',
        bgColor: '#10b98115',
        icon: Settings,
    },
    interval_maintenance: {
        label: 'Interval Maintenance (TBM)',
        code: 'TBM',
        description: 'Schedule preventive maintenance at fixed time or usage intervals. Replace or restore the component before the expected failure point based on its wear-out pattern.',
        color: '#10b981',
        bgColor: '#10b98115',
        icon: Wrench,
    },
    availability_testing: {
        label: 'Availability Testing (FFT)',
        code: 'FFT',
        description: 'Schedule periodic failure-finding tasks or functional tests to detect hidden failures before they have operational consequences.',
        color: '#10b981',
        bgColor: '#10b98115',
        icon: Search,
    },
    combined_tasks: {
        label: 'Combined Tasks (CBM + TBM)',
        code: 'CMB',
        description: 'Implement a combination of predictive monitoring and scheduled maintenance tasks to adequately manage the risk to an acceptable level.',
        color: '#10b981',
        bgColor: '#10b98115',
        icon: Wrench,
    },
    corrective_maintenance: {
        label: 'Corrective Maintenance (Run-To-Failure)',
        code: 'RTF',
        description: 'No proactive maintenance is required. Allow the equipment to operate until failure occurs, then perform corrective maintenance. Acceptable because the failure consequences are limited to direct repair costs.',
        color: '#10b981',
        bgColor: '#10b98115',
        icon: RefreshCw,
    },
    redesign: {
        label: 'Mandatory Engineering Redesign',
        code: 'RD',
        description: 'No applicable or economically justified maintenance task exists for this critical failure mode. A design change, redundancy addition, or operational procedure change is mandatory.',
        color: '#ef4444',
        bgColor: '#ef444415',
        icon: AlertTriangle,
    },
};

// Derive which consequence branch we are on from the answers given so far
function deriveBranch(allAnswers: Record<string, boolean | null>): ConsequenceBranch {
    if (allAnswers.hidden_consequence === true) return 'hidden';
    if (allAnswers.critical_risk === true) return 'critical';
    if (allAnswers.operational_risk === true) return 'operational';
    // If we've answered financial_risk at all (YES or NO), we're on the financial branch
    if (allAnswers.financial_risk != null) return 'financial';
    return null;
}

// Decision flow logic — branch derived from answers
function getNextStep(
    currentStep: QuestionStep,
    answer: boolean,
    allAnswers: Record<string, boolean | null>
): { nextStep: QuestionStep | 'result'; outcome?: string } {
    const branch = deriveBranch(allAnswers);

    switch (currentStep) {
        case 'hidden_consequence':
            if (answer) return { nextStep: 'cbm_feasibility' };
            return { nextStep: 'critical_risk' };

        case 'critical_risk':
            if (answer) return { nextStep: 'cbm_feasibility' };
            return { nextStep: 'operational_risk' };

        case 'operational_risk':
            if (answer) return { nextStep: 'cbm_feasibility' };
            return { nextStep: 'financial_risk' };

        case 'financial_risk':
            // YES or NO both lead to financial branch feasibility checks
            return { nextStep: 'cbm_feasibility' };

        case 'cbm_feasibility':
            if (answer) return { nextStep: 'result', outcome: 'predictive_monitoring' };
            return { nextStep: 'tbm_feasibility' };

        case 'tbm_feasibility':
            if (answer) return { nextStep: 'result', outcome: 'interval_maintenance' };
            // Fallback depends on branch
            if (branch === 'hidden') {
                return { nextStep: 'fft_feasibility' }; // Branch A
            }
            if (branch === 'critical') {
                return { nextStep: 'combination_feasibility' }; // Branch B
            }
            // Branch C (operational) and Branch D (financial) both go to RTF
            return { nextStep: 'result', outcome: 'corrective_maintenance' };

        case 'fft_feasibility':
            if (answer) return { nextStep: 'result', outcome: 'availability_testing' };
            return { nextStep: 'result', outcome: 'redesign' };

        case 'combination_feasibility':
            if (answer) return { nextStep: 'result', outcome: 'combined_tasks' };
            return { nextStep: 'result', outcome: 'redesign' };

        default:
            return { nextStep: 'result', outcome: 'corrective_maintenance' };
    }
}

// Maps outcome keys back from strategy codes (for loading saved results)
function outcomeKeyFromCode(code: string): string {
    switch (code) {
        case 'CBM': return 'predictive_monitoring';
        case 'TBM': return 'interval_maintenance';
        case 'FFT': return 'availability_testing';
        case 'CMB': return 'combined_tasks';
        case 'RTF': return 'corrective_maintenance';
        case 'RD': return 'redesign';
        default: return 'corrective_maintenance';
    }
}

export default function LogicTreeAnalysis({ isOpen, onClose, failureMode, onSaveResult, savedResults }: LogicTreeProps) {
    const [currentStep, setCurrentStep] = useState<QuestionStep | 'result'>('hidden_consequence');
    const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
    const [outcome, setOutcome] = useState<string | null>(null);
    const [path, setPath] = useState<string[]>(['hidden_consequence']);
    const [animating, setAnimating] = useState(false);

    // Track visited steps for progress bar
    const visitedSteps: QuestionStep[] = [];
    for (const p of path) {
        if (p !== 'result' && !p.includes(':') && QUESTIONS[p]) {
            visitedSteps.push(p as QuestionStep);
        }
    }

    const resetTree = () => {
        setCurrentStep('hidden_consequence');
        setAnswers({});
        setOutcome(null);
        setPath(['hidden_consequence']);
    };

    // Load saved result if exists
    useEffect(() => {
        if (isOpen && failureMode && savedResults?.[failureMode.id]) {
            const saved = savedResults[failureMode.id];
            // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing external saved data into local state is intentional
            setAnswers(saved.answers);
            setCurrentStep('result');
            setOutcome(outcomeKeyFromCode(saved.strategyCode));
            setPath(saved.path);
        } else if (isOpen) {
            resetTree();
        }
    }, [isOpen, failureMode, savedResults]);


    const handleAnswer = (answer: boolean) => {
        if (currentStep === 'result') return;
        setAnimating(true);
        const newAnswers = { ...answers, [currentStep]: answer };
        setAnswers(newAnswers);

        setTimeout(() => {
            // Derive branch from ALL answers (including the current one) — avoids stale state
            const { nextStep, outcome: nextOutcome } = getNextStep(currentStep, answer, newAnswers);

            if (nextStep === 'result' && nextOutcome) {
                setOutcome(nextOutcome);
                setPath([...path, `${currentStep}:${answer ? 'yes' : 'no'}`, 'result']);
                setCurrentStep('result');
            } else {
                setPath([...path, `${currentStep}:${answer ? 'yes' : 'no'}`, nextStep]);
                setCurrentStep(nextStep as QuestionStep);
            }
            setAnimating(false);
        }, 300);
    };

    const handleSave = () => {
        if (!failureMode || !outcome) return;
        const outcomeData = OUTCOMES[outcome];
        const result: LTAResult = {
            strategy: outcomeData.label,
            strategyCode: outcomeData.code,
            answers,
            completedAt: new Date().toISOString(),
            path,
        };
        onSaveResult?.(failureMode.id, result);
        onClose();
    };

    if (!isOpen || !failureMode) return null;

    const currentQuestion = currentStep !== 'result' ? QUESTIONS[currentStep] : null;
    const answeredCount = Object.keys(answers).length;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 9998,
                    animation: 'fadeIn 0.2s ease',
                }}
            />

            {/* Modal */}
            <div
                style={{
                    position: 'fixed',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '94%',
                    maxWidth: '820px',
                    maxHeight: '92vh',
                    background: 'var(--bg-secondary)',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 32px 64px rgba(0, 0, 0, 0.4)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideUp 0.3s ease',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #1e3a5f, #4a7a8c)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 3v18" /><path d="M6 9l6-6 6 6" /><path d="M6 15l6 6 6-6" />
                                        <circle cx="4" cy="12" r="1" fill="white" /><circle cx="20" cy="12" r="1" fill="white" />
                                    </svg>
                                </div>
                                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    RCM Logic Tree Analysis
                                </h2>
                            </div>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: '500px' }}>
                                Determine the optimal maintenance strategy for each failure mode
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {currentStep !== 'hidden_consequence' && (
                                <button onClick={resetTree} style={{
                                    padding: '8px', minWidth: 'auto', background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)', borderRadius: '10px',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                }} title="Restart Analysis">
                                    <RotateCcw size={18} />
                                </button>
                            )}
                            <button onClick={onClose} style={{
                                padding: '8px', minWidth: 'auto', background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)', borderRadius: '10px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-secondary)',
                            }}>
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Failure Mode Context Card */}
                    <div style={{
                        marginTop: '14px', padding: '12px 16px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center',
                    }}>
                        <div>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Component</div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{failureMode.component}</div>
                        </div>
                        <div style={{ width: '1px', height: '30px', background: 'var(--border-color)' }} />
                        <div>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Failure Mode</div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{failureMode.failureMode}</div>
                        </div>
                        <div style={{ width: '1px', height: '30px', background: 'var(--border-color)' }} />
                        <div>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', fontWeight: 600 }}>RPN</div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: failureMode.rpn >= 300 ? '#ef4444' : failureMode.rpn >= 100 ? '#f59e0b' : '#10b981' }}>{failureMode.rpn}</div>
                        </div>
                    </div>
                </div>

                {/* Progress Steps */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--border-color)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'auto' }}>
                        {visitedSteps.map((step, idx) => {
                            const isAnswered = answers[step] != null;
                            const isCurrent = currentStep === step;
                            const answer = answers[step];
                            const q = QUESTIONS[step];
                            const isConsequence = ['hidden_consequence', 'critical_risk', 'operational_risk', 'financial_risk'].includes(step);

                            return (
                                <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                                    <div
                                        title={q?.title || step}
                                        style={{
                                            width: '28px', height: '28px', borderRadius: isConsequence ? '6px' : '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '11px', fontWeight: 700,
                                            background: isAnswered
                                                ? answer ? '#10b98120' : '#ef444420'
                                                : isCurrent ? `${q.color}20` : 'var(--bg-tertiary)',
                                            color: isAnswered
                                                ? answer ? '#10b981' : '#ef4444'
                                                : isCurrent ? q.color : 'var(--text-tertiary)',
                                            border: isCurrent ? `2px solid ${q.color}` : '1px solid var(--border-color)',
                                            transition: 'all 0.3s ease',
                                            flexShrink: 0,
                                        }}>
                                        {isAnswered ? (answer ? '✓' : '✗') : idx + 1}
                                    </div>
                                    {idx < visitedSteps.length - 1 && (
                                        <div style={{
                                            width: '20px', height: '2px',
                                            background: isAnswered ? (answer ? '#10b98150' : '#ef444450') : 'var(--border-color)',
                                            flexShrink: 0,
                                            transition: 'background 0.3s ease',
                                        }} />
                                    )}
                                </div>
                            );
                        })}
                        {currentStep === 'result' && (
                            <>
                                <div style={{ width: '20px', height: '2px', background: outcome ? OUTCOMES[outcome].color + '50' : 'var(--border-color)', flexShrink: 0 }} />
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: outcome ? `${OUTCOMES[outcome].color}20` : 'var(--bg-tertiary)',
                                    border: outcome ? `2px solid ${OUTCOMES[outcome].color}` : '1px solid var(--border-color)',
                                    flexShrink: 0,
                                }}>
                                    <CheckCircle2 size={14} color={outcome ? OUTCOMES[outcome].color : 'var(--text-tertiary)'} />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div style={{
                    padding: '24px',
                    overflowY: 'auto',
                    flex: 1,
                    opacity: animating ? 0.3 : 1,
                    transform: animating ? 'translateY(8px)' : 'translateY(0)',
                    transition: 'all 0.2s ease',
                }}>
                    {/* Question View */}
                    {currentStep !== 'result' && currentQuestion && (
                        <div>
                            {/* Step Label */}
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '4px 12px', borderRadius: '100px',
                                background: `${currentQuestion.color}12`,
                                color: currentQuestion.color,
                                fontSize: '12px', fontWeight: 600,
                                marginBottom: '20px',
                            }}>
                                <currentQuestion.icon size={14} />
                                {currentQuestion.title}
                            </div>

                            {/* Question */}
                            <h3 style={{
                                margin: '0 0 12px', fontSize: '22px', fontWeight: 700,
                                color: 'var(--text-primary)', lineHeight: 1.3,
                            }}>
                                {currentQuestion.question}
                            </h3>

                            {/* Description */}
                            <p style={{
                                margin: '0 0 28px',
                                fontSize: '14px', color: 'var(--text-tertiary)',
                                lineHeight: 1.7, maxWidth: '680px',
                            }}>
                                {currentQuestion.description}
                            </p>

                            {/* Answer Buttons */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button
                                    onClick={() => handleAnswer(true)}
                                    style={{
                                        padding: '18px 20px',
                                        background: 'var(--bg-tertiary)',
                                        border: '2px solid var(--border-color)',
                                        borderRadius: '14px',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '14px',
                                        textAlign: 'left',
                                        transition: 'all 0.2s ease',
                                        color: 'var(--text-primary)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#10b981';
                                        e.currentTarget.style.background = '#10b98108';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--border-color)';
                                        e.currentTarget.style.background = 'var(--bg-tertiary)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '12px',
                                        background: '#10b98115', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <CheckCircle2 size={20} color="#10b981" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px', color: '#10b981' }}>YES</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{currentQuestion.yesLabel}</div>
                                    </div>
                                    <ChevronRight size={18} color="var(--text-tertiary)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                                </button>

                                <button
                                    onClick={() => handleAnswer(false)}
                                    style={{
                                        padding: '18px 20px',
                                        background: 'var(--bg-tertiary)',
                                        border: '2px solid var(--border-color)',
                                        borderRadius: '14px',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '14px',
                                        textAlign: 'left',
                                        transition: 'all 0.2s ease',
                                        color: 'var(--text-primary)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#ef4444';
                                        e.currentTarget.style.background = '#ef444408';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--border-color)';
                                        e.currentTarget.style.background = 'var(--bg-tertiary)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '12px',
                                        background: '#ef444415', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <X size={20} color="#ef4444" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px', color: '#ef4444' }}>NO</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{currentQuestion.noLabel}</div>
                                    </div>
                                    <ChevronRight size={18} color="var(--text-tertiary)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                                </button>
                            </div>

                            {/* Decision Path So Far */}
                            {answeredCount > 0 && (
                                <div style={{ marginTop: '24px' }}>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '10px' }}>
                                        Decision Path
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {Object.entries(answers).map(([step, answer]) => (
                                            <span key={step} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                padding: '4px 10px', borderRadius: '100px',
                                                background: answer ? '#10b98112' : '#ef444412',
                                                color: answer ? '#10b981' : '#ef4444',
                                                fontSize: '11px', fontWeight: 600,
                                            }}>
                                                {QUESTIONS[step]?.title || step}:
                                                {answer ? ' ✓ YES' : ' ✗ NO'}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Result View */}
                    {currentStep === 'result' && outcome && (
                        <div>
                            {/* Result Badge */}
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '4px 12px', borderRadius: '100px',
                                background: `${OUTCOMES[outcome].color}15`,
                                color: OUTCOMES[outcome].color,
                                fontSize: '12px', fontWeight: 600,
                                marginBottom: '20px',
                            }}>
                                <CheckCircle2 size={14} />
                                Analysis Complete
                            </div>

                            {/* Result Card */}
                            <div style={{
                                padding: '24px',
                                background: OUTCOMES[outcome].bgColor,
                                border: `2px solid ${OUTCOMES[outcome].color}30`,
                                borderRadius: '16px',
                                marginBottom: '24px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                    <div style={{
                                        width: '52px', height: '52px', borderRadius: '14px',
                                        background: `${OUTCOMES[outcome].color}20`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        {(() => {
                                            const Icon = OUTCOMES[outcome].icon;
                                            return <Icon size={24} color={OUTCOMES[outcome].color} />;
                                        })()}
                                    </div>
                                    <div>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '2px 10px', borderRadius: '6px',
                                            background: OUTCOMES[outcome].color,
                                            color: 'white', fontSize: '11px', fontWeight: 700,
                                            marginBottom: '8px', letterSpacing: '0.5px',
                                        }}>
                                            {OUTCOMES[outcome].code}
                                        </div>
                                        <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {OUTCOMES[outcome].label}
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                            {OUTCOMES[outcome].description}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Decision Summary */}
                            <div style={{
                                padding: '20px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '14px',
                                border: '1px solid var(--border-color)',
                            }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                                    Decision Path Summary
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {Object.entries(answers).map(([step, answer]) => (
                                        <div key={step} style={{
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            padding: '10px 14px',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: '10px',
                                            border: '1px solid var(--border-color)',
                                        }}>
                                            <div style={{
                                                width: '22px', height: '22px', borderRadius: '6px',
                                                background: answer ? '#10b98115' : '#ef444415',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                {answer
                                                    ? <CheckCircle2 size={12} color="#10b981" />
                                                    : <X size={12} color="#ef4444" />}
                                            </div>
                                            <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>
                                                {QUESTIONS[step]?.question || step}
                                            </div>
                                            <span style={{
                                                fontSize: '12px', fontWeight: 700,
                                                color: answer ? '#10b981' : '#ef4444',
                                            }}>
                                                {answer ? 'YES' : 'NO'}
                                            </span>
                                        </div>
                                    ))}

                                    {/* Final Result Row */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '12px 14px',
                                        background: OUTCOMES[outcome].bgColor,
                                        borderRadius: '10px',
                                        border: `1px solid ${OUTCOMES[outcome].color}30`,
                                    }}>
                                        <div style={{
                                            width: '22px', height: '22px', borderRadius: '6px',
                                            background: `${OUTCOMES[outcome].color}20`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <ChevronRight size={12} color={OUTCOMES[outcome].color} />
                                        </div>
                                        <div style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: OUTCOMES[outcome].color }}>
                                            → {OUTCOMES[outcome].label}
                                        </div>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '6px',
                                            background: OUTCOMES[outcome].color,
                                            color: 'white', fontSize: '11px', fontWeight: 700,
                                        }}>
                                            {OUTCOMES[outcome].code}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {currentStep === 'result' && outcome && (
                    <div style={{
                        padding: '16px 24px',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex', gap: '12px', justifyContent: 'flex-end',
                        background: 'var(--bg-tertiary)',
                        flexShrink: 0,
                    }}>
                        <button onClick={resetTree} style={{
                            padding: '10px 20px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '14px', fontWeight: 600,
                            color: 'var(--text-secondary)',
                        }}>
                            <RotateCcw size={16} /> Re-analyze
                        </button>
                        <button onClick={handleSave} style={{
                            padding: '10px 24px',
                            background: OUTCOMES[outcome].color,
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '14px', fontWeight: 600,
                            color: 'white',
                            boxShadow: `0 4px 12px ${OUTCOMES[outcome].color}40`,
                        }}>
                            <CheckCircle2 size={16} /> Save Result
                        </button>
                    </div>
                )}
            </div>

            {/* Animation Keyframes */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translate(-50%, -46%); }
                    to { opacity: 1; transform: translate(-50%, -50%); }
                }
            `}</style>
        </>
    );
}
