/**
 * ========================================
 * LANGUAGE SWITCHER COMPONENT
 * Dropdown to switch between languages
 * ========================================
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function LanguageSwitcher() {
    const { language, setLanguage, languages, direction } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 180 });

    const currentLang = languages.find(l => l.code === language) || languages[0];

    // Compute position once when opening
    const openDropdown = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPos({
                top: rect.bottom + 4,
                left: direction === 'rtl' ? rect.right - Math.max(200, rect.width) : rect.left,
                width: Math.max(200, rect.width),
            });
        }
        setIsOpen(true);
    };

    // Close on click outside (checks both button and portal menu)
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                buttonRef.current && !buttonRef.current.contains(target) &&
                menuRef.current && !menuRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        };

        // Use a slight delay so the opening click doesn't immediately close
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen]);

    return (
        <>
            {/* Trigger Button */}
            <button
                ref={buttonRef}
                onClick={() => isOpen ? setIsOpen(false) : openDropdown()}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 500,
                    transition: 'all var(--transition-base)',
                    minWidth: '140px',
                    justifyContent: 'space-between',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary-500)';
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <span style={{ fontSize: '1.2rem' }}>{currentLang.flag}</span>
                    <span>{currentLang.nativeName}</span>
                </div>
                <ChevronDown
                    size={16}
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform var(--transition-base)',
                    }}
                />
            </button>

            {/* Dropdown Menu — portalled to body to escape overflow:hidden */}
            {isOpen && createPortal(
                <>
                <style>{`
                    @keyframes langDropdownReveal {
                        0% {
                            opacity: 0;
                            transform: translateY(-8px) scale(0.96);
                            filter: blur(4px);
                        }
                        60% {
                            opacity: 1;
                            transform: translateY(2px) scale(1.005);
                            filter: blur(0px);
                        }
                        100% {
                            opacity: 1;
                            transform: translateY(0) scale(1);
                            filter: blur(0px);
                        }
                    }
                `}</style>
                <div
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        top: `${menuPos.top}px`,
                        left: `${menuPos.left}px`,
                        minWidth: `${menuPos.width}px`,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                        overflow: 'hidden',
                        zIndex: 99999,
                        animation: 'langDropdownReveal 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                        transformOrigin: 'top center',
                    }}
                >
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => {
                                setLanguage(lang.code);
                                setIsOpen(false);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-md)',
                                width: '100%',
                                padding: 'var(--spacing-md)',
                                background: language === lang.code ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: language === lang.code ? 'var(--primary-400)' : 'var(--text-primary)',
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: language === lang.code ? 600 : 400,
                                textAlign: direction === 'rtl' ? 'right' : 'left',
                                transition: 'all var(--transition-fast)',
                            }}
                            onMouseEnter={(e) => {
                                if (language !== lang.code) {
                                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (language !== lang.code) {
                                    e.currentTarget.style.background = 'transparent';
                                }
                            }}
                        >
                            <span style={{ fontSize: '1.4rem' }}>{lang.flag}</span>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: direction === 'rtl' ? 'flex-end' : 'flex-start',
                                gap: '2px',
                            }}>
                                <span>{lang.nativeName}</span>
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--text-tertiary)',
                                }}>
                                    {lang.name}
                                </span>
                            </div>
                            {language === lang.code && (
                                <span style={{
                                    marginLeft: direction === 'rtl' ? 0 : 'auto',
                                    marginRight: direction === 'rtl' ? 'auto' : 0,
                                    color: 'var(--primary-400)',
                                    fontSize: '1rem',
                                }}>
                                    ✓
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                </>,
                document.body
            )}
        </>
    );
}

// Compact version for sidebar/header
export function LanguageSwitcherCompact() {
    const { language, setLanguage, languages } = useLanguage();

    const toggleLanguage = () => {
        const currentIndex = languages.findIndex(l => l.code === language);
        const nextIndex = (currentIndex + 1) % languages.length;
        setLanguage(languages[nextIndex].code);
    };

    const currentLang = languages.find(l => l.code === language) || languages[0];

    return (
        <button
            onClick={toggleLanguage}
            title={`Switch to ${languages.find(l => l.code !== language)?.name}`}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-xs)',
                padding: 'var(--spacing-sm)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                transition: 'all var(--transition-base)',
                minWidth: '44px',
                height: '44px',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary-500)';
                e.currentTarget.style.background = 'var(--bg-elevated)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.background = 'var(--bg-tertiary)';
            }}
        >
            <span style={{ fontSize: '1.3rem' }}>{currentLang.flag}</span>
        </button>
    );
}
