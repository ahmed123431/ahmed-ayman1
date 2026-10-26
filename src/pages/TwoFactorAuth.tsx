import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Smartphone, Copy, CheckCircle, AlertCircle, Lock } from 'lucide-react';

export default function TwoFactorAuth() {
    const navigate = useNavigate();
    const [step, setStep] = useState<'setup' | 'verify' | 'success'>('setup');
    const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    // Demo secret key and QR code
    const secretKey = 'JBSWY3DPEHPK3PXP';
    const qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/RCM%20Pro:user@example.com?secret=' + secretKey + '&issuer=RCM%20Pro';

    const handleCodeChange = (index: number, value: string) => {
        if (value.length > 1) return;
        if (value && !/^\d+$/.test(value)) return;

        const newCode = [...verificationCode];
        newCode[index] = value;
        setVerificationCode(newCode);

        // Auto-focus next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`code-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
            const prevInput = document.getElementById(`code-${index - 1}`);
            prevInput?.focus();
        }
    };

    const handleVerify = () => {
        const code = verificationCode.join('');
        if (code.length !== 6) {
            setError('Please enter all 6 digits');
            return;
        }

        // Simulate verification (in production, verify with backend)
        if (code === '123456') {
            setError('');
            setStep('success');
            setTimeout(() => {
                navigate('/');
            }, 2000);
        } else {
            setError('Invalid code. Please try again.');
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(secretKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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

            {/* 2FA Setup Card */}
            <div className="card-glass animate-fade-in" style={{
                position: 'relative',
                maxWidth: '500px',
                width: '100%',
                padding: 'var(--spacing-3xl)',
            }}>
                {step === 'setup' && (
                    <>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-2xl)' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                margin: '0 auto var(--spacing-lg)',
                                borderRadius: 'var(--radius-lg)',
                                background: 'var(--gradient-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <Shield size={40} color="white" />
                            </div>
                            <h1 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: 'var(--spacing-sm)' }}>
                                Enable 2FA
                            </h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-base)' }}>
                                Add an extra layer of security to your account
                            </p>
                        </div>

                        {/* Instructions */}
                        <div style={{
                            background: 'rgba(26, 122, 184, 0.1)',
                            border: '1px solid var(--primary-500)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-lg)',
                            marginBottom: 'var(--spacing-xl)',
                        }}>
                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-secondary)',
                                marginBottom: 'var(--spacing-md)',
                            }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Step 1:</strong> Install an authenticator app
                            </p>
                            <div style={{
                                display: 'flex',
                                gap: 'var(--spacing-sm)',
                                flexWrap: 'wrap',
                                marginBottom: 'var(--spacing-lg)',
                            }}>
                                <span style={{
                                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--text-secondary)',
                                }}>
                                    Google Authenticator
                                </span>
                                <span style={{
                                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--text-secondary)',
                                }}>
                                    Microsoft Authenticator
                                </span>
                                <span style={{
                                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--text-secondary)',
                                }}>
                                    Authy
                                </span>
                            </div>
                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-secondary)',
                                margin: 0,
                            }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Step 2:</strong> Scan the QR code or enter the key manually
                            </p>
                        </div>

                        {/* QR Code */}
                        <div style={{
                            textAlign: 'center',
                            marginBottom: 'var(--spacing-xl)',
                        }}>
                            <div style={{
                                display: 'inline-block',
                                padding: 'var(--spacing-md)',
                                background: 'white',
                                borderRadius: 'var(--radius-lg)',
                                marginBottom: 'var(--spacing-md)',
                            }}>
                                <img
                                    src={qrCodeUrl}
                                    alt="2FA QR Code"
                                    style={{
                                        width: '200px',
                                        height: '200px',
                                        display: 'block',
                                    }}
                                />
                            </div>
                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-tertiary)',
                            }}>
                                Scan this QR code with your authenticator app
                            </p>
                        </div>

                        {/* Manual Entry */}
                        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: 'var(--spacing-sm)',
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 600,
                            }}>
                                Or enter this key manually:
                            </label>
                            <div style={{
                                display: 'flex',
                                gap: 'var(--spacing-sm)',
                            }}>
                                <input
                                    type="text"
                                    className="input"
                                    value={secretKey}
                                    readOnly
                                    style={{ flex: 1 }}
                                />
                                <button
                                    onClick={copyToClipboard}
                                    className="btn btn-secondary"
                                    style={{
                                        minWidth: '100px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 'var(--spacing-xs)',
                                    }}
                                >
                                    {copied ? (
                                        <>
                                            <CheckCircle size={18} />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={18} />
                                            Copy
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Next Button */}
                        <button
                            onClick={() => setStep('verify')}
                            className="btn btn-primary"
                            style={{
                                width: '100%',
                                padding: 'var(--spacing-md)',
                            }}
                        >
                            <Smartphone size={20} />
                            Continue to Verification
                        </button>
                    </>
                )}

                {step === 'verify' && (
                    <>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-2xl)' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                margin: '0 auto var(--spacing-lg)',
                                borderRadius: 'var(--radius-lg)',
                                background: 'var(--gradient-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <Lock size={40} color="white" />
                            </div>
                            <h1 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: 'var(--spacing-sm)' }}>
                                Enter Verification Code
                            </h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-base)' }}>
                                Enter the 6-digit code from your authenticator app
                            </p>
                        </div>

                        {/* Code Input */}
                        <div style={{
                            display: 'flex',
                            gap: 'var(--spacing-sm)',
                            justifyContent: 'center',
                            marginBottom: 'var(--spacing-lg)',
                        }}>
                            {verificationCode.map((digit, index) => (
                                <input
                                    key={index}
                                    id={`code-${index}`}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleCodeChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    style={{
                                        width: '50px',
                                        height: '60px',
                                        textAlign: 'center',
                                        fontSize: 'var(--font-size-2xl)',
                                        fontWeight: 'bold',
                                        background: 'var(--bg-tertiary)',
                                        border: `2px solid ${error ? 'var(--danger-500)' : 'var(--border-color)'}`,
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                        transition: 'all var(--transition-base)',
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'var(--primary-500)';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(26, 122, 184, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = error ? 'var(--danger-500)' : 'var(--border-color)';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                />
                            ))}
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="animate-slide-in" style={{
                                padding: 'var(--spacing-md)',
                                background: 'rgba(255, 26, 26, 0.1)',
                                border: '1px solid var(--danger-500)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 'var(--spacing-lg)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-sm)',
                            }}>
                                <AlertCircle size={20} color="var(--danger-500)" />
                                <span style={{ color: 'var(--danger-500)', fontSize: 'var(--font-size-sm)' }}>
                                    {error}
                                </span>
                            </div>
                        )}

                        {/* Demo Hint */}
                        <div style={{
                            background: 'rgba(26, 122, 184, 0.1)',
                            border: '1px solid var(--primary-500)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-md)',
                            marginBottom: 'var(--spacing-lg)',
                            textAlign: 'center',
                        }}>
                            <p style={{
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--text-tertiary)',
                                margin: 0,
                            }}>
                                💡 <strong>Demo:</strong> Use code <strong style={{ color: 'var(--primary-400)' }}>123456</strong> to verify
                            </p>
                        </div>

                        {/* Verify Button */}
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
                            Verify and Enable 2FA
                        </button>

                        {/* Back Button */}
                        <button
                            onClick={() => {
                                setStep('setup');
                                setError('');
                                setVerificationCode(['', '', '', '', '', '']);
                            }}
                            className="btn btn-ghost"
                            style={{
                                width: '100%',
                                padding: 'var(--spacing-md)',
                            }}
                        >
                            ← Back to Setup
                        </button>
                    </>
                )}

                {step === 'success' && (
                    <div className="animate-fade-in" style={{ textAlign: 'center' }}>
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
                            2FA Enabled!
                        </h1>
                        <p style={{
                            color: 'var(--text-secondary)',
                            fontSize: 'var(--font-size-base)',
                            marginBottom: 'var(--spacing-lg)',
                        }}>
                            Your account is now protected with two-factor authentication.<br />
                            Redirecting to dashboard...
                        </p>

                        {/* Backup Codes Section */}
                        <div style={{
                            background: 'rgba(255, 193, 7, 0.1)',
                            border: '1px solid var(--warning-500)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-lg)',
                            textAlign: 'left',
                        }}>
                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-secondary)',
                                marginBottom: 'var(--spacing-sm)',
                            }}>
                                <strong style={{ color: 'var(--warning-500)' }}>⚠️ Important:</strong> Save these backup codes
                            </p>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 'var(--spacing-xs)',
                                fontFamily: 'var(--font-family-mono)',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-primary)',
                            }}>
                                <span>ABCD-1234-EFGH</span>
                                <span>IJKL-5678-MNOP</span>
                                <span>QRST-9012-UVWX</span>
                                <span>YZAB-3456-CDEF</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
