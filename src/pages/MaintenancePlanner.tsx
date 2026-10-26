import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import { Wrench, Calendar, Filter, Plus, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function MaintenancePlanner() {
    const [filterType, setFilterType] = useState<string>('All');
    const [filterStatus, setFilterStatus] = useState<string>('All');

    // Mock data - would come from backend in production
    const tasks = [
        {
            task_id: '1',
            asset_name: 'Centrifugal Pump A-101',
            task_type: 'Predictive' as const,
            task_description: 'Vibration analysis and oil analysis to detect bearing degradation',
            interval: 'Weekly',
            due_date: '2026-01-25',
            status: 'Pending' as const,
            priority: 'High',
        },
        {
            task_id: '2',
            asset_name: 'Motor Drive B-205',
            task_type: 'Preventive' as const,
            task_description: 'Motor winding resistance test and insulation check',
            interval: 'Monthly',
            due_date: '2026-01-28',
            status: 'In Progress' as const,
            priority: 'High',
        },
        {
            task_id: '3',
            asset_name: 'Compressor C-301',
            task_type: 'Preventive' as const,
            task_description: 'Lubrication service and bearing inspection',
            interval: 'Quarterly',
            due_date: '2026-02-15',
            status: 'Pending' as const,
            priority: 'Medium',
        },
        {
            task_id: '4',
            asset_name: 'Conveyor Belt D-102',
            task_type: 'Corrective' as const,
            task_description: 'Monitor belt tension and alignment when detected',
            interval: 'As needed',
            due_date: '2026-03-01',
            status: 'Pending' as const,
            priority: 'Low',
        },
        {
            task_id: '5',
            asset_name: 'Cooling Tower E-103',
            task_type: 'Preventive' as const,
            task_description: 'Water treatment and cooling tower cleaning',
            interval: 'Monthly',
            due_date: '2026-01-20',
            status: 'Completed' as const,
            priority: 'Medium',
        },
    ];

    const filteredTasks = tasks.filter((task) => {
        const matchesType = filterType === 'All' || task.task_type === filterType;
        const matchesStatus = filterStatus === 'All' || task.status === filterStatus;
        return matchesType && matchesStatus;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed': return 'var(--success-500)';
            case 'In Progress': return 'var(--warning-500)';
            case 'Pending': return 'var(--primary-500)';
            case 'Overdue': return 'var(--danger-500)';
            default: return 'var(--gray-500)';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Completed': return CheckCircle;
            case 'In Progress': return Clock;
            case 'Pending': return Calendar;
            case 'Overdue': return AlertCircle;
            default: return Calendar;
        }
    };

    const getTaskTypeColor = (type: string) => {
        switch (type) {
            case 'Predictive': return 'var(--primary-500)';
            case 'Preventive': return 'var(--success-500)';
            case 'Corrective': return 'var(--warning-500)';
            case 'Run-to-Failure': return 'var(--gray-500)';
            default: return 'var(--gray-500)';
        }
    };

    const taskStats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'Pending').length,
        inProgress: tasks.filter(t => t.status === 'In Progress').length,
        completed: tasks.filter(t => t.status === 'Completed').length,
    };

    return (
        <>
            <Sidebar />
            <PageContainer style={{ padding: 'var(--spacing-2xl)' }}>
                {/* Header */}
                <div className="animate-fade-in" style={{ marginBottom: 'var(--spacing-2xl)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-md)' }}>
                        <div>
                            <h1 style={{ marginBottom: 'var(--spacing-sm)' }}>Maintenance Planner</h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-lg)' }}>
                                Plan, schedule, and track all maintenance activities.
                            </p>
                        </div>
                        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Plus size={20} />
                            Add New Task
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-2 animate-fade-in" style={{ marginBottom: 'var(--spacing-2xl)', animationDelay: '100ms' }}>
                    <div className="card-glass">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>Pending Tasks</p>
                                <h2 style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 800, margin: 0 }}>{taskStats.pending}</h2>
                            </div>
                            <Calendar size={48} color="var(--primary-500)" />
                        </div>
                    </div>

                    <div className="card-glass">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>In Progress</p>
                                <h2 style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 800, margin: 0 }}>{taskStats.inProgress}</h2>
                            </div>
                            <Clock size={48} color="var(--warning-500)" />
                        </div>
                    </div>

                    <div className="card-glass">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>Completed</p>
                                <h2 style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 800, margin: 0 }}>{taskStats.completed}</h2>
                            </div>
                            <CheckCircle size={48} color="var(--success-500)" />
                        </div>
                    </div>

                    <div className="card-glass">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>Total Tasks</p>
                                <h2 style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 800, margin: 0 }}>{taskStats.total}</h2>
                            </div>
                            <Wrench size={48} color="var(--accent-500)" />
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="card-glass animate-fade-in" style={{ marginBottom: 'var(--spacing-xl)', animationDelay: '200ms' }}>
                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'center' }}>
                        <Filter size={20} color="var(--text-tertiary)" />

                        <select className="select" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ flex: '0 1 200px' }}>
                            <option value="All">All Types</option>
                            <option value="Predictive">Predictive</option>
                            <option value="Preventive">Preventive</option>
                            <option value="Corrective">Corrective</option>
                            <option value="Run-to-Failure">Run-to-Failure</option>
                        </select>

                        <select className="select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ flex: '0 1 200px' }}>
                            <option value="All">All Status</option>
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Overdue">Overdue</option>
                        </select>

                        <p style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                            Showing {filteredTasks.length} of {tasks.length} tasks
                        </p>
                    </div>
                </div>

                {/* Tasks List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }} className="animate-slide-in">
                    {filteredTasks.map((task, index) => {
                        const StatusIcon = getStatusIcon(task.status);

                        return (
                            <div key={task.task_id} className="card-glass" style={{ animationDelay: `${300 + (index * 50)}ms` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-md)' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
                                            <h3 style={{ fontSize: 'var(--font-size-lg)', margin: 0 }}>{task.asset_name}</h3>
                                            <span
                                                className="badge"
                                                style={{
                                                    background: `${getTaskTypeColor(task.task_type)}20`,
                                                    color: getTaskTypeColor(task.task_type),
                                                }}
                                            >
                                                {task.task_type}
                                            </span>
                                        </div>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                            {task.task_description}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                        <StatusIcon size={24} color={getStatusColor(task.status)} />
                                        <span
                                            className="badge"
                                            style={{
                                                background: `${getStatusColor(task.status)}20`,
                                                color: getStatusColor(task.status),
                                            }}
                                        >
                                            {task.status}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--border-color)' }}>
                                    <div>
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                                            Interval
                                        </p>
                                        <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{task.interval}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                                            Due Date
                                        </p>
                                        <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{task.due_date}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                                            Priority
                                        </p>
                                        <p style={{
                                            fontSize: 'var(--font-size-sm)',
                                            fontWeight: 600,
                                            color: task.priority === 'High' ? 'var(--danger-500)' : task.priority === 'Medium' ? 'var(--warning-500)' : 'var(--success-500)'
                                        }}>
                                            {task.priority}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                        <button className="btn btn-secondary" style={{ flex: 1, fontSize: 'var(--font-size-sm)', padding: 'var(--spacing-sm)' }}>
                                            View
                                        </button>
                                        <button className="btn btn-primary" style={{ flex: 1, fontSize: 'var(--font-size-sm)', padding: 'var(--spacing-sm)' }}>
                                            Update
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredTasks.length === 0 && (
                    <div className="card-glass" style={{ textAlign: 'center', padding: 'var(--spacing-3xl)' }}>
                        <Wrench size={64} color="var(--text-tertiary)" style={{ margin: '0 auto var(--spacing-lg)' }} />
                        <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>No tasks found</h3>
                        <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--spacing-lg)' }}>
                            Try adjusting your filters or create a new maintenance task
                        </p>
                        <button className="btn btn-primary">
                            <Plus size={20} />
                            Create Task
                        </button>
                    </div>
                )}
            </PageContainer>
        </>
    );
}
