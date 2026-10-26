import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import { Shield, ArrowLeft, Save, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSidebar } from '../contexts/SidebarContext';
import { useUser } from '../contexts/UserContext';

export default function ChangePassword() {
    const navigate = useNavigate();
    const { t, direction } = useLanguage();
    const { isMobile } = useSidebar();
    const { currentUser } = useUser();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('All fields are required.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.');
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        // Simulate password change success
        setTimeout(() => {
            setSuccess('Password changed successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }, 500);
    };

    return (
        <>
            <Sidebar />
            <PageContainer style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-2xl)' }}>
                {/* Header */}
                <div className="animate-fade-in" style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-sm)'
                    }}>
                        <button onClick={() => navigate('/settings')} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}>
                            <ArrowLeft size={20} />
                        </button>
                        <h1 style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                            margin: 0,
                            fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)'
                        }}>
                            <Shield size={isMobile ? 24 : 32} color="var(--primary-500)" />
                            Change Password
                        </h1>
                    </div>
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-lg)',
                        marginLeft: direction === 'rtl' ? 0 : 'calc(40px + var(--spacing-md))',
                        marginRight: direction === 'rtl' ? 'calc(40px + var(--spacing-md))' : 0
                    }}>
                        Update your account password securely.
                    </p>
                </div>

                <div className="card animate-slide-in" style={{ maxWidth: '600px' }}>
                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                        {error && (
                            <div style={{ padding: 'var(--spacing-md)', background: 'var(--danger-100)', color: 'var(--danger-700)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
                                {error}
                            </div>
                        )}
                        {success && (
                            <div style={{ padding: 'var(--spacing-md)', background: 'var(--success-100)', color: 'var(--success-700)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
                                {success}
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                Current Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showCurrent ? "text" : "password"}
                                    className="input"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{ width: '100%', paddingRight: direction === 'rtl' ? 'var(--spacing-md)' : '40px', paddingLeft: direction === 'rtl' ? '40px' : 'var(--spacing-md)' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrent(!showCurrent)}
                                    style={{
                                        position: 'absolute',
                                        right: direction === 'rtl' ? 'auto' : '10px',
                                        left: direction === 'rtl' ? '10px' : 'auto',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-tertiary)',
                                        padding: 0,
                                        display: 'flex'
                                    }}
                                >
                                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                New Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showNew ? "text" : "password"}
                                    className="input"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{ width: '100%', paddingRight: direction === 'rtl' ? 'var(--spacing-md)' : '40px', paddingLeft: direction === 'rtl' ? '40px' : 'var(--spacing-md)' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(!showNew)}
                                    style={{
                                        position: 'absolute',
                                        right: direction === 'rtl' ? 'auto' : '10px',
                                        left: direction === 'rtl' ? '10px' : 'auto',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-tertiary)',
                                        padding: 0,
                                        display: 'flex'
                                    }}
                                >
                                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                Confirm New Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showConfirm ? "text" : "password"}
                                    className="input"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{ width: '100%', paddingRight: direction === 'rtl' ? 'var(--spacing-md)' : '40px', paddingLeft: direction === 'rtl' ? '40px' : 'var(--spacing-md)' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    style={{
                                        position: 'absolute',
                                        right: direction === 'rtl' ? 'auto' : '10px',
                                        left: direction === 'rtl' ? '10px' : 'auto',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-tertiary)',
                                        padding: 0,
                                        display: 'flex'
                                    }}
                                >
                                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)' }}
                            >
                                <Save size={18} />
                                {t('settings.save')}
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => navigate('/settings')}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </form>
                </div>
            </PageContainer>
        </>
    );
}
