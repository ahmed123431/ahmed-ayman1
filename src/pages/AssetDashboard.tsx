import React, { useState, useEffect, Fragment } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    AlertTriangle,
    Shield,
    DollarSign,
    RefreshCw,
    BarChart3,
    Cpu,
    Calendar,
    Activity,
    TrendingUp,
    TrendingDown,
    FileText,
    ChevronRight,
    Wrench,
    Zap,
    Target,
    Info,
    ClipboardList,
    Package,
    Plus,
    Trash2,
    Pencil,
    X,
    Save,
    History,
    Upload,
    CheckCircle2,
    ShieldAlert
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import { useSidebar } from '../contexts/SidebarContext';
import { useAssetContext } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { uploadFile, deleteFile, validateFile } from '../lib/storageService';
import { AlertsEngine, MachineAlert } from '../services/AlertsEngine';

interface Asset {
    id: string;
    equipment_name: string;
    tag_number: string;
    system: string;
    manufacturer: string;
    model?: string;
    quantity?: number;
    specifications?: string;
    status?: string;
    criticality_level?: 'High' | 'Medium' | 'Low';
    installation_date?: string;
    operating_hours_per_day?: number;
    created_at: string;
    projectId?: string;
}

// FMEA entry for this asset
interface FMEAEntry {
    id: string;
    failureMode: string;
    cause: string;
    effect: string;
    severity: number;
    occurrence: number;
    detection: number;
    rpn: number;
    riskLevel: string;
    strategy?: string;
    strategyCode?: string;
    taskDescription?: string;
}

// Risk data for this asset
interface RiskData {
    overallRisk: string;
    rpn: number;
    failureModes: number;
    riskMatrix: { category: string; level: string; score: number }[];
}

// Cost data for this asset
interface CostData {
    estimatedAnnualCost: number;
    preventiveCost: number;
    correctiveCost: number;
    potentialSavings: number;
    costTrend: string;
}

// Optimal replacement data
interface ReplacementData {
    currentAge: number;
    optimalAge: number;
    replacementCost: number;
    failureProbability: number;
    recommendation: string;
}

// Spare Part data for this asset
interface SparePart {
    id: string;
    partName: string;
    partNumber: string;
    quantity: number;
    unitCost: number;
    supplier: string;
    minimumStock: number;
}

interface FaultRecord {
    id: string;
    componentId?: string;
    partName: string;
    failedAtTime: number | string;
    date: string;
}

