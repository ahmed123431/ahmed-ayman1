import { useState, useEffect, useRef } from 'react';
import { Search, X, FolderOpen, Cpu, ChevronRight, Shield, AlertTriangle, DollarSign, RefreshCw, Settings, Wrench } from 'lucide-react';
import { useSearch, type PageType, type SearchResult } from '../contexts/SearchContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';

// Map result type to icon and gradient
const resultTypeConfig: Record<SearchResult['type'], { icon: any; gradient: string }> = {
    project: { icon: FolderOpen, gradient: 'var(--gradient-primary)' },
    asset: { icon: Cpu, gradient: 'var(--gradient-accent)' },
    fmea: { icon: AlertTriangle, gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    risk: { icon: Shield, gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
    cost: { icon: DollarSign, gradient: 'linear-gradient(135deg, #10b981, #059669)' },
    replacement: { icon: RefreshCw, gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
    maintenance: { icon: Wrench, gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)' },
    setting: { icon: Settings, gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
};

// Map result type to section labels
const sectionLabels: Record<SearchResult['type'], { en: string; translationKey: string }> = {
    project: { en: 'Projects', translationKey: 'search.projects' },
    asset: { en: 'Machines / Assets', translationKey: 'search.machines' },
    fmea: { en: 'FMEA Entries', translationKey: 'search.fmea' },
    risk: { en: 'Risks', translationKey: 'search.risks' },
    cost: { en: 'Cost Items', translationKey: 'search.costs' },
    replacement: { en: 'Replacement Items', translationKey: 'search.replacement' },
    maintenance: { en: 'Maintenance Tasks', translationKey: 'search.maintenance' },
    setting: { en: 'Settings', translationKey: 'search.settings' },
};

// Map pageType to placeholder text
const placeholderByPage: Record<PageType, { en: string; translationKey: string }> = {
    dashboard: { en: 'Search...', translationKey: 'common.search' },
    projects: { en: 'Search...', translationKey: 'common.search' },
    assets: { en: 'Search...', translationKey: 'common.search' },
    fmea: { en: 'Search...', translationKey: 'common.search' },
    risks: { en: 'Search...', translationKey: 'common.search' },
    costs: { en: 'Search...', translationKey: 'common.search' },
    replacement: { en: 'Search...', translationKey: 'common.search' },
    maintenance: { en: 'Search...', translationKey: 'common.search' },
    reports: { en: 'Search...', translationKey: 'common.search' },
    settings: { en: 'Search...', translationKey: 'common.search' },
};

interface GlobalSearchProps {
    pageType?: PageType;
}

export default function GlobalSearch({ pageType = 'dashboard' }: GlobalSearchProps) {
    const navigate = useNavigate();
    const { t, direction } = useLanguage();
    const { isMobile } = useSidebar();
    const {
        searchQuery,
        searchResults,
        isSearchOpen,
        setIsSearchOpen,
        performSearch,
        clearSearch,
        setSelectedResult
    } = useSearch();

    const [localQuery, setLocalQuery] = useState(searchQuery);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Focus input when search opens
    useEffect(() => {
        if (isSearchOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isSearchOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsSearchOpen(false);
            }
        };

        if (isSearchOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSearchOpen, setIsSearchOpen]);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl/Cmd + K to open search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
            // Escape to close
            if (e.key === 'Escape') {
                setIsSearchOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [setIsSearchOpen]);

    const handleSearch = (query: string) => {
        setLocalQuery(query);
        performSearch(query, pageType);
    };

    const handleResultClick = (result: SearchResult) => {
        setSelectedResult(result);
        setIsSearchOpen(false);

        // Navigate based on result type
        switch (result.type) {
            case 'project':
                navigate('/dashboard');
                break;
            case 'asset':
                navigate('/dashboard');
                break;
            case 'fmea':
                // Stay on FMEA page (already there)
                break;
            case 'risk':
                // Stay on Risk page
                break;
            case 'cost':
                // Stay on Costs page
                break;
            case 'replacement':
                // Stay on Replacement page
                break;
            default:
                navigate('/dashboard');
        }
    };

    const handleClear = () => {
        setLocalQuery('');
        clearSearch();
    };

    // Get the placeholder for the current page
    const placeholderConfig = placeholderByPage[pageType];
    const placeholder = t(placeholderConfig.translationKey) || placeholderConfig.en;

    // Group results by type to render sections
    const resultsByType = searchResults.reduce<Record<string, SearchResult[]>>((acc, result) => {
        if (!acc[result.type]) acc[result.type] = [];
        acc[result.type].push(result);
        return acc;
    }, {});

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            {/* Search Button / Collapsed State */}
            <button
                onClick={() => setIsSearchOpen(true)}
                className="btn btn-secondary"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    minWidth: isSearchOpen ? '300px' : 'auto',
                    background: isSearchOpen ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                    border: isSearchOpen ? '1px solid var(--primary-500)' : '1px solid var(--border-color)',
                    transition: 'all var(--transition-base)',
                }}
            >
                <Search size={18} color="var(--text-secondary)" />
            </button>

            {/* Expanded Search Dropdown */}
            {isSearchOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    [direction === 'rtl' ? 'right' : 'left']: 0,
                    marginTop: 'var(--spacing-sm)',
                    width: '400px',
                    maxWidth: '90vw',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-xl)',
                    zIndex: 'var(--z-dropdown)',
                    overflow: 'hidden',
                }}>
                    {/* Search Input */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        padding: 'var(--spacing-md)',
                        borderBottom: '1px solid var(--border-color)',
                    }}>
                        <Search size={20} color="var(--text-tertiary)" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={localQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder={placeholder}
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: 'var(--text-primary)',
                                fontSize: 'var(--font-size-base)',
                            }}
                        />
                        {localQuery && (
                            <button
                                onClick={handleClear}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 'var(--spacing-xs)',
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                            >
                                <X size={18} color="var(--text-tertiary)" />
                            </button>
                        )}
                    </div>

                    {/* Search Results */}
                    <div style={{
                        maxHeight: '400px',
                        overflowY: 'auto',
                    }}>
                        {searchResults.length === 0 && localQuery && (
                            <div style={{
                                padding: 'var(--spacing-xl)',
                                textAlign: 'center',
                                color: 'var(--text-tertiary)',
                            }}>
                                <Search size={40} style={{ marginBottom: 'var(--spacing-sm)', opacity: 0.5 }} />
                                <p>{t('search.noResults') || 'No results found'}</p>
                                <p style={{ fontSize: 'var(--font-size-sm)' }}>
                                    {t('search.tryDifferent') || 'Try a different search term'}
                                </p>
                            </div>
                        )}

                        {searchResults.length === 0 && !localQuery && (
                            <div style={{
                                padding: 'var(--spacing-lg)',
                                color: 'var(--text-tertiary)',
                            }}>
                                <p style={{
                                    fontSize: 'var(--font-size-sm)',
                                    marginBottom: 'var(--spacing-sm)',
                                    fontWeight: '600'
                                }}>
                                    {t('search.suggestions') || 'Quick Tips'}
                                </p>
                                <ul style={{
                                    fontSize: 'var(--font-size-sm)',
                                    paddingLeft: 'var(--spacing-lg)',
                                    margin: 0,
                                }}>
                                    {pageType === 'projects' && (
                                        <li>{t('search.tipProject') || 'Search by project name or description'}</li>
                                    )}
                                    {pageType === 'assets' && (
                                        <>
                                            <li>{t('search.tip2') || 'Search by machine/equipment name'}</li>
                                            <li>{t('search.tip3') || 'Search by tag number'}</li>
                                        </>
                                    )}
                                    {pageType === 'fmea' && (
                                        <li>{t('search.tipFmea') || 'Search by component, failure mode, or cause'}</li>
                                    )}
                                    {pageType === 'risks' && (
                                        <li>{t('search.tipRisk') || 'Search by risk name, category, or mitigation'}</li>
                                    )}
                                    {pageType === 'costs' && (
                                        <li>{t('search.tipCost') || 'Search by equipment name'}</li>
                                    )}
                                    {pageType === 'replacement' && (
                                        <li>{t('search.tipReplacement') || 'Search by equipment name or tag number'}</li>
                                    )}
                                    {(pageType === 'dashboard' || pageType === 'reports') && (
                                        <>
                                            <li>{t('search.tip1') || 'Search by project name'}</li>
                                            <li>{t('search.tip2') || 'Search by machine/equipment name'}</li>
                                            <li>{t('search.tip3') || 'Search by tag number'}</li>
                                        </>
                                    )}
                                </ul>
                            </div>
                        )}

                        {/* Render each result type as a section */}
                        {Object.entries(resultsByType).map(([type, results]) => {
                            const config = resultTypeConfig[type as SearchResult['type']];
                            const label = sectionLabels[type as SearchResult['type']];
                            const Icon = config.icon;

                            return (
                                <div key={type}>
                                    <div style={{
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        background: 'var(--bg-tertiary)',
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: '600',
                                        color: 'var(--text-tertiary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                    }}>
                                        {t(label.translationKey) || label.en}
                                    </div>
                                    {results.map((result, index) => (
                                        <button
                                            key={`${type}-${index}`}
                                            onClick={() => handleResultClick(result)}
                                            style={{
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--spacing-md)',
                                                padding: 'var(--spacing-md)',
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                textAlign: direction === 'rtl' ? 'right' : 'left',
                                                transition: 'background var(--transition-fast)',
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: 'var(--radius-md)',
                                                background: config.gradient,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                <Icon size={18} color="white" />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    color: 'var(--text-primary)',
                                                    fontWeight: '600',
                                                    fontSize: 'var(--font-size-sm)',
                                                }}>
                                                    {result.displayTitle}
                                                </div>
                                                <div style={{
                                                    color: 'var(--text-tertiary)',
                                                    fontSize: 'var(--font-size-xs)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {result.displaySubtitle}
                                                </div>
                                            </div>
                                            {result.badge ? (
                                                <span className={`badge badge-${result.badge.variant}`} style={{ fontSize: 'var(--font-size-xs)' }}>
                                                    {result.badge.label}
                                                </span>
                                            ) : (
                                                <ChevronRight size={16} color="var(--text-tertiary)" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    {searchResults.length > 0 && (
                        <div style={{
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            borderTop: '1px solid var(--border-color)',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-tertiary)',
                            display: 'flex',
                            justifyContent: 'space-between',
                        }}>
                            <span>{searchResults.length} {t('search.resultsFound') || 'results found'}</span>
                            <span>{t('search.clickToView') || 'Click to view details'}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
