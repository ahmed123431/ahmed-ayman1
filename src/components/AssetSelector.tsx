import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Cpu, Filter, Search, X } from 'lucide-react';
import { useAssetContext } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function AssetSelector() {
    const { currentAssetId, setCurrentAsset, clearAsset } = useAssetContext();
    const { user } = useAuth();
    const [assets, setAssets] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!user) return;
        const loadAssets = async () => {
            const { data } = await supabase.from('assets').select('*').eq('user_id', user.id);
            if (data) setAssets(data);
        };
        
        // Load assets on mount
        loadAssets();
        
        // Listen for asset updates
        const handleUpdate = () => {
            loadAssets();
        };
        window.addEventListener('app-data-updated', handleUpdate);
        return () => window.removeEventListener('app-data-updated', handleUpdate);
    }, [user]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
        if (!isOpen) {
            setTimeout(() => setSearchQuery(''), 0);
        }
    }, [isOpen]);

    const selectedAsset = assets.find(a => a.id === currentAssetId);

    // Filter assets based on search query
    const filteredAssets = assets.filter(asset => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            asset.equipment_name.toLowerCase().includes(q) ||
            asset.tag_number.toLowerCase().includes(q) ||
            (asset.system && asset.system.toLowerCase().includes(q)) ||
            (asset.manufacturer && asset.manufacturer.toLowerCase().includes(q)) ||
            (asset.model && asset.model.toLowerCase().includes(q))
        );
    });

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
                className="btn btn-secondary"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    background: currentAssetId ? 'var(--primary-100)' : 'var(--bg-secondary)',
                    borderColor: currentAssetId ? 'var(--primary-300)' : 'var(--border-color)',
                    color: currentAssetId ? 'var(--primary-700)' : 'var(--text-secondary)',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    minWidth: '180px',
                    justifyContent: 'space-between'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    {currentAssetId ? <Cpu size={16} /> : <Filter size={16} />}
                    <span style={{ fontWeight: currentAssetId ? '600' : 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                        {currentAssetId && selectedAsset ? selectedAsset.equipment_name : 'All Assets'}
                    </span>
                </div>
                <ChevronDown size={14} style={{ opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + var(--spacing-xs))',
                    right: 0,
                    width: '280px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-xl)',
                    border: '1px solid var(--border-color)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    animation: 'fadeIn 0.15s ease-out'
                }}>
                    {/* Search Box */}
                    <div style={{ padding: 'var(--spacing-sm)', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-xs)',
                            background: 'var(--bg-primary)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            padding: '6px 10px',
                            transition: 'border-color 0.2s ease',
                        }}>
                            <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search assets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    color: 'var(--text-primary)',
                                    fontSize: 'var(--font-size-sm)',
                                    width: '100%',
                                    padding: 0,
                                }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: 'var(--text-tertiary)',
                                        flexShrink: 0
                                    }}
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* All Assets button */}
                    {!searchQuery && (
                        <div style={{ padding: 'var(--spacing-xs)' }}>
                            <button
                                onClick={() => {
                                    clearAsset();
                                    setIsOpen(false);
                                }}
                                style={{
                                    width: '100%',
                                    padding: 'var(--spacing-sm) var(--spacing-md)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-sm)',
                                    background: !currentAssetId ? 'var(--bg-tertiary)' : 'transparent',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    color: !currentAssetId ? 'var(--primary-500)' : 'var(--text-primary)',
                                    fontWeight: !currentAssetId ? '600' : 'normal',
                                    transition: 'background 0.2s ease',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = !currentAssetId ? 'var(--bg-tertiary)' : 'transparent'}
                            >
                                <Filter size={16} style={{ color: !currentAssetId ? 'var(--primary-500)' : 'var(--text-tertiary)' }} />
                                All Assets (Global Data)
                            </button>
                        </div>
                    )}

                    {assets.length > 0 && (
                        <>
                            <div style={{
                                padding: 'var(--spacing-xs) var(--spacing-md)',
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--text-tertiary)',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                borderTop: '1px solid var(--border-color)',
                                borderBottom: '1px solid var(--border-color)',
                                background: 'var(--bg-primary)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}>
                                <span>{searchQuery ? 'Results' : 'Select Asset'}</span>
                                <span style={{ fontWeight: 'normal', fontSize: '10px' }}>{filteredAssets.length} of {assets.length}</span>
                            </div>
                            <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '0 var(--spacing-xs) var(--spacing-xs) var(--spacing-xs)' }}>
                                {filteredAssets.length === 0 ? (
                                    <div style={{
                                        padding: 'var(--spacing-lg) var(--spacing-md)',
                                        textAlign: 'center',
                                        color: 'var(--text-tertiary)',
                                        fontSize: 'var(--font-size-sm)',
                                    }}>
                                        <Search size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                        <p style={{ margin: 0 }}>No assets match "{searchQuery}"</p>
                                    </div>
                                ) : (
                                    filteredAssets.map(asset => (
                                        <button
                                            key={asset.id}
                                            onClick={() => {
                                                setCurrentAsset(asset.id);
                                                setIsOpen(false);
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--spacing-sm)',
                                                background: currentAssetId === asset.id ? 'var(--bg-tertiary)' : 'transparent',
                                                border: 'none',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                color: currentAssetId === asset.id ? 'var(--primary-500)' : 'var(--text-primary)',
                                                fontWeight: currentAssetId === asset.id ? '600' : 'normal',
                                                transition: 'background 0.2s ease',
                                                marginTop: 'var(--spacing-xs)',
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = currentAssetId === asset.id ? 'var(--bg-tertiary)' : 'transparent'}
                                        >
                                            <Cpu size={16} style={{ color: currentAssetId === asset.id ? 'var(--primary-500)' : 'var(--text-tertiary)', flexShrink: 0 }} />
                                            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                <span style={{ fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.equipment_name}</span>
                                                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{asset.tag_number} · {asset.system || 'N/A'}</span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