export default function AssetDashboard() {
    const navigate = useNavigate();
    const { assetId } = useParams<{ assetId: string }>();
    const { isMobile } = useSidebar();
    const { setCurrentAsset } = useAssetContext();
    const { user } = useAuth();
    const [asset, setAsset] = useState<Asset | null>(null);
    const [fmeaData, setFmeaData] = useState<FMEAEntry[]>([]);
    const [riskData, setRiskData] = useState<RiskData | null>(null);
    const [costData, setCostData] = useState<CostData | null>(null);
    const [replacementData, setReplacementData] = useState<ReplacementData | null>(null);
    const [sparePartsData, setSparePartsData] = useState<SparePart[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'fmea' | 'risk' | 'cost' | 'optimal' | 'tasks' | 'plan' | 'spares' | 'report' | 'history' | 'manual'>('overview');
    const [showAllTabs, setShowAllTabs] = useState(true);
    const [isEditingAsset, setIsEditingAsset] = useState(false);
    const [editForm, setEditForm] = useState({
        equipment_name: '',
        tag_number: '',
        system: '',
        manufacturer: '',
        model: '',
        quantity: 1,
        specifications: '',
        status: '',
        criticality_level: 'Medium'
    });

    // Spares Modal State
    const [showSpareModal, setShowSpareModal] = useState(false);
    const [editingSpareId, setEditingSpareId] = useState<string | null>(null);
    const [spareForm, setSpareForm] = useState<Omit<SparePart, 'id'>>({
        partName: '', partNumber: '', quantity: 0, unitCost: 0, supplier: '', minimumStock: 0
    });

    // History & Manual State
    const [faults, setFaults] = useState<FaultRecord[]>([]);
    const [components, setComponents] = useState<{id: string, name: string}[]>([]);
    const [newComponentName, setNewComponentName] = useState('');
    const [newFaultByComponent, setNewFaultByComponent] = useState<Record<string, string>>({});
    const [manualFile, setManualFile] = useState<{name: string, url: string, filePath?: string} | null>(null);
    const [isSavingHistory, setIsSavingHistory] = useState(false);
    const [showSavedNotification, setShowSavedNotification] = useState(false);
    const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});
    const [manualUploading, setManualUploading] = useState(false);
    const [manualUploadMessage, setManualUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [assetAlerts, setAssetAlerts] = useState<MachineAlert[]>([]);


    const loadAssetData = async () => {
        setIsLoading(true);

        if (!user || !assetId) {
            setIsLoading(false);
            return;
        }

        try {
            // Load asset
            const { data: assetData } = await supabase.from('assets').select('*').eq('id', assetId).single();
            if (assetData) {
                setAsset(assetData);
                setEditForm({
                    equipment_name: assetData.equipment_name || '',
                    tag_number: assetData.tag_number || '',
                    system: assetData.system || '',
                    manufacturer: assetData.manufacturer || '',
                    model: assetData.model || '',
                    quantity: assetData.quantity || 1,
                    specifications: assetData.specifications || '',
                    status: assetData.status || 'Operational',
                    criticality_level: assetData.criticality_level || 'Medium'
                });

                // Fetch data in parallel
                const [
                    { data: fmeaRes },
                    { data: risksRes },
                    { data: costsRes },
                    { data: replacementsRes },
                    { data: sparesRes },
                    { data: faultsRes },
                    { data: componentsRes },
                    { data: manualsRes },
                    { data: logicTreeRes }
                ] = await Promise.all([
                    supabase.from('fmea').select('*').eq('asset_id', assetId),
                    supabase.from('risks').select('*').eq('asset_id', assetId),
                    supabase.from('costs').select('*').eq('asset_id', assetId),
                    supabase.from('replacements').select('*').eq('asset_id', assetId),
                    supabase.from('spares').select('*').eq('asset_id', assetId),
                    supabase.from('faults').select('*').eq('asset_id', assetId),
                    supabase.from('components').select('*').eq('asset_id', assetId),
                    supabase.from('manuals').select('*').eq('asset_id', assetId),
                    supabase.from('logic_tree').select('*').eq('asset_id', assetId)
                ]);


                // FMEA
                if (fmeaRes && fmeaRes.length > 0) {
                    setFmeaData(fmeaRes.map(f => {
                        const lt = logicTreeRes?.find(l => l.fmea_id === f.id);
                        return {
                            id: f.id,
                            failureMode: f.failure_mode,
                            cause: f.failure_cause,
                            effect: f.failure_effect,
                            severity: f.severity,
                            occurrence: f.occurrence,
                            detection: f.detection,
                            rpn: f.rpn,
                            riskLevel: f.risk_level,
                            strategy: lt?.strategy,
                            strategyCode: lt?.strategy_code,
                            taskDescription: lt?.task_description
                        };
                    }));
                } else {
                    setFmeaData([]);
                }

                // Risk Data
                const criticality = assetData.criticality_level || 'Medium';
                setRiskData({
                    overallRisk: criticality,
                    rpn: risksRes && risksRes.length > 0 ? risksRes[0].rpn : 0,
                    failureModes: fmeaRes?.length || 0,
                    riskMatrix: risksRes && risksRes.length > 0 ? [{
                        category: risksRes[0].category,
                        level: risksRes[0].level,
                        score: risksRes[0].rpn
                    }] : []
                });

                // Cost Data
                if (costsRes && costsRes.length > 0) {
                    const c = costsRes[0];
                    const opTime = Number(c.operating_time || 0);
                    const mtbf = Number(c.mtbf || 0);
                    const expectedFailures = mtbf > 0 ? opTime / mtbf : 0;
                    const expectedDowntime = expectedFailures * Number(c.mttr || 0);
                    const totalPMCost = Number(c.planned_maint_cost || 0) * (Number(c.pm_tasks_per_year || 0) * (opTime / 8760));
                    const totalCost = Number(c.acquisition_cost || 0) + (expectedFailures * Number(c.failure_cost || 0)) + (expectedDowntime * Number(c.downtime_cost_rate || 0)) + totalPMCost;
                    const yearsInMission = opTime / 8760;
                    const annualCost = yearsInMission > 0 ? totalCost / yearsInMission : totalCost;

                    setCostData({
                        estimatedAnnualCost: annualCost,
                        preventiveCost: yearsInMission > 0 ? totalPMCost / yearsInMission : totalPMCost,
                        correctiveCost: yearsInMission > 0 ? (expectedFailures * Number(c.failure_cost || 0)) / yearsInMission : (expectedFailures * Number(c.failure_cost || 0)),
                        potentialSavings: annualCost * 0.15,
                        costTrend: 'stable'
                    });
                } else {
                    setCostData(null);
                }

                // Replacement
                if (replacementsRes && replacementsRes.length > 0) {
                    const r = replacementsRes[0];
                    setReplacementData({
                        currentAge: Number(r.current_age),
                        optimalAge: Number(r.optimum_time),
                        replacementCost: Number(r.planned_replacement_cost),
                        failureProbability: 0,
                        recommendation: r.status
                    });
                } else {
                    setReplacementData(null);
                }

                // Spares
                if (sparesRes) {
                    setSparePartsData(sparesRes.map(s => ({
                        id: s.id,
                        partName: s.part_name,
                        partNumber: s.part_number,
                        quantity: s.quantity,
                        unitCost: Number(s.cost),
                        supplier: s.supplier,
                        minimumStock: s.min_quantity
                    })));
                }

                // History & Manuals
                if (componentsRes) {
                    setComponents(componentsRes.map(c => ({ id: c.id, name: c.name })));
                }
                if (faultsRes) {
                    setFaults(faultsRes.map(f => {
                        const comp = componentsRes?.find(c => c.id === f.component_id);
                        return {
                            id: f.id,
                            componentId: f.component_id,
                            partName: comp?.name || f.description.split(': ')[0] || 'Unknown',
                            failedAtTime: f.failed_at_time || 0,
                            date: f.date
                        };
                    }));
                }
                if (manualsRes && manualsRes.length > 0) {
                    setManualFile({
                        name: manualsRes[0].title,
                        url: manualsRes[0].file_path ? manualsRes[0].content : manualsRes[0].content,
                        filePath: manualsRes[0].file_path || undefined
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching asset dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddComponent = async () => {
        const name = newComponentName.trim();
        if (!name || components.some(c => c.name === name) || !asset || !user) return;
        
        try {
            const { data, error } = await supabase.from('components').insert([{
                user_id: user.id,
                asset_id: asset.id,
                name: name,
                description: ''
            }]).select();
            if (error) throw error;
            
            setComponents([...components, { id: data[0].id, name: name }]);
            setNewComponentName('');
            setExpandedComponents(prev => ({...prev, [name]: true}));
            setShowSavedNotification(true);
            setTimeout(() => setShowSavedNotification(false), 3000);
        } catch (error) {
            console.error('Error adding component:', error);
        }
    };

    const handleAddFaultToComponent = async (componentId: string, componentName: string) => {
        const timeValue = newFaultByComponent[componentName];
        if (!timeValue || !asset || !user) return;
        
        try {
            const { data, error } = await supabase.from('faults').insert([{
                user_id: user.id,
                asset_id: asset.id,
                component_id: componentId,
                failed_at_time: Number(timeValue),
                description: `${componentName}: Fault occurred`,
                date: new Date().toISOString(),
                severity: 'Medium',
                resolution: ''
            }]).select();
            
            if (error) throw error;
            
            const newRecord: FaultRecord = {
                id: data[0].id,
                componentId: componentId,
                partName: componentName,
                failedAtTime: Number(timeValue),
                date: new Date().toISOString()
            };
            
            setFaults([...faults, newRecord]);
            setNewFaultByComponent(prev => ({...prev, [componentName]: ''}));
            setShowSavedNotification(true);
            setTimeout(() => setShowSavedNotification(false), 3000);
        } catch (error) {
            console.error('Error adding fault:', error);
        }
    };

    const handleDeleteComponent = async (componentId: string, componentName: string) => {
        if (!asset) return;
        try {
            const { error } = await supabase.from('components').delete().eq('id', componentId);
            if (error) throw error;
            setComponents(components.filter(c => c.id !== componentId));
            setFaults(faults.filter(f => f.componentId !== componentId && f.partName !== componentName));
        } catch (error) {
            console.error('Error deleting component:', error);
        }
    };

    const handleDeleteFault = async (id: string) => {
        try {
            const { error } = await supabase.from('faults').delete().eq('id', id);
            if (error) throw error;
            setFaults(faults.filter(f => f.id !== id));
        } catch (error) {
            console.error('Error deleting fault:', error);
        }
    };

    const toggleComponent = (name: string) => {
        setExpandedComponents(prev => ({
            ...prev,
            [name]: !prev[name]
        }));
    };

    const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!asset || !user || !e.target.files || e.target.files.length === 0) return;
        
        const file = e.target.files[0];

        // Validate file (50MB limit, specific document types)
        const validationError = validateFile(file, {
            maxSize: 50 * 1024 * 1024, // 50MB
            allowedTypes: ['.pdf', '.doc', '.docx'],
        });
        if (validationError) {
            setManualUploadMessage({ type: 'error', text: validationError });
            setTimeout(() => setManualUploadMessage(null), 5000);
            return;
        }

        setManualUploading(true);
        setManualUploadMessage(null);

        try {
            // Delete old manual file from Storage if exists
            if (manualFile?.filePath) {
                await deleteFile(manualFile.filePath);
            }
            // Delete old manual record from DB
            await supabase.from('manuals').delete().eq('asset_id', asset.id);

            // Upload to Supabase Storage
            const result = await uploadFile(file, user.id, 'equipment', {
                maxSize: 50 * 1024 * 1024,
                allowedTypes: ['.pdf', '.doc', '.docx'],
            });

            if (result.success && result.publicUrl && result.path) {
                // Save to manuals table with Storage reference
                const { error } = await supabase.from('manuals').insert([{
                    user_id: user.id,
                    asset_id: asset.id,
                    title: file.name,
                    content: result.publicUrl,
                    file_path: result.path,
                    file_size: file.size,
                }]);
                if (error) throw error;

                setManualFile({ name: file.name, url: result.publicUrl, filePath: result.path });
                setManualUploadMessage({ type: 'success', text: 'Manual uploaded successfully!' });
            } else {
                setManualUploadMessage({ type: 'error', text: result.error || 'Upload failed. Please try again.' });
            }
        } catch (error) {
            console.error('Error uploading manual:', error);
            setManualUploadMessage({ type: 'error', text: 'An unexpected error occurred during upload.' });
        } finally {
            setManualUploading(false);
            setTimeout(() => setManualUploadMessage(null), 5000);
        }
    };

    const handleRemoveManual = async () => {
        if (!asset) return;
        try {
            // Delete from Supabase Storage first
            if (manualFile?.filePath) {
                await deleteFile(manualFile.filePath);
            }
            const { error } = await supabase.from('manuals').delete().eq('asset_id', asset.id);
            if (error) throw error;
            setManualFile(null);
            setManualUploadMessage({ type: 'success', text: 'Manual removed successfully.' });
            setTimeout(() => setManualUploadMessage(null), 3000);
        } catch (error) {
            console.error('Error removing manual:', error);
        }
    };

    const handleUpdateAsset = async () => {
        if (!asset || !user) return;
        try {
            const { error } = await supabase.from('assets').update({
                equipment_name: editForm.equipment_name,
                tag_number: editForm.tag_number,
                system: editForm.system,
                manufacturer: editForm.manufacturer,
                model: editForm.model,
                quantity: editForm.quantity,
                specifications: editForm.specifications,
                status: editForm.status,
                criticality_level: editForm.criticality_level
            }).eq('id', asset.id);

            if (error) throw error;
            
            setAsset({ ...asset, ...editForm } as any);
            setIsEditingAsset(false);
            setShowSavedNotification(true);
            setTimeout(() => setShowSavedNotification(false), 3000);
        } catch (error) {
            console.error('Error updating asset:', error);
        }
    };

    useEffect(() => {
        if (assetId) {
            setCurrentAsset(assetId);
        }
        loadAssetData();
    }, [assetId, setCurrentAsset, user]);

    useEffect(() => {
        let isMounted = true;
        const syncAlerts = async () => {
            try {
                const list = await AlertsEngine.evaluateMachineAlerts({
                    userId: user?.id,
                    currentAssetId: assetId
                });
                if (!isMounted) return;
                const relevant = list.filter(a =>
                    !a.acknowledged && (
                        (assetId && a.assetId === assetId) ||
                        (asset && a.assetName && (
                            a.assetName.toLowerCase() === asset.equipment_name.toLowerCase() ||
                            a.assetName.toLowerCase().includes(asset.equipment_name.toLowerCase()) ||
                            (asset.tag_number && a.assetName.toLowerCase().includes(asset.tag_number.toLowerCase()))
                        ))
                    )
                );
                setAssetAlerts(relevant);
            } catch {
                if (isMounted) setAssetAlerts([]);
            }
        };

        syncAlerts();
        window.addEventListener('rcm-alerts-changed', syncAlerts);
        return () => {
            isMounted = false;
            window.removeEventListener('rcm-alerts-changed', syncAlerts);
        };
    }, [assetId, asset, user?.id]);


    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const getRiskColor = (level: string) => {
        switch (level.toLowerCase()) {
            case 'high': return 'var(--danger-500)';
            case 'medium': return 'var(--warning-500)';
            case 'low': return 'var(--success-500)';
            default: return 'var(--text-secondary)';
        }
    };

    const getRiskBadge = (level: string) => {
        switch (level.toLowerCase()) {
            case 'high': return 'badge-danger';
            case 'medium': return 'badge-warning';
            case 'low': return 'badge-success';
            default: return 'badge-primary';
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Spares Handlers
    const resetSpareForm = () => {
        setSpareForm({ partName: '', partNumber: '', quantity: 0, unitCost: 0, supplier: '', minimumStock: 0 });
        setEditingSpareId(null);
    };

    const handleEditSpare = (spare: SparePart) => {
        setSpareForm({
            partName: spare.partName,
            partNumber: spare.partNumber,
            quantity: spare.quantity,
            unitCost: spare.unitCost,
            supplier: spare.supplier,
            minimumStock: spare.minimumStock
        });
        setEditingSpareId(spare.id);
        setShowSpareModal(true);
    };

    const handleSaveSpare = async () => {
        if (!spareForm.partName.trim() || !spareForm.partNumber.trim() || !user || !asset) return;

        try {
            if (editingSpareId) {
                const { error } = await supabase.from('spares').update({
                    part_name: spareForm.partName,
                    part_number: spareForm.partNumber,
                    quantity: spareForm.quantity,
                    cost: spareForm.unitCost,
                    supplier: spareForm.supplier,
                    min_quantity: spareForm.minimumStock
                }).eq('id', editingSpareId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('spares').insert([{
                    user_id: user.id,
                    asset_id: asset.id,
                    part_name: spareForm.partName,
                    part_number: spareForm.partNumber,
                    quantity: spareForm.quantity,
                    cost: spareForm.unitCost,
                    supplier: spareForm.supplier,
                    min_quantity: spareForm.minimumStock
                }]);
                if (error) throw error;
            }
            await loadAssetData(); // reload
            setShowSpareModal(false);
            resetSpareForm();
        } catch (error) {
            console.error('Error saving spare:', error);
        }
    };

    const handleDeleteSpare = async (id: string) => {
        try {
            const { error } = await supabase.from('spares').delete().eq('id', id);
            if (error) throw error;
            setSparePartsData(sparePartsData.filter(s => s.id !== id));
        } catch (error) {
            console.error('Error deleting spare:', error);
        }
    };

    // Tab configuration
    const allTabs = [
        { id: 'history' as const, label: 'Fault History', icon: <History size={18} /> },
        { id: 'spares' as const, label: 'Spare Parts Inventory', icon: <Package size={18} /> },
        { id: 'manual' as const, label: 'Add Manual', icon: <FileText size={18} /> },
        { id: 'overview' as const, label: 'Overview', icon: <Activity size={18} /> },
        { id: 'fmea' as const, label: 'FMEA', icon: <AlertTriangle size={18} /> },
        { id: 'risk' as const, label: 'Risk', icon: <Shield size={18} /> },
        { id: 'cost' as const, label: 'Cost', icon: <DollarSign size={18} /> },
        { id: 'optimal' as const, label: 'Optimal', icon: <RefreshCw size={18} /> },
        { id: 'tasks' as const, label: 'Tasks', icon: <Wrench size={18} /> },
        { id: 'plan' as const, label: 'Plan', icon: <ClipboardList size={18} /> },
        { id: 'report' as const, label: 'Report', icon: <BarChart3 size={18} /> },
    ];

    const defaultTabs = ['spares', 'history', 'manual'];

    const tabs = showAllTabs 
        ? allTabs 
        : allTabs.filter(t => defaultTabs.includes(t.id));

    if (isLoading) {
        return (
            <>
                <Sidebar />
                <PageContainer>
                    <div style={{
                        minHeight: '60vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <RefreshCw
                                size={48}
                                style={{
                                    color: 'var(--primary-500)',
                                    animation: 'spin 1s linear infinite',
                                    marginBottom: 'var(--spacing-md)'
                                }}
                            />
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Loading asset analysis...
                            </p>
                        </div>
                    </div>
                </PageContainer>
            </>
        );
    }

    if (!asset) {
        return (
            <>
                <Sidebar />
                <PageContainer>
                    <div style={{
                        minHeight: '60vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <Cpu size={64} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--spacing-md)' }} />
                            <h2 style={{ color: 'var(--text-primary)', marginBottom: 'var(--spacing-sm)' }}>
                                Asset Not Found
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
                                The asset you're looking for doesn't exist or has been removed.
                            </p>
                            <button
                                onClick={() => navigate('/assets')}
                                className="btn btn-primary"
                            >
                                Back to Assets
                            </button>
                        </div>
                    </div>
                </PageContainer>
            </>
        );
    }

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
                        marginBottom: 'var(--spacing-lg)'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-md)'
                        }}>
                            <button
                                onClick={() => navigate('/assets')}
                                className="btn btn-ghost"
                                style={{
                                    padding: 'var(--spacing-sm)',
                                    minWidth: 'auto'
                                }}
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-md)'
                            }}>
                                <div style={{
                                    width: isMobile ? '44px' : '52px',
                                    height: isMobile ? '44px' : '52px',
                                    borderRadius: 'var(--radius-lg)',
                                    background: 'var(--gradient-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 4px 16px rgba(26, 122, 184, 0.3)',
                                }}>
                                    <Cpu size={isMobile ? 22 : 26} color="white" />
                                </div>
                                <div>
                                    <h1 style={{
                                        marginBottom: '2px',
                                        fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-2xl)'
                                    }}>
                                        {asset.equipment_name}
                                    </h1>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                            {asset.tag_number}
                                        </span>
                                        <span className={`badge ${getRiskBadge(asset.criticality_level || asset.status || 'Operational')}`}>
                                            {asset.criticality_level || asset.status || 'Operational'}
                                        </span>
                                        {assetAlerts.length > 0 && (
                                            <button
                                                onClick={() => navigate('/alerts')}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '2px 8px',
                                                    borderRadius: '9999px',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    background: assetAlerts.some(a => a.severity === 'critical') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                                    color: assetAlerts.some(a => a.severity === 'critical') ? '#ef4444' : '#f59e0b',
                                                    border: `1px solid ${assetAlerts.some(a => a.severity === 'critical') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                                    cursor: 'pointer',
                                                }}
                                                title="Click to view maintenance alerts for this machine"
                                            >
                                                <ShieldAlert size={12} />
                                                {assetAlerts.length} {assetAlerts.length === 1 ? 'Alert' : 'Alerts'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Quick Navigation to Alerts and Cost Analysis */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => navigate('/alerts')}
                                className="btn btn-ghost"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: 'var(--font-size-sm)',
                                    color: assetAlerts.length > 0 ? '#ef4444' : 'var(--text-secondary)'
                                }}
                            >
                                <ShieldAlert size={16} />
                                Alerts {assetAlerts.length > 0 && `(${assetAlerts.length})`}
                            </button>
                            <button
                                onClick={() => navigate('/cost-analysis')}
                                className="btn btn-ghost"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                <DollarSign size={16} />
                                Cost Analysis
                            </button>
                        </div>
                    </div>

                    {/* Active Maintenance Alert Banner (if any) */}
                    {assetAlerts.length > 0 && (
                        <div style={{
                            background: assetAlerts.some(a => a.severity === 'critical') 
                                ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.04) 100%)' 
                                : 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)',
                            border: `1px solid ${assetAlerts.some(a => a.severity === 'critical') ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--spacing-md) var(--spacing-lg)',
                            marginBottom: 'var(--spacing-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 'var(--spacing-md)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                <div style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '50%',
                                    background: assetAlerts.some(a => a.severity === 'critical') ? '#ef4444' : '#f59e0b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    flexShrink: 0
                                }}>
                                    <ShieldAlert size={20} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
                                        {assetAlerts.length} Active Maintenance {assetAlerts.length === 1 ? 'Alert' : 'Alerts'} Detected for this Equipment
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                        {assetAlerts[0]?.title}: {assetAlerts[0]?.message}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                <button
                                    onClick={() => navigate('/alerts')}
                                    className="btn btn-sm btn-outline"
                                    style={{ borderColor: assetAlerts.some(a => a.severity === 'critical') ? '#ef4444' : '#f59e0b', color: assetAlerts.some(a => a.severity === 'critical') ? '#ef4444' : '#f59e0b', fontWeight: 600 }}
                                >
                                    View in Alerts Center →
                                </button>
                                <button
                                    onClick={() => navigate('/cost-analysis')}
                                    className="btn btn-sm btn-ghost"
                                    style={{ fontSize: 'var(--font-size-xs)' }}
                                >
                                    Cost Impact
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab Navigation */}
                    <div style={{
                        display: 'flex',
                        gap: 'var(--spacing-xs)',
                        marginBottom: 'var(--spacing-lg)',
                        overflowX: 'auto',
                        paddingBottom: 'var(--spacing-xs)',
                        alignItems: 'center'
                    }}>
                        {tabs.map(tab => (
                            <Fragment key={tab.id}>
                                <button
                                    onClick={() => setActiveTab(tab.id as any)}
                                    style={{
                                        padding: isMobile ? 'var(--spacing-sm) var(--spacing-md)' : 'var(--spacing-sm) var(--spacing-lg)',
                                        background: activeTab === tab.id ? 'var(--gradient-primary)' : 'var(--bg-secondary)',
                                        color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                                        border: activeTab === tab.id ? 'none' : '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-lg)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-xs)',
                                        fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                                        fontWeight: activeTab === tab.id ? '600' : '500',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s ease',
                                        flexShrink: 0,
                                    }}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                                {tab.id === 'manual' && (
                                    <Fragment>
                                        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 var(--spacing-sm)' }} />
                                            <button
                                                onClick={() => navigate(`/report-preview?name=${encodeURIComponent(`${asset.equipment_name} (${asset.tag_number}) - Asset Report`)}&assetId=${asset.id}`)}
                                                className="btn"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--spacing-xs)',
                                                    whiteSpace: 'nowrap',
                                                    background: 'var(--gradient-primary)',
                                                    color: 'white',
                                                    padding: isMobile ? 'var(--spacing-sm) var(--spacing-md)' : 'var(--spacing-sm) var(--spacing-lg)',
                                                    borderRadius: 'var(--radius-lg)',
                                                    flexShrink: 0,
                                                    boxShadow: '0 4px 12px rgba(26, 122, 184, 0.2)'
                                                }}
                                            >
                                                <FileText size={18} />
                                                Full Report Preview
                                            </button>
                                    </Fragment>
                                )}
                            </Fragment>
                        ))}
                    </div>

                    {/* ==================== OVERVIEW TAB ==================== */}
                    {activeTab === 'overview' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            {/* Asset Info Card */}
                            <div className="card" style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
                                <h2 style={{
                                    fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                    marginBottom: 'var(--spacing-md)',
                                    display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                        <Info size={20} style={{ color: 'var(--primary-500)' }} />
                                        Asset Information
                                    </div>
                                    <button 
                                        className="btn btn-ghost" 
                                        onClick={() => setIsEditingAsset(!isEditingAsset)}
                                        style={{ color: 'var(--primary-500)', padding: 'var(--spacing-xs) var(--spacing-sm)', minWidth: 'auto' }}
                                    >
                                        {isEditingAsset ? <X size={18} /> : <Pencil size={18} />}
                                    </button>
                                </h2>
                                
                                {isEditingAsset ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 'var(--spacing-md)' }}>
                                        {[
                                            { label: 'Name', key: 'equipment_name' },
                                            { label: 'Tag', key: 'tag_number' },
                                            { label: 'System', key: 'system' },
                                            { label: 'Manufacturer', key: 'manufacturer' },
                                            { label: 'Model', key: 'model' },
                                            { label: 'Quantity', key: 'quantity', type: 'number' },
                                        ].map((field) => (
                                            <div key={field.key}>
                                                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>{field.label}</label>
                                                <input 
                                                    type={field.type || 'text'}
                                                    value={(editForm as any)[field.key]}
                                                    onChange={(e) => setEditForm({...editForm, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value})}
                                                    style={{
                                                        width: '100%',
                                                        padding: 'var(--spacing-sm)',
                                                        background: 'var(--bg-tertiary)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: 'var(--radius-md)',
                                                        color: 'var(--text-primary)'
                                                    }}
                                                />
                                            </div>
                                        ))}
                                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                                            <button className="btn btn-primary" onClick={handleUpdateAsset}>
                                                <Save size={18} style={{ marginRight: '8px' }} />
                                                Save Changes
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                                        gap: 'var(--spacing-md)'
                                    }}>
                                        {[
                                            { label: 'System', value: asset.system || 'N/A' },
                                            { label: 'Manufacturer', value: asset.manufacturer || 'N/A' },
                                            { label: 'Specifications', value: asset.specifications || 'N/A' },
                                            { label: 'Model', value: asset.model || 'N/A' },
                                            { label: 'Install Date', value: formatDate(asset.installation_date || asset.created_at) },
                                            { label: 'Hours/Day', value: `${asset.operating_hours_per_day || 8}h` },
                                            { label: 'Tag Number', value: asset.tag_number },
                                            { label: 'Criticality', value: asset.criticality_level || asset.status || 'N/A' },
                                            { label: 'Added', value: formatDate(asset.created_at) },
                                        ].map((item, i) => (
                                            <div key={i} style={{ padding: 'var(--spacing-md)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>
                                                    {item.label}
                                                </div>
                                                <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: 'var(--font-size-sm)' }}>
                                                    {item.value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Quick Stats Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                                gap: 'var(--spacing-md)'
                            }}>
                                {/* RPN Score */}
                                <div
                                    className="card"
                                    style={{ padding: 'var(--spacing-md)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                    onClick={() => setActiveTab('risk')}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                                        <div style={{
                                            width: '36px', height: '36px',
                                            borderRadius: 'var(--radius-md)',
                                            background: `linear-gradient(135deg, ${getRiskColor(riskData?.overallRisk || 'Medium')}33, ${getRiskColor(riskData?.overallRisk || 'Medium')}11)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <Shield size={18} style={{ color: getRiskColor(riskData?.overallRisk || 'Medium') }} />
                                        </div>
                                        <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                                    </div>
                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '2px' }}>RPN Score</div>
                                    <div style={{ color: getRiskColor(riskData?.overallRisk || 'Medium'), fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                        {riskData?.rpn || 0}
                                    </div>
                                </div>

                                {/* FMEA Entries */}
                                <div
                                    className="card"
                                    style={{ padding: 'var(--spacing-md)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                    onClick={() => setActiveTab('fmea')}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                                        <div style={{
                                            width: '36px', height: '36px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.2), rgba(251, 146, 60, 0.05))',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <AlertTriangle size={18} style={{ color: 'var(--warning-500)' }} />
                                        </div>
                                        <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                                    </div>
                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '2px' }}>Failure Modes</div>
                                    <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                        {fmeaData.length}
                                    </div>
                                </div>

                                {/* Annual Cost */}
                                <div
                                    className="card"
                                    style={{ padding: 'var(--spacing-md)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                    onClick={() => setActiveTab('cost')}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                                        <div style={{
                                            width: '36px', height: '36px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.05))',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <DollarSign size={18} style={{ color: 'var(--success-500)' }} />
                                        </div>
                                        <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                                    </div>
                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '2px' }}>Annual Cost</div>
                                    <div style={{ color: 'var(--text-primary)', fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-2xl)', fontWeight: '700' }}>
                                        {formatCurrency(costData?.estimatedAnnualCost || 0)}
                                    </div>
                                </div>

                                {/* Replacement */}
                                <div
                                    className="card"
                                    style={{ padding: 'var(--spacing-md)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                    onClick={() => setActiveTab('optimal')}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                                        <div style={{
                                            width: '36px', height: '36px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'linear-gradient(135deg, rgba(26, 122, 184, 0.2), rgba(26, 122, 184, 0.05))',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <RefreshCw size={18} style={{ color: 'var(--primary-500)' }} />
                                        </div>
                                        <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                                    </div>
                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '2px' }}>Failure Prob.</div>
                                    <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                        {replacementData?.failureProbability || 0}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* ==================== FMEA TAB ==================== */}
                    {activeTab === 'fmea' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            <div className="card" style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
                                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                    <h2 style={{
                                        fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                        display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', margin: 0
                                    }}>
                                        <AlertTriangle size={20} style={{ color: 'var(--warning-500)' }} />
                                        FMEA Analysis
                                    </h2>
                                </div>

                                {/* FMEA Table */}
                                {isMobile ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                        {fmeaData.map((entry) => (
                                            <div key={entry.id} style={{
                                                padding: 'var(--spacing-md)',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-md)',
                                                borderLeft: `3px solid ${getRiskColor(entry.riskLevel)}`,
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                                                    <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>{entry.failureMode}</span>
                                                    <span className={`badge ${getRiskBadge(entry.riskLevel)}`} style={{ fontSize: 'var(--font-size-xs)' }}>
                                                        RPN: {entry.rpn}
                                                    </span>
                                                </div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>
                                                    <strong>Cause:</strong> {entry.cause}
                                                </div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                                    <strong>Effect:</strong> {entry.effect}
                                                </div>
                                                <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                                    <span>S: {entry.severity}</span>
                                                    <span>O: {entry.occurrence}</span>
                                                    <span>D: {entry.detection}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ overflow: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                                    {['Failure Mode', 'Cause', 'Effect', 'S', 'O', 'D', 'RPN', 'Strategy', 'RCM Task'].map(h => (
                                                        <th key={h} style={{
                                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                                            textAlign: 'left',
                                                            color: 'var(--text-tertiary)',
                                                            fontSize: 'var(--font-size-sm)',
                                                            fontWeight: '600'
                                                        }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {fmeaData.map((entry) => (
                                                    <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', color: 'var(--text-primary)', fontWeight: '600', fontSize: 'var(--font-size-sm)' }}>{entry.failureMode}</td>
                                                        <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{entry.cause}</td>
                                                        <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{entry.effect}</td>
                                                        <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', color: 'var(--text-primary)', fontWeight: '600', textAlign: 'center' }}>{entry.severity}</td>
                                                        <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', color: 'var(--text-primary)', fontWeight: '600', textAlign: 'center' }}>{entry.occurrence}</td>
                                                        <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', color: 'var(--text-primary)', fontWeight: '600', textAlign: 'center' }}>{entry.detection}</td>
                                                        <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', color: getRiskColor(entry.riskLevel), fontWeight: '700', textAlign: 'center' }}>{entry.rpn}</td>
                                                        <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}>
                                                            {entry.strategyCode ? (
                                                                <span className="badge" style={{ background: 'var(--primary-50)', color: 'var(--primary-700)', border: '1px solid var(--primary-100)' }}>
                                                                    {entry.strategyCode}
                                                                </span>
                                                            ) : '-'}
                                                        </td>
                                                        <td style={{ padding: 'var(--spacing-sm) var(--spacing-md)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                                            {entry.taskDescription || 'No task assigned'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => navigate('/fmea')}
                                className="btn btn-secondary"
                                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}
                            >
                                Open Full FMEA Analysis <ChevronRight size={18} />
                            </button>
                        </div>
                    )}

                    {/* ==================== RISK TAB ==================== */}
                    {activeTab === 'risk' && riskData && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            {/* Overall Risk Card */}
                            <div className="card" style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
                                <h2 style={{
                                    fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                    marginBottom: 'var(--spacing-lg)',
                                    display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)'
                                }}>
                                    <Shield size={20} style={{ color: 'var(--primary-500)' }} />
                                    Risk Assessment
                                </h2>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                                    gap: 'var(--spacing-lg)',
                                    marginBottom: 'var(--spacing-lg)'
                                }}>
                                    <div style={{
                                        textAlign: 'center',
                                        padding: 'var(--spacing-lg)',
                                        background: `linear-gradient(135deg, ${getRiskColor(riskData.overallRisk)}15, transparent)`,
                                        borderRadius: 'var(--radius-lg)',
                                        border: `1px solid ${getRiskColor(riskData.overallRisk)}33`,
                                    }}>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)' }}>Overall Risk Level</div>
                                        <div style={{ color: getRiskColor(riskData.overallRisk), fontSize: 'var(--font-size-3xl)', fontWeight: '800' }}>
                                            {riskData.overallRisk}
                                        </div>
                                    </div>
                                    <div style={{
                                        textAlign: 'center',
                                        padding: 'var(--spacing-lg)',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-lg)',
                                    }}>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)' }}>Risk Priority Number</div>
                                        <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-3xl)', fontWeight: '800' }}>
                                            {riskData.rpn}
                                        </div>
                                    </div>
                                    <div style={{
                                        textAlign: 'center',
                                        padding: 'var(--spacing-lg)',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-lg)',
                                    }}>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)' }}>Failure Modes Identified</div>
                                        <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-3xl)', fontWeight: '800' }}>
                                            {riskData.failureModes}
                                        </div>
                                    </div>
                                </div>

                                {/* Risk Matrix */}
                                <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--spacing-md)', color: 'var(--text-primary)' }}>
                                    Risk Categories
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                    {riskData.riskMatrix.map((item, i) => (
                                        <div key={i} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-md)',
                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                        }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', flex: '1' }}>{item.category}</span>
                                            <div style={{
                                                flex: '2',
                                                height: '8px',
                                                background: 'var(--bg-primary)',
                                                borderRadius: 'var(--radius-full)',
                                                overflow: 'hidden',
                                            }}>
                                                <div style={{
                                                    width: `${(item.score / 15) * 100}%`,
                                                    height: '100%',
                                                    background: getRiskColor(item.level),
                                                    borderRadius: 'var(--radius-full)',
                                                    transition: 'width 0.6s ease'
                                                }} />
                                            </div>
                                            <span className={`badge ${getRiskBadge(item.level)}`} style={{ fontSize: 'var(--font-size-xs)', minWidth: '60px', textAlign: 'center' }}>
                                                {item.level}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/risk-management')}
                                className="btn btn-secondary"
                                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}
                            >
                                Open Full Risk Management <ChevronRight size={18} />
                            </button>
                        </div>
                    )}

                    {/* ==================== COST TAB ==================== */}
                    {activeTab === 'cost' && costData && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            <div className="card" style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
                                <h2 style={{
                                    fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                    marginBottom: 'var(--spacing-lg)',
                                    display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)'
                                }}>
                                    <DollarSign size={20} style={{ color: 'var(--success-500)' }} />
                                    Cost Analysis
                                </h2>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                                    gap: 'var(--spacing-md)',
                                    marginBottom: 'var(--spacing-lg)'
                                }}>
                                    <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>Annual Cost</div>
                                        <div style={{ color: 'var(--text-primary)', fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)', fontWeight: '700' }}>
                                            {formatCurrency(costData.estimatedAnnualCost)}
                                        </div>
                                    </div>
                                    <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>Preventive</div>
                                        <div style={{ color: 'var(--primary-500)', fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)', fontWeight: '700' }}>
                                            {formatCurrency(costData.preventiveCost)}
                                        </div>
                                    </div>
                                    <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>Corrective</div>
                                        <div style={{ color: 'var(--danger-500)', fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)', fontWeight: '700' }}>
                                            {formatCurrency(costData.correctiveCost)}
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: 'var(--spacing-md)',
                                        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.02))',
                                        border: '1px solid rgba(34, 197, 94, 0.2)',
                                        borderRadius: 'var(--radius-lg)', textAlign: 'center'
                                    }}>
                                        <div style={{ color: 'var(--success-500)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)', fontWeight: '600' }}>
                                            💰 Potential Savings
                                        </div>
                                        <div style={{ color: 'var(--success-500)', fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)', fontWeight: '700' }}>
                                            {formatCurrency(costData.potentialSavings)}
                                        </div>
                                    </div>
                                </div>

                                {/* Cost Breakdown Bar */}
                                <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--spacing-md)', color: 'var(--text-primary)' }}>
                                    Cost Breakdown
                                </h3>
                                <div style={{
                                    height: '24px',
                                    borderRadius: 'var(--radius-full)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    marginBottom: 'var(--spacing-sm)',
                                }}>
                                    <div style={{
                                        width: `${(costData.preventiveCost / costData.estimatedAnnualCost) * 100}%`,
                                        background: 'var(--primary-500)',
                                        transition: 'width 0.6s ease',
                                    }} />
                                    <div style={{
                                        width: `${(costData.correctiveCost / costData.estimatedAnnualCost) * 100}%`,
                                        background: 'var(--danger-500)',
                                        transition: 'width 0.6s ease',
                                    }} />
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--spacing-lg)', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--primary-500)', display: 'inline-block' }} />
                                        Preventive ({Math.round((costData.preventiveCost / costData.estimatedAnnualCost) * 100)}%)
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--danger-500)', display: 'inline-block' }} />
                                        Corrective ({Math.round((costData.correctiveCost / costData.estimatedAnnualCost) * 100)}%)
                                    </span>
                                </div>

                                <div style={{
                                    marginTop: 'var(--spacing-lg)',
                                    padding: 'var(--spacing-md)',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-md)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-sm)',
                                    fontSize: 'var(--font-size-sm)'
                                }}>
                                    {costData.costTrend === 'increasing' ? (
                                        <TrendingUp size={18} style={{ color: 'var(--danger-500)' }} />
                                    ) : (
                                        <TrendingDown size={18} style={{ color: 'var(--success-500)' }} />
                                    )}
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                        Cost trend is <strong style={{ color: costData.costTrend === 'increasing' ? 'var(--danger-500)' : 'var(--success-500)' }}>{costData.costTrend}</strong>
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/operating-costs')}
                                className="btn btn-secondary"
                                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}
                            >
                                Open Full Cost Analysis <ChevronRight size={18} />
                            </button>
                        </div>
                    )}

                    {/* ==================== OPTIMAL REPLACEMENT TAB ==================== */}
                    {activeTab === 'optimal' && replacementData && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            <div className="card" style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
                                <h2 style={{
                                    fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                    marginBottom: 'var(--spacing-lg)',
                                    display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)'
                                }}>
                                    <RefreshCw size={20} style={{ color: 'var(--primary-500)' }} />
                                    Optimal Replacement Analysis
                                </h2>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                                    gap: 'var(--spacing-lg)',
                                    marginBottom: 'var(--spacing-lg)'
                                }}>
                                    {/* Age vs Optimal */}
                                    <div style={{
                                        padding: 'var(--spacing-lg)',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-lg)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                                            <Calendar size={18} style={{ color: 'var(--primary-500)' }} />
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>Equipment Age</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--spacing-md)' }}>
                                            <div>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>Current Age</div>
                                                <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>{replacementData.currentAge} yrs</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>Optimal Life</div>
                                                <div style={{ color: 'var(--primary-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>{replacementData.optimalAge} yrs</div>
                                            </div>
                                        </div>
                                        {/* Age progress bar */}
                                        <div style={{
                                            height: '10px',
                                            background: 'var(--bg-primary)',
                                            borderRadius: 'var(--radius-full)',
                                            overflow: 'hidden',
                                            position: 'relative',
                                        }}>
                                            <div style={{
                                                width: `${Math.min(100, (replacementData.currentAge / replacementData.optimalAge) * 100)}%`,
                                                height: '100%',
                                                background: replacementData.currentAge > replacementData.optimalAge
                                                    ? 'var(--danger-500)'
                                                    : replacementData.currentAge > replacementData.optimalAge * 0.7
                                                        ? 'var(--warning-500)'
                                                        : 'var(--success-500)',
                                                borderRadius: 'var(--radius-full)',
                                                transition: 'width 0.6s ease'
                                            }} />
                                        </div>
                                    </div>

                                    {/* Failure Probability */}
                                    <div style={{
                                        padding: 'var(--spacing-lg)',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-lg)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                                            <Target size={18} style={{ color: 'var(--danger-500)' }} />
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>Failure Probability</span>
                                        </div>
                                        <div style={{ textAlign: 'center', padding: 'var(--spacing-md)' }}>
                                            <div style={{
                                                fontSize: 'var(--font-size-3xl)',
                                                fontWeight: '800',
                                                color: replacementData.failureProbability > 70
                                                    ? 'var(--danger-500)'
                                                    : replacementData.failureProbability > 40
                                                        ? 'var(--warning-500)'
                                                        : 'var(--success-500)',
                                            }}>
                                                {replacementData.failureProbability}%
                                            </div>
                                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>
                                                Estimated probability of failure
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Recommendation */}
                                <div style={{
                                    padding: 'var(--spacing-lg)',
                                    background: replacementData.recommendation === 'Replace Soon'
                                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.02))'
                                        : 'linear-gradient(135deg, rgba(26, 122, 184, 0.1), rgba(26, 122, 184, 0.02))',
                                    border: `1px solid ${replacementData.recommendation === 'Replace Soon' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(26, 122, 184, 0.3)'}`,
                                    borderRadius: 'var(--radius-lg)',
                                    display: 'flex',
                                    flexDirection: isMobile ? 'column' : 'row',
                                    alignItems: isMobile ? 'flex-start' : 'center',
                                    justifyContent: 'space-between',
                                    gap: 'var(--spacing-md)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                        <div style={{
                                            width: '48px', height: '48px',
                                            borderRadius: 'var(--radius-lg)',
                                            background: replacementData.recommendation === 'Replace Soon' ? 'var(--danger-500)' : 'var(--primary-500)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {replacementData.recommendation === 'Replace Soon'
                                                ? <Zap size={24} color="white" />
                                                : <Wrench size={24} color="white" />
                                            }
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>Recommendation</div>
                                            <div style={{
                                                color: replacementData.recommendation === 'Replace Soon' ? 'var(--danger-500)' : 'var(--primary-500)',
                                                fontSize: 'var(--font-size-lg)', fontWeight: '700'
                                            }}>
                                                {replacementData.recommendation}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>Est. Replacement Cost</div>
                                        <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-xl)', fontWeight: '700' }}>
                                            {formatCurrency(replacementData.replacementCost)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/optimal-replacement')}
                                className="btn btn-secondary"
                                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}
                            >
                                Open Full Replacement Analysis <ChevronRight size={18} />
                            </button>
                        </div>
                    )}

                    {/* ==================== MAINTENANCE TASKS TAB ==================== */}
                    {activeTab === 'tasks' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            <div className="card" style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
                                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                    <h2 style={{
                                        fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                        display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', margin: 0
                                    }}>
                                        <Wrench size={20} style={{ color: 'var(--primary-500)' }} />
                                        Maintenance Tasks
                                    </h2>
                                </div>

                                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)', lineHeight: 1.6 }}>
                                    View and manage scheduled maintenance tasks for <strong>{asset.equipment_name}</strong>.
                                    Track task assignments, frequencies, and completion status.
                                </p>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                                    gap: 'var(--spacing-md)',
                                }}>
                                    {[
                                        { label: 'Preventive', count: 3, color: '#22c55e', bg: '#f0fdf4' },
                                        { label: 'Predictive', count: 2, color: '#1a7ab8', bg: '#eff6ff' },
                                        { label: 'Corrective', count: 1, color: '#dc3545', bg: '#fee2e2' },
                                        { label: 'Condition-Based', count: 1, color: '#8b5cf6', bg: '#f5f3ff' },
                                    ].map((item, i) => (
                                        <div key={i} style={{
                                            background: item.bg,
                                            borderRadius: 'var(--radius-lg)',
                                            padding: 'var(--spacing-md)',
                                            textAlign: 'center',
                                            border: `1px solid ${item.color}20`,
                                        }}>
                                            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: item.color }}>{item.count}</div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>{item.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/maintenance-tasks')}
                                className="btn btn-secondary"
                                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}
                            >
                                Open Full Maintenance Tasks <ChevronRight size={18} />
                            </button>
                        </div>
                    )}

                    {/* ==================== MAINTENANCE PLAN TAB ==================== */}
                    {activeTab === 'plan' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            <div className="card" style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
                                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                    <h2 style={{
                                        fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                        display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', margin: 0
                                    }}>
                                        <ClipboardList size={20} style={{ color: 'var(--primary-500)' }} />
                                        Maintenance Plan
                                    </h2>
                                </div>

                                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)', lineHeight: 1.6 }}>
                                    Comprehensive maintenance plan for <strong>{asset.equipment_name}</strong> covering
                                    daily, weekly, monthly, quarterly, semi-annual, and annual tasks with detailed procedures.
                                </p>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                                    gap: 'var(--spacing-md)',
                                }}>
                                    {[
                                        { label: 'Daily Checks', desc: 'Pressure monitoring, visual inspections', icon: '📋' },
                                        { label: 'Weekly Tasks', desc: 'Electrical & seal inspections', icon: '🔧' },
                                        { label: 'Monthly Checks', desc: 'Motor analysis, hydraulic performance', icon: '⚙️' },
                                        { label: 'Quarterly Service', desc: 'Alignment, impeller, lubrication', icon: '🔩' },
                                        { label: 'Semi-Annual', desc: 'Motor rewind, performance validation', icon: '🏭' },
                                        { label: 'Annual Overhaul', desc: 'Seal replacement, bearing swap', icon: '📅' },
                                    ].map((item, i) => (
                                        <div key={i} style={{
                                            padding: 'var(--spacing-md)',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-lg)',
                                            borderLeft: '3px solid var(--primary-500)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                                                <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>{item.label}</span>
                                            </div>
                                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>{item.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/maintenance-plan')}
                                className="btn btn-secondary"
                                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}
                            >
                                Open Full Maintenance Plan <ChevronRight size={18} />
                            </button>
                        </div>
                    )}

                    {/* ==================== REPORT TAB ==================== */}
                    {activeTab === 'report' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>

                            {/* Report Header */}
                            <div className="card" style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
                                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                    <h2 style={{
                                        fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                        display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', margin: 0
                                    }}>
                                        <FileText size={20} style={{ color: 'var(--primary-500)' }} />
                                        RCM Report — {asset.equipment_name}
                                    </h2>
                                </div>

                                {/* Report Date & Asset Info */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                                    gap: 'var(--spacing-md)',
                                    marginBottom: 'var(--spacing-lg)',
                                    padding: 'var(--spacing-md)',
                                    background: 'linear-gradient(135deg, rgba(26, 122, 184, 0.08), rgba(26, 122, 184, 0.02))',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid rgba(26, 122, 184, 0.15)'
                                }}>
                                    <div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>Equipment</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: 'var(--font-size-sm)' }}>{asset.equipment_name}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>Tag Number</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: 'var(--font-size-sm)' }}>{asset.tag_number}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>Report Date</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: 'var(--font-size-sm)' }}>
                                            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </div>
                                    </div>
                                </div>

                                {/* Executive Summary */}
                                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                    <h3 style={{
                                        fontSize: 'var(--font-size-md)',
                                        color: 'var(--primary-500)',
                                        marginBottom: 'var(--spacing-sm)',
                                        paddingBottom: 'var(--spacing-xs)',
                                        borderBottom: '2px solid var(--primary-500)'
                                    }}>
                                        Executive Summary
                                    </h3>
                                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 'var(--font-size-sm)' }}>
                                        This Reliability-Centered Maintenance report presents the analysis findings for <strong>{asset.equipment_name}</strong> ({asset.tag_number}).
                                        The equipment has a <strong style={{ color: getRiskColor(asset.criticality_level || asset.status || 'Operational') }}>{asset.criticality_level || asset.status || 'Operational'}</strong> criticality rating
                                        with an overall RPN score of <strong>{riskData?.rpn || 0}</strong>.
                                        {fmeaData.length > 0 && ` A total of ${fmeaData.length} failure modes have been identified and analyzed.`}
                                        {costData && ` Estimated annual maintenance cost is ${formatCurrency(costData.estimatedAnnualCost)} with potential savings of ${formatCurrency(costData.potentialSavings)}.`}
                                    </p>
                                </div>

                                {/* FMEA Summary Table */}
                                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                    <h3 style={{
                                        fontSize: 'var(--font-size-md)',
                                        color: 'var(--primary-500)',
                                        marginBottom: 'var(--spacing-sm)',
                                        paddingBottom: 'var(--spacing-xs)',
                                        borderBottom: '2px solid var(--primary-500)'
                                    }}>
                                        FMEA Analysis Results
                                    </h3>
                                    {isMobile ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                            {fmeaData.map((entry) => (
                                                <div key={entry.id} style={{
                                                    padding: 'var(--spacing-sm)',
                                                    background: 'var(--bg-tertiary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    borderLeft: `3px solid ${getRiskColor(entry.riskLevel)}`,
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                        <span style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)' }}>{entry.failureMode}</span>
                                                        <span className={`badge ${getRiskBadge(entry.riskLevel)}`} style={{ fontSize: 'var(--font-size-xs)' }}>
                                                            RPN: {entry.rpn}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                                        S: {entry.severity} | O: {entry.occurrence} | D: {entry.detection}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ overflow: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                                                <thead>
                                                    <tr style={{ background: 'var(--primary-500)', color: 'white' }}>
                                                        {['Failure Mode', 'Cause', 'Effect', 'S', 'O', 'D', 'RPN', 'Risk'].map(h => (
                                                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {fmeaData.map((entry, i) => (
                                                        <tr key={entry.id} style={{ background: i % 2 === 0 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                                            <td style={{ padding: '10px 12px', fontWeight: '600' }}>{entry.failureMode}</td>
                                                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{entry.cause}</td>
                                                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{entry.effect}</td>
                                                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600' }}>{entry.severity}</td>
                                                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600' }}>{entry.occurrence}</td>
                                                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600' }}>{entry.detection}</td>
                                                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: getRiskColor(entry.riskLevel) }}>{entry.rpn}</td>
                                                            <td style={{ padding: '10px 12px' }}>
                                                                <span className={`badge ${getRiskBadge(entry.riskLevel)}`}>{entry.riskLevel}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Risk Assessment */}
                                {riskData && (
                                    <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                        <h3 style={{
                                            fontSize: 'var(--font-size-md)',
                                            color: 'var(--primary-500)',
                                            marginBottom: 'var(--spacing-sm)',
                                            paddingBottom: 'var(--spacing-xs)',
                                            borderBottom: '2px solid var(--primary-500)'
                                        }}>
                                            Risk Assessment
                                        </h3>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                                            gap: 'var(--spacing-md)',
                                            marginBottom: 'var(--spacing-md)'
                                        }}>
                                            <div style={{ padding: 'var(--spacing-md)', background: `linear-gradient(135deg, ${getRiskColor(riskData.overallRisk)}15, transparent)`, borderRadius: 'var(--radius-lg)', textAlign: 'center', border: `1px solid ${getRiskColor(riskData.overallRisk)}33` }}>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>Overall Risk</div>
                                                <div style={{ color: getRiskColor(riskData.overallRisk), fontSize: 'var(--font-size-xl)', fontWeight: '800' }}>{riskData.overallRisk}</div>
                                            </div>
                                            <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>RPN Score</div>
                                                <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-xl)', fontWeight: '800' }}>{riskData.rpn}</div>
                                            </div>
                                            <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>Failure Modes</div>
                                                <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-xl)', fontWeight: '800' }}>{riskData.failureModes}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                                            {riskData.riskMatrix.map((item, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-xs) var(--spacing-sm)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', flex: '1' }}>{item.category}</span>
                                                    <div style={{ flex: '2', height: '8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                                        <div style={{ width: `${(item.score / 15) * 100}%`, height: '100%', background: getRiskColor(item.level), borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
                                                    </div>
                                                    <span className={`badge ${getRiskBadge(item.level)}`} style={{ fontSize: 'var(--font-size-xs)', minWidth: '60px', textAlign: 'center' }}>{item.level}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Cost Analysis */}
                                {costData && (
                                    <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                        <h3 style={{
                                            fontSize: 'var(--font-size-md)',
                                            color: 'var(--primary-500)',
                                            marginBottom: 'var(--spacing-sm)',
                                            paddingBottom: 'var(--spacing-xs)',
                                            borderBottom: '2px solid var(--primary-500)'
                                        }}>
                                            Cost Analysis
                                        </h3>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                                            gap: 'var(--spacing-md)',
                                            marginBottom: 'var(--spacing-md)'
                                        }}>
                                            <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>Annual Cost</div>
                                                <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-lg)', fontWeight: '700' }}>{formatCurrency(costData.estimatedAnnualCost)}</div>
                                            </div>
                                            <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>Preventive</div>
                                                <div style={{ color: 'var(--primary-500)', fontSize: 'var(--font-size-lg)', fontWeight: '700' }}>{formatCurrency(costData.preventiveCost)}</div>
                                            </div>
                                            <div style={{ padding: 'var(--spacing-md)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>Corrective</div>
                                                <div style={{ color: 'var(--danger-500)', fontSize: 'var(--font-size-lg)', fontWeight: '700' }}>{formatCurrency(costData.correctiveCost)}</div>
                                            </div>
                                            <div style={{ padding: 'var(--spacing-md)', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.02))', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                                <div style={{ color: 'var(--success-500)', fontSize: 'var(--font-size-xs)', marginBottom: '4px', fontWeight: '600' }}>💰 Savings</div>
                                                <div style={{ color: 'var(--success-500)', fontSize: 'var(--font-size-lg)', fontWeight: '700' }}>{formatCurrency(costData.potentialSavings)}</div>
                                            </div>
                                        </div>
                                        {/* Cost breakdown bar */}
                                        <div style={{ height: '20px', borderRadius: 'var(--radius-full)', overflow: 'hidden', display: 'flex', marginBottom: 'var(--spacing-sm)' }}>
                                            <div style={{ width: `${(costData.preventiveCost / costData.estimatedAnnualCost) * 100}%`, background: 'var(--primary-500)' }} />
                                            <div style={{ width: `${(costData.correctiveCost / costData.estimatedAnnualCost) * 100}%`, background: 'var(--danger-500)' }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--spacing-lg)', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--primary-500)', display: 'inline-block' }} />
                                                Preventive ({Math.round((costData.preventiveCost / costData.estimatedAnnualCost) * 100)}%)
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--danger-500)', display: 'inline-block' }} />
                                                Corrective ({Math.round((costData.correctiveCost / costData.estimatedAnnualCost) * 100)}%)
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Recommendations */}
                                {replacementData && (
                                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                        <h3 style={{
                                            fontSize: 'var(--font-size-md)',
                                            color: 'var(--primary-500)',
                                            marginBottom: 'var(--spacing-sm)',
                                            paddingBottom: 'var(--spacing-xs)',
                                            borderBottom: '2px solid var(--primary-500)'
                                        }}>
                                            Recommendations
                                        </h3>
                                        <div style={{
                                            padding: 'var(--spacing-md)',
                                            background: replacementData.recommendation === 'Replace Soon'
                                                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.02))'
                                                : 'linear-gradient(135deg, rgba(26, 122, 184, 0.08), rgba(26, 122, 184, 0.02))',
                                            border: `1px solid ${replacementData.recommendation === 'Replace Soon' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(26, 122, 184, 0.25)'}`,
                                            borderRadius: 'var(--radius-lg)',
                                            display: 'flex',
                                            flexDirection: isMobile ? 'column' : 'row',
                                            alignItems: isMobile ? 'flex-start' : 'center',
                                            justifyContent: 'space-between',
                                            gap: 'var(--spacing-md)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                                <div style={{
                                                    width: '44px', height: '44px',
                                                    borderRadius: 'var(--radius-lg)',
                                                    background: replacementData.recommendation === 'Replace Soon' ? 'var(--danger-500)' : 'var(--primary-500)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    {replacementData.recommendation === 'Replace Soon'
                                                        ? <Zap size={22} color="white" />
                                                        : <Wrench size={22} color="white" />
                                                    }
                                                </div>
                                                <div>
                                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>Action</div>
                                                    <div style={{
                                                        color: replacementData.recommendation === 'Replace Soon' ? 'var(--danger-500)' : 'var(--primary-500)',
                                                        fontSize: 'var(--font-size-md)', fontWeight: '700'
                                                    }}>
                                                        {replacementData.recommendation}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>Age</div>
                                                    <div style={{ fontWeight: '700', fontSize: 'var(--font-size-sm)' }}>{replacementData.currentAge} / {replacementData.optimalAge} yrs</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>Failure Prob.</div>
                                                    <div style={{ fontWeight: '700', fontSize: 'var(--font-size-sm)', color: replacementData.failureProbability > 70 ? 'var(--danger-500)' : replacementData.failureProbability > 40 ? 'var(--warning-500)' : 'var(--success-500)' }}>
                                                        {replacementData.failureProbability}%
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>Replace Cost</div>
                                                    <div style={{ fontWeight: '700', fontSize: 'var(--font-size-sm)' }}>{formatCurrency(replacementData.replacementCost)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                </div>
                            </div>
                    )}

                    {/* ==================== SPARES TAB ==================== */}
                    {activeTab === 'spares' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            <div className="card" style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                                    <h2 style={{
                                        fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                                        display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', margin: 0
                                    }}>
                                        <Package size={20} style={{ color: 'var(--primary-500)' }} />
                                        Spare Parts Inventory
                                    </h2>
                                    <button
                                        onClick={() => setShowSpareModal(true)}
                                        className="btn btn-primary"
                                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)' }}
                                    >
                                        <Plus size={16} />
                                        Add Spare Part
                                    </button>
                                </div>

                                {sparePartsData.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)', color: 'var(--text-tertiary)' }}>
                                        <Package size={48} style={{ marginBottom: 'var(--spacing-sm)', opacity: 0.5 }} />
                                        <p>No spare parts defined for this asset yet.</p>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                                    <th style={{ padding: 'var(--spacing-sm) 0' }}>Part Name</th>
                                                    <th style={{ padding: 'var(--spacing-sm) 0' }}>Part Number</th>
                                                    <th style={{ padding: 'var(--spacing-sm) 0' }}>Supplier</th>
                                                    <th style={{ padding: 'var(--spacing-sm) 0', textAlign: 'center' }}>Quantity</th>
                                                    <th style={{ padding: 'var(--spacing-sm) 0', textAlign: 'center' }}>Min. Stock</th>
                                                    <th style={{ padding: 'var(--spacing-sm) 0', textAlign: 'right' }}>Unit Cost</th>
                                                    <th style={{ padding: 'var(--spacing-sm) 0', textAlign: 'right' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sparePartsData.map((spare, idx) => (
                                                    <tr key={spare.id} style={{ borderBottom: idx < sparePartsData.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                                        <td style={{ padding: 'var(--spacing-sm) 0', fontWeight: 'bold' }}>{spare.partName}</td>
                                                        <td style={{ padding: 'var(--spacing-sm) 0', color: 'var(--text-secondary)' }}>{spare.partNumber}</td>
                                                        <td style={{ padding: 'var(--spacing-sm) 0', color: 'var(--text-secondary)' }}>{spare.supplier || '-'}</td>
                                                        <td style={{ padding: 'var(--spacing-sm) 0', textAlign: 'center', color: spare.quantity <= spare.minimumStock ? 'var(--danger-500)' : 'var(--text-primary)', fontWeight: spare.quantity <= spare.minimumStock ? 'bold' : 'normal' }}>
                                                            {spare.quantity}
                                                        </td>
                                                        <td style={{ padding: 'var(--spacing-sm) 0', textAlign: 'center' }}>{spare.minimumStock}</td>
                                                        <td style={{ padding: 'var(--spacing-sm) 0', textAlign: 'right' }}>{formatCurrency(spare.unitCost)}</td>
                                                        <td style={{ padding: 'var(--spacing-sm) 0', textAlign: 'right' }}>
                                                            <button onClick={() => handleEditSpare(spare)} className="btn btn-ghost" style={{ padding: '4px', color: 'var(--text-tertiary)' }}><Pencil size={16} /></button>
                                                            <button onClick={() => handleDeleteSpare(spare.id)} className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger-500)' }}><Trash2 size={16} /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ==================== FAULT HISTORY TAB ==================== */}
                    {activeTab === 'history' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            <div className="card" style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                                    <h2 style={{ fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', margin: 0 }}>
                                        <History size={20} style={{ color: 'var(--warning-500)' }} />
                                        Fault History
                                    </h2>
                                    {showSavedNotification && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success-500)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                                            <CheckCircle2 size={14} /> Saved
                                        </span>
                                    )}
                                </div>

                                {/* Add New Component */}
                                <div style={{
                                    padding: 'var(--spacing-md)',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: 'var(--spacing-lg)',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
                                        Add Component
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                        <input
                                            type="text"
                                            placeholder="Enter component name (e.g. Bearing, Motor, Pump Seal...)"
                                            value={newComponentName}
                                            onChange={e => setNewComponentName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddComponent()}
                                            className="input"
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            onClick={handleAddComponent}
                                            className="btn btn-primary"
                                            style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', whiteSpace: 'nowrap' }}
                                        >
                                            <Plus size={16} /> Add Component
                                        </button>
                                    </div>
                                </div>

                                {/* Components List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                {components.map((component, compIdx) => {
                                    const componentFaults = faults.filter(f => f.componentId === component.id || f.partName === component.name);
                                    const isExpanded = expandedComponents[component.name];
                                    return (
                                        <div key={component.id} style={{
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)',
                                            overflow: 'hidden',
                                            transition: 'box-shadow 0.2s',
                                            boxShadow: isExpanded ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
                                        }}>
                                            {/* Component Header */}
                                            <div
                                                onClick={() => toggleComponent(component.name)}
                                                style={{
                                                    padding: 'var(--spacing-md) var(--spacing-lg)',
                                                    background: isExpanded ? 'linear-gradient(135deg, var(--primary-500)10, var(--bg-tertiary))' : 'var(--bg-tertiary)',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    userSelect: 'none',
                                                    borderLeft: isExpanded ? '3px solid var(--primary-500)' : '3px solid transparent',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                                    <Cpu size={18} style={{ color: isExpanded ? 'var(--primary-500)' : 'var(--text-tertiary)' }} />
                                                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>
                                                        {compIdx + 1}. {component.name}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                                                    <span style={{
                                                        fontSize: 'var(--font-size-xs)',
                                                        padding: '2px 10px',
                                                        borderRadius: 'var(--radius-full)',
                                                        background: componentFaults.length > 0 ? 'var(--warning-100)' : 'var(--bg-secondary)',
                                                        color: componentFaults.length > 0 ? 'var(--warning-600)' : 'var(--text-tertiary)',
                                                        fontWeight: 600
                                                    }}>
                                                        {componentFaults.length} Fault{componentFaults.length !== 1 ? 's' : ''}
                                                    </span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteComponent(component.id, component.name); }}
                                                        className="btn btn-ghost"
                                                        style={{ padding: '4px', color: 'var(--danger-500)' }}
                                                        title="Delete component"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                        <ChevronRight
                                                            size={18}
                                                            style={{
                                                                transform: isExpanded ? 'rotate(90deg)' : 'none',
                                                                transition: 'transform 0.2s',
                                                                color: 'var(--text-tertiary)'
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Expanded Content */}
                                                {isExpanded && (
                                                    <div style={{ padding: 'var(--spacing-md) var(--spacing-lg)', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)' }}>
                                                        {/* Add Fault for this Component */}
                                                        <div style={{
                                                            display: 'flex',
                                                            gap: 'var(--spacing-sm)',
                                                            marginBottom: 'var(--spacing-md)',
                                                            flexWrap: isMobile ? 'wrap' : 'nowrap'
                                                        }}>
                                                            <input
                                                                type="number"
                                                                placeholder="Failed at Time (Hours)"
                                                                value={newFaultByComponent[component.name] || ''}
                                                                onChange={e => setNewFaultByComponent(prev => ({...prev, [component.name]: e.target.value}))}
                                                                onKeyDown={e => e.key === 'Enter' && handleAddFaultToComponent(component.id, component.name)}
                                                                className="input"
                                                                style={{ flex: 1, minWidth: '180px' }}
                                                            />
                                                            <button
                                                                onClick={() => handleAddFaultToComponent(component.id, component.name)}
                                                                className="btn btn-primary"
                                                                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)' }}
                                                            >
                                                                <Plus size={14} /> Add Fault
                                                            </button>
                                                        </div>

                                                        {/* Fault Table */}
                                                        {componentFaults.length > 0 ? (
                                                            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                                                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                                                    <thead>
                                                                        <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
                                                                            <th style={{ padding: 'var(--spacing-sm) 0', borderRight: '1px solid var(--border-color)' }}>Failure number</th>
                                                                            <th style={{ padding: 'var(--spacing-sm) 0', borderRight: '1px solid var(--border-color)' }}>Failed at Time (Hours)</th>
                                                                            <th style={{ padding: 'var(--spacing-sm) 0', width: '80px' }}>Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {componentFaults.map((fault, idx) => (
                                                                            <tr key={fault.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--bg-tertiary)' : 'transparent' }}>
                                                                                <td style={{ padding: 'var(--spacing-sm) 0', fontWeight: 'bold', borderRight: '1px solid var(--border-color)' }}>{idx + 1}</td>
                                                                                <td style={{ padding: 'var(--spacing-sm) 0', borderRight: '1px solid var(--border-color)' }}>{fault.failedAtTime}</td>
                                                                                <td style={{ padding: 'var(--spacing-sm) 0' }}>
                                                                                    <button onClick={() => handleDeleteFault(fault.id)} className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger-500)' }}><Trash2 size={16} /></button>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                        <tr style={{ borderTop: '2px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                                                                            <td style={{ padding: 'var(--spacing-sm) 0', fontWeight: 'bold', borderRight: '1px solid var(--border-color)' }}>Total Operating Hours</td>
                                                                            <td style={{ padding: 'var(--spacing-sm) 0', fontWeight: 'bold', borderRight: '1px solid var(--border-color)' }}>
                                                                                {componentFaults.reduce((acc, curr) => acc + (Number(curr.failedAtTime) || 0), 0)}
                                                                            </td>
                                                                            <td></td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        ) : (
                                                            <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                                                No faults recorded for this component yet.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {components.length === 0 && (
                                        <div style={{
                                            textAlign: 'center',
                                            padding: 'var(--spacing-2xl)',
                                            color: 'var(--text-tertiary)',
                                            border: '2px dashed var(--border-color)',
                                            borderRadius: 'var(--radius-md)'
                                        }}>
                                            <Cpu size={40} style={{ marginBottom: 'var(--spacing-sm)', opacity: 0.4 }} />
                                            <p style={{ margin: 0 }}>No components added yet. Add a component above to start tracking faults.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== ADD MANUAL TAB ==================== */}
                    {activeTab === 'manual' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            <div className="card" style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)' }}>
                                <h2 style={{ fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                                    <FileText size={20} style={{ color: 'var(--primary-500)' }} />
                                    Equipment Manual 
                                </h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)' }}>
                                    Upload the operating manual or technical specifications for this asset.
                                </p>
                                
                                <div style={{
                                    border: '2px dashed var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--spacing-2xl)',
                                    textAlign: 'center',
                                    background: 'var(--bg-tertiary)',
                                    position: 'relative',
                                    transition: 'all 0.2s',
                                    cursor: 'pointer'
                                }}>
                                    <input 
                                        type="file" 
                                        accept=".pdf,.doc,.docx"
                                        onChange={handleManualUpload}
                                        style={{
                                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer'
                                        }}
                                    />
                                <div style={{ pointerEvents: 'none' }}>
                                    {manualUploading ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <RefreshCw size={32} style={{ color: 'var(--primary-500)', animation: 'spin 1s linear infinite' }} />
                                            <span style={{ color: 'var(--primary-500)', fontWeight: 600, fontSize: 'var(--font-size-md)' }}>
                                                Uploading...
                                            </span>
                                        </div>
                                    ) : manualFile ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--success-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <CheckCircle2 color="var(--success-500)" size={24} />
                                            </div>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--font-size-md)' }}>
                                                {manualFile.name}
                                            </span>
                                            <span style={{ color: 'var(--primary-500)', fontSize: 'var(--font-size-sm)' }}>Click anywhere here to replace file</span>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <Upload color="var(--text-tertiary)" size={32} />
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)' }}>
                                                Drag & drop or <span style={{ color: 'var(--primary-500)', fontWeight: 600 }}>Browse</span>
                                            </span>
                                            <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                                PDF, DOC, DOCX up to 50MB
                                            </span>
                                        </div>
                                    )}
                                </div>
                                </div>
                                {manualUploadMessage && (
                                    <div style={{
                                        marginTop: 'var(--spacing-md)',
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        background: manualUploadMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 26, 26, 0.1)',
                                        border: `1px solid ${manualUploadMessage.type === 'success' ? 'var(--success-500)' : 'var(--danger-500)'}`,
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-sm)',
                                        color: manualUploadMessage.type === 'success' ? 'var(--success-500)' : 'var(--danger-500)',
                                        fontWeight: 500,
                                    }}>
                                        {manualUploadMessage.text}
                                    </div>
                                )}
                                {manualFile && (
                                    <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
                                        <button 
                                            onClick={handleRemoveManual}
                                            className="btn btn-ghost"
                                            style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--danger-500)', border: '1px solid var(--danger-500)' }}
                                        >
                                            <Trash2 size={16} /> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                {/* Spare Part Modal */}
                {showSpareModal && (
                    <>
                        <div
                            onClick={() => { setShowSpareModal(false); resetSpareForm(); }}
                            style={{
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', zIndex: 9998,
                            }}
                        />
                        <div style={{
                            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: isMobile ? '95%' : '500px', background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-xl)',
                            boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-color)', zIndex: 9999,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                                <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>{editingSpareId ? 'Edit Spare Part' : 'Add Spare Part'}</h3>
                                <button onClick={() => { setShowSpareModal(false); resetSpareForm(); }} className="btn btn-ghost" style={{ padding: '4px' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Part Name *</label>
                                    <input className="input" value={spareForm.partName} onChange={e => setSpareForm({ ...spareForm, partName: e.target.value })} placeholder="e.g., Bearings" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Part Number *</label>
                                    <input className="input" value={spareForm.partNumber} onChange={e => setSpareForm({ ...spareForm, partNumber: e.target.value })} placeholder="e.g., BRG-123" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Quantity</label>
                                        <input className="input" type="number" value={spareForm.quantity || ''} onChange={e => setSpareForm({ ...spareForm, quantity: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Min Stock Level</label>
                                        <input className="input" type="number" value={spareForm.minimumStock || ''} onChange={e => setSpareForm({ ...spareForm, minimumStock: Number(e.target.value) })} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Unit Cost ($)</label>
                                    <input className="input" type="number" value={spareForm.unitCost || ''} onChange={e => setSpareForm({ ...spareForm, unitCost: Number(e.target.value) })} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Supplier</label>
                                    <input className="input" value={spareForm.supplier} onChange={e => setSpareForm({ ...spareForm, supplier: e.target.value })} placeholder="e.g., SKF" />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-xl)' }}>
                                <button className="btn btn-ghost" onClick={() => { setShowSpareModal(false); resetSpareForm(); }}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleSaveSpare} disabled={!spareForm.partName.trim() || !spareForm.partNumber.trim()}>
                                    <Save size={18} style={{ marginRight: '8px' }} /> Save Part
                                </button>
                            </div>
                        </div>
                    </>
                )}

                <style>{`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </PageContainer>
        </>
    );
}
