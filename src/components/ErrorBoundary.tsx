import React, { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleReset = () => {
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch {}
        window.location.href = '/login';
    };

    handleEnterDemo = () => {
        try {
            localStorage.setItem('rcm_demo_mode', 'true');
        } catch {}
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0f172a',
                    color: '#f8fafc',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    padding: '24px',
                    textAlign: 'center'
                }}>
                    <div style={{
                        maxWidth: '560px',
                        width: '100%',
                        background: '#1e293b',
                        padding: '36px',
                        borderRadius: '16px',
                        border: '1px solid #334155',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            margin: '0 auto 16px',
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ef4444',
                            fontSize: '28px'
                        }}>
                            ⚠️
                        </div>
                        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px', color: '#ffffff' }}>
                            Application Render Error
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
                            An unexpected issue was caught by the Error Boundary. You can recover immediately using the options below:
                        </p>
                        <div style={{
                            background: '#0f172a',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            color: '#f87171',
                            textAlign: 'left',
                            marginBottom: '24px',
                            maxHeight: '120px',
                            overflowY: 'auto',
                            wordBreak: 'break-word'
                        }}>
                            {this.state.error?.message || 'Unknown render error'}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={this.handleEnterDemo}
                                style={{
                                    background: 'linear-gradient(135deg, #1a7ab8 0%, #0d5c8d 100%)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                🚀 Enter Demo Mode
                            </button>
                            <button
                                onClick={this.handleReload}
                                style={{
                                    background: '#334155',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 18px',
                                    borderRadius: '8px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                🔄 Reload
                            </button>
                            <button
                                onClick={this.handleReset}
                                style={{
                                    background: 'transparent',
                                    color: '#94a3b8',
                                    border: '1px solid #475569',
                                    padding: '10px 18px',
                                    borderRadius: '8px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                🧹 Clear Cache & Reset
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
