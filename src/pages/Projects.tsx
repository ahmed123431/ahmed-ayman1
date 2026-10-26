import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Trash2, Pencil, Save } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import GlobalSearch from '../components/GlobalSearch';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useLanguage } from '../contexts/LanguageContext';
import { useSidebar } from '../contexts/SidebarContext';
import { useAssetContext } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface Project {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    status: 'active' | 'completed' | 'archived';
    assetCount?: number;
}

export default function Projects() {
    const navigate = useNavigate();
    const { t, language } = useLanguage();
    const { isMobile } = useSidebar();
    const { setCurrentProject } = useAssetContext();
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [newProject, setNewProject] = useState({
        name: '',
        description: '',
        status: 'active' as 'active' | 'completed' | 'archived'
    });
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; projectId: string; projectName: string }>({ isOpen: false, projectId: '', projectName: '' });

    useEffect(() => {
        loadProjects();
    }, [user]);

    const loadProjects = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Fetch projects
            const { data: projectData, error: projectError } = await supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });

            if (projectError) throw projectError;

            // Fetch asset counts
            const { data: assetsData, error: assetsError } = await supabase
                .from('assets')
                .select('project_id');

            if (assetsError) throw assetsError;

            // Map the data
            const projectsWithCounts = (projectData || []).map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
                status: p.status,
                assetCount: (assetsData || []).filter(a => a.project_id === p.id).length
            }));

            if (projectsWithCounts.length > 0) {
                setProjects(projectsWithCounts);
            } else {
                setProjects([
                    {
                        id: 'demo-proj-01',
                        name: 'Industrial Plant Operations (RCM 7Q)',
                        description: 'Main production facility reliability & critical machinery maintenance study.',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        status: 'active',
                        assetCount: 4
                    }
                ]);
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            setProjects([
                {
                    id: 'demo-proj-01',
                    name: 'Industrial Plant Operations (RCM 7Q)',
                    description: 'Main production facility reliability & critical machinery maintenance study.',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    status: 'active',
                    assetCount: 4
                }
            ]);
        } finally {
            setLoading(false);
        }
    };


    const handleCreateProject = async () => {
        if (newProject.name.trim() && user) {
            try {
                const { data, error } = await supabase
                    .from('projects')
                    .insert([{
                        user_id: user.id,
                        name: newProject.name,
                        description: newProject.description,
                        status: newProject.status
                    }])
                    .select();

                if (error) throw error;
                if (data && data.length > 0) {
                    await loadProjects();
                }

                setNewProject({ name: '', description: '', status: 'active' });
                setShowCreateModal(false);
            } catch (error) {
                console.error('Error creating project:', error);
            }
        }
    };

    const handleDeleteProject = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        setDeleteConfirm({
            isOpen: true,
            projectId,
            projectName: project?.name || 'this project'
        });
    };

    const confirmDeleteProject = async () => {
        const projectId = deleteConfirm.projectId;
        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId);

            if (error) throw error;
            
            // Assets will be deleted by ON DELETE CASCADE
            await loadProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
        } finally {
            setDeleteConfirm({ isOpen: false, projectId: '', projectName: '' });
        }
    };

    const handleEditProject = (project: Project) => {
        setNewProject({
            name: project.name,
            description: project.description,
            status: project.status
        });
        setEditingProjectId(project.id);
        setShowCreateModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingProjectId || !newProject.name.trim()) return;
        try {
            const { error } = await supabase
                .from('projects')
                .update({
                    name: newProject.name,
                    description: newProject.description,
                    status: newProject.status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingProjectId);

            if (error) throw error;
            await loadProjects();

            setNewProject({ name: '', description: '', status: 'active' });
            setEditingProjectId(null);
            setShowCreateModal(false);
        } catch (error) {
            console.error('Error updating project:', error);
        }
    };

    const resetForm = () => {
        setNewProject({ name: '', description: '', status: 'active' });
        setEditingProjectId(null);
    };

    const handleProjectClick = (projectId: string) => {
        setCurrentProject(projectId);
        navigate('/assets');
    };



    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'badge-success';
            case 'completed': return 'badge-primary';
            case 'archived': return 'badge-warning';
            default: return 'badge-primary';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'active': return t('projects.active');
            case 'completed': return t('projects.completed');
            case 'archived': return t('projects.archived');
            default: return status;
        }
    };

    // Mobile Project Card
    const renderProjectCard = (project: Project) => (
        <div
            key={project.id}
            className="card"
            style={{
                padding: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-md)',
                cursor: 'pointer'
            }}
            onClick={() => handleProjectClick(project.id)}
        >
            {/* Header with icon, name and delete */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--spacing-sm)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1, minWidth: 0 }}>
                    <div style={{
                        background: 'var(--gradient-primary)',
                        padding: 'var(--spacing-xs)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <FolderOpen size={18} color="white" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            color: 'var(--text-primary)',
                            fontWeight: '600',
                            fontSize: 'var(--font-size-md)'
                        }}>
                            {project.name}
                        </div>
                        {project.description && (
                            <div style={{
                                color: 'var(--text-tertiary)',
                                fontSize: 'var(--font-size-xs)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {project.description}
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <span className={`badge ${getStatusColor(project.status)}`} style={{ textTransform: 'capitalize' }}>
                        {getStatusLabel(project.status)}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleEditProject(project);
                        }}
                        className="btn btn-ghost"
                        style={{
                            padding: 'var(--spacing-xs)',
                            minWidth: 'auto',
                            color: 'var(--primary-500)'
                        }}
                        title="Edit project"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                        }}
                        className="btn btn-ghost"
                        style={{
                            padding: 'var(--spacing-xs)',
                            minWidth: 'auto',
                            color: 'var(--danger-500)'
                        }}
                        title={t('projects.deleteProject')}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--spacing-sm)',
                padding: 'var(--spacing-sm)',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '2px' }}>
                        {t('projects.assets')}
                    </div>
                    <div style={{ color: 'var(--primary-500)', fontSize: 'var(--font-size-md)', fontWeight: '600' }}>
                        {project.assetCount || 0}
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '2px' }}>
                        {t('projects.created')}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', fontWeight: '500' }}>
                        {formatDate(project.createdAt).split(',')[0]}
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: '2px' }}>
                        {t('projects.updated')}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', fontWeight: '500' }}>
                        {formatDate(project.updatedAt).split(',')[0]}
                    </div>
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
                        justifyContent: 'space-between',
                        alignItems: isMobile ? 'stretch' : 'center',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-xl)'
                    }}>
                        <div>
                            <h1 style={{
                                marginBottom: 'var(--spacing-xs)',
                                fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)'
                            }}>
                                {t('projects.title')}
                            </h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)' }}>
                                {t('projects.subtitle')}
                            </p>
                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)'
                        }}>
                            <GlobalSearch pageType="projects" />
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="btn btn-primary"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 'var(--spacing-sm)'
                                }}
                            >
                                <Plus size={20} />
                                {t('projects.new')}
                            </button>
                        </div>
                    </div>

                    {/* Projects Table/Cards */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-3xl)', color: 'var(--text-tertiary)' }}>
                            <div className="animate-pulse" style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>Loading projects...</div>
                        </div>
                    ) : projects.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: isMobile ? 'var(--spacing-xl)' : 'var(--spacing-3xl)',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '2px dashed var(--border-color)'
                        }}>
                            <FolderOpen
                                size={isMobile ? 48 : 64}
                                style={{
                                    color: 'var(--text-tertiary)',
                                    marginBottom: 'var(--spacing-md)'
                                }}
                            />
                            <h3 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-primary)', fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)' }}>
                                {t('projects.noProjects')}
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)' }}>
                                {t('projects.createFirst')}
                            </p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="btn btn-primary"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-sm)'
                                }}
                            >
                                <Plus size={20} />
                                {t('projects.new')}
                            </button>
                        </div>
                    ) : isMobile ? (
                        // Mobile: Card Layout
                        <div>
                            {projects.map(project => renderProjectCard(project))}
                        </div>
                    ) : (
                        // Desktop: Table Layout
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-color)',
                            overflow: 'hidden'
                        }}>
                            {/* Table Header */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '2.5fr 2fr 1fr 1fr 1fr 1fr 0.8fr',
                                gap: 'var(--spacing-md)',
                                padding: 'var(--spacing-md) var(--spacing-lg)',
                                background: 'var(--bg-tertiary)',
                                borderBottom: '1px solid var(--border-color)',
                                fontWeight: '600',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-secondary)'
                            }}>
                                <div>{t('projects.projectName')}</div>
                                <div>{t('projects.description')}</div>
                                <div>{t('projects.status')}</div>
                                <div>{t('projects.assets')}</div>
                                <div>{t('projects.created')}</div>
                                <div>{t('projects.updated')}</div>
                                <div>Actions</div>
                            </div>

                            {/* Table Body */}
                            {projects.map((project, index) => (
                                <div
                                    key={project.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '2.5fr 2fr 1fr 1fr 1fr 1fr 0.8fr',
                                        gap: 'var(--spacing-md)',
                                        padding: 'var(--spacing-md) var(--spacing-lg)',
                                        borderBottom: index < projects.length - 1 ? '1px solid var(--border-color)' : 'none',
                                        alignItems: 'center',
                                        transition: 'background var(--transition-fast)',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => handleProjectClick(project.id)}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-sm)'
                                    }}>
                                        <div style={{
                                            background: 'var(--gradient-primary)',
                                            padding: 'var(--spacing-xs)',
                                            borderRadius: 'var(--radius-md)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <FolderOpen size={20} color="white" />
                                        </div>
                                        <span style={{
                                            color: 'var(--text-primary)',
                                            fontWeight: '600'
                                        }}>
                                            {project.name}
                                        </span>
                                    </div>
                                    <div style={{
                                        color: 'var(--text-secondary)',
                                        fontSize: 'var(--font-size-sm)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {project.description || t('projects.noDescription')}
                                    </div>
                                    <div>
                                        <span className={`badge ${getStatusColor(project.status)}`} style={{ textTransform: 'capitalize' }}>
                                            {getStatusLabel(project.status)}
                                        </span>
                                    </div>
                                    <div style={{
                                        color: 'var(--text-secondary)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}>
                                        {project.assetCount || 0} {t('projects.assets').toLowerCase()}
                                    </div>
                                    <div style={{
                                        color: 'var(--text-secondary)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}>
                                        {formatDate(project.createdAt)}
                                    </div>
                                    <div style={{
                                        color: 'var(--text-secondary)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}>
                                        {formatDate(project.updatedAt)}
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditProject(project);
                                            }}
                                            className="btn btn-ghost"
                                            style={{
                                                padding: 'var(--spacing-xs)',
                                                minWidth: 'auto',
                                                color: 'var(--primary-500)'
                                            }}
                                            title="Edit project"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteProject(project.id);
                                            }}
                                            className="btn btn-ghost"
                                            style={{
                                                padding: 'var(--spacing-xs)',
                                                minWidth: 'auto',
                                                color: 'var(--danger-500)'
                                            }}
                                            title={t('projects.deleteProject')}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Summary Stats */}
                    {projects.length > 0 && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 'var(--spacing-md)',
                            marginTop: 'var(--spacing-lg)'
                        }}>
                            <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                    {t('projects.totalProjects')}
                                </div>
                                <div style={{ color: 'var(--text-primary)', fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)', fontWeight: '700' }}>
                                    {projects.length}
                                </div>
                            </div>
                            <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                    {t('projects.activeProjects')}
                                </div>
                                <div style={{ color: 'var(--success-500)', fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)', fontWeight: '700' }}>
                                    {projects.filter(p => p.status === 'active').length}
                                </div>
                            </div>
                            <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                    {t('projects.totalAssets')}
                                </div>
                                <div style={{ color: 'var(--primary-500)', fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)', fontWeight: '700' }}>
                                    {projects.reduce((sum, p) => sum + (p.assetCount || 0), 0)}
                                </div>
                            </div>
                            <div className="card" style={{ padding: 'var(--spacing-md)' }}>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                    {t('projects.completedProjects')}
                                </div>
                                <div style={{ color: 'var(--primary-400)', fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)', fontWeight: '700' }}>
                                    {projects.filter(p => p.status === 'completed').length}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Create Project Modal */}
                    {showCreateModal && (
                        <div
                            onClick={() => { setShowCreateModal(false); resetForm(); }}
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0, 0, 0, 0.7)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 'var(--spacing-md)',
                                zIndex: 'var(--z-modal)'
                            }}>
                            <div onClick={(e) => e.stopPropagation()} style={{
                                background: 'var(--bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                padding: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-2xl)',
                                maxWidth: '600px',
                                width: '100%',
                                maxHeight: '90vh',
                                overflowY: 'auto',
                                boxShadow: 'var(--shadow-xl)',
                                border: '1px solid var(--border-color)'
                            }}>
                                <h2 style={{
                                    marginBottom: 'var(--spacing-lg)',
                                    color: 'var(--text-primary)',
                                    fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)'
                                }}>
                                    {editingProjectId ? 'Edit Project' : t('projects.createNew')}
                                </h2>

                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--spacing-md)',
                                    marginBottom: 'var(--spacing-lg)'
                                }}>
                                    <div>
                                        <label style={{
                                            display: 'block',
                                            marginBottom: 'var(--spacing-xs)',
                                            color: 'var(--text-secondary)',
                                            fontSize: 'var(--font-size-sm)',
                                            fontWeight: '500'
                                        }}>
                                            {t('projects.projectNameLabel')}
                                        </label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder={t('projects.projectNamePlaceholder')}
                                            value={newProject.name}
                                            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                            autoFocus
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
                                            {t('projects.descriptionLabel')}
                                        </label>
                                        <textarea
                                            className="textarea"
                                            placeholder={t('projects.descriptionPlaceholder')}
                                            value={newProject.description}
                                            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                                            rows={3}
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
                                            {t('projects.statusLabel')}
                                        </label>
                                        <select
                                            className="select"
                                            value={newProject.status}
                                            onChange={(e) => setNewProject({ ...newProject, status: e.target.value as 'active' | 'completed' | 'archived' })}
                                        >
                                            <option value="active">{t('projects.active')}</option>
                                            <option value="completed">{t('projects.completed')}</option>
                                            <option value="archived">{t('projects.archived')}</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    flexDirection: isMobile ? 'column-reverse' : 'row',
                                    gap: 'var(--spacing-sm)',
                                    justifyContent: 'flex-end'
                                }}>
                                    <button
                                        onClick={() => { setShowCreateModal(false); resetForm(); }}
                                        className="btn btn-secondary"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        onClick={editingProjectId ? handleSaveEdit : handleCreateProject}
                                        disabled={!newProject.name.trim()}
                                        className="btn btn-primary"
                                        style={{
                                            opacity: newProject.name.trim() ? '1' : '0.5',
                                            cursor: newProject.name.trim() ? 'pointer' : 'not-allowed',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-sm)'
                                        }}
                                    >
                                        {editingProjectId ? <><Save size={18} /> Save Changes</> : t('projects.createProject')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <ConfirmDeleteModal
                        isOpen={deleteConfirm.isOpen}
                        title="Delete Project"
                        message="Are you sure you want to delete this project? All associated assets will also be removed. This action cannot be undone."
                        itemName={deleteConfirm.projectName}
                        onConfirm={confirmDeleteProject}
                        onCancel={() => setDeleteConfirm({ isOpen: false, projectId: '', projectName: '' })}
                    />
                </div>
            </PageContainer>
        </>
    );
}
