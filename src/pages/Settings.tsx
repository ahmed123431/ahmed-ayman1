import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import GlobalSearch from '../components/GlobalSearch';
import { Settings as SettingsIcon, User, Bell, Shield, Palette, Save, ArrowLeft, Globe, Camera, X, FileText, ChevronDown, PanelLeft, Loader2, Sparkles, Key, CheckCircle2, ExternalLink } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useSidebar } from '../contexts/SidebarContext';
import { useReportSettings, type ReportSections } from '../contexts/ReportSettingsContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { uploadFile, deleteFile, validateFile } from '../lib/storageService';
import { GeminiService } from '../services/GeminiService';

// Toggle switch component
const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
    <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px', flexShrink: 0 }}>
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span style={{
            position: 'absolute',
            cursor: 'pointer',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: checked ? 'var(--primary-500)' : 'var(--gray-600)',
            transition: 'var(--transition-base)',
            borderRadius: '24px',
        }}>
            <span style={{
                position: 'absolute',
                content: '""',
                height: '18px',
                width: '18px',
                left: checked ? '28px' : '3px',
                bottom: '3px',
                background: 'white',
                transition: 'var(--transition-base)',
                borderRadius: '50%',
            }}></span>
        </span>
    </label>
);

export default function Settings() {
    const navigate = useNavigate();
    const { currentUser, updateCurrentUser } = useUser();
    const { language, languages, t, direction } = useLanguage();
    const { isMobile, isPinned, togglePin } = useSidebar();
    const { sections, toggleSection } = useReportSettings();
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Collapsible category state
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
        profile: false,
        geminiAI: true,
        notifications: false,
        appearance: false,
        language: false,
        reportContent: false,
        security: false,
    });

    // Collapsible subcategory state (for Report Content)
    const [expandedSubcategories, setExpandedSubcategories] = useState<Record<string, boolean>>({
        executiveSummary: false,
        technicalAnalysis: false,
        visualData: false,
    });

    const toggleCategory = (key: string) => {
        setExpandedCategories(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleSubcategory = (key: string) => {
        setExpandedSubcategories(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const [name, setName] = useState(currentUser.name);
    const [email, setEmail] = useState(currentUser.email);
    const [role, setRole] = useState(currentUser.role);
    const [avatar, setAvatar] = useState(currentUser.avatar || '');
    // Persist preferences across sessions via localStorage
    const [notifications, setNotifications] = useState(() => localStorage.getItem('rcm_notifications') !== 'false');
    const [emailAlerts, setEmailAlerts] = useState(() => localStorage.getItem('rcm_email_alerts') !== 'false');
    const [theme, setTheme] = useState(() => localStorage.getItem('rcm_theme') || 'light');
    const [isSaving, setIsSaving] = useState(false);

    // Google Gemini AI Agent Configuration State
    const [geminiApiKey, setGeminiApiKey] = useState(() => GeminiService.getApiKey());
    const [geminiModel, setGeminiModel] = useState(() => GeminiService.getModel());
    const [geminiTesting, setGeminiTesting] = useState(false);
    const [geminiSaveMessage, setGeminiSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSaveGeminiConfig = () => {
        GeminiService.setApiKey(geminiApiKey);
        GeminiService.setModel(geminiModel);
        setGeminiSaveMessage({ type: 'success', text: 'Gemini AI Agent configuration saved successfully!' });
        setTimeout(() => setGeminiSaveMessage(null), 4000);
    };

    const handleTestGeminiConnection = async () => {
        setGeminiTesting(true);
        setGeminiSaveMessage(null);
        const result = await GeminiService.testApiKey(geminiApiKey, geminiModel);
        setGeminiTesting(false);
        if (result.valid) {
            setGeminiSaveMessage({ type: 'success', text: 'Connected to Gemini API successfully! Ready for AI insights.' });
        } else {
            setGeminiSaveMessage({ type: 'error', text: `Connection failed: ${result.message}` });
        }
    };


    // Update local state when current user changes (account switch or DB load)
    useEffect(() => {
        setName(currentUser.name);
        setEmail(currentUser.email);
        setRole(currentUser.role);
        setAvatar(currentUser.avatar || '');
    }, [currentUser]);

    // Handle profile image upload to Supabase Storage
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // Validate file before upload
        const validationError = validateFile(file, {
            maxSize: 2 * 1024 * 1024, // 2MB for avatars
            allowedTypes: ['image/*'],
        });
        if (validationError) {
            setUploadMessage({ type: 'error', text: validationError });
            setTimeout(() => setUploadMessage(null), 5000);
            return;
        }

        setAvatarUploading(true);
        setUploadMessage(null);

        try {
            // Delete old avatar if exists
            if (currentUser.avatarPath) {
                await deleteFile(currentUser.avatarPath);
            }

            const result = await uploadFile(file, user.id, 'avatars', {
                maxSize: 2 * 1024 * 1024,
                allowedTypes: ['image/*'],
            });

            if (result.success && result.path) {
                // Update UserContext with the new avatar path (it will generate a signed URL for display)
                await updateCurrentUser({ avatarPath: result.path });

                setUploadMessage({ type: 'success', text: 'Profile picture uploaded successfully!' });
            } else {
                setUploadMessage({ type: 'error', text: result.error || 'Upload failed. Please try again.' });
            }
        } catch (err) {
            setUploadMessage({ type: 'error', text: 'An unexpected error occurred during upload.' });
        } finally {
            setAvatarUploading(false);
            setTimeout(() => setUploadMessage(null), 5000);
        }
    };

    // Remove profile picture
    const handleRemoveAvatar = async () => {
        if (currentUser.avatarPath) {
            await deleteFile(currentUser.avatarPath);
        }
        setAvatar('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        // Clear avatar in profiles table and UserContext
        await updateCurrentUser({ avatar: '', avatarPath: '' });
    };

    // Get initials for avatar fallback
    const getInitials = (userName?: string) => {
        if (!userName || typeof userName !== 'string') return 'RE';
        const parts = userName.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return 'RE';
        return parts
            .map(n => n[0] || '')
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'RE';
    };

    const applyTheme = (selectedTheme: string) => {
        const root = document.documentElement;

        if (selectedTheme === 'light') {
            // Light theme colors (Primary - Default)
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f7fafc');
            root.style.setProperty('--bg-tertiary', '#e2e8f0');
            root.style.setProperty('--bg-elevated', '#ffffff');
            root.style.setProperty('--bg-card', '#ffffff');
            root.style.setProperty('--bg-card-hover', '#f0f4f8');
            root.style.setProperty('--text-primary', '#1a202c');
            root.style.setProperty('--text-secondary', '#2d3748');
            root.style.setProperty('--text-tertiary', '#4a5568');
            root.style.setProperty('--text-disabled', '#a0aec0');
            root.style.setProperty('--text-muted', '#718096');
            root.style.setProperty('--border-color', '#cbd5e0');
            root.style.setProperty('--border-subtle', 'rgba(0, 0, 0, 0.08)');
            root.style.setProperty('--gray-800', '#2d3748');
            root.style.setProperty('--gray-700', '#4a5568');
            root.style.setProperty('--gray-600', '#718096');
            root.style.setProperty('--shadow-sm', '0 1px 2px 0 rgba(0, 0, 0, 0.06)');
            root.style.setProperty('--shadow-md', '0 4px 12px -2px rgba(0, 0, 0, 0.1)');
            root.style.setProperty('--shadow-lg', '0 12px 32px -4px rgba(0, 0, 0, 0.12)');
            root.style.setProperty('--shadow-xl', '0 24px 48px -8px rgba(0, 0, 0, 0.15)');
            root.style.setProperty('--shadow-card', '0 1px 3px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)');
            root.style.setProperty('--shadow-card-hover', '0 12px 40px rgba(0, 0, 0, 0.12)');
            root.style.setProperty('--gradient-hero', 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 50%, #e2e8f0 100%)');
            root.style.setProperty('--gradient-glass', 'linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.4) 100%)');

            console.log('✅ Light theme applied');
        } else if (selectedTheme === 'dark') {
            // Dark theme colors (Secondary)
            root.style.setProperty('--bg-primary', '#0a0a0a');
            root.style.setProperty('--bg-secondary', '#121212');
            root.style.setProperty('--bg-tertiary', '#181818');
            root.style.setProperty('--bg-elevated', '#1e1e1e');
            root.style.setProperty('--bg-card', '#181818');
            root.style.setProperty('--bg-card-hover', '#222222');
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#b0b0b0');
            root.style.setProperty('--text-tertiary', '#707070');
            root.style.setProperty('--text-disabled', '#404040');
            root.style.setProperty('--text-muted', '#555555');
            root.style.setProperty('--border-color', '#2a2a2a');
            root.style.setProperty('--border-subtle', 'rgba(255, 255, 255, 0.06)');
            root.style.setProperty('--gray-800', '#1e1e1e');
            root.style.setProperty('--gray-700', '#282828');
            root.style.setProperty('--gray-600', '#3a3a3a');
            root.style.setProperty('--shadow-sm', '0 1px 2px 0 rgba(0, 0, 0, 0.4)');
            root.style.setProperty('--shadow-md', '0 4px 12px -2px rgba(0, 0, 0, 0.5)');
            root.style.setProperty('--shadow-lg', '0 12px 32px -4px rgba(0, 0, 0, 0.6)');
            root.style.setProperty('--shadow-xl', '0 24px 48px -8px rgba(0, 0, 0, 0.7)');
            root.style.setProperty('--shadow-card', '0 0 0 1px rgba(255, 255, 255, 0.04)');
            root.style.setProperty('--shadow-card-hover', '0 12px 40px rgba(0, 0, 0, 0.5)');
            root.style.setProperty('--gradient-hero', 'linear-gradient(135deg, #0a0a0a 0%, #181818 50%, #121212 100%)');
            root.style.setProperty('--gradient-glass', 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)');

            console.log('🌙 Dark theme applied');
        } else {
            // Auto - use system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(prefersDark ? 'dark' : 'light');
            console.log(`💻 Auto theme applied (${prefersDark ? 'dark' : 'light'})`);
        }
    };

    // Apply theme when it changes
    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Sync profile to Supabase
            await updateCurrentUser({ name, email, role, avatar });

            // Persist UI preferences to localStorage
            localStorage.setItem('rcm_theme', theme);
            localStorage.setItem('rcm_notifications', String(notifications));
            localStorage.setItem('rcm_email_alerts', String(emailAlerts));

            setUploadMessage({ type: 'success', text: 'Settings saved successfully!' });
        } catch (err) {
            console.error('Save settings error:', err);
            setUploadMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
        } finally {
            setIsSaving(false);
            setTimeout(() => setUploadMessage(null), 5000);
        }
    };

    const getThemeLabel = () => {
        if (theme === 'dark') return t('settings.darkModeActive');
        if (theme === 'light') return t('settings.lightModeActive');
        return t('settings.followingSystem');
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
                        justifyContent: 'space-between',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-sm)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                            <button onClick={() => navigate('/')} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}>
                                <ArrowLeft size={20} />
                            </button>
                            <h1 style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-sm)',
                                margin: 0,
                                fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)'
                            }}>
                                <SettingsIcon size={isMobile ? 24 : 32} color="var(--primary-500)" />
                                {t('settings.title')}
                            </h1>
                        </div>
                        <GlobalSearch pageType="settings" />
                    </div>
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-lg)',
                        marginLeft: direction === 'rtl' ? 0 : 'calc(40px + var(--spacing-md))',
                        marginRight: direction === 'rtl' ? 'calc(40px + var(--spacing-md))' : 0
                    }}>
                        {t('settings.subtitle')}
                    </p>
                </div>

                {/* Settings Sections */}
                <div style={{ maxWidth: '800px' }}>
                    {/* Profile Settings */}
                    <div className="card animate-slide-in" style={{ marginBottom: 'var(--spacing-lg)', animationDelay: '100ms' }}>
                        <h3
                            onClick={() => toggleCategory('profile')}
                            style={{
                                marginBottom: expandedCategories.profile ? 'var(--spacing-lg)' : '0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                cursor: 'pointer',
                                userSelect: 'none',
                                transition: 'margin-bottom 0.3s ease',
                            }}
                        >
                            <User size={isMobile ? 20 : 24} color="var(--primary-500)" />
                            <span style={{ flex: 1 }}>{t('settings.profile')}</span>
                            <ChevronDown
                                size={20}
                                color="var(--text-tertiary)"
                                style={{
                                    transition: 'transform 0.3s ease',
                                    transform: expandedCategories.profile ? 'rotate(0deg)' : 'rotate(-90deg)',
                                }}
                            />
                        </h3>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--spacing-md)',
                            maxHeight: expandedCategories.profile ? '2000px' : '0',
                            overflow: 'hidden',
                            opacity: expandedCategories.profile ? 1 : 0,
                            transition: 'max-height 0.4s ease, opacity 0.3s ease',
                        }}>
                            {/* Profile Picture Section */}
                            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    {t('settings.profilePicture') || 'Profile Picture'}
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
                                    {/* Avatar Preview */}
                                    <div style={{ position: 'relative' }}>
                                        <div
                                            style={{
                                                width: isMobile ? '80px' : '100px',
                                                height: isMobile ? '80px' : '100px',
                                                borderRadius: '50%',
                                                background: 'var(--gradient-primary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)',
                                                fontWeight: '700',
                                                color: 'white',
                                                overflow: 'hidden',
                                                border: '3px solid var(--border-color)',
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
                                                getInitials(name)
                                            )}
                                        </div>
                                        {/* Camera Overlay */}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            style={{
                                                position: 'absolute',
                                                bottom: '0',
                                                right: '0',
                                                width: '32px',
                                                height: '32px',
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
                                            <Camera size={16} color="white" />
                                        </button>
                                    </div>

                                    {/* Upload Controls */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="btn btn-secondary"
                                            style={{ fontSize: 'var(--font-size-sm)' }}
                                        >
                                            <Camera size={16} />
                                            {avatar ? (t('settings.changePicture') || 'Change Picture') : (t('settings.uploadPicture') || 'Upload Picture')}
                                        </button>
                                        {avatar && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveAvatar}
                                                className="btn btn-ghost"
                                                style={{
                                                    fontSize: 'var(--font-size-sm)',
                                                    color: 'var(--danger-500)',
                                                }}
                                            >
                                                <X size={16} />
                                                {t('settings.removePicture') || 'Remove'}
                                            </button>
                                        )}
                                        {avatarUploading && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', color: 'var(--primary-500)' }}>
                                                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                                <span style={{ fontSize: 'var(--font-size-xs)' }}>Uploading...</span>
                                            </div>
                                        )}
                                        {uploadMessage && (
                                            <p style={{
                                                fontSize: 'var(--font-size-xs)',
                                                color: uploadMessage.type === 'success' ? 'var(--success-500)' : 'var(--danger-500)',
                                                margin: 0,
                                                fontWeight: 500,
                                            }}>
                                                {uploadMessage.text}
                                            </p>
                                        )}
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                                            {t('settings.pictureHint') || 'JPG, PNG or GIF. Max 2MB.'}
                                        </p>
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

                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    {t('settings.fullName')}
                                </label>
                                <input
                                    type="text"
                                    className="input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t('settings.fullName')}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    {t('settings.email')}
                                </label>
                                <input
                                    type="email"
                                    className="input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your.email@company.com"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    {t('settings.role')}
                                </label>
                                <select
                                    className="select"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                >
                                    <option value="Maintenance Engineer">Maintenance Engineer</option>
                                    <option value="Maintenance Manager">Maintenance Manager</option>
                                    <option value="RCM Analyst">RCM Analyst</option>
                                    <option value="Technician">Technician</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Google Gemini AI Agent Configuration */}
                    <div className="card animate-slide-in" style={{ marginBottom: 'var(--spacing-lg)', animationDelay: '120ms', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
                        <h3
                            onClick={() => toggleCategory('geminiAI')}
                            style={{
                                marginBottom: expandedCategories.geminiAI ? 'var(--spacing-lg)' : '0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                cursor: 'pointer',
                                userSelect: 'none',
                                transition: 'margin-bottom 0.3s ease',
                            }}
                        >
                            <Sparkles size={isMobile ? 20 : 24} color="#0ea5e9" />
                            <span style={{ flex: 1 }}>Google Gemini AI Agent</span>
                            <div style={{
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--bg-tertiary)',
                                transform: expandedCategories.geminiAI ? 'rotate(0deg)' : 'rotate(-90deg)',
                                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}>
                                <ChevronDown size={18} />
                            </div>
                        </h3>

                        <div style={{
                            maxHeight: expandedCategories.geminiAI ? '1000px' : '0',
                            overflow: 'hidden',
                            opacity: expandedCategories.geminiAI ? 1 : 0,
                            transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
                        }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-lg)' }}>
                                Connect your Google Gemini API key to enable intelligent AI maintenance insights grounded in your project assets, FMEA, tasks, and operating costs.
                            </p>

                            {geminiSaveMessage && (
                                <div style={{
                                    padding: 'var(--spacing-sm) var(--spacing-md)',
                                    marginBottom: 'var(--spacing-md)',
                                    borderRadius: 'var(--radius-md)',
                                    background: geminiSaveMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    border: `1px solid ${geminiSaveMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
                                    color: geminiSaveMessage.type === 'success' ? '#10b981' : '#ef4444',
                                    fontSize: 'var(--font-size-sm)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    {geminiSaveMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                    <span>{geminiSaveMessage.text}</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                {/* API Key Input */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                        Gemini API Key
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="password"
                                            className="input"
                                            placeholder="AIzaSy..."
                                            value={geminiApiKey}
                                            onChange={(e) => setGeminiApiKey(e.target.value)}
                                            style={{ width: '100%', fontFamily: 'monospace' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>
                                            Key is stored securely in your browser's local environment.
                                        </span>
                                        <a
                                            href="https://aistudio.google.com/app/apikey"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: 'var(--primary-500)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                                        >
                                            Get Free Gemini Key <ExternalLink size={12} />
                                        </a>
                                    </div>
                                </div>

                                {/* Model Selector */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                        Gemini Model
                                    </label>
                                    <select
                                        className="select"
                                        value={geminiModel}
                                        onChange={(e) => setGeminiModel(e.target.value)}
                                    >
                                        <option value="gemini-3.5-flash">gemini-3.5-flash (Recommended - Fast & Reliable)</option>
                                        <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Ultra Low Latency)</option>
                                        <option value="gemini-3.8-flash">gemini-3.8-flash (Latest Generation)</option>
                                    </select>
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        onClick={handleSaveGeminiConfig}
                                        className="btn btn-primary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Save size={16} />
                                        Save Configuration
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleTestGeminiConnection}
                                        disabled={geminiTesting || !geminiApiKey.trim()}
                                        className="btn btn-ghost"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            border: '1px solid var(--border-color)'
                                        }}
                                    >
                                        {geminiTesting ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                                        {geminiTesting ? 'Testing Connection...' : 'Test Connection'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="card animate-slide-in" style={{ marginBottom: 'var(--spacing-lg)', animationDelay: '150ms' }}>
                        <h3
                            onClick={() => toggleCategory('notifications')}
                            style={{
                                marginBottom: expandedCategories.notifications ? 'var(--spacing-lg)' : '0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                cursor: 'pointer',
                                userSelect: 'none',
                                transition: 'margin-bottom 0.3s ease',
                            }}
                        >
                            <Bell size={isMobile ? 20 : 24} color="var(--warning-500)" />
                            <span style={{ flex: 1 }}>{t('settings.notifications')}</span>
                            <ChevronDown
                                size={20}
                                color="var(--text-tertiary)"
                                style={{
                                    transition: 'transform 0.3s ease',
                                    transform: expandedCategories.notifications ? 'rotate(0deg)' : 'rotate(-90deg)',
                                }}
                            />
                        </h3>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--spacing-md)',
                            maxHeight: expandedCategories.notifications ? '2000px' : '0',
                            overflow: 'hidden',
                            opacity: expandedCategories.notifications ? 1 : 0,
                            transition: 'max-height 0.4s ease, opacity 0.3s ease',
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 'var(--spacing-md)',
                                padding: 'var(--spacing-md)',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{ fontSize: 'var(--font-size-base)', margin: 0, marginBottom: '0.25rem' }}>
                                        {t('settings.pushNotifications')}
                                    </h4>
                                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                                        {t('settings.pushNotificationsDesc')}
                                    </p>
                                </div>
                                <ToggleSwitch checked={notifications} onChange={setNotifications} />
                            </div>

                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 'var(--spacing-md)',
                                padding: 'var(--spacing-md)',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{ fontSize: 'var(--font-size-base)', margin: 0, marginBottom: '0.25rem' }}>
                                        {t('settings.emailAlerts')}
                                    </h4>
                                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                                        {t('settings.emailAlertsDesc')}
                                    </p>
                                </div>
                                <ToggleSwitch checked={emailAlerts} onChange={setEmailAlerts} />
                            </div>
                        </div>
                    </div>

                    {/* Display */}
                    <div className="card animate-slide-in" style={{ marginBottom: 'var(--spacing-lg)', animationDelay: '200ms' }}>
                        <h3
                            onClick={() => toggleCategory('appearance')}
                            style={{
                                marginBottom: expandedCategories.appearance ? 'var(--spacing-lg)' : '0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                cursor: 'pointer',
                                userSelect: 'none',
                                transition: 'margin-bottom 0.3s ease',
                            }}
                        >
                            <Palette size={isMobile ? 20 : 24} color="var(--accent-500)" />
                            <span style={{ flex: 1 }}>{t('settings.appearance')}</span>
                            <ChevronDown
                                size={20}
                                color="var(--text-tertiary)"
                                style={{
                                    transition: 'transform 0.3s ease',
                                    transform: expandedCategories.appearance ? 'rotate(0deg)' : 'rotate(-90deg)',
                                }}
                            />
                        </h3>
                        <div style={{
                            maxHeight: expandedCategories.appearance ? '2000px' : '0',
                            overflow: 'hidden',
                            opacity: expandedCategories.appearance ? 1 : 0,
                            transition: 'max-height 0.4s ease, opacity 0.3s ease',
                        }}>
                            <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                {t('settings.theme')}
                            </label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                                gap: 'var(--spacing-sm)'
                            }}>
                                <button
                                    className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setTheme('dark')}
                                    style={{ justifyContent: 'center' }}
                                >
                                    🌙 {t('settings.dark')}
                                </button>
                                <button
                                    className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setTheme('light')}
                                    style={{ justifyContent: 'center' }}
                                >
                                    ☀️ {t('settings.light')}
                                </button>
                                <button
                                    className={`btn ${theme === 'auto' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setTheme('auto')}
                                    style={{ justifyContent: 'center' }}
                                >
                                    💻 {t('settings.auto')}
                                </button>
                            </div>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--spacing-sm)' }}>
                                {t('settings.currentTheme')}: <strong>{t(`settings.${theme}`)}</strong> ({getThemeLabel()})
                            </p>

                            {/* Pin Sidebar Toggle */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 'var(--spacing-md)',
                                padding: 'var(--spacing-md)',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                                marginTop: 'var(--spacing-lg)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flex: 1, minWidth: 0 }}>
                                    <PanelLeft size={20} color="var(--primary-500)" />
                                    <div>
                                        <h4 style={{ fontSize: 'var(--font-size-base)', margin: 0, marginBottom: '0.25rem' }}>
                                            {t('settings.pinSidebar')}
                                        </h4>
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                                            {t('settings.pinSidebarDesc')}
                                        </p>
                                    </div>
                                </div>
                                <ToggleSwitch checked={isPinned} onChange={() => togglePin()} />
                            </div>
                        </div>
                    </div>

                    {/* Language Settings */}
                    <div className="card animate-slide-in" style={{ marginBottom: 'var(--spacing-lg)', animationDelay: '225ms' }}>
                        <h3
                            onClick={() => toggleCategory('language')}
                            style={{
                                marginBottom: expandedCategories.language ? 'var(--spacing-lg)' : '0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                cursor: 'pointer',
                                userSelect: 'none',
                                transition: 'margin-bottom 0.3s ease',
                            }}
                        >
                            <Globe size={isMobile ? 20 : 24} color="var(--primary-500)" />
                            <span style={{ flex: 1 }}>{t('settings.language')}</span>
                            <ChevronDown
                                size={20}
                                color="var(--text-tertiary)"
                                style={{
                                    transition: 'transform 0.3s ease',
                                    transform: expandedCategories.language ? 'rotate(0deg)' : 'rotate(-90deg)',
                                }}
                            />
                        </h3>
                        <div style={{
                            maxHeight: expandedCategories.language ? '2000px' : '0',
                            overflow: expandedCategories.language ? 'visible' : 'hidden',
                            opacity: expandedCategories.language ? 1 : 0,
                            transition: 'max-height 0.4s ease, opacity 0.3s ease',
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-lg)',
                                flexWrap: 'wrap',
                            }}>
                                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, margin: 0, whiteSpace: 'nowrap' }}>
                                    {t('settings.selectLanguage')}
                                </label>
                                <LanguageSwitcher />
                            </div>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--spacing-md)' }}>
                                {t('settings.currentLanguage')}: <strong>{languages.find(l => l.code === language)?.nativeName}</strong> ({language === 'ar' ? t('settings.rtlLayout') : t('settings.ltrLayout')})
                            </p>
                        </div>
                    </div>

                    {/* Report Content Settings */}
                    <div className="card animate-slide-in" style={{ marginBottom: 'var(--spacing-lg)', animationDelay: '275ms' }}>
                        <h3
                            onClick={() => toggleCategory('reportContent')}
                            style={{
                                marginBottom: expandedCategories.reportContent ? 'var(--spacing-md)' : '0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                cursor: 'pointer',
                                userSelect: 'none',
                                transition: 'margin-bottom 0.3s ease',
                            }}
                        >
                            <FileText size={isMobile ? 20 : 24} color="var(--primary-500)" />
                            <span style={{ flex: 1 }}>{t('settings.reportContent')}</span>
                            <ChevronDown
                                size={20}
                                color="var(--text-tertiary)"
                                style={{
                                    transition: 'transform 0.3s ease',
                                    transform: expandedCategories.reportContent ? 'rotate(0deg)' : 'rotate(-90deg)',
                                }}
                            />
                        </h3>
                        <div style={{
                            maxHeight: expandedCategories.reportContent ? '3000px' : '0',
                            overflow: 'hidden',
                            opacity: expandedCategories.reportContent ? 1 : 0,
                            transition: 'max-height 0.4s ease, opacity 0.3s ease',
                        }}>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--spacing-lg)' }}>
                                {t('settings.reportContentDesc')}
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                                {/* Executive Summary Section */}
                                <div>
                                    <h4
                                        onClick={() => toggleSubcategory('executiveSummary')}
                                        style={{
                                            fontSize: 'var(--font-size-base)',
                                            fontWeight: 600,
                                            marginBottom: expandedSubcategories.executiveSummary ? 'var(--spacing-sm)' : '0',
                                            color: 'var(--success-500)',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            transition: 'margin-bottom 0.3s ease',
                                        }}
                                    >
                                        <span style={{ flex: 1 }}>{t('settings.executiveSummarySection')}</span>
                                        <ChevronDown
                                            size={16}
                                            color="var(--text-tertiary)"
                                            style={{
                                                transition: 'transform 0.3s ease',
                                                transform: expandedSubcategories.executiveSummary ? 'rotate(0deg)' : 'rotate(-90deg)',
                                            }}
                                        />
                                    </h4>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--spacing-xs)',
                                        maxHeight: expandedSubcategories.executiveSummary ? '1000px' : '0',
                                        overflow: 'hidden',
                                        opacity: expandedSubcategories.executiveSummary ? 1 : 0,
                                        transition: 'max-height 0.4s ease, opacity 0.3s ease',
                                    }}>
                                        {[
                                            { key: 'keyFindings' as keyof ReportSections, label: 'settings.keyFindings' },
                                            { key: 'criticalIssues' as keyof ReportSections, label: 'settings.criticalIssues' },
                                            { key: 'recommendations' as keyof ReportSections, label: 'settings.recommendations' },
                                            { key: 'costImplications' as keyof ReportSections, label: 'settings.costImplications' },
                                        ].map(item => (
                                            <div key={item.key} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-sm)'
                                            }}>
                                                <span style={{ fontSize: 'var(--font-size-sm)' }}>{t(item.label)}</span>
                                                <ToggleSwitch checked={sections[item.key]} onChange={() => toggleSection(item.key)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Technical Analysis Section */}
                                <div>
                                    <h4
                                        onClick={() => toggleSubcategory('technicalAnalysis')}
                                        style={{
                                            fontSize: 'var(--font-size-base)',
                                            fontWeight: 600,
                                            marginBottom: expandedSubcategories.technicalAnalysis ? 'var(--spacing-sm)' : '0',
                                            color: 'var(--warning-500)',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            transition: 'margin-bottom 0.3s ease',
                                        }}
                                    >
                                        <span style={{ flex: 1 }}>{t('settings.technicalAnalysisSection')}</span>
                                        <ChevronDown
                                            size={16}
                                            color="var(--text-tertiary)"
                                            style={{
                                                transition: 'transform 0.3s ease',
                                                transform: expandedSubcategories.technicalAnalysis ? 'rotate(0deg)' : 'rotate(-90deg)',
                                            }}
                                        />
                                    </h4>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--spacing-xs)',
                                        maxHeight: expandedSubcategories.technicalAnalysis ? '1000px' : '0',
                                        overflow: 'hidden',
                                        opacity: expandedSubcategories.technicalAnalysis ? 1 : 0,
                                        transition: 'max-height 0.4s ease, opacity 0.3s ease',
                                    }}>
                                        {[
                                            { key: 'fmeaTables' as keyof ReportSections, label: 'settings.fmeaTables' },
                                            { key: 'riskClassifications' as keyof ReportSections, label: 'settings.riskClassifications' },
                                            { key: 'maintenanceStrategies' as keyof ReportSections, label: 'settings.maintenanceStrategies' },
                                            { key: 'engineeringJustifications' as keyof ReportSections, label: 'settings.engineeringJustifications' },
                                        ].map(item => (
                                            <div key={item.key} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-sm)'
                                            }}>
                                                <span style={{ fontSize: 'var(--font-size-sm)' }}>{t(item.label)}</span>
                                                <ToggleSwitch checked={sections[item.key]} onChange={() => toggleSection(item.key)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Visual Data Section */}
                                <div>
                                    <h4
                                        onClick={() => toggleSubcategory('visualData')}
                                        style={{
                                            fontSize: 'var(--font-size-base)',
                                            fontWeight: 600,
                                            marginBottom: expandedSubcategories.visualData ? 'var(--spacing-sm)' : '0',
                                            color: 'var(--accent-500)',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            transition: 'margin-bottom 0.3s ease',
                                        }}
                                    >
                                        <span style={{ flex: 1 }}>{t('settings.visualDataSection')}</span>
                                        <ChevronDown
                                            size={16}
                                            color="var(--text-tertiary)"
                                            style={{
                                                transition: 'transform 0.3s ease',
                                                transform: expandedSubcategories.visualData ? 'rotate(0deg)' : 'rotate(-90deg)',
                                            }}
                                        />
                                    </h4>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--spacing-xs)',
                                        maxHeight: expandedSubcategories.visualData ? '1000px' : '0',
                                        overflow: 'hidden',
                                        opacity: expandedSubcategories.visualData ? 1 : 0,
                                        transition: 'max-height 0.4s ease, opacity 0.3s ease',
                                    }}>
                                        {[
                                            { key: 'chartsGraphs' as keyof ReportSections, label: 'settings.chartsGraphs' },
                                            { key: 'riskMatrices' as keyof ReportSections, label: 'settings.riskMatrices' },
                                            { key: 'costBreakdowns' as keyof ReportSections, label: 'settings.costBreakdowns' },
                                            { key: 'trendAnalysis' as keyof ReportSections, label: 'settings.trendAnalysis' },
                                        ].map(item => (
                                            <div key={item.key} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-sm)'
                                            }}>
                                                <span style={{ fontSize: 'var(--font-size-sm)' }}>{t(item.label)}</span>
                                                <ToggleSwitch checked={sections[item.key]} onChange={() => toggleSection(item.key)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Security */}
                    <div className="card animate-slide-in" style={{ marginBottom: 'var(--spacing-lg)', animationDelay: '300ms' }}>
                        <h3
                            onClick={() => toggleCategory('security')}
                            style={{
                                marginBottom: expandedCategories.security ? 'var(--spacing-lg)' : '0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                cursor: 'pointer',
                                userSelect: 'none',
                                transition: 'margin-bottom 0.3s ease',
                            }}
                        >
                            <Shield size={isMobile ? 20 : 24} color="var(--danger-500)" />
                            <span style={{ flex: 1 }}>{t('settings.security')}</span>
                            <ChevronDown
                                size={20}
                                color="var(--text-tertiary)"
                                style={{
                                    transition: 'transform 0.3s ease',
                                    transform: expandedCategories.security ? 'rotate(0deg)' : 'rotate(-90deg)',
                                }}
                            />
                        </h3>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--spacing-sm)',
                            maxHeight: expandedCategories.security ? '2000px' : '0',
                            overflow: 'hidden',
                            opacity: expandedCategories.security ? 1 : 0,
                            transition: 'max-height 0.4s ease, opacity 0.3s ease',
                        }}>
                            <button className="btn btn-secondary" onClick={() => navigate('/change-password')} style={{ justifyContent: 'flex-start' }}>
                                {t('settings.changePassword')}
                            </button>
                            <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                                {t('settings.enable2FA')}
                            </button>
                            <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                                {t('settings.viewSessions')}
                            </button>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="animate-fade-in" style={{ animationDelay: '350ms' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)', padding: 'var(--spacing-md)', opacity: isSaving ? 0.75 : 1 }}
                        >
                            {isSaving
                                ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                : <Save size={20} />}
                            {isSaving ? 'Saving…' : t('settings.save')}
                        </button>
                    </div>
                </div>
            </PageContainer>
        </>
    );
}
