import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Box,
    AlertTriangle,
    Shield,
    Wrench,
    DollarSign,
    MessageSquare,
    FileText,
    Settings,
    Menu,
    X
} from 'lucide-react';
import { useState } from 'react';

const Navigation = () => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);

    const navItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/assets', label: 'Assets', icon: Box },
        { path: '/fmea', label: 'FMEA Analysis', icon: AlertTriangle },
        { path: '/risks', label: 'Risk Assessment', icon: Shield },
        { path: '/maintenance', label: 'Maintenance', icon: Wrench },
        { path: '/costs', label: 'Cost Analysis', icon: DollarSign },
        { path: '/ai-chat', label: 'AI Assistant', icon: MessageSquare },
        { path: '/reports', label: 'Reports', icon: FileText },
    ];

    return (
        <>
            {/* Mobile Menu Toggle */}
            <button
                className="mobile-menu-toggle"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'fixed',
                    top: '1rem',
                    left: '1rem',
                    zIndex: 1001,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    display: 'none',
                }}
            >
                {isOpen ? <X size={24} color="var(--text-primary)" /> : <Menu size={24} color="var(--text-primary)" />}
            </button>

            {/* Sidebar Navigation */}
            <nav
                className={`sidebar ${isOpen ? 'open' : ''}`}
                style={{
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    height: '100vh',
                    width: '280px',
                    background: 'var(--bg-secondary)',
                    borderRight: '1px solid var(--border-color)',
                    padding: 'var(--spacing-xl)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-lg)',
                    zIndex: 1000,
                    overflowY: 'auto',
                    transition: 'transform var(--transition-base)',
                }}
            >
                {/* Logo */}
                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h2 style={{
                        fontSize: 'var(--font-size-2xl)',
                        background: 'var(--gradient-primary)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                    }}>
                        RCM7Q
                    </h2>
                    <p style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--text-tertiary)',
                        marginTop: '0.25rem',
                    }}>
                        Reliability-Centered Maintenance
                    </p>
                </div>

                {/* Navigation Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsOpen(false)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-md)',
                                    padding: 'var(--spacing-sm) var(--spacing-md)',
                                    borderRadius: 'var(--radius-md)',
                                    textDecoration: 'none',
                                    color: isActive ? 'var(--primary-400)' : 'var(--text-secondary)',
                                    background: isActive ? 'rgba(26, 122, 184, 0.15)' : 'transparent',
                                    border: `1px solid ${isActive ? 'var(--primary-600)' : 'transparent'}`,
                                    fontWeight: isActive ? 600 : 400,
                                    transition: 'all var(--transition-base)',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'var(--bg-tertiary)';
                                        e.currentTarget.style.color = 'var(--text-primary)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--text-secondary)';
                                    }
                                }}
                            >
                                <Icon size={20} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Settings */}
                <div style={{ marginTop: 'auto', paddingTop: 'var(--spacing-lg)', borderTop: '1px solid var(--border-color)' }}>
                    <Link
                        to="/settings"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-md)',
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            borderRadius: 'var(--radius-md)',
                            textDecoration: 'none',
                            color: 'var(--text-secondary)',
                            transition: 'all var(--transition-base)',
                        }}
                    >
                        <Settings size={20} />
                        <span>Settings</span>
                    </Link>
                </div>
            </nav>

            <style>{`
        @media (max-width: 768px) {
          .mobile-menu-toggle {
            display: block !important;
          }
          
          .sidebar {
            transform: translateX(-100%);
          }
          
          .sidebar.open {
            transform: translateX(0);
          }
        }
      `}</style>
        </>
    );
};

export default Navigation;
