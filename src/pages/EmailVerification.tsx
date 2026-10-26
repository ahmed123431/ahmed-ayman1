import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function EmailVerification() {
    const navigate = useNavigate();
    const [email] = useState('user@example.com'); // This would come from the signup process
    const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
    const [resendLoading, setResendLoading] = useState(false);
    const [countdown, setCountdown] = useState(60);

    // Countdown timer for resend button
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleResend = () => {
        setResendLoading(true);
        setCountdown(60);

        // Simulate sending verification email
        setTimeout(() => {
            setResendLoading(false);
        }, 2000);
    };

    const handleVerify = () => {
        // Simulate email verification
        setTimeout(() => {
            setVerificationStatus('success');
            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        }, 1500);
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            padding: 'var(--spacing-lg)',
        }}>
            {/* Background Pattern */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(circle at 20% 50%, rgba(26, 122, 184, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 116, 67, 0.15) 0%, transparent 50%)',
                pointerEvents: 'none',
            }}></div>

            {/* Verification Card */}
            <div className="card-glass animate-fade-in" style={{
                position: 'relative',
                maxWidth: '500px',
                width: '100%',
                padding: 'var(--spacing-3xl)',
                textAlign: 'center',
            }}>
                {verificationStatus === 'pending' && (
                    <>
                        {/* Email Icon */}
                        <div style={{
                            width: '100px',
                            height: '100px',
                            margin: '0 auto var(--spacing-xl)',
                            borderRadius: '50%',
                            background: 'var(--gradient-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: 'pulse 2s infinite',
                        }}>
                            <Mail size={50} color="white" />
                        </div>

                        {/* Header */}
                        <h1 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: 'var(--spacing-md)' }}>
                            Verify Your Email
                        </h1>
                        <p style={{
                            color: 'var(--text-secondary)',
                            fontSize: 'var(--font-size-base)',
                            marginBottom: 'var(--spacing-xl)',
                        }}>
                            We've sent a verification link to<br />
                            <strong style={{ color: 'var(--primary-400)' }}>{email}</strong>
                        </p>

                        {/* Instructions */}
                        <div style={{
                            background: 'rgba(26, 122, 184, 0.1)',
                            border: '1px solid var(--primary-500)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-lg)',
                            marginBottom: 'var(--spacing-xl)',
                            textAlign: 'left',
                        }}>
                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-secondary)',
                                marginBottom: 'var(--spacing-sm)',
                            }}>
                                📧 <strong>Check your inbox</strong> and click the verification link
                            </p>
                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-secondary)',
                                marginBottom: 'var(--spacing-sm)',
                            }}>
                                📁 Don't see it? Check your <strong>spam folder</strong>
                            </p>
                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-secondary)',
                                margin: 0,
                            }}>
                                ⏱️ Link expires in <strong>24 hours</strong>
                            </p>
                        </div>

                        {/* Demo Verify Button */}
                        <button
                            onClick={handleVerify}
                            className="btn btn-primary"
                            style={{
                                width: '100%',
                                padding: 'var(--spacing-md)',
                                marginBottom: 'var(--spacing-md)',
                            }}
                        >
                            <CheckCircle size={20} />
                            Simulate Email Verification
                        </button>

                        {/* Resend Link */}
                        <button
                            onClick={handleResend}
                            disabled={countdown > 0 || resendLoading}
                            className="btn btn-ghost"
                            style={{
                                width: '100%',
                                padding: 'var(--spacing-md)',
                                opacity: countdown > 0 ? 0.5 : 1,
                                cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {resendLoading ? (
                                <>
                                    <RefreshCw size={20} className="animate-pulse" />
                                    Sending...
                                </>
                            ) : countdown > 0 ? (
                                `Resend available in ${countdown}s`
                            ) : (
                                <>
                                    <RefreshCw size={20} />
                                    Resend Verification Email
                                </>
                            )}
                        </button>

                        {/* Back to Login */}
                        <div style={{ marginTop: 'var(--spacing-xl)' }}>
                            <a
                                href="/login"
                                onClick={(e) => {
                                    e.preventDefault();
                                    navigate('/login');
                                }}
                                style={{
                                    color: 'var(--text-secondary)',
                                    textDecoration: 'none',
                                    fontSize: 'var(--font-size-sm)',
                                }}
                            >
                                ← Back to Login
                            </a>
                        </div>
                    </>
                )}

                {verificationStatus === 'success' && (
                    <div className="animate-fade-in">
                        {/* Success Icon */}
                        <div style={{
                            width: '100px',
                            height: '100px',
                            margin: '0 auto var(--spacing-xl)',
                            borderRadius: '50%',
                            background: 'var(--success-100)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <CheckCircle size={50} color="var(--success-500)" />
                        </div>

                        <h1 style={{
                            fontSize: 'var(--font-size-3xl)',
                            marginBottom: 'var(--spacing-md)',
                            color: 'var(--success-500)',
                        }}>
                            Email Verified!
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-base)' }}>
                            Your email has been successfully verified.<br />
                            Redirecting you to login...
                        </p>
                    </div>
                )}

                {verificationStatus === 'error' && (
                    <div className="animate-fade-in">
                        {/* Error Icon */}
                        <div style={{
                            width: '100px',
                            height: '100px',
                            margin: '0 auto var(--spacing-xl)',
                            borderRadius: '50%',
                            background: 'var(--danger-100)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <AlertCircle size={50} color="var(--danger-500)" />
                        </div>

                        <h1 style={{
                            fontSize: 'var(--font-size-3xl)',
                            marginBottom: 'var(--spacing-md)',
                            color: 'var(--danger-500)',
                        }}>
                            Verification Failed
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-base)' }}>
                            The verification link is invalid or expired.<br />
                            Please request a new verification email.
                        </p>

                        <button
                            onClick={handleResend}
                            className="btn btn-primary"
                            style={{
                                width: '100%',
                                padding: 'var(--spacing-md)',
                                marginTop: 'var(--spacing-xl)',
                            }}
                        >
                            <RefreshCw size={20} />
                            Request New Link
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
