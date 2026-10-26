import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { LogIn, Mail, Lock, AlertCircle, X, CheckCircle } from 'lucide-react';
import RCM7QLogo from '../components/RCM7QLogo';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';


export default function Login() {
    const navigate = useNavigate();
    const { signIn, session, resetPassword, loginAsDemo } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetSent, setResetSent] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile screen
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Validation
        if (!email || !password) {
            setError('Please enter both email and password');
            setLoading(false);
            return;
        }

        try {
            const { error } = await signIn(email, password);
            if (error) {
                setError(error.message);
            } else {
                navigate('/');
            }
        } catch (err) {
            setError('An unexpected error occurred during login.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/'
                }
            });
            if (error) {
                setError(error.message);
                setLoading(false);
            }
        } catch (err) {
            setError('An unexpected error occurred during Google sign-in.');
            setLoading(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetEmail) return;
        
        try {
            const { error } = await resetPassword(resetEmail);
            if (error) {
                setError(error.message);
                setShowResetModal(false);
            } else {
                setResetSent(true);
                setTimeout(() => {
                    setShowResetModal(false);
                    setResetSent(false);
                    setResetEmail('');
                }, 3000);
            }
        } catch (err) {
            setError('An unexpected error occurred.');
            setShowResetModal(false);
        }
    };

    // Auto-redirect if already logged in
    if (session) {
        return <Navigate to="/" replace />;
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)',
        }}>
            {/* Background Pattern */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: isMobile
                    ? 'radial-gradient(circle at 50% 0%, rgba(26, 122, 184, 0.2) 0%, transparent 60%)'
                    : 'radial-gradient(circle at 20% 50%, rgba(26, 122, 184, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 116, 67, 0.15) 0%, transparent 50%)',
                pointerEvents: 'none',
            }}></div>

            {/* Login Card */}
            <div className="card-glass animate-fade-in" style={{
                position: 'relative',
                maxWidth: isMobile ? '100%' : '450px',
                width: '100%',
                padding: isMobile ? 'var(--spacing-xl)' : 'var(--spacing-3xl)',
                borderRadius: isMobile ? 'var(--radius-xl)' : 'var(--radius-2xl)',
            }}>
                {/* Logo/Header */}
                <div style={{ textAlign: 'center', marginBottom: isMobile ? 'var(--spacing-xl)' : 'var(--spacing-2xl)' }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: 'var(--spacing-md)',
                    }}>
                        <RCM7QLogo size={isMobile ? 100 : 120} showText />
                    </div>
                    <h1 style={{
                        fontSize: isMobile ? 'var(--font-size-2xl)' : 'var(--font-size-3xl)',
                        marginBottom: 'var(--spacing-xs)'
                    }}>
                        Welcome Back
                    </h1>
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)'
                    }}>
                        Sign in to RCM7Q
                    </p>
                </div>

                {/* Instant Local Demo Access Button */}
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <button
                        type="button"
                        onClick={() => {
                            loginAsDemo();
                            navigate('/');
                        }}
                        style={{
                            width: '100%',
                            padding: isMobile ? 'var(--spacing-sm) var(--spacing-md)' : 'var(--spacing-md)',
                            background: 'var(--gradient-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--spacing-sm)',
                            minHeight: isMobile ? '44px' : '48px',
                            fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)',
                            fontWeight: 600,
                            boxShadow: '0 4px 16px rgba(26, 122, 184, 0.3)'
                        }}
                    >
                        🚀 Enter Local Demo Mode (Skip Login)
                    </button>
                    <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        Instant full access to all features on localhost without credentials
                    </div>
                </div>

                {/* Social Login Buttons */}
                <div style={{ marginBottom: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-xl)' }}>
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-md)',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-base)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--spacing-sm)',
                            minHeight: isMobile ? '44px' : '48px',
                            color: 'var(--text-primary)',
                            fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)',
                            fontWeight: 500,
                        }}
                    >
                        <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </button>
                    <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                        (Note: Google OAuth redirects to Supabase cloud URL. For localhost, use Demo Mode above or Email)
                    </div>

                    {/* Divider */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-md)',
                        margin: isMobile ? 'var(--spacing-lg) 0' : 'var(--spacing-xl) 0',
                    }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                        <span style={{
                            color: 'var(--text-tertiary)',
                            fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)'
                        }}>
                            or continue with email
                        </span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="animate-slide-in" style={{
                        padding: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-md)',
                        background: 'rgba(255, 26, 26, 0.1)',
                        border: '1px solid var(--danger-500)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--spacing-md)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                    }}>
                        <AlertCircle size={18} color="var(--danger-500)" style={{ flexShrink: 0 }} />
                        <span style={{
                            color: 'var(--danger-500)',
                            fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)'
                        }}>
                            {error}
                        </span>
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {/* Email Input */}
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: 'var(--spacing-xs)',
                            fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                            fontWeight: 600
                        }}>
                            Email Address
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail
                                size={isMobile ? 18 : 20}
                                style={{
                                    position: 'absolute',
                                    left: 'var(--spacing-md)',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-tertiary)',
                                }}
                            />
                            <input
                                type="email"
                                className="input"
                                placeholder="your.email@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    paddingLeft: '2.5rem',
                                    fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)',
                                    minHeight: isMobile ? '44px' : '48px',
                                }}
                                required
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div>
                        <label style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 'var(--spacing-xs)',
                            fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                            fontWeight: 600
                        }}>
                            <span>Password</span>
                            <button
                                type="button"
                                onClick={() => setShowResetModal(true)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--primary-400)',
                                    cursor: 'pointer',
                                    fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                                    padding: 0,
                                }}
                            >
                                Forgot?
                            </button>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock
                                size={isMobile ? 18 : 20}
                                style={{
                                    position: 'absolute',
                                    left: 'var(--spacing-md)',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-tertiary)',
                                }}
                            />
                            <input
                                type="password"
                                className="input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    paddingLeft: '2.5rem',
                                    fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)',
                                    minHeight: isMobile ? '44px' : '48px',
                                }}
                                required
                            />
                        </div>
                    </div>

                    {/* Remember Me */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                        <input
                            type="checkbox"
                            id="remember"
                            style={{
                                width: isMobile ? '16px' : '18px',
                                height: isMobile ? '16px' : '18px',
                                cursor: 'pointer'
                            }}
                        />
                        <label
                            htmlFor="remember"
                            style={{
                                fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer'
                            }}
                        >
                            Remember me for 30 days
                        </label>
                    </div>

                    {/* Login Button */}
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-md)',
                            fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)',
                            fontWeight: 600,
                            minHeight: isMobile ? '44px' : '48px',
                            marginTop: 'var(--spacing-sm)',
                        }}
                    >
                        {loading ? (
                            <span className="animate-pulse">Signing in...</span>
                        ) : (
                            <>
                                <LogIn size={isMobile ? 18 : 20} />
                                Sign In
                            </>
                        )}
                    </button>
                </form>

                {/* Sign Up Link */}
                <div style={{ marginTop: 'var(--spacing-lg)', textAlign: 'center' }}>
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)'
                    }}>
                        Don't have an account?{' '}
                        <a
                            href="/signup"
                            onClick={(e) => {
                                e.preventDefault();
                                navigate('/signup');
                            }}
                            style={{ color: 'var(--primary-400)', textDecoration: 'none', fontWeight: 600 }}
                        >
                            Sign Up
                        </a>
                    </p>
                </div>
            </div>

            {/* Password Reset Modal */}
            {showResetModal && (
                <>
                    {/* Backdrop */}
                    <div
                        onClick={() => setShowResetModal(false)}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.7)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 999,
                            animation: 'fadeIn 0.2s ease-out',
                        }}
                    />

                    {/* Modal */}
                    <div
                        className="card-glass animate-fade-in"
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            maxWidth: isMobile ? 'calc(100% - 32px)' : '450px',
                            width: '100%',
                            padding: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-2xl)',
                            zIndex: 1000,
                        }}
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => setShowResetModal(false)}
                            style={{
                                position: 'absolute',
                                top: 'var(--spacing-sm)',
                                right: 'var(--spacing-sm)',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all var(--transition-base)',
                            }}
                        >
                            <X size={18} color="var(--text-secondary)" />
                        </button>

                        {!resetSent ? (
                            <>
                                {/* Header */}
                                <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
                                    <div style={{
                                        width: isMobile ? '48px' : '60px',
                                        height: isMobile ? '48px' : '60px',
                                        margin: '0 auto var(--spacing-md)',
                                        borderRadius: 'var(--radius-lg)',
                                        background: 'var(--gradient-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Lock size={isMobile ? 24 : 30} color="white" />
                                    </div>
                                    <h2 style={{
                                        fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)',
                                        marginBottom: 'var(--spacing-xs)'
                                    }}>
                                        Reset Password
                                    </h2>
                                    <p style={{
                                        color: 'var(--text-secondary)',
                                        fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)'
                                    }}>
                                        Enter your email and we'll send you a reset link
                                    </p>
                                </div>

                                {/* Reset Form */}
                                <form onSubmit={handlePasswordReset}>
                                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                        <label style={{
                                            display: 'block',
                                            marginBottom: 'var(--spacing-xs)',
                                            fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                                            fontWeight: 600
                                        }}>
                                            Email Address
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <Mail
                                                size={isMobile ? 18 : 20}
                                                style={{
                                                    position: 'absolute',
                                                    left: 'var(--spacing-md)',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    color: 'var(--text-tertiary)',
                                                }}
                                            />
                                            <input
                                                type="email"
                                                className="input"
                                                placeholder="your.email@company.com"
                                                value={resetEmail}
                                                onChange={(e) => setResetEmail(e.target.value)}
                                                style={{
                                                    paddingLeft: '2.5rem',
                                                    fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)',
                                                    minHeight: isMobile ? '44px' : '48px',
                                                }}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        style={{
                                            width: '100%',
                                            padding: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-md)',
                                            fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)',
                                            fontWeight: 600,
                                            minHeight: isMobile ? '44px' : '48px',
                                        }}
                                    >
                                        Send Reset Link
                                    </button>
                                </form>
                            </>
                        ) : (
                            /* Success State */
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-lg) 0' }}>
                                <div className="animate-fade-in" style={{
                                    width: isMobile ? '64px' : '80px',
                                    height: isMobile ? '64px' : '80px',
                                    margin: '0 auto var(--spacing-lg)',
                                    borderRadius: '50%',
                                    background: 'var(--success-100)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <CheckCircle size={isMobile ? 32 : 40} color="var(--success-500)" />
                                </div>
                                <h2 style={{
                                    fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)',
                                    marginBottom: 'var(--spacing-xs)',
                                    color: 'var(--success-500)'
                                }}>
                                    Check Your Email
                                </h2>
                                <p style={{
                                    color: 'var(--text-secondary)',
                                    fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)'
                                }}>
                                    We've sent a password reset link to<br />
                                    <strong style={{ color: 'var(--text-primary)' }}>{resetEmail}</strong>
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
