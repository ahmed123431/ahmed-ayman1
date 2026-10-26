import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Plus, X, Pencil, Save, Trash2, Calendar,
    Clock, CheckCircle, AlertCircle, Filter, ClipboardList, Timer,
    User, ChevronLeft, ChevronRight, XCircle, RefreshCw, Loader2
} from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import GlobalSearch from '../components/GlobalSearch';
import AssetSelector from '../components/AssetSelector';
import { useSidebar } from '../contexts/SidebarContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useSearch } from '../contexts/SearchContext';
import { useAssetContext } from '../contexts/AssetContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface MaintenanceTaskItem {
    id: string;
    taskName: string;
    assetName: string;
    taskType: string;
    priority: string;
    status: string;
    assignedTo: string;
    dueDate: string;
    estimatedDuration: number;
    description: string;
    frequency: string;
    lastCompleted: string;
    completionPercentage: number;
    source?: 'manual' | 'ai_calculated' | 'sync' | 'replacement';
    componentName?: string;
    failureMode?: string;
    intervalValue?: number;
    intervalUnit?: string;
    isRecurringInstance?: boolean;
}

const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_AR = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const generateId = () => new Date().getTime().toString();

export default function MaintenanceTask() {
    const navigate = useNavigate();
    const { isMobile } = useSidebar();
    const { t, direction, language } = useLanguage();
    const { registerPageData, unregisterPageData } = useSearch();
    const { storageKeyFor } = useAssetContext();
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<string>('All');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterPriority, setFilterPriority] = useState<string>('All');
    const [filterAsset, setFilterAsset] = useState<string>('All');
    const [filterComponent, setFilterComponent] = useState<string>('All');
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Dropdown options
    const [uniqueAssets, setUniqueAssets] = useState<string[]>([]);
    const [uniqueItems, setUniqueItems] = useState<{components: string[], failureModes: string[]}>({components: [], failureModes: []});

    // Calendar state
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [showSidePanel, setShowSidePanel] = useState(false);

    const [tasks, setTasks] = useState<MaintenanceTaskItem[]>([]);
    const { user } = useAuth();
    const { currentAssetId } = useAssetContext();
    const [isLoading, setIsLoading] = useState(false);

    const loadTasks = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            // Build query: show all user tasks, or filter by asset if one is selected
            let query = supabase
                .from('tasks')
                .select('*, assets!tasks_asset_id_fkey(equipment_name)')
                .eq('user_id', user.id)
                .order('due_date', { ascending: true, nullsFirst: false });

            if (currentAssetId) {
                query = query.eq('asset_id', currentAssetId);
            }

            const { data, error } = await query;
            if (error) throw error;
            if (data) {
                const todayStr = new Date().toISOString().split('T')[0];
                const mappedTasks = data.map((t: any) => {
                    const dueDate = t.due_date ? new Date(t.due_date).toISOString().split('T')[0] : '';
                    // Auto-detect overdue status
                    let status = t.status || 'Pending';
                    if (dueDate && dueDate < todayStr && status !== 'Completed' && status !== 'Cancelled') {
                        status = 'Overdue';
                    }
                    return {
                        id: t.id,
                        taskName: t.task_name,
                        assetName: t.assets?.equipment_name || 'Unknown Asset',
                        taskType: t.task_type || '',
                        priority: t.priority || '',
                        status,
                        assignedTo: t.assigned_to || '',
                        dueDate,
                        estimatedDuration: Number(t.estimated_duration) || 2,
                        description: t.description || '',
                        frequency: t.frequency || '',
                        lastCompleted: t.last_completed ? new Date(t.last_completed).toISOString().split('T')[0] : '-',
                        completionPercentage: Number(t.completion_percentage) || 0,
                        source: t.source || 'manual',
                        componentName: t.component_name || '',
                        failureMode: t.failure_mode || '',
                        intervalValue: t.interval_value || '',
                        intervalUnit: t.interval_unit || 'days',
                    };
                });
                setTasks(mappedTasks);
                
                // Extract unique fields for dropdowns
                const assets = Array.from(new Set(mappedTasks.map((t: any) => t.assetName).filter(Boolean))) as string[];
                const comps = Array.from(new Set(mappedTasks.map((t: any) => t.componentName).filter(Boolean))) as string[];
                const fmodes = Array.from(new Set(mappedTasks.map((t: any) => t.failureMode).filter(Boolean))) as string[];
                setUniqueAssets(assets);
                setUniqueItems({ components: comps, failureModes: fmodes });
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
    }, [currentAssetId, user]);

    const [formData, setFormData] = useState({
        taskName: '', assetName: '', componentName: '', failureMode: '',
        taskType: '', priority: '', status: '',
        assignedTo: '', dueDate: '', estimatedDuration: 2, description: '', frequency: '',
        intervalValue: '' as number | '', intervalUnit: 'days',
    });

    useEffect(() => {
        registerPageData('maintenance', {
            items: tasks, searchFields: ['taskName', 'assetName', 'taskType', 'priority', 'status', 'assignedTo', 'description'],
            resultType: 'maintenance',
            formatResult: (item: MaintenanceTaskItem) => ({
                displayTitle: item.taskName,
                displaySubtitle: `${item.assetName} • ${item.assignedTo} • Due: ${item.dueDate}`,
                badge: { label: item.priority, variant: item.priority === 'Critical' ? 'danger' as const : item.priority === 'High' ? 'warning' as const : item.priority === 'Medium' ? 'info' as const : 'success' as const }
            })
        });
        return () => unregisterPageData('maintenance');
    }, [tasks, registerPageData, unregisterPageData]);

    const filteredTasks = tasks.filter((task) => {
        const matchesType = filterType === 'All' || task.taskType === filterType;
        const matchesStatus = filterStatus === 'All' || task.status === filterStatus;
        const matchesPriority = filterPriority === 'All' || task.priority === filterPriority;
        const matchesAsset = filterAsset === 'All' || task.assetName === filterAsset;
        const matchesComp = filterComponent === 'All' || task.componentName === filterComponent;
        return matchesType && matchesStatus && matchesPriority && matchesAsset && matchesComp;
    });

    // --- Calendar helpers ---
    const calendarDays = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1);
        let startDow = firstDay.getDay() - 1; // Mon=0
        if (startDow < 0) startDow = 6;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
        const cells: { day: number; month: number; year: number; isCurrentMonth: boolean; dateStr: string }[] = [];
        for (let i = startDow - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            const m = currentMonth === 0 ? 11 : currentMonth - 1;
            const y = currentMonth === 0 ? currentYear - 1 : currentYear;
            cells.push({ day: d, month: m, year: y, isCurrentMonth: false, dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ day: d, month: currentMonth, year: currentYear, isCurrentMonth: true, dateStr: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
        }
        const remaining = 7 - (cells.length % 7);
        if (remaining < 7) {
            for (let d = 1; d <= remaining; d++) {
                const m = currentMonth === 11 ? 0 : currentMonth + 1;
                const y = currentMonth === 11 ? currentYear + 1 : currentYear;
                cells.push({ day: d, month: m, year: y, isCurrentMonth: false, dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
            }
        }
        return cells;
    }, [currentMonth, currentYear]);

    const tasksByDate = useMemo(() => {
        const map: Record<string, MaintenanceTaskItem[]> = {};
        filteredTasks.forEach(t => {
            if (!t.dueDate) return;
            if (!map[t.dueDate]) map[t.dueDate] = [];
            map[t.dueDate].push(t);

            // Generate recurring instances for the visible window
            // Skip replacements as requested ("Except for replacement tasks, make them recurring")
            if (t.taskType !== 'Replacement' && t.taskType !== 'RR' && t.frequency && t.frequency !== 'As Needed') {
                const startDate = new Date(t.dueDate);
                const startOfView = new Date(currentYear, currentMonth - 1, 1);
                const endOfView = new Date(currentYear, currentMonth + 2, 0);
                
                let nextDate = new Date(startDate);
                let maxIters = 400; // safety limit
                
                while(nextDate <= endOfView && maxIters > 0) {
                    if (t.frequency === 'Daily') nextDate.setDate(nextDate.getDate() + 1);
                    else if (t.frequency === 'Weekly') nextDate.setDate(nextDate.getDate() + 7);
                    else if (t.frequency === 'Bi-Weekly') nextDate.setDate(nextDate.getDate() + 14);
                    else if (t.frequency === 'Monthly') nextDate.setMonth(nextDate.getMonth() + 1);
                    else if (t.frequency === 'Bi-Monthly') nextDate.setMonth(nextDate.getMonth() + 2);
                    else if (t.frequency === 'Quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
                    else if (t.frequency === 'Semi-Annually') nextDate.setMonth(nextDate.getMonth() + 6);
                    else if (t.frequency === 'Annually') nextDate.setFullYear(nextDate.getFullYear() + 1);
                    else break;

                    if (nextDate >= startOfView && nextDate <= endOfView) {
                        const dateStr = nextDate.toISOString().split('T')[0];
                        if (!map[dateStr]) map[dateStr] = [];
                        map[dateStr].push({...t, isRecurringInstance: true});
                    }
                    maxIters--;
                }
            }
        });
        return map;
    }, [filteredTasks, currentMonth, currentYear]);

    const selectedDayTasks = selectedDate ? (tasksByDate[selectedDate] || []) : [];

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const monthNames = language === 'ar' ? MONTHS_AR : MONTHS_EN;
    const weekdays = language === 'ar' ? WEEKDAYS_AR : WEEKDAYS_EN;

    const prevMonth = () => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } else setCurrentMonth(m => m - 1); };
    const nextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } else setCurrentMonth(m => m + 1); };
    const goToToday = () => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()); };

    const handleDayClick = (dateStr: string) => { setSelectedDate(dateStr); setShowSidePanel(true); };

    // --- Color helpers ---
    const getStatusColor = (status: string) => {
        switch (status) { case 'Completed': return 'var(--success-500)'; case 'In Progress': return 'var(--primary-500)'; case 'Pending': return 'var(--warning-500)'; case 'Overdue': return 'var(--danger-500)'; case 'Cancelled': return 'var(--text-tertiary)'; default: return 'var(--text-tertiary)'; }
    };
    const getPriorityColor = (priority: string) => {
        switch (priority) { case 'Critical': return 'var(--danger-500)'; case 'High': return '#f97316'; case 'Medium': return 'var(--warning-500)'; case 'Low': return 'var(--success-500)'; default: return 'var(--text-tertiary)'; }
    };
    const getTaskTypeColor = (type: string) => {
        switch (type) { case 'Preventive': return 'var(--success-500)'; case 'Predictive': return 'var(--primary-500)'; case 'Corrective': return 'var(--danger-500)'; case 'Condition-Based': return '#8b5cf6'; default: return 'var(--text-tertiary)'; }
    };
    const getStatusIcon = (status: string) => {
        switch (status) { case 'Completed': return CheckCircle; case 'In Progress': return Clock; case 'Pending': return Calendar; case 'Overdue': return AlertCircle; case 'Cancelled': return XCircle; default: return Calendar; }
    };

    const taskStats = { total: tasks.length, pending: tasks.filter(t => t.status === 'Pending').length, inProgress: tasks.filter(t => t.status === 'In Progress').length, completed: tasks.filter(t => t.status === 'Completed').length, overdue: tasks.filter(t => t.status === 'Overdue').length };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadTasks();
        setIsRefreshing(false);
    };

    // --- CRUD handlers ---
    const handleAddTask = async () => {
        if (!currentAssetId) {
            alert('Please select an asset first using the dropdown at the top.');
            return;
        }
        if (!formData.taskName) {
            alert('Please enter a task name.');
            return;
        }
        if (!user) return;

        // Apply interval calculations if Date is blank and Interval is provided
        let finalDueDate = formData.dueDate;
        if (!finalDueDate && formData.intervalValue) {
            const date = new Date();
            const val = Number(formData.intervalValue);
            if (formData.intervalUnit === 'days') date.setDate(date.getDate() + val);
            else if (formData.intervalUnit === 'hours') date.setDate(date.getDate() + Math.ceil(val / 8));
            else if (formData.intervalUnit === 'weeks') date.setDate(date.getDate() + val * 7);
            else if (formData.intervalUnit === 'months') date.setMonth(date.getMonth() + val);
            finalDueDate = date.toISOString().split('T')[0];
        }

        try {
            const { data: insertedTask, error } = await supabase.from('tasks').insert([{
                user_id: user.id,
                asset_id: currentAssetId,
                task_name: formData.taskName,
                description: formData.description,
                frequency: formData.frequency,
                assigned_to: formData.assignedTo,
                status: formData.status || 'Pending', // default if blank
                due_date: finalDueDate ? new Date(finalDueDate).toISOString() : null,
                task_type: formData.taskType || 'Preventive', // default if blank
                priority: formData.priority || 'Medium', // default if blank
                estimated_duration: formData.estimatedDuration,
                completion_percentage: 0,
                source: 'manual',
                component_name: formData.componentName,
                failure_mode: formData.failureMode,
                interval_value: formData.intervalValue || null,
                interval_unit: formData.intervalUnit,
            }]).select().single();
            if (error) throw error;

            // Also sync to maintenance_tasks table for Maintenance Plan view
            try {
                await supabase.from('maintenance_tasks').insert({
                    user_id: user.id,
                    asset_id: currentAssetId,
                    task_name: formData.taskName,
                    task_type: formData.taskType || 'Preventive',
                    assigned_interval: formData.intervalValue ? `${formData.intervalValue} ${formData.intervalUnit}` : formData.frequency,
                    component_name: formData.componentName || '',
                    failure_mode_id: null,
                    last_updated: new Date().toISOString(),
                });
            } catch (syncErr) {
                console.error('Warning: Task saved but sync to maintenance_tasks failed:', syncErr);
            }

            await loadTasks();
            setShowAddModal(false); resetForm();
        } catch (error) {
            console.error('Error adding task:', error);
            alert('Failed to add maintenance task. Please check your connection.');
        }
    };
    
    const resetForm = () => { 
        setFormData({ 
            taskName: '', assetName: '', componentName: '', failureMode: '', 
            taskType: '', priority: '', status: '', 
            assignedTo: '', dueDate: '', estimatedDuration: 2, description: '', frequency: '',
            intervalValue: '', intervalUnit: 'days' 
        }); 
        setEditingId(null); 
    };
    
    const handleEditTask = (task: MaintenanceTaskItem) => {
        setFormData({ 
            taskName: task.taskName, assetName: task.assetName, 
            componentName: task.componentName || '', failureMode: task.failureMode || '',
            taskType: task.taskType, priority: task.priority, status: task.status, 
            assignedTo: task.assignedTo, dueDate: task.dueDate, estimatedDuration: task.estimatedDuration, 
            description: task.description, frequency: task.frequency,
            intervalValue: task.intervalValue || '', intervalUnit: task.intervalUnit || 'days'
        });
        setEditingId(task.id); setShowAddModal(true);
    };
    
    const handleSaveEdit = async () => {
        if (!editingId || !formData.taskName || !user || !currentAssetId) return;
        
        let finalDueDate = formData.dueDate;
        if (!finalDueDate && formData.intervalValue) {
            const date = new Date();
            const val = Number(formData.intervalValue);
            if (formData.intervalUnit === 'days') date.setDate(date.getDate() + val);
            else if (formData.intervalUnit === 'hours') date.setDate(date.getDate() + Math.ceil(val / 8));
            else if (formData.intervalUnit === 'weeks') date.setDate(date.getDate() + val * 7);
            else if (formData.intervalUnit === 'months') date.setMonth(date.getMonth() + val);
            finalDueDate = date.toISOString().split('T')[0];
        }

        try {
            const { error } = await supabase.from('tasks').update({
                task_name: formData.taskName,
                description: formData.description,
                frequency: formData.frequency,
                assigned_to: formData.assignedTo,
                status: formData.status || 'Pending',
                due_date: finalDueDate ? new Date(finalDueDate).toISOString() : null,
                task_type: formData.taskType || 'Preventive',
                priority: formData.priority || 'Medium',
                estimated_duration: formData.estimatedDuration,
                completion_percentage: formData.status === 'Completed' ? 100 : undefined,
                last_completed: formData.status === 'Completed' ? new Date().toISOString() : undefined,
                component_name: formData.componentName,
                failure_mode: formData.failureMode,
                interval_value: formData.intervalValue || null,
                interval_unit: formData.intervalUnit,
            }).eq('id', editingId);
            if (error) throw error;
            await loadTasks();
            setShowAddModal(false); resetForm();
        } catch (error) {
            console.error('Error updating task:', error);
        }
    };
    const handleDeleteTask = (task: MaintenanceTaskItem) => { setDeleteConfirm({ isOpen: true, id: task.id, name: task.taskName }); };
    const confirmDeleteTask = async () => {
        try {
            const { error } = await supabase.from('tasks').delete().eq('id', deleteConfirm.id);
            if (error) throw error;
            setTasks(tasks.filter(task => task.id !== deleteConfirm.id));
            setDeleteConfirm({ isOpen: false, id: '', name: '' });
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    const getDaysUntilDue = (dueDate: string): number => { const d = new Date(); const due = new Date(dueDate); return Math.ceil((due.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)); };
    const getDueDateLabel = (dueDate: string, status: string) => {
        if (status === 'Completed' || status === 'Cancelled') return '';
        const days = getDaysUntilDue(dueDate);
        if (days < 0) return `${Math.abs(days)} ${t('maintenance.daysOverdue')}`;
        if (days === 0) return t('maintenance.dueToday');
        if (days <= 3) return `${days} ${t('maintenance.daysLeft')}`;
        return '';
    };

    // Dot rendering for calendar cells
    const renderTaskDots = (dateStr: string) => {
        const dayTasks = tasksByDate[dateStr];
        if (!dayTasks || dayTasks.length === 0) return null;
        const maxDots = 4;
        const shown = dayTasks.slice(0, maxDots);
        return (
            <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                {shown.map((tk, i) => (
                    <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: getStatusColor(tk.status), flexShrink: 0 }} />
                ))}
                {dayTasks.length > maxDots && <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', lineHeight: '7px' }}>+{dayTasks.length - maxDots}</span>}
            </div>
        );
    };

    return (
        <>
            <Sidebar />
            <PageContainer>
                <div className="container" style={{ maxWidth: '1400px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                            <button onClick={() => navigate('/')} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}><ArrowLeft size={20} /></button>
                            <div>
                                <h1 style={{ marginBottom: 'var(--spacing-xs)', fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)' }}>{t('maintenance.title')}</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)' }}>{t('maintenance.subtitle')}</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', width: isMobile ? '100%' : 'auto' }}>
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
                            <GlobalSearch pageType="maintenance" />
                            <AssetSelector />
                            <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)', width: isMobile ? '100%' : 'auto', flex: isMobile ? 1 : 'none' }}>
                                <Plus size={20} />{t('maintenance.addTask')}
                            </button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
                        {[
                            { label: t('maintenance.totalTasks'), value: taskStats.total, color: 'var(--text-primary)', icon: ClipboardList },
                            { label: t('maintenance.pendingTasks'), value: taskStats.pending, color: 'var(--warning-500)', icon: Calendar },
                            { label: t('maintenance.inProgressTasks'), value: taskStats.inProgress, color: 'var(--primary-500)', icon: Clock },
                            { label: t('maintenance.completedTasks'), value: taskStats.completed, color: 'var(--success-500)', icon: CheckCircle },
                            { label: t('maintenance.overdueTasks'), value: taskStats.overdue, color: 'var(--danger-500)', icon: AlertCircle },
                        ].map((stat, i) => (
                            <div key={i} className="card" style={{ padding: 'var(--spacing-md)', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-10px', right: direction === 'rtl' ? 'auto' : '-10px', left: direction === 'rtl' ? '-10px' : 'auto', opacity: 0.08 }}><stat.icon size={64} /></div>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>{stat.label}</div>
                                <div style={{ color: stat.color, fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>{stat.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="card" style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
                        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'center' }}>
                            <Filter size={20} color="var(--text-tertiary)" />
                            
                            <select className="select" value={filterAsset} onChange={(e) => setFilterAsset(e.target.value)} style={{ flex: '0 1 180px' }}>
                                <option value="All">All Assets</option>
                                {uniqueAssets.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>

                            <select className="select" value={filterComponent} onChange={(e) => setFilterComponent(e.target.value)} style={{ flex: '0 1 180px' }}>
                                <option value="All">All Components</option>
                                {uniqueItems.components.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>

                            <select className="select" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ flex: '0 1 180px' }}>
                                <option value="All">{t('maintenance.allTypes')}</option>
                                <option value="Preventive">{t('maintenance.preventive')}</option>
                                <option value="Predictive">{t('maintenance.predictive')}</option>
                                <option value="Corrective">{t('maintenance.corrective')}</option>
                                <option value="Condition-Based">{t('maintenance.conditionBased')}</option>
                            </select>
                            <select className="select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ flex: '0 1 180px' }}>
                                <option value="All">{t('maintenance.allStatus')}</option>
                                <option value="Pending">{t('maintenance.pending')}</option>
                                <option value="In Progress">{t('maintenance.inProgress')}</option>
                                <option value="Completed">{t('maintenance.completed')}</option>
                                <option value="Overdue">{t('maintenance.overdue')}</option>
                            </select>
                            <select className="select" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={{ flex: '0 1 180px' }}>
                                <option value="All">{t('maintenance.allPriorities')}</option>
                                <option value="Critical">{t('maintenance.critical')}</option>
                                <option value="High">{t('maintenance.high')}</option>
                                <option value="Medium">{t('maintenance.medium')}</option>
                                <option value="Low">{t('maintenance.low')}</option>
                            </select>
                            <p style={{ marginLeft: direction === 'rtl' ? '0' : 'auto', marginRight: direction === 'rtl' ? 'auto' : '0', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                {t('maintenance.showing')} {filteredTasks.length} {t('maintenance.of')} {tasks.length} {t('maintenance.tasks')}
                            </p>
                        </div>
                        
                        {/* Filtered Tasks List */}
                        {(filterType !== 'All' || filterStatus !== 'All' || filterPriority !== 'All' || filterAsset !== 'All' || filterComponent !== 'All') && (
                            <div style={{ marginTop: 'var(--spacing-md)', maxHeight: '200px', overflowY: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--spacing-md)' }}>
                                <h4 style={{ margin: '0 0 var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Matching Tasks</h4>
                                {filteredTasks.length === 0 ? (
                                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>No tasks match the selected filters.</p>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--spacing-sm)' }}>
                                        {filteredTasks.map(task => (
                                            <div 
                                                key={task.id} 
                                                onClick={() => {
                                                    if (task.dueDate) {
                                                        const [y, m] = task.dueDate.split('-');
                                                        setCurrentYear(parseInt(y));
                                                        setCurrentMonth(parseInt(m) - 1);
                                                        setSelectedDate(task.dueDate);
                                                        setShowSidePanel(true);
                                                    }
                                                }}
                                                style={{ 
                                                    padding: 'var(--spacing-sm)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', 
                                                    cursor: task.dueDate ? 'pointer' : 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    borderLeft: `3px solid ${getPriorityColor(task.priority)}`
                                                }}
                                                onMouseEnter={e => { if (task.dueDate) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                                            >
                                                <div>
                                                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{task.taskName}</div>
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{task.assetName} {task.componentName ? `• ${task.componentName}` : ''}</div>
                                                </div>
                                                {task.dueDate && (
                                                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--primary-500)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Calendar size={12} /> {task.dueDate}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Calendar + Side Panel Layout */}
                    <div style={{ display: 'flex', gap: 'var(--spacing-lg)', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
                        {/* Calendar Card */}
                        <div className="card" style={{ flex: 1, padding: 'var(--spacing-lg)', minWidth: 0 }}>
                            {/* Month Navigation */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-lg)' }}>
                                <button onClick={prevMonth} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}><ChevronLeft size={22} /></button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                    <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>{monthNames[currentMonth]} {currentYear}</h2>
                                    <button onClick={goToToday} className="btn btn-ghost" style={{ padding: '4px 12px', minWidth: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--primary-500)', border: '1px solid var(--primary-500)', borderRadius: 'var(--radius-full)' }}>
                                        {language === 'ar' ? 'اليوم' : 'Today'}
                                    </button>
                                </div>
                                <button onClick={nextMonth} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}><ChevronRight size={22} /></button>
                            </div>

                            {/* Weekday Headers */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: '2px' }}>
                                {weekdays.map((d, i) => (
                                    <div key={i} style={{ textAlign: 'center', padding: '8px 0', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{d}</div>
                                ))}
                            </div>

                            {/* Day Cells */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                                {calendarDays.map((cell, i) => {
                                    const isToday = cell.dateStr === todayStr;
                                    const isSelected = cell.dateStr === selectedDate;
                                    const hasTasks = tasksByDate[cell.dateStr] && tasksByDate[cell.dateStr].length > 0;
                                    return (
                                        <div
                                            key={i}
                                            onClick={() => handleDayClick(cell.dateStr)}
                                            style={{
                                                background: isSelected ? 'rgba(var(--primary-rgb, 99, 102, 241), 0.1)' : 'var(--bg-card)',
                                                padding: isMobile ? '6px 2px' : '8px',
                                                minHeight: isMobile ? '52px' : '80px',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                                opacity: cell.isCurrentMonth ? 1 : 0.35,
                                                position: 'relative',
                                                borderLeft: isSelected ? '3px solid var(--primary-500)' : '3px solid transparent',
                                            }}
                                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-card)'; }}
                                        >
                                            <div style={{
                                                display: 'flex', justifyContent: 'center', alignItems: 'center',
                                                width: isMobile ? '24px' : '30px', height: isMobile ? '24px' : '30px',
                                                borderRadius: '50%',
                                                background: isToday ? 'var(--primary-500)' : 'transparent',
                                                color: isToday ? 'white' : hasTasks ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                                                fontWeight: isToday || hasTasks ? 700 : 400,
                                                margin: '0 auto',
                                            }}>
                                                {cell.day}
                                            </div>
                                            {renderTaskDots(cell.dateStr)}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Status Legend */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)', justifyContent: 'center' }}>
                                {[
                                    { label: t('maintenance.completed'), color: 'var(--success-500)' },
                                    { label: t('maintenance.inProgress'), color: 'var(--primary-500)' },
                                    { label: t('maintenance.pending'), color: 'var(--warning-500)' },
                                    { label: t('maintenance.overdue'), color: 'var(--danger-500)' },
                                    { label: t('maintenance.cancelled'), color: 'var(--text-tertiary)' },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />{item.label}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Side Panel - Task Details for selected day */}
                        {showSidePanel && selectedDate && (
                            <div className="card" style={{ width: isMobile ? '100%' : '380px', flexShrink: 0, padding: 0, overflow: 'hidden', maxHeight: isMobile ? 'none' : '700px', display: 'flex', flexDirection: 'column' }}>
                                {/* Panel Header */}
                                <div style={{ padding: 'var(--spacing-md) var(--spacing-lg)', background: 'var(--gradient-primary)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800 }}>{new Date(selectedDate + 'T00:00:00').getDate()}</div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', opacity: 0.9 }}>
                                            {monthNames[new Date(selectedDate + 'T00:00:00').getMonth()]} {new Date(selectedDate + 'T00:00:00').getFullYear()}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                        <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 10px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                                            {selectedDayTasks.length} {t('maintenance.tasks')}
                                        </span>
                                        <button onClick={() => setShowSidePanel(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 'var(--radius-md)', padding: '4px', cursor: 'pointer', display: 'flex', color: 'white' }}><X size={18} /></button>
                                    </div>
                                </div>

                                {/* Panel Task List */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-md)' }}>
                                    {selectedDayTasks.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-tertiary)' }}>
                                            <Calendar size={40} style={{ margin: '0 auto var(--spacing-md)', opacity: 0.4 }} />
                                            <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>{t('maintenance.noTasks')}</p>
                                            <button className="btn btn-primary" onClick={() => { setFormData(prev => ({ ...prev, dueDate: selectedDate })); setShowAddModal(true); }} style={{ marginTop: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', padding: '6px 16px' }}>
                                                <Plus size={16} /> {t('maintenance.addTask')}
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                            {selectedDayTasks.map(task => {
                                                const StatusIcon = getStatusIcon(task.status);
                                                const dueLabel = getDueDateLabel(task.dueDate, task.status);
                                                return (
                                                    <div key={task.id} style={{
                                                        padding: 'var(--spacing-md)',
                                                        background: 'var(--bg-tertiary)',
                                                        borderRadius: 'var(--radius-lg)',
                                                        borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                                                    >
                                                        {/* Task status + priority badges */}
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <StatusIcon size={14} color={getStatusColor(task.status)} />
                                                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: getStatusColor(task.status) }}>
                                                                    {t(`maintenance.${task.status.toLowerCase().replace(' ', '')}`)}
                                                                </span>
                                                            </div>
                                                            <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: 'var(--radius-full)', background: `${getTaskTypeColor(task.taskType)}15`, color: getTaskTypeColor(task.taskType), fontWeight: 600 }}>
                                                                {t(`maintenance.${task.taskType.toLowerCase().replace('-', '')}`)}
                                                            </span>
                                                        </div>
                                                        {/* Task name */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                            <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>{task.taskName}</h4>
                                                            {task.source === 'ai_calculated' && (
                                                                <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', fontWeight: 700, whiteSpace: 'nowrap' }}>✨ AI</span>
                                                            )}
                                                        </div>
                                                        <p style={{ margin: '0 0 6px', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{task.assetName}</p>
                                                        {/* Meta info */}
                                                        <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                                                            {task.assignedTo && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><User size={11} />{task.assignedTo}</span>}
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Timer size={11} />{task.estimatedDuration}h</span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: 'var(--radius-full)', background: `${getPriorityColor(task.priority)}15`, color: getPriorityColor(task.priority), fontWeight: 600 }}>
                                                                {t(`maintenance.${task.priority.toLowerCase()}`)}
                                                            </span>
                                                        </div>
                                                        {dueLabel && <div style={{ fontSize: 'var(--font-size-xs)', color: task.status === 'Overdue' ? 'var(--danger-500)' : 'var(--warning-500)', fontWeight: 600, marginTop: '4px' }}>{dueLabel}</div>}
                                                        {/* Progress bar */}
                                                        {task.status === 'In Progress' && (
                                                            <div style={{ marginTop: '6px' }}>
                                                                <div style={{ height: '4px', background: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                    <div style={{ width: `${task.completionPercentage}%`, height: '100%', background: 'var(--gradient-primary)', borderRadius: '2px' }} />
                                                                </div>
                                                                <span style={{ fontSize: '10px', color: 'var(--primary-500)' }}>{task.completionPercentage}%</span>
                                                            </div>
                                                        )}
                                                        {/* Action buttons */}
                                                        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: '8px', justifyContent: 'flex-end' }}>
                                                            <button onClick={() => handleEditTask(task)} className="btn btn-ghost" style={{ padding: '4px 8px', minWidth: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--primary-500)' }}><Pencil size={13} /></button>
                                                            <button onClick={() => handleDeleteTask(task)} className="btn btn-ghost" style={{ padding: '4px 8px', minWidth: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--danger-500)' }}><Trash2 size={13} /></button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </PageContainer>

            {/* Add/Edit Task Modal */}
            {showAddModal && (
                <>
                    <div onClick={() => { setShowAddModal(false); resetForm(); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 9998 }} />
                    <div className="card-glass" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: '700px', padding: 'var(--spacing-xl)', zIndex: 9999, maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                            <h2 style={{ margin: 0 }}>{editingId ? t('maintenance.editTask') : t('maintenance.addTask')}</h2>
                            <button onClick={() => { setShowAddModal(false); resetForm(); }} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{t('maintenance.taskName')} <span style={{ color: 'var(--danger-500)' }}>*</span></label>
                                <input className="input" value={formData.taskName} onChange={(e) => setFormData({ ...formData, taskName: e.target.value })} placeholder={t('maintenance.taskNamePlaceholder')} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 'var(--spacing-md)' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{t('maintenance.asset')}</label>
                                    <input className="input" list="asset-list" value={formData.assetName} onChange={(e) => setFormData({ ...formData, assetName: e.target.value })} placeholder={t('maintenance.assetPlaceholder')} />
                                    <datalist id="asset-list">
                                        {uniqueAssets.map(a => <option key={a} value={a} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Component Name</label>
                                    <input className="input" list="component-list" value={formData.componentName} onChange={(e) => setFormData({ ...formData, componentName: e.target.value })} placeholder="E.g. Motor, Bearing..." />
                                    <datalist id="component-list">
                                        {uniqueItems.components.map(c => <option key={c} value={c} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Failure Mode (Optional)</label>
                                    <input className="input" list="failure-mode-list" value={formData.failureMode} onChange={(e) => setFormData({ ...formData, failureMode: e.target.value })} placeholder="E.g. Wear, Fatigue..." />
                                    <datalist id="failure-mode-list">
                                        {uniqueItems.failureModes.map(f => <option key={f} value={f} />)}
                                    </datalist>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{t('maintenance.description')}</label>
                                <textarea className="input" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder={t('maintenance.descriptionPlaceholder')} rows={3} style={{ resize: 'vertical' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 'var(--spacing-md)' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{t('maintenance.taskType')}</label>
                                    <select className="select" value={formData.taskType} onChange={(e) => setFormData({ ...formData, taskType: e.target.value })} style={{ width: '100%' }}>
                                        <option value="">Auto-calculate/Default</option>
                                        <option value="Preventive">{t('maintenance.preventive')}</option><option value="Predictive">{t('maintenance.predictive')}</option><option value="Corrective">{t('maintenance.corrective')}</option><option value="Condition-Based">{t('maintenance.conditionBased')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{t('maintenance.priorityLabel')}</label>
                                    <select className="select" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} style={{ width: '100%' }}>
                                        <option value="">Auto-calculate/Default</option>
                                        <option value="Critical">{t('maintenance.critical')}</option><option value="High">{t('maintenance.high')}</option><option value="Medium">{t('maintenance.medium')}</option><option value="Low">{t('maintenance.low')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{t('maintenance.statusLabel')}</label>
                                    <select className="select" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} style={{ width: '100%' }}>
                                        <option value="">Auto-calculate/Default</option>
                                        <option value="Pending">{t('maintenance.pending')}</option><option value="In Progress">{t('maintenance.inProgress')}</option><option value="Completed">{t('maintenance.completed')}</option><option value="Overdue">{t('maintenance.overdue')}</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{t('maintenance.assignedTo')}</label>
                                    <input className="input" value={formData.assignedTo} onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })} placeholder={t('maintenance.assignedToPlaceholder')} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{t('maintenance.dueDate')} (Auto-calc if blank)</label>
                                    <input type="date" className="input" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Interval Value</label>
                                        <input type="number" className="input" value={formData.intervalValue} onChange={(e) => setFormData({ ...formData, intervalValue: e.target.value ? Number(e.target.value) : '' })} placeholder="E.g. 100" min={1} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Interval Unit</label>
                                        <select className="select" value={formData.intervalUnit} onChange={(e) => setFormData({ ...formData, intervalUnit: e.target.value })} style={{ width: '100%' }}>
                                            <option value="hours">Hours</option>
                                            <option value="days">Days</option>
                                            <option value="weeks">Weeks</option>
                                            <option value="months">Months</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{t('maintenance.estimatedDuration')}</label>
                                        <input type="number" className="input" min={0.5} step={0.5} value={formData.estimatedDuration} onChange={(e) => setFormData({ ...formData, estimatedDuration: Number(e.target.value) })} placeholder={t('maintenance.durationPlaceholder')} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Calendar {t('maintenance.frequency')}</label>
                                        <select className="select" value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })} style={{ width: '100%' }}>
                                            <option value="Daily">{t('maintenance.daily')}</option><option value="Weekly">{t('maintenance.weekly')}</option><option value="Bi-Weekly">{t('maintenance.biWeekly')}</option><option value="Monthly">{t('maintenance.monthly')}</option><option value="Bi-Monthly">{t('maintenance.biMonthly')}</option><option value="Quarterly">{t('maintenance.quarterly')}</option><option value="Semi-Annually">{t('maintenance.semiAnnually')}</option><option value="Annually">{t('maintenance.annually')}</option><option value="As Needed">{t('maintenance.asNeeded')}</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
                                <button className="btn btn-secondary" onClick={() => { setShowAddModal(false); resetForm(); }} style={{ flex: 1 }}>{t('common.cancel')}</button>
                                <button className="btn btn-primary" onClick={editingId ? handleSaveEdit : handleAddTask} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)' }} disabled={!formData.taskName}>
                                    {editingId ? <><Save size={18} /> {t('maintenance.saveChanges')}</> : <><Plus size={18} /> {t('maintenance.addTask')}</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <ConfirmDeleteModal
                isOpen={deleteConfirm.isOpen}
                title={t('maintenance.deleteTask')}
                message={t('maintenance.deleteConfirm')}
                itemName={deleteConfirm.name}
                onConfirm={confirmDeleteTask}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
            />
        </>
    );
}
