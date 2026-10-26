import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, Building, AlertCircle, CheckCircle, Camera, X, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { uploadFile, validateFile } from '../lib/storageService';
import RCM7QLogo from '../components/RCM7QLogo';


// Password strength calculation
const calculatePasswordStrength = (password: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    if (/[a-z]/.test(password)) score += 20;
    if (/[A-Z]/.test(password)) score += 20;
    if (/[0-9]/.test(password)) score += 15;
    if (/[^a-zA-Z0-9]/.test(password)) score += 15;

    let label = 'Weak';
    let color = 'var(--danger-500)';
    if (score >= 70) {
        label = 'Strong';
        color = 'var(--success-500)';
    } else if (score >= 50) {
        label = 'Medium';
        color = 'var(--warning-500)';
    }

    return { score, label, color };
};

export default function SignUp() {
    const navigate = useNavigate();
    const { signUp, session } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        company: '',
        password: '',
        confirmPassword: '',
    });
    const [avatar, setAvatar] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile screen
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Calculate password strength
    const passwordStrength = useMemo(
        () => calculatePasswordStrength(formData.password),
        [formData.password]
    );

    // Handle profile image upload - preview locally, upload to Storage on submit
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file
            const validationError = validateFile(file, {
                maxSize: 2 * 1024 * 1024, // 2MB for avatars
                allowedTypes: ['image/*'],
            });
            if (validationError) {
                setError(validationError);
                return;
            }

            // Store file reference for upload on submit
            setAvatarFile(file);

            // Show local preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatar(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Remove profile picture
    const handleRemoveAvatar = () => {
        setAvatar('');
        setAvatarFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Get initials for avatar fallback
    const getInitials = (userName: string) => {
        return userName
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'U';
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Validation
        if (!formData.name || !formData.email || !formData.password) {
            setError('Please fill in all required fields');
            setLoading(false);
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            setLoading(false);
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            const { error } = await signUp(formData.email, formData.password, {
                full_name: formData.name,
                company: formData.company,
            });

            if (error) {
                setError(error.message);
            } else {
                // Upload avatar to Supabase Storage if one was selected
                // Also update profile with name and company
                try {
                    const { data: { user: newUser } } = await supabase.auth.getUser();
                    if (newUser) {
                        // Update profile with name and company
                        await supabase.from('profiles').update({
                            full_name: formData.name,
                            company: formData.company || null,
                        }).eq('id', newUser.id);

                        // Upload avatar if selected
                        if (avatarFile) {
                            const result = await uploadFile(avatarFile, newUser.id, 'avatars', {
                                maxSize: 2 * 1024 * 1024,
                                allowedTypes: ['image/*'],
                            });
                            if (result.success && result.publicUrl) {
                                await supabase.from('profiles').update({ avatar_url: result.publicUrl }).eq('id', newUser.id);
                            }
                        }
                    }
                } catch (profileErr) {
                    console.error('Profile update during signup failed:', profileErr);
                    // Don't block signup for profile update failure
                }
                navigate('/');
            }
        } catch (err) {
            setError('An unexpected error occurred during signup.');
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
            setError('An unexpected error occurred during Google sign-up.');
            setLoading(false);
        }
    };

    const updateField = (field: keyof typeof formData, value: string) => {
        setFormData({ ...formData, [field]: value });
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

            {/* Sign Up Card */}
            <div className="card-glass animate-fade-in" style={{
                position: 'relative',
                maxWidth: isMobile ? '100%' : '500px',
                width: '100%',
                padding: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-2xl)',
                maxHeight: isMobile ? 'calc(100vh - 32px)' : '90vh',
                overflowY: 'auto',
                borderRadius: isMobile ? 'var(--radius-xl)' : 'var(--radius-2xl)',
            }}>
                {/* Logo/Header */}
                <div style={{ textAlign: 'center', marginBottom: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-xl)' }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: 'var(--spacing-md)',
                    }}>
                        <RCM7QLogo size={isMobile ? 64 : 80} />
                    </div>
                    <h1 style={{
                        fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)',
                        marginBottom: 'var(--spacing-xs)'
                    }}>
                        Create Account
                    </h1>
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)'
                    }}>
                        Get started with RCM7Q
                    </p>
                </div>

                {/* Social Login Buttons */}
                <div style={{ marginBottom: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
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
                            minHeight: isMobile ? '42px' : '48px',
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

                    {/* Divider */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        margin: isMobile ? 'var(--spacing-md) 0' : 'var(--spacing-lg) 0',
                    }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                        <span style={{
                            color: 'var(--text-tertiary)',
                            fontSize: 'var(--font-size-xs)'
                        }}>
                            or sign up with email
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
                        <AlertCircle size={16} color="var(--danger-500)" style={{ flexShrink: 0 }} />
                        <span style={{
                            color: 'var(--danger-500)',
                            fontSize: 'var(--font-size-xs)'
                        }}>
                            {error}
                        </span>
                    </div>
                )}

                {/* Sign Up Form */}
                <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-md)' }}>
                    {/* Profile Picture Section */}
                    <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: 'var(--spacing-xs)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600
                        }}>
                            Profile Picture (Optional)
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                            {/* Avatar Preview */}
                            <div style={{ position: 'relative' }}>
                                <div
                                    style={{
                                        width: isMobile ? '60px' : '72px',
                                        height: isMobile ? '60px' : '72px',
                                        borderRadius: '50%',
                                        background: 'var(--gradient-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)',
                                        fontWeight: '700',
                                        color: 'white',
                                        overflow: 'hidden',
                                        border: '2px solid var(--border-color)',
                                    }}
                                >
                                    {avatar ? (
                                        <img
                                            src={avatar}
                                            alt="Profile"
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                            }}
                                        />
                                    ) : (
                                        getInitials(formData.name || 'U')
                                    )}
                                </div>
                                {/* Camera Overlay */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        position: 'absolute',
                                        bottom: '-2px',
                                        right: '-2px',
                                        width: '26px',
                                        height: '26px',
                                        borderRadius: '50%',
                                        background: 'var(--primary-500)',
                                        border: '2px solid var(--bg-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <Camera size={12} color="white" />
                                </button>
                            </div>

                            {/* Upload Controls */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                        fontSize: 'var(--font-size-xs)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-xs)',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <Camera size={14} />
                                    {avatar ? 'Change' : 'Upload'}
                                </button>
                                {avatar && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveAvatar}
                                        style={{
                                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--danger-500)',
                                            fontSize: 'var(--font-size-xs)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-xs)',
                                        }}
                                    >
                                        <X size={14} />
                                        Remove
                                    </button>
                                )}
                            </div>

                            {/* Hidden File Input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                onChange={handleImageUpload}
                                style={{ display: 'none' }}
                            />
                        </div>
                    </div>

                    {/* Full Name */}
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: 'var(--spacing-xs)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600
                        }}>
                            Full Name *
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User
                                size={isMobile ? 16 : 18}
                                style={{
                                    position: 'absolute',
                                    left: 'var(--spacing-sm)',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-tertiary)',
                                }}
                            />
                            <input
                                type="text"
                                className="input"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={(e) => updateField('name', e.target.value)}
                                style={{
                                    paddingLeft: '2.25rem',
                                    fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)',
                                    minHeight: isMobile ? '40px' : '44px',
                                }}
                                required
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: 'var(--spacing-xs)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600
                        }}>
                            Email Address *
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail
                                size={isMobile ? 16 : 18}
                                style={{
                                    position: 'absolute',
                                    left: 'var(--spacing-sm)',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-tertiary)',
                                }}
                            />
                            <input
                                type="email"
                                className="input"
                                placeholder="your.email@company.com"
                                value={formData.email}
                                onChange={(e) => updateField('email', e.target.value)}
                                style={{
                                    paddingLeft: '2.25rem',
                                    fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)',
                                    minHeight: isMobile ? '40px' : '44px',
                                }}
                                required
                            />
                        </div>
                    </div>

                    {/* Company */}
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: 'var(--spacing-xs)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600
                        }}>
                            Company Name
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Building
                                size={isMobile ? 16 : 18}
                                style={{
                                    position: 'absolute',
                                    left: 'var(--spacing-sm)',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-tertiary)',
                                }}
                            />
                            <input
                                type="text"
                                className="input"
                                placeholder="Acme Corporation"
                                value={formData.company}
                                onChange={(e) => updateField('company', e.target.value)}
                                style={{
                                    paddingLeft: '2.25rem',
                                    fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)',
                                    minHeight: isMobile ? '40px' : '44px',
                                }}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: 'var(--spacing-xs)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600
                        }}>
                            Password *
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock
                                size={isMobile ? 16 : 18}
                                style={{
                                    position: 'absolute',
                                    left: 'var(--spacing-sm)',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-tertiary)',
                                }}
                            />
                            <input
                                type="password"
                                className="input"
                                placeholder="Min. 6 characters"
                                value={formData.password}
                                onChange={(e) => updateField('password', e.target.value)}
                                style={{
                                    paddingLeft: '2.25rem',
                                    fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)',
                                    minHeight: isMobile ? '40px' : '44px',
                                }}
                                required
                                minLength={6}
                            />
                        </div>

                        {/* Password Strength Indicator */}
                        {formData.password && (
                            <div style={{ marginTop: 'var(--spacing-xs)' }}>
                                {/* Strength Bar */}
                                <div style={{
                                    width: '100%',
                                    height: '3px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-full)',
                                    overflow: 'hidden',
                                    marginBottom: '2px',
                                }}>
                                    <div
                                        style={{
                                            width: `${passwordStrength.score}%`,
                                            height: '100%',
                                            background: passwordStrength.color,
                                            transition: 'all var(--transition-base)',
                                        }}
                                    />
                                </div>

                                {/* Strength Label */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}>
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        color: passwordStrength.color,
                                        fontWeight: 600,
                                    }}>
                                        {passwordStrength.label}
                                    </span>
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--text-tertiary)',
                                    }}>
                                        {passwordStrength.score}%
                                    </span>
                                </div>

                                {/* Strength Tips - hide on mobile to save space */}
                                {!isMobile && passwordStrength.score < 70 && (
                                    <div style={{
                                        marginTop: 'var(--spacing-xs)',
                                        padding: 'var(--spacing-xs)',
                                        background: 'rgba(26, 122, 184, 0.1)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--text-tertiary)',
                                    }}>
                                        💡 Use 12+ characters, mix uppercase, lowercase, numbers & symbols
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: 'var(--spacing-xs)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600
                        }}>
                            Confirm Password *
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock
                                size={isMobile ? 16 : 18}
                                style={{
                                    position: 'absolute',
                                    left: 'var(--spacing-sm)',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-tertiary)',
                                }}
                            />
                            <input
                                type="password"
                                className="input"
                                placeholder="Re-enter password"
                                value={formData.confirmPassword}
                                onChange={(e) => updateField('confirmPassword', e.target.value)}
                                style={{
                                    paddingLeft: '2.25rem',
                                    fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)',
                                    minHeight: isMobile ? '40px' : '44px',
                                }}
                                required
                            />
                        </div>
                        {formData.password && formData.confirmPassword && (
                            <div style={{ marginTop: 'var(--spacing-xs)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                                {formData.password === formData.confirmPassword ? (
                                    <>
                                        <CheckCircle size={14} color="var(--success-500)" />
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success-500)' }}>
                                            Passwords match
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle size={14} color="var(--danger-500)" />
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger-500)' }}>
                                            Passwords don't match
                                        </span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Terms & Conditions */}
                    <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--spacing-sm)' }}>
                        <input
                            type="checkbox"
                            id="terms"
                            required
                            style={{
                                marginTop: '2px',
                                width: isMobile ? '16px' : '18px',
                                height: isMobile ? '16px' : '18px',
                                cursor: 'pointer',
                                flexShrink: 0
                            }}
                        />
                        <label htmlFor="terms" style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            lineHeight: 1.4
                        }}>
                            I agree to the{' '}
                            <a href="#" style={{ color: 'var(--primary-400)', textDecoration: 'none' }}>
                                Terms of Service
                            </a>
                            {' '}and{' '}
                            <a href="#" style={{ color: 'var(--primary-400)', textDecoration: 'none' }}>
                                Privacy Policy
                            </a>
                        </label>
                    </div>

                    {/* Sign Up Button */}
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-md)',
                            fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)',
                            fontWeight: 600,
                            marginTop: 'var(--spacing-xs)',
                            minHeight: isMobile ? '42px' : '48px',
                        }}
                    >
                        {loading ? (
                            <span className="animate-pulse">Creating account...</span>
                        ) : (
                            <>
                                <UserPlus size={isMobile ? 18 : 20} />
                                Create Account
                            </>
                        )}
                    </button>
                </form>

                {/* Login Link */}
                <div style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--font-size-xs)'
                    }}>
                        Already have an account?{' '}
                        <a
                            href="/login"
                            onClick={(e) => {
                                e.preventDefault();
                                navigate('/login');
                            }}
                            style={{ color: 'var(--primary-400)', textDecoration: 'none', fontWeight: 600 }}
                        >
                            Sign In
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
