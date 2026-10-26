import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import { Shield, AlertTriangle, XCircle } from 'lucide-react';

export default function RiskAssessment() {
    // Mock data - would come from RCM engine in production
    const unacceptableRisks = [
        {
            id: '1',
            category: 'Safety',
            asset: 'Centrifugal Pump A-101',
            failureMode: 'Seal failure causing high-pressure leak',
            riskLevel: 'High',
            rpn: 432,
            mitigation: 'Install leak detection system and implement weekly visual inspections. Emergency shutdown procedure required.',
        },
        {
            id: '2',
            category: 'Environmental',
            asset: 'Chemical Storage Tank T-105',
            failureMode: 'Tank corrosion leading to chemical spillage',
            riskLevel: 'High',
            rpn: 378,
            mitigation: 'Perform ultrasonic thickness testing quarterly. Install secondary containment and level monitoring.',
        },
    ];

    const risksByCategory = [
        { category: 'Safety', high: 2, medium: 3, low: 5, color: 'var(--danger-500)' },
        { category: 'Environmental', high: 1, medium: 2, low: 4, color: 'var(--success-500)' },
        { category: 'Operational', high: 3, medium: 5, low: 2, color: 'var(--primary-500)' },
        { category: 'Financial', high: 2, medium: 4, low: 6, color: 'var(--warning-500)' },
    ];

    const totalRisks = risksByCategory.reduce((sum, cat) => sum + cat.high + cat.medium + cat.low, 0);

    return (
        <>
            <Sidebar />
            <PageContainer style={{ padding: 'var(--spacing-2xl)' }}>
                {/* Header */}
                <div className="animate-fade-in" style={{ marginBottom: 'var(--spacing-2xl)' }}>
                    <h1 style={{ marginBottom: 'var(--spacing-sm)' }}>Risk Assessment</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-lg)' }}>
                        Comprehensive risk analysis across Safety, Environmental, Operational, and Financial categories.
                    </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-2 animate-fade-in" style={{ marginBottom: 'var(--spacing-2xl)', animationDelay: '100ms' }}>
                    <div className="card-glass">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: '0.5rem' }}>
                                    Total Risks Assessed
                                </p>
                                <h2 style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 800, margin: 0 }}>
                                    {totalRisks}
                                </h2>
                            </div>
                            <Shield size={48} color="var(--primary-500)" />
                        </div>
                    </div>

                    <div className="card-glass">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: '0.5rem' }}>
                                    Unacceptable Risks
                                </p>
                                <h2 style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 800, margin: 0, color: 'var(--danger-500)' }}>
                                    {unacceptableRisks.length}
                                </h2>
                                <p style={{ color: 'var(--danger-500)', fontSize: 'var(--font-size-sm)', marginTop: '0.5rem' }}>
                                    Immediate action required
                                </p>
                            </div>
                            <AlertTriangle size={48} color="var(--danger-500)" />
                        </div>
                    </div>
                </div>

                {/* Unacceptable Risks */}
                {unacceptableRisks.length > 0 && (
                    <div className="card-glass animate-slide-in" style={{ marginBottom: 'var(--spacing-2xl)', animationDelay: '200ms', borderColor: 'var(--danger-500)' }}>
                        <h3 style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger-500)' }}>
                            <XCircle size={24} />
                            Unacceptable Risks - Immediate Action Required
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {unacceptableRisks.map((risk) => (
                                <div
                                    key={risk.id}
                                    style={{
                                        padding: 'var(--spacing-lg)',
                                        background: 'rgba(255, 26, 26, 0.1)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--danger-500)',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-sm)' }}>
                                        <div>
                                            <h4 style={{ fontSize: 'var(--font-size-lg)', margin: 0, marginBottom: '0.25rem' }}>
                                                {risk.asset}
                                            </h4>
                                            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                                {risk.failureMode}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                            <span className="badge badge-danger">{risk.category}</span>
                                            <span className="badge" style={{ background: 'var(--danger-900)', color: 'white' }}>
                                                RPN: {risk.rpn}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{
                                        marginTop: 'var(--spacing-md)',
                                        padding: 'var(--spacing-md)',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-sm)',
                                        borderLeft: '3px solid var(--danger-500)',
                                    }}>
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                                            Mitigation Action
                                        </p>
                                        <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                            {risk.mitigation}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Risk Distribution by Category */}
                <div className="card-glass animate-fade-in" style={{ marginBottom: 'var(--spacing-2xl)', animationDelay: '300ms' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Risk Distribution by Category</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                        {risksByCategory.map((cat) => {
                            const total = cat.high + cat.medium + cat.low;
                            return (
                                <div key={cat.category}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                                        <h4 style={{ fontSize: 'var(--font-size-base)', margin: 0 }}>{cat.category}</h4>
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                            {total} risks
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', height: '32px', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                flex: cat.high,
                                                background: 'var(--danger-500)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontWeight: 600,
                                                fontSize: 'var(--font-size-sm)',
                                            }}
                                        >
                                            {cat.high > 0 && cat.high}
                                        </div>
                                        <div
                                            style={{
                                                flex: cat.medium,
                                                background: 'var(--warning-500)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--gray-900)',
                                                fontWeight: 600,
                                                fontSize: 'var(--font-size-sm)',
                                            }}
                                        >
                                            {cat.medium > 0 && cat.medium}
                                        </div>
                                        <div
                                            style={{
                                                flex: cat.low,
                                                background: 'var(--success-500)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontWeight: 600,
                                                fontSize: 'var(--font-size-sm)',
                                            }}
                                        >
                                            {cat.low > 0 && cat.low}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                        <span>🔴 High: {cat.high}</span>
                                        <span>🟡 Medium: {cat.medium}</span>
                                        <span>🟢 Low: {cat.low}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div className="card-glass animate-fade-in" style={{ animationDelay: '400ms' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Risk Level Criteria</h3>
                    <div className="grid grid-3">
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--danger-500)' }}></div>
                                <span style={{ fontWeight: 600 }}>High Risk</span>
                            </div>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                                RPN ≥ 300. Immediate action required. Unacceptable for Safety/Environmental.
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--warning-500)' }}></div>
                            <span style={{ fontWeight: 600 }}>Medium Risk</span>
                        </div>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                            RPN 101-299. Preventive action recommended. Monitor and control.
                        </p>
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--success-500)' }}></div>
                            <span style={{ fontWeight: 600 }}>Low Risk</span>
                        </div>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                            RPN ≤ 100. Acceptable risk. Routine monitoring sufficient.
                        </p>
                    </div>
                </div>
            </PageContainer>
        </>
    );
}
