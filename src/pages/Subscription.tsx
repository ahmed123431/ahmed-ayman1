import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, Zap } from 'lucide-react';

interface SubscriptionPlan {
    id: string;
    name: string;
    price: string;
    period: string;
    features: string[];
    recommended?: boolean;
}

export default function Subscription() {
    const navigate = useNavigate();
    const [selectedPlan, setSelectedPlan] = useState<string>('');

    const plans: SubscriptionPlan[] = [
        {
            id: 'basic',
            name: 'Basic',
            price: '$29',
            period: 'per month',
            features: [
                'Up to 5 projects',
                'Basic RCM analysis',
                'Email support',
                'Standard reports'
            ]
        },
        {
            id: 'professional',
            name: 'Professional',
            price: '$79',
            period: 'per month',
            recommended: true,
            features: [
                'Unlimited projects',
                'Advanced RCM analysis',
                'Priority support',
                'Custom reports',
                'API access',
                'Team collaboration'
            ]
        },
        {
            id: 'enterprise',
            name: 'Enterprise',
            price: '$199',
            period: 'per month',
            features: [
                'Everything in Professional',
                'Dedicated support',
                'Custom integrations',
                'Advanced security',
                'SLA guarantee',
                'Training sessions'
            ]
        }
    ];

    const handleSubscribe = () => {
        if (selectedPlan) {
            // Here you would integrate with Stripe or other payment provider
            // For now, just navigate to projects
            navigate('/');
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            padding: 'var(--spacing-xl)'
        }}>
            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: 'var(--spacing-3xl)'
                }}>
                    <h1 style={{ marginBottom: 'var(--spacing-md)' }}>
                        Choose Your Plan
                    </h1>
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--font-size-lg)'
                    }}>
                        Select the plan that best fits your reliability needs
                    </p>
                </div>

                {/* Plans Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 'var(--spacing-xl)',
                    marginBottom: 'var(--spacing-2xl)'
                }}>
                    {plans.map((plan) => (
                        <div
                            key={plan.id}
                            onClick={() => setSelectedPlan(plan.id)}
                            style={{
                                background: selectedPlan === plan.id
                                    ? 'var(--bg-elevated)'
                                    : 'var(--bg-secondary)',
                                border: `2px solid ${selectedPlan === plan.id
                                    ? 'var(--primary-500)'
                                    : 'var(--border-color)'}`,
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--spacing-xl)',
                                cursor: 'pointer',
                                transition: 'all var(--transition-base)',
                                position: 'relative',
                                boxShadow: selectedPlan === plan.id
                                    ? 'var(--shadow-glow)'
                                    : 'var(--shadow-md)'
                            }}
                        >
                            {plan.recommended && (
                                <div style={{
                                    position: 'absolute',
                                    top: '-12px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    background: 'var(--gradient-accent)',
                                    color: 'white',
                                    padding: 'var(--spacing-xs) var(--spacing-md)',
                                    borderRadius: 'var(--radius-full)',
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-xs)'
                                }}>
                                    <Crown size={14} />
                                    Recommended
                                </div>
                            )}

                            <div style={{
                                textAlign: 'center',
                                marginBottom: 'var(--spacing-lg)'
                            }}>
                                <h3 style={{
                                    fontSize: 'var(--font-size-xl)',
                                    marginBottom: 'var(--spacing-sm)',
                                    color: 'var(--text-primary)'
                                }}>
                                    {plan.name}
                                </h3>
                                <div style={{
                                    fontSize: 'var(--font-size-4xl)',
                                    fontWeight: '800',
                                    background: 'var(--gradient-primary)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    marginBottom: 'var(--spacing-xs)'
                                }}>
                                    {plan.price}
                                </div>
                                <p style={{
                                    color: 'var(--text-secondary)',
                                    fontSize: 'var(--font-size-sm)'
                                }}>
                                    {plan.period}
                                </p>
                            </div>

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 'var(--spacing-sm)'
                            }}>
                                {plan.features.map((feature, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-sm)',
                                            color: 'var(--text-secondary)'
                                        }}
                                    >
                                        <Check size={18} style={{ color: 'var(--success-500)', flexShrink: 0 }} />
                                        <span style={{ fontSize: 'var(--font-size-sm)' }}>{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Action Buttons */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 'var(--spacing-md)'
                }}>
                    <button
                        onClick={() => navigate('/login')}
                        className="btn btn-secondary"
                        style={{ minWidth: '140px' }}
                    >
                        Back
                    </button>
                    <button
                        onClick={handleSubscribe}
                        disabled={!selectedPlan}
                        className="btn btn-primary"
                        style={{
                            minWidth: '140px',
                            opacity: selectedPlan ? '1' : '0.5',
                            cursor: selectedPlan ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)'
                        }}
                    >
                        <Zap size={18} />
                        Continue
                    </button>
                </div>

                {/* Footer Note */}
                <p style={{
                    textAlign: 'center',
                    marginTop: 'var(--spacing-xl)',
                    color: 'var(--text-tertiary)',
                    fontSize: 'var(--font-size-sm)'
                }}>
                    All plans include secure data storage and automatic backups
                </p>
            </div>
        </div>
    );
}
