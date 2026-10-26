import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import RCM7QLogo from './RCM7QLogo';
import {
    Home,
    LayoutDashboard,
    RefreshCw,
    AlertTriangle,
    Wrench,
    ClipboardList,
    DollarSign,
    BarChart3,
    Settings,
    LogOut,
    Check,
    Menu,
    X,
    UserPlus,
    Users,
    ShieldAlert
} from 'lucide-react';
import { AlertsEngine } from '../services/AlertsEngine';

interface SidebarItem {
    id: string;
    icon: React.ReactNode;
    label: string;
    path: string;
    badge?: number;
}

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        isExpanded,
        setIsExpanded,
        isMobile,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        toggleMobileMenu,
        isPinned
    } = useSidebar();
    const { signOut } = useAuth();
    const { currentUser, accounts, switchAccount } = useUser();
    const { t, direction } = useLanguage();
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [showAccountMenu, setShowAccountMenu] = useState(false);
    const [alertCount, setAlertCount] = useState(0);

    // Track active machine maintenance alerts for badge
    useEffect(() => {
        const updateAlertCount = async () => {
            try {
                const list = await AlertsEngine.evaluateMachineAlerts({ userId: currentUser?.id });
                const urgent = list.filter(a => !a.acknowledged && (a.severity === 'critical' || a.severity === 'warning'));
                setAlertCount(urgent.length);
            } catch {
                setAlertCount(0);
            }
        };

        updateAlertCount();
        window.addEventListener('rcm-alerts-changed', updateAlertCount);
        return () => window.removeEventListener('rcm-alerts-changed', updateAlertCount);
    }, [currentUser?.id]);

    // Avatar URL from the DB-connected UserContext
    const avatarUrl = currentUser.avatar || null;

    const getInitials = (name?: string) => {
        if (!name || typeof name !== 'string') return 'RE';
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return 'RE';
        return parts
            .map(n => n[0] || '')
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'RE';
    };

    const menuItems: SidebarItem[] = [
        {
            id: 'home',
            icon: <Home size={22} />,
            label: t('nav.projects'),
            path: '/'
        },
        {
            id: 'assets',
            icon: <LayoutDashboard size={22} />,
            label: t('nav.assets'),
            path: '/assets'
        },
        {
            id: 'alerts',
            icon: <ShieldAlert size={22} />,
            label: t('nav.alerts') || 'Machine Alerts',
            path: '/alerts',
            badge: alertCount > 0 ? alertCount : undefined
        },
        {
            id: 'optimal-replacement',
            icon: <RefreshCw size={22} />,
            label: t('nav.replacement'),
            path: '/optimal-replacement'
        },
        {
            id: 'fmea',
            icon: <AlertTriangle size={22} />,
            label: t('nav.fmea'),
            path: '/fmea'
        },
        {
            id: 'maintenance-tasks',
            icon: <Wrench size={22} />,
            label: t('nav.maintenance'),
            path: '/maintenance-tasks'
        },
        {
            id: 'maintenance-plan',
            icon: <ClipboardList size={22} />,
            label: t('nav.maintenancePlan'),
            path: '/maintenance-plan'
        },
        {
            id: 'cost-analysis',
            icon: <DollarSign size={22} />,
            label: t('nav.costAnalysis') || 'Cost Analysis & ROI',
            path: '/cost-analysis'
        },
        {
            id: 'operating-costs',
            icon: <DollarSign size={22} />,
            label: t('nav.costs'),
            path: '/operating-costs'
        },
        {
            id: 'reports',
            icon: <BarChart3 size={22} />,
            label: t('nav.reports'),
            path: '/reports'
        },
        {
            id: 'settings',
            icon: <Settings size={22} />,
            label: t('nav.settings'),
            path: '/settings'
        }
    ];

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    const handleNavigation = (path: string) => {
        navigate(path);
        // Close mobile menu after navigation
        if (isMobile) {
            setIsMobileMenuOpen(false);
        }
    };

    // MOBILE LAYOUT
    if (isMobile) {
        return (
            <>
                {/* Mobile Top Header Bar */}
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '60px',
                        background: 'var(--bg-secondary)',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 var(--spacing-md)',
                        zIndex: 1000,
                    }}
                >
                    {/* Hamburger Menu Button */}
                    <button
                        onClick={toggleMobileMenu}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            padding: 'var(--spacing-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 'var(--radius-md)',
                            transition: 'background 0.2s ease',
                        }}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>

                    {/* App Title / Logo */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-xs)',
                            cursor: 'pointer',
                        }}
                        onClick={() => handleNavigation('/')}
                    >
                        <RCM7QLogo size={32} />
                        <span
                            style={{
                                fontSize: 'var(--font-size-lg)',
                                fontWeight: '700',
                                color: 'var(--text-primary)',
                                background: 'var(--gradient-primary)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            RCM7Q
                        </span>
                    </div>

                    {/* User Avatar - Only show when menu is closed */}
                    {!isMobileMenuOpen && (
                        <div
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'var(--gradient-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: '600',
                                color: 'white',
                            }}
                        >
                            {(avatarUrl || currentUser.avatar) ? (
                                <img src={avatarUrl || currentUser.avatar} alt={currentUser.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                getInitials(currentUser.name)
                            )}
                        </div>
                    )}
                </div>

                {/* Mobile Menu Overlay */}
                {isMobileMenuOpen && (
                    <div
                        onClick={() => setIsMobileMenuOpen(false)}
                        style={{
                            position: 'fixed',
                            top: '60px',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.5)',
                            zIndex: 998,
                            animation: 'fadeIn 0.2s ease',
                        }}
                    />
                )}

                {/* Mobile Slide-Down Menu */}
                <div
                    style={{
                        position: 'fixed',
                        top: '60px',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-secondary)',
                        borderBottom: '1px solid var(--border-color)',
                        zIndex: 999,
                        transform: isMobileMenuOpen ? 'translateY(0)' : 'translateY(-100%)',
                        opacity: isMobileMenuOpen ? 1 : 0,
                        transition: 'transform 0.3s ease, opacity 0.3s ease',
                        maxHeight: 'calc(100vh - 60px)',
                        overflowY: 'auto',
                        boxShadow: isMobileMenuOpen ? '0 8px 24px rgba(0, 0, 0, 0.3)' : 'none',
                    }}
                >
                    {/* User Section */}
                    <div
                        style={{
                            padding: 'var(--spacing-md)',
                            borderBottom: '1px solid var(--border-color)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                            <div
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    background: 'var(--gradient-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 'var(--font-size-md)',
                                    fontWeight: '600',
                                    color: 'white',
                                    flexShrink: 0
                                }}
                            >
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={currentUser.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                    getInitials(currentUser.name)
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: 'var(--font-size-md)' }}>
                                    {currentUser.name}
                                </div>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                    {currentUser.role}
                                </div>
                            </div>

                            {/* Quick Action Icons */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-sm)',
                                }}
                            >
                                {/* Switch Account Icon */}
                                <button
                                    onClick={() => setShowAccountMenu(!showAccountMenu)}
                                    title={t('settings.switchAccount')}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--primary-500)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Users size={18} />
                                </button>

                                {/* Add Account Icon */}
                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        navigate('/login');
                                    }}
                                    title={t('settings.addAccount')}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--success-500)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <UserPlus size={18} />
                                </button>

                                {/* Logout Icon */}
                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        handleLogout();
                                    }}
                                    title={t('nav.logout')}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        color: 'var(--danger-500)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <LogOut size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Account Switching Dropdown for Mobile */}
                        {showAccountMenu && (
                            <div
                                style={{
                                    marginTop: 'var(--spacing-md)',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    overflow: 'hidden'
                                }}
                            >
                                {accounts.map(account => (
                                    <button
                                        key={account.id}
                                        onClick={() => {
                                            switchAccount(account.id);
                                            setShowAccountMenu(false);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                            background: account.id === currentUser.id ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-sm)',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                background: 'var(--gradient-primary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: '600',
                                                color: 'white',
                                                flexShrink: 0
                                            }}
                                        >
                                            {getInitials(account.name)}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>
                                                {account.name}
                                            </div>
                                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                                                {account.email}
                                            </div>
                                        </div>
                                        {account.id === currentUser.id && (
                                            <Check size={16} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Navigation Items */}
                    <div style={{ padding: 'var(--spacing-sm) 0' }}>
                        {menuItems.map((item) => {
                            const active = isActive(item.path);
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavigation(item.path)}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-md) var(--spacing-lg)',
                                        background: active ? 'var(--gradient-primary)' : 'transparent',
                                        border: 'none',
                                        color: active ? 'white' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-md)',
                                        fontSize: 'var(--font-size-md)',
                                        fontWeight: active ? '600' : '500',
                                        textAlign: direction === 'rtl' ? 'right' : 'left',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                                    <span style={{ flex: 1 }}>{item.label}</span>
                                    {item.badge && (
                                        <span style={{
                                            background: '#ef4444',
                                            color: 'white',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            padding: '2px 7px',
                                            borderRadius: '10px'
                                        }}>
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                `}</style>
            </>
        );
    }

    // DESKTOP LAYOUT (Original)
    return (
        <>
            <div
                onMouseEnter={() => { if (!isPinned) setIsExpanded(true); }}
                onMouseLeave={() => { if (!isPinned) { setIsExpanded(false); setShowAccountMenu(false); } }}
                style={{
                    position: 'fixed',
                    left: direction === 'rtl' ? 'auto' : 0,
                    right: direction === 'rtl' ? 0 : 'auto',
                    top: 0,
                    bottom: 0,
                    width: isExpanded ? '260px' : '70px',
                    background: 'var(--bg-secondary)',
                    borderRight: direction === 'rtl' ? 'none' : '1px solid var(--border-color)',
                    borderLeft: direction === 'rtl' ? '1px solid var(--border-color)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 1000,
                    overflow: 'hidden'
                }}
            >
                {/* Brand Logo Section */}
                <div
                    style={{
                        padding: isExpanded ? 'var(--spacing-lg) var(--spacing-lg) var(--spacing-sm)' : 'var(--spacing-md) 0 var(--spacing-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isExpanded ? 'flex-start' : 'center',
                        gap: 'var(--spacing-sm)',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                    }}
                    onClick={() => handleNavigation('/')}
                >
                    <RCM7QLogo size={isExpanded ? 36 : 32} />
                    {isExpanded && (
                        <span
                            style={{
                                fontSize: 'var(--font-size-lg)',
                                fontWeight: '800',
                                letterSpacing: '0.5px',
                                color: 'var(--text-primary)',
                                background: 'var(--gradient-primary)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            RCM7Q
                        </span>
                    )}
                </div>

                {/* User Profile Section */}
                <div
                    style={{
                        padding: isExpanded ? 'var(--spacing-lg)' : 'var(--spacing-md)',
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'padding 0.3s ease',
                        position: 'relative'
                    }}
                >
                    {/* Current Account Button */}
                    <div
                        onClick={() => isExpanded && setShowAccountMenu(!showAccountMenu)}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            cursor: isExpanded ? 'pointer' : 'default',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-md)',
                            marginBottom: isExpanded ? 'var(--spacing-md)' : '0'
                        }}
                    >
                        {/* Avatar */}
                        <div
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'var(--gradient-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: '600',
                                color: 'white'
                            }}
                        >
                            {(avatarUrl || currentUser.avatar) ? (
                                <img src={avatarUrl || currentUser.avatar} alt={currentUser.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                getInitials(currentUser.name)
                            )}
                        </div>

                        {/* User Info - Only show when expanded */}
                        {isExpanded && (
                            <>
                                <div
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        opacity: isExpanded ? 1 : 0,
                                        transition: 'opacity 0.2s ease',
                                        textAlign: 'left'
                                    }}
                                >
                                    <div
                                        style={{
                                            color: 'var(--text-primary)',
                                            fontSize: 'var(--font-size-sm)',
                                            fontWeight: '600',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}
                                    >
                                        {currentUser.name}
                                    </div>
                                    <div
                                        style={{
                                            color: 'var(--text-tertiary)',
                                            fontSize: 'var(--font-size-xs)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}
                                    >
                                        {currentUser.role}
                                    </div>
                                </div>

                                {/* Quick Action Icons */}
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-xs)',
                                        opacity: isExpanded ? 1 : 0,
                                        transition: 'opacity 0.2s ease'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* Switch Account Icon */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowAccountMenu(!showAccountMenu);
                                        }}
                                        title={t('settings.switchAccount')}
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--bg-tertiary)',
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'var(--primary-500)';
                                            e.currentTarget.style.color = 'white';
                                            e.currentTarget.style.borderColor = 'var(--primary-500)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'var(--bg-tertiary)';
                                            e.currentTarget.style.color = 'var(--text-secondary)';
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                        }}
                                    >
                                        <Users size={14} />
                                    </button>

                                    {/* Add Account Icon */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/login');
                                        }}
                                        title={t('settings.addAccount')}
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--bg-tertiary)',
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'var(--success-500)';
                                            e.currentTarget.style.color = 'white';
                                            e.currentTarget.style.borderColor = 'var(--success-500)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'var(--bg-tertiary)';
                                            e.currentTarget.style.color = 'var(--text-secondary)';
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                        }}
                                    >
                                        <UserPlus size={14} />
                                    </button>

                                    {/* Logout Icon */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleLogout();
                                        }}
                                        title={t('nav.logout')}
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--bg-tertiary)',
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'var(--danger-500)';
                                            e.currentTarget.style.color = 'white';
                                            e.currentTarget.style.borderColor = 'var(--danger-500)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'var(--bg-tertiary)';
                                            e.currentTarget.style.color = 'var(--text-secondary)';
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                        }}
                                    >
                                        <LogOut size={14} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Account Switching Dropdown */}
                    {isExpanded && showAccountMenu && (
                        <div
                            style={{
                                position: 'absolute',
                                left: '0',
                                right: '0',
                                top: '100%',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                margin: 'var(--spacing-xs)',
                                marginTop: 'var(--spacing-sm)',
                                zIndex: 9999,
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                                maxHeight: '300px',
                                overflowY: 'auto'
                            }}
                        >
                            {/* Other Accounts */}
                            {accounts.map(account => (
                                <button
                                    key={account.id}
                                    onClick={() => {
                                        switchAccount(account.id);
                                        setShowAccountMenu(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-sm)',
                                        background: account.id === currentUser.id ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
                                        border: 'none',
                                        borderBottom: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-sm)',
                                        transition: 'background 0.2s ease',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => account.id !== currentUser.id && (e.currentTarget.style.background = 'var(--bg-secondary)')}
                                    onMouseLeave={(e) => account.id !== currentUser.id && (e.currentTarget.style.background = 'transparent')}
                                >
                                    <div
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            background: 'var(--gradient-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 'var(--font-size-xs)',
                                            fontWeight: '600',
                                            color: 'white',
                                            flexShrink: 0
                                        }}
                                    >
                                        {getInitials(account.name)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {account.name}
                                        </div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {account.email}
                                        </div>
                                    </div>
                                    {account.id === currentUser.id && (
                                        <Check size={16} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}


                </div>

                {/* Navigation Items */}
                <div
                    style={{
                        flex: 1,
                        padding: 'var(--spacing-md) 0',
                        overflowY: 'auto',
                        overflowX: 'hidden'
                    }}
                >
                    {menuItems.map((item) => {
                        const active = isActive(item.path);
                        const hovered = hoveredItem === item.id;

                        return (
                            <div
                                key={item.id}
                                style={{
                                    position: 'relative',
                                    marginBottom: 'var(--spacing-xs)'
                                }}
                            >
                                {/* Active Indicator */}
                                {active && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: 0,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            width: '4px',
                                            height: '70%',
                                            background: 'var(--accent-500)',
                                            borderRadius: '0 4px 4px 0',
                                            transition: 'height var(--transition-fast)'
                                        }}
                                    />
                                )}

                                <button
                                    onClick={() => navigate(item.path)}
                                    onMouseEnter={() => setHoveredItem(item.id)}
                                    onMouseLeave={() => setHoveredItem(null)}
                                    style={{
                                        width: '100%',
                                        padding: isExpanded ? 'var(--spacing-sm) var(--spacing-lg)' : 'var(--spacing-sm) var(--spacing-md)',
                                        background: active
                                            ? 'var(--gradient-primary)'
                                            : hovered
                                                ? 'var(--bg-tertiary)'
                                                : 'transparent',
                                        border: 'none',
                                        color: active ? 'white' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-md)',
                                        transition: 'all var(--transition-fast)',
                                        position: 'relative',
                                        textAlign: 'left',
                                        fontSize: 'var(--font-size-sm)',
                                        fontWeight: active ? '600' : '500',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', position: 'relative' }}>
                                        {item.icon}
                                        {!isExpanded && item.badge && (
                                            <span style={{
                                                position: 'absolute',
                                                top: '-2px',
                                                right: '-2px',
                                                width: '8px',
                                                height: '8px',
                                                background: '#ef4444',
                                                borderRadius: '50%',
                                                boxShadow: '0 0 6px #ef4444'
                                            }} />
                                        )}
                                    </span>

                                    {/* Label - Show when expanded */}
                                    {isExpanded && (
                                        <span
                                            style={{
                                                opacity: isExpanded ? 1 : 0,
                                                transition: 'opacity 0.2s ease',
                                                flex: 1
                                            }}
                                        >
                                            {item.label}
                                        </span>
                                    )}

                                    {isExpanded && item.badge && (
                                        <span style={{
                                            background: '#ef4444',
                                            color: 'white',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            padding: '1px 6px',
                                            borderRadius: '8px',
                                            boxShadow: '0 0 6px rgba(239, 68, 68, 0.4)'
                                        }}>
                                            {item.badge}
                                        </span>
                                    )}

                                    {/* Tooltip - Show when collapsed and hovered */}
                                    {!isExpanded && hovered && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: '100%',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                marginLeft: 'var(--spacing-sm)',
                                                padding: 'var(--spacing-xs) var(--spacing-sm)',
                                                background: 'var(--bg-tertiary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-primary)',
                                                fontSize: 'var(--font-size-sm)',
                                                whiteSpace: 'nowrap',
                                                zIndex: 1001,
                                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                                                animation: 'fadeIn 0.2s ease'
                                            }}
                                        >
                                            {item.label}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    left: '-4px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    width: 0,
                                                    height: 0,
                                                    borderTop: '4px solid transparent',
                                                    borderBottom: '4px solid transparent',
                                                    borderRight: '4px solid var(--border-color)'
                                                }}
                                            />
                                        </div>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-50%) translateX(-4px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(-50%) translateX(0);
                    }
                }
            `}</style>
        </>
    );
}
