import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Send, Loader, Loader2, Trash2, FileText, Pencil, Save, RefreshCw, ShieldAlert } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import GlobalSearch from '../components/GlobalSearch';
import { useSidebar } from '../contexts/SidebarContext';
import { useLanguage } from '../contexts/LanguageContext';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useAssetContext } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface Asset {
    id: string;
    equipment_name: string;
    tag_number: string;
    quantity: number;
    system: string;
    manufacturer: string;
    specifications: string;
    status: string;
    operating_hours_per_day?: number;
    created_at: string;
    project_id?: string;
}

interface Project {
    id: string;
    name: string;
    status: string;
}

interface AssetFormData {
    project_id: string;
    equipment_name: string;
    tag_number: string;
    quantity: string;
    system: string;
    manufacturer: string;
    specifications: string;
    status: string;
    operating_hours_per_day: string;
}

export default function AssetManagement() {
    const navigate = useNavigate();
    const { isMobile } = useSidebar();
    const { t } = useLanguage();
    const { currentProjectId, setCurrentAsset } = useAssetContext();
    const { user } = useAuth();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<{
        type: 'success' | 'error' | null;
        message: string;
    }>({ type: null, message: '' });
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; assetId: string; assetName: string }>({ isOpen: false, assetId: '', assetName: '' });
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Projects for the dropdown
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);

    const fetchProjects = async () => {
        if (!user) return;
        setIsLoadingProjects(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('id, name, status')
                .eq('user_id', user.id)
                .order('name', { ascending: true });
            if (error) throw error;
            setProjects(data || []);
        } catch (err) {
            console.error('Error fetching projects:', err);
        } finally {
            setIsLoadingProjects(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await new Promise(resolve => setTimeout(resolve, 600));
        loadAssets();
        setIsRefreshing(false);
    };

    const [formData, setFormData] = useState<AssetFormData>({
        project_id: '',
        equipment_name: '',
        tag_number: '',
        quantity: '1',
        system: '',
        manufacturer: '',
        specifications: '',
        status: 'Operational',
        operating_hours_per_day: ''
    });

    // Load existing assets on mount or when project/user changes
    useEffect(() => {
        loadAssets();
    }, [currentProjectId, user]);

    const loadAssets = async () => {
        if (!user) {
            setAssets([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            let query = supabase
                .from('assets')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            // Scope to current project if one is selected
            if (currentProjectId && currentProjectId !== 'default') {
                query = query.eq('project_id', currentProjectId);
            }

            const { data, error } = await query;
            if (error) throw error;
            setAssets(data || []);
        } catch (error) {
            console.error('Error loading assets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field: keyof AssetFormData, value: string) => {
        setFormData({ ...formData, [field]: value });
        if (submitStatus.type) {
            setSubmitStatus({ type: null, message: '' });
        }
    };

    const resetForm = () => {
        setFormData({
            project_id: currentProjectId && currentProjectId !== 'default' ? currentProjectId : '',
            equipment_name: '',
            tag_number: '',
            quantity: '1',
            system: '',
            manufacturer: '',
            specifications: '',
            status: 'Operational',
            operating_hours_per_day: ''
        });
        setEditingAssetId(null);
    };

    const handleOpenAddModal = async () => {
        resetForm();
        setShowAddModal(true);
        await fetchProjects();
    };

    const handleEditAsset = async (asset: Asset) => {
        setFormData({
            project_id: asset.project_id || '',
            equipment_name: asset.equipment_name,
            tag_number: asset.tag_number,
            quantity: asset.quantity?.toString() || '1',
            system: asset.system || '',
            manufacturer: asset.manufacturer || '',
            specifications: asset.specifications || '',
            status: asset.status || 'Operational',
            operating_hours_per_day: asset.operating_hours_per_day?.toString() || ''
        });
        setEditingAssetId(asset.id);
        setShowAddModal(true);
        setSubmitStatus({ type: null, message: '' });
        await fetchProjects();
    };

    const handleSaveEdit = async () => {
        if (!editingAssetId) return;

        // Validate required fields
        if (!formData.equipment_name || !formData.tag_number || !formData.status) {
            setSubmitStatus({
                type: 'error',
                message: 'Please fill in all required fields'
            });
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus({ type: null, message: '' });

        try {
            const { error } = await supabase
                .from('assets')
                .update({
                    equipment_name: formData.equipment_name,
                    tag_number: formData.tag_number,
                    quantity: parseInt(formData.quantity) || 1,
                    system: formData.system,
                    manufacturer: formData.manufacturer,
                    specifications: formData.specifications,
                    status: formData.status,
                    operating_hours_per_day: formData.operating_hours_per_day ? parseInt(formData.operating_hours_per_day) : null
                })
                .eq('id', editingAssetId);

            if (error) throw error;

            await loadAssets();

            setSubmitStatus({
                type: 'success',
                message: 'Asset updated successfully!'
            });

            // Reset form and close modal after a short delay
            setTimeout(() => {
                resetForm();
                setShowAddModal(false);
                setSubmitStatus({ type: null, message: '' });
            }, 1500);

        } catch (error) {
            console.error('Error updating asset:', error);
            setSubmitStatus({
                type: 'error',
                message: 'Failed to update asset. Please try again.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddAsset = async () => {
        // Validate required fields
        if (!formData.project_id || !formData.equipment_name || !formData.tag_number || !formData.status) {
            setSubmitStatus({
                type: 'error',
                message: 'Please select a project and fill in all required fields'
            });
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus({ type: null, message: '' });

        try {
            if (!user) throw new Error('Not authenticated');

            const newAsset = {
                user_id: user.id,
                project_id: formData.project_id,
                equipment_name: formData.equipment_name,
                tag_number: formData.tag_number,
                quantity: parseInt(formData.quantity) || 1,
                system: formData.system,
                manufacturer: formData.manufacturer,
                specifications: formData.specifications,
                status: formData.status,
                operating_hours_per_day: formData.operating_hours_per_day ? parseInt(formData.operating_hours_per_day) : null
            };

            const { data, error } = await supabase
                .from('assets')
                .insert([newAsset])
                .select();

            if (error) throw error;

            // Prepare data for n8n webhook
            const payload = {
                project_id: formData.project_id,
                asset_data: data?.[0] || newAsset
            };

            // TODO: Replace with your actual n8n webhook URL
            const n8nWebhookUrl = 'YOUR_N8N_WEBHOOK_URL_HERE';

            // Send data to n8n
            try {
                const response = await fetch(n8nWebhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error('Failed to send data to n8n');
                }
            } catch (error) {
                console.error('Error sending to n8n:', error);
                // Continue anyway for demo purposes
            }

            // Update list from server
            await loadAssets();

            setSubmitStatus({
                type: 'success',
                message: 'Asset added successfully!'
            });

            // Reset form and close modal after a short delay
            setTimeout(() => {
                resetForm();
                setShowAddModal(false);
                setSubmitStatus({ type: null, message: '' });
            }, 1500);

        } catch (error) {
            console.error('Error adding asset:', error);
            setSubmitStatus({
                type: 'error',
                message: 'Failed to add asset. Please try again.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAsset = (assetId: string) => {
        const asset = assets.find(a => a.id === assetId);
        setDeleteConfirm({
            isOpen: true,
            assetId,
            assetName: asset?.equipment_name || 'this asset'
        });
    };

    const confirmDeleteAsset = async () => {
        const assetId = deleteConfirm.assetId;

        try {
            const { error } = await supabase
                .from('assets')
                .delete()
                .eq('id', assetId);

            if (error) throw error;

            await loadAssets();
        } catch (error) {
            console.error('Error deleting asset:', error);
        } finally {
            setDeleteConfirm({ isOpen: false, assetId: '', assetName: '' });
        }
    };

    const getStatusColor = (status: string) => {
        if (!status) return 'badge-primary';
        switch (status.toLowerCase()) {
            case 'operational': return 'badge-success';
            case 'good': return 'badge-success';
            case 'full': return 'badge-info';
            case 'open': return 'badge-info';
            case 'needs inspection': return 'badge-warning';
            case 'needs maintenance': return 'badge-danger';
            default: return 'badge-primary';
        }
    };

    // Mobile Card Component
    const AssetCard = ({ asset }: { asset: Asset }) => (
        <div
            className="card"
            onClick={() => {
                setCurrentAsset(asset.id);
                navigate(`/asset-dashboard/${asset.id}`);
            }}
            style={{
                padding: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-md)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            }}
        >
            {/* Header: Equipment Name + Criticality Badge */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--spacing-sm)'
            }}>
                <div style={{ flex: 1, paddingRight: 'var(--spacing-sm)' }}>
                    <div style={{
                        color: 'var(--text-primary)',
                        fontWeight: '600',
                        fontSize: 'var(--font-size-md)',
                    }}>
                        {asset.equipment_name}
                    </div>
                    <div style={{
                        color: 'var(--text-tertiary)',
                        fontSize: 'var(--font-size-sm)',
                    }}>
                        {asset.tag_number}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <span className={`badge ${getStatusColor(asset.status)}`}>
                        {asset.status}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleEditAsset(asset);
                        }}
                        className="btn btn-ghost"
                        style={{
                            padding: 'var(--spacing-xs)',
                            minWidth: 'auto',
                            color: 'var(--primary-500)'
                        }}
                        title="Edit asset"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAsset(asset.id);
                        }}
                        className="btn btn-ghost"
                        style={{
                            padding: 'var(--spacing-xs)',
                            minWidth: 'auto',
                            color: 'var(--danger-500)'
                        }}
                        title="Delete asset"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Details Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 'var(--spacing-sm)',
                padding: 'var(--spacing-sm)',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)'
            }}>
                <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '2px' }}>System</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>{asset.system || '-'}</div>
                </div>
                <div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '2px' }}>Quantity</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>{asset.quantity || 1}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '2px' }}>Specifications</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>{asset.specifications || '-'}</div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <Sidebar />
            <PageContainer>
                <div className="container" style={{ maxWidth: '1400px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'stretch' : 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-xl)'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-md)'
                        }}>
                            <button
                                onClick={() => navigate('/')}
                                className="btn btn-ghost"
                                style={{
                                    padding: 'var(--spacing-sm)',
                                    minWidth: 'auto'
                                }}
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 style={{ marginBottom: 'var(--spacing-xs)', fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)' }}>
                                    {t('nav.assets')}
                                </h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)' }}>
                                    {t('assets.manageFor')}
                                </p>
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            gap: 'var(--spacing-sm)',
                            alignItems: 'center'
                        }}>
                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '8px 14px', borderRadius: 'var(--radius-md)',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white',
                                    cursor: isRefreshing ? 'wait' : 'pointer',
                                    fontSize: '13px', fontWeight: 600,
                                    opacity: isRefreshing ? 0.7 : 1,
                                }}
                            >
                                {isRefreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                                {isMobile ? '' : (isRefreshing ? 'Refreshing...' : 'Refresh')}
                            </button>
                            <button
                                onClick={() => navigate('/alerts')}
                                className="btn btn-ghost"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    color: '#ef4444',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    background: 'rgba(239, 68, 68, 0.06)'
                                }}
                            >
                                <ShieldAlert size={18} />
                                <span>{isMobile ? 'Alerts' : 'Machine Alerts'}</span>
                            </button>
                            <button
                                onClick={() => navigate('/cost-analysis')}
                                className="btn btn-secondary"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 'var(--spacing-sm)'
                                }}
                            >
                                <FileText size={18} />
                                {isMobile ? 'Costs' : 'Cost Analysis'}
                            </button>
                            <button
                                onClick={handleOpenAddModal}
                                className="btn btn-primary"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 'var(--spacing-sm)'
                                }}
                            >
                                <Plus size={20} />
                                {t('assets.add')}
                            </button>
                        </div>
                    </div>

                    {/* Assets List */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-3xl)', color: 'var(--text-tertiary)' }}>
                            <div className="animate-pulse" style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>Loading assets...</div>
                        </div>
                    ) : assets.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--spacing-3xl)',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '2px dashed var(--border-color)'
                        }}>
                            <FileText
                                size={64}
                                style={{
                                    color: 'var(--text-tertiary)',
                                    marginBottom: 'var(--spacing-lg)'
                                }}
                            />
                            <h3 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-primary)' }}>
                                {t('assets.noAssets')}
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
                                {t('assets.addFirst')}
                            </p>
                            <button
                                onClick={handleOpenAddModal}
                                className="btn btn-primary"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-sm)'
                                }}
                            >
                                <Plus size={20} />
                                Add First Asset
                            </button>
                        </div>
                    ) : isMobile ? (
                        // Mobile: Card Layout
                        <div>
                            {assets.map(asset => (
                                <AssetCard key={asset.id} asset={asset} />
                            ))}
                        </div>
                    ) : (
                        // Desktop: Table Layout
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-color)',
                            overflow: 'auto'
                        }}>
                            {/* Table Header */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1.5fr 0.5fr 1fr 1.5fr 2.5fr 1.5fr 1fr',
                                gap: 'var(--spacing-md)',
                                padding: 'var(--spacing-md) var(--spacing-lg)',
                                background: 'var(--bg-tertiary)',
                                borderBottom: '1px solid var(--border-color)',
                                fontWeight: '600',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-secondary)',
                                minWidth: '1000px'
                            }}>
                                <div>Asset</div>
                                <div>ID</div>
                                <div style={{ textAlign: 'center' }}>Q</div>
                                <div>System</div>
                                <div>Manufacturer</div>
                                <div>Specifications</div>
                                <div>Status</div>
                                <div>Actions</div>
                            </div>

                            {/* Table Body */}
                            {assets.map((asset, index) => (
                                <div
                                    key={asset.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '2fr 1.5fr 0.5fr 1fr 1.5fr 2.5fr 1.5fr 1fr',
                                        gap: 'var(--spacing-md)',
                                        padding: 'var(--spacing-md) var(--spacing-lg)',
                                        borderBottom: index < assets.length - 1 ? '1px solid var(--border-color)' : 'none',
                                        alignItems: 'center',
                                        transition: 'background var(--transition-fast)',
                                        cursor: 'pointer',
                                        minWidth: '1000px'
                                    }}
                                    onClick={() => {
                                        setCurrentAsset(asset.id);
                                        navigate(`/asset-dashboard/${asset.id}`);
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{
                                        color: 'var(--text-primary)',
                                        fontWeight: '600'
                                    }}>
                                        {asset.equipment_name}
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                        {asset.tag_number}
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
                                        {asset.quantity || 1}
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                        {asset.system || '-'}
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                        {asset.manufacturer || '-'}
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                        {asset.specifications || '-'}
                                    </div>
                                    <div>
                                        <span className={`badge ${getStatusColor(asset.status)}`}>
                                            {asset.status || 'Operational'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditAsset(asset);
                                            }}
                                            className="btn btn-ghost"
                                            style={{
                                                padding: 'var(--spacing-xs)',
                                                minWidth: 'auto',
                                                color: 'var(--primary-500)'
                                            }}
                                            title="Edit asset"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteAsset(asset.id);
                                            }}
                                            className="btn btn-ghost"
                                            style={{
                                                padding: 'var(--spacing-xs)',
                                                minWidth: 'auto',
                                                color: 'var(--danger-500)'
                                            }}
                                            title="Delete asset"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Summary Stats */}
                    {assets.length > 0 && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 'var(--spacing-md)',
                            marginTop: 'var(--spacing-xl)'
                        }}>
                            <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                    Total Items
                                </div>
                                <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                    {assets.reduce((sum, a) => sum + (a.quantity || 1), 0)}
                                </div>
                            </div>
                            <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                    Operational / Good
                                </div>
                                <div style={{ color: 'var(--success-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                    {assets.filter(a => ['operational', 'good'].includes(a.status?.toLowerCase())).length}
                                </div>
                            </div>
                            <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                    Needs Attention
                                </div>
                                <div style={{ color: 'var(--warning-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                    {assets.filter(a => ['needs inspection', 'needs maintenance'].includes(a.status?.toLowerCase())).length}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </PageContainer>

            {/* Add Asset Modal */}
            {showAddModal && (
                <>
                    <div
                        onClick={() => {
                            setShowAddModal(false);
                            resetForm();
                            setEditingAssetId(null);
                            setSubmitStatus({ type: null, message: '' });
                        }}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.7)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 9998,
                        }}
                    />
                    <div style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: isMobile ? '95%' : '90%',
                        maxWidth: '700px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-2xl)',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: 'var(--shadow-xl)',
                        border: '1px solid var(--border-color)',
                        zIndex: 9999,
                    }}>
                        <h2 style={{
                            marginBottom: 'var(--spacing-lg)',
                            color: 'var(--text-primary)',
                            fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)'
                        }}>
                            {editingAssetId ? 'Edit Asset' : 'Add New Asset'}
                        </h2>

                        {/* Status Message */}
                        {submitStatus.type && (
                            <div style={{
                                padding: 'var(--spacing-md)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 'var(--spacing-lg)',
                                background: submitStatus.type === 'success'
                                    ? 'var(--success-100)'
                                    : 'var(--danger-100)',
                                color: submitStatus.type === 'success'
                                    ? 'var(--success-900)'
                                    : 'var(--danger-900)',
                                border: `1px solid ${submitStatus.type === 'success'
                                    ? 'var(--success-500)'
                                    : 'var(--danger-500)'}`,
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: '500'
                            }}>
                                {submitStatus.message}
                            </div>
                        )}

                        {/* Form */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--spacing-md)',
                            marginBottom: 'var(--spacing-xl)'
                        }}>
                            {/* Project Selection — Required */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    marginBottom: 'var(--spacing-xs)',
                                    color: 'var(--text-secondary)',
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: '600'
                                }}>
                                    Project *
                                </label>
                                {isLoadingProjects ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                        <Loader2 size={15} className="spin" /> Loading projects...
                                    </div>
                                ) : projects.length === 0 ? (
                                    <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--warning-500)', fontSize: 'var(--font-size-sm)', background: 'rgba(245,158,11,0.06)' }}>
                                        ⚠ No projects found. <button onClick={() => navigate('/projects')} style={{ background: 'none', border: 'none', color: 'var(--primary-500)', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'underline' }}>Create a project first.</button>
                                    </div>
                                ) : (
                                    <select
                                        className="select"
                                        value={formData.project_id}
                                        onChange={(e) => handleInputChange('project_id', e.target.value)}
                                        style={{ width: '100%', borderColor: !formData.project_id ? 'var(--warning-500)' : 'var(--border-color)' }}
                                    >
                                        <option value="">— Select a Project —</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}{p.status !== 'active' ? ` (${p.status})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                {!formData.project_id && !isLoadingProjects && projects.length > 0 && (
                                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--warning-500)' }}>A project must be selected before saving.</p>
                                )}
                            </div>

                            {/* Divider */}
                            <div style={{ borderTop: '1px solid var(--border-color)', margin: '2px 0' }} />

                            {/* Equipment Name */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    marginBottom: 'var(--spacing-xs)',
                                    color: 'var(--text-secondary)',
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: '500'
                                }}>
                                    Equipment Name *
                                </label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., Centrifugal Pump"
                                    value={formData.equipment_name}
                                    onChange={(e) => handleInputChange('equipment_name', e.target.value)}
                                />
                            </div>

                            {/* Tag Number */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    marginBottom: 'var(--spacing-xs)',
                                    color: 'var(--text-secondary)',
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: '500'
                                }}>
                                    Tag Number *
                                </label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., PUMP-001"
                                    value={formData.tag_number}
                                    onChange={(e) => handleInputChange('tag_number', e.target.value)}
                                />
                            </div>

                            {/* Two Column Layout - System and Criticality */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                                gap: 'var(--spacing-md)'
                            }}>
                                {/* System */}
                                <div>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: 'var(--spacing-xs)',
                                        color: 'var(--text-secondary)',
                                        fontSize: 'var(--font-size-sm)',
                                        fontWeight: '500'
                                    }}>
                                        System
                                    </label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="e.g., Cooling"
                                        value={formData.system}
                                        onChange={(e) => handleInputChange('system', e.target.value)}
                                    />
                                </div>

                                {/* Status */}
                                <div>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: 'var(--spacing-xs)',
                                        color: 'var(--text-secondary)',
                                        fontSize: 'var(--font-size-sm)',
                                        fontWeight: '500'
                                    }}>
                                        Status *
                                    </label>
                                    <select
                                        className="select"
                                        value={formData.status}
                                        onChange={(e) => handleInputChange('status', e.target.value)}
                                    >
                                        <option value="Operational">Operational</option>
                                        <option value="Needs Inspection">Needs Inspection</option>
                                        <option value="Needs Maintenance">Needs Maintenance</option>
                                        <option value="Good">Good</option>
                                        <option value="Full">Full</option>
                                        <option value="Open">Open</option>
                                    </select>
                                </div>
                            </div>

                            {/* Manufacturer and Quantity */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                                gap: 'var(--spacing-md)'
                            }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: 'var(--spacing-xs)',
                                        color: 'var(--text-secondary)',
                                        fontSize: 'var(--font-size-sm)',
                                        fontWeight: '500'
                                    }}>
                                        Manufacturer
                                    </label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="e.g., Grundfos"
                                        value={formData.manufacturer}
                                        onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: 'var(--spacing-xs)',
                                        color: 'var(--text-secondary)',
                                        fontSize: 'var(--font-size-sm)',
                                        fontWeight: '500'
                                    }}>
                                        Quantity
                                    </label>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="e.g., 1"
                                        min="1"
                                        value={formData.quantity}
                                        onChange={(e) => handleInputChange('quantity', e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Operating Hours */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : '1fr',
                                gap: 'var(--spacing-md)'
                            }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: 'var(--spacing-xs)',
                                        color: 'var(--text-secondary)',
                                        fontSize: 'var(--font-size-sm)',
                                        fontWeight: '500'
                                    }}>
                                        Operating Hours / Day
                                    </label>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="e.g., 8"
                                        min="0"
                                        max="24"
                                        value={formData.operating_hours_per_day}
                                        onChange={(e) => handleInputChange('operating_hours_per_day', e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Specifications */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr',
                                gap: 'var(--spacing-md)'
                            }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: 'var(--spacing-xs)',
                                        color: 'var(--text-secondary)',
                                        fontSize: 'var(--font-size-sm)',
                                        fontWeight: '500'
                                    }}>
                                        Specifications
                                    </label>
                                    <textarea
                                        className="input"
                                        placeholder="Enter specifications..."
                                        rows={3}
                                        value={formData.specifications}
                                        onChange={(e) => handleInputChange('specifications', e.target.value)}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            gap: 'var(--spacing-md)',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    resetForm();
                                    setEditingAssetId(null);
                                    setSubmitStatus({ type: null, message: '' });
                                }}
                                className="btn btn-secondary"
                                disabled={isSubmitting}
                                style={{ flex: isMobile ? 1 : undefined }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={editingAssetId ? handleSaveEdit : handleAddAsset}
                                className="btn btn-primary"
                                disabled={isSubmitting || !formData.equipment_name || !formData.tag_number || !formData.status || (!editingAssetId && !formData.project_id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 'var(--spacing-sm)',
                                    opacity: isSubmitting ? '0.7' : '1',
                                    flex: isMobile ? 1 : undefined
                                }}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                        {editingAssetId ? 'Saving...' : 'Adding...'}
                                    </>
                                ) : (
                                    <>
                                        {editingAssetId ? <Save size={18} /> : <Send size={18} />}
                                        {editingAssetId ? 'Save Changes' : 'Add Asset'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}

            <ConfirmDeleteModal
                isOpen={deleteConfirm.isOpen}
                title="Delete Asset"
                message="Are you sure you want to delete this asset? This action cannot be undone."
                itemName={deleteConfirm.assetName}
                onConfirm={confirmDeleteAsset}
                onCancel={() => setDeleteConfirm({ isOpen: false, assetId: '', assetName: '' })}
            />

            <style>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
}
