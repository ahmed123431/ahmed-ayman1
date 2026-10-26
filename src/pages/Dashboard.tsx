import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    Wrench,
    DollarSign,
    X,
    FolderOpen,
    Cpu,
    Calendar,
    Clock,
    Loader2
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import GlobalSearch from '../components/GlobalSearch';
import AssetSelector from '../components/AssetSelector';
import { useSidebar } from '../contexts/SidebarContext';
import { useSearch } from '../contexts/SearchContext';


interface N8NAnalysisOutput {
    asset_info: {
        equipment_name: string;
        tag_number: string;
        criticality_level: string;
    };
    risk_assessment: {
        overall_risk: string;
        risk_priority_number: number;
        failure_modes: number;
    };
    maintenance_recommendations: {
        frequency: string;
        type: string;
        priority: string;
    };
    cost_analysis: {
        estimated_annual_cost: number;
        potential_savings: number;
    };
    analysis_timestamp: string;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { isMobile } = useSidebar();
    const { selectedResult, setSelectedResult, clearSearch } = useSearch();
    const [analysisData, setAnalysisData] = useState<N8NAnalysisOutput | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    // Fetch data from n8n webhook on component mount
    useEffect(() => {
        fetchAnalysisData();
    }, []);

    const fetchAnalysisData = async () => {
        setIsLoading(true);

        try {
            // TODO: Replace with your actual n8n webhook URL for fetching results
            const n8nResultsWebhookUrl = 'YOUR_N8N_RESULTS_WEBHOOK_URL_HERE';

            const projectId = 'default';

            const response = await fetch(`${n8nResultsWebhookUrl}?project_id=${projectId}`);

            if (response.ok) {
                const data = await response.json();
                setAnalysisData(data);
            } else {
                // For demo purposes, use mock data
                setAnalysisData(getMockData());
            }
        } catch (error) {
            console.error('Error fetching analysis data:', error);
            // Use mock data for demo
            setAnalysisData(getMockData());
        } finally {
            setIsLoading(false);
            setLastRefresh(new Date());
        }
    };

    // Mock data for demonstration
    const getMockData = (): N8NAnalysisOutput => {
        return {
            asset_info: {
                equipment_name: 'Centrifugal Pump',
                tag_number: 'PUMP-001',
                criticality_level: 'High'
            },
            risk_assessment: {
                overall_risk: 'High',
                risk_priority_number: 240,
                failure_modes: 12
            },
            maintenance_recommendations: {
                frequency: 'Monthly',
                type: 'Predictive + Preventive',
                priority: 'High'
            },
            cost_analysis: {
                estimated_annual_cost: 45000,
                potential_savings: 18000
            },
            analysis_timestamp: new Date().toISOString()
        };
    };

    const getRiskColor = (risk: string) => {
        switch (risk.toLowerCase()) {
            case 'high': return 'var(--danger-500)';
            case 'medium': return 'var(--warning-500)';
            case 'low': return 'var(--success-500)';
            default: return 'var(--text-secondary)';
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const formatTimestamp = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

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
                                Loading analysis results...
                            </p>
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
                <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
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
                                <h1 style={{
                                    marginBottom: 'var(--spacing-xs)',
                                    fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)'
                                }}>
                                    RCM Analysis Dashboard
                                </h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                    {isMobile ? formatTimestamp(lastRefresh.toISOString()).split(',')[0] : `Last updated: ${formatTimestamp(lastRefresh.toISOString())}`}
                                </p>
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)'
                        }}>
                            <GlobalSearch pageType="dashboard" />
                            <AssetSelector />
                            <button
                                onClick={fetchAnalysisData}
                                disabled={isLoading}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '8px 14px', borderRadius: 'var(--radius-md)',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white',
                                    cursor: isLoading ? 'wait' : 'pointer',
                                    fontSize: '13px', fontWeight: 600,
                                    opacity: isLoading ? 0.7 : 1,
                                }}
                            >
                                {isLoading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                                {isMobile ? '' : (isLoading ? 'Refreshing...' : 'Refresh')}
                            </button>
                        </div>
                    </div>

                    {/* Search Result Details */}
                    {selectedResult && (
                        <div className="card" style={{
                            marginBottom: 'var(--spacing-lg)',
                            border: '2px solid var(--primary-500)',
                            animation: 'fadeIn 0.3s ease-out'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: 'var(--spacing-md)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: 'var(--radius-md)',
                                        background: selectedResult.type === 'project'
                                            ? 'var(--gradient-primary)'
                                            : 'var(--gradient-accent)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {selectedResult.type === 'project'
                                            ? <FolderOpen size={24} color="white" />
                                            : <Cpu size={24} color="white" />
                                        }
                                    </div>
                                    <div>
                                        <span className={`badge ${selectedResult.type === 'project' ? 'badge-primary' : 'badge-success'}`}
                                            style={{ marginBottom: 'var(--spacing-xs)', display: 'inline-block' }}>
                                            {selectedResult.type === 'project' ? 'Project' : 'Machine / Asset'}
                                        </span>
                                        <h2 style={{
                                            margin: 0,
                                            fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)',
                                            color: 'var(--text-primary)'
                                        }}>
                                            {selectedResult.type === 'project'
                                                ? (selectedResult.item as any).name
                                                : (selectedResult.item as any).equipment_name
                                            }
                                        </h2>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedResult(null);
                                        clearSearch();
                                    }}
                                    className="btn btn-ghost"
                                    style={{ padding: 'var(--spacing-xs)', minWidth: 'auto' }}
                                    title="Close"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Project Details */}
                            {selectedResult.type === 'project' && (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: 'var(--spacing-md)',
                                    padding: 'var(--spacing-md)',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-md)'
                                }}>
                                    <div>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                            Description
                                        </p>
                                        <p style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                            {(selectedResult.item as any).description || 'No description'}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                            Status
                                        </p>
                                        <span className={`badge badge-${(selectedResult.item as any).status === 'active' ? 'success' :
                                            (selectedResult.item as any).status === 'completed' ? 'primary' : 'warning'
                                            }`}>
                                            {(selectedResult.item as any).status}
                                        </span>
                                    </div>
                                    <div>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                            <Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                            Created
                                        </p>
                                        <p style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                            {formatTimestamp((selectedResult.item as any).createdAt)}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                            <Clock size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                            Updated
                                        </p>
                                        <p style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                            {formatTimestamp((selectedResult.item as any).updatedAt)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Asset/Machine Details */}
                            {selectedResult.type === 'asset' && (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: 'var(--spacing-md)',
                                    padding: 'var(--spacing-md)',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-md)'
                                }}>
                                    <div>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                            Tag Number
                                        </p>
                                        <p style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: 'var(--font-size-lg)' }}>
                                            {(selectedResult.item as any).tag_number}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                            Project
                                        </p>
                                        <p style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                            {selectedResult.projectName || 'Unknown'}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                            Criticality Level
                                        </p>
                                        <span className={`badge badge-${(selectedResult.item as any).criticality_level === 'High' ? 'danger' :
                                            (selectedResult.item as any).criticality_level === 'Medium' ? 'warning' : 'success'
                                            }`}>
                                            {(selectedResult.item as any).criticality_level}
                                        </span>
                                    </div>
                                    <div>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                            System
                                        </p>
                                        <p style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                            {(selectedResult.item as any).system || 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                            Manufacturer
                                        </p>
                                        <p style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                            {(selectedResult.item as any).manufacturer || 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                            Model
                                        </p>
                                        <p style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                            {(selectedResult.item as any).model || 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                            <Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                            Installation Date
                                        </p>
                                        <p style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                            {(selectedResult.item as any).installation_date
                                                ? formatTimestamp((selectedResult.item as any).installation_date)
                                                : 'N/A'
                                            }
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                            <Clock size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                            Operating Hours/Day
                                        </p>
                                        <p style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: 'var(--font-size-lg)' }}>
                                            {(selectedResult.item as any).operating_hours_per_day || 0}h
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {analysisData && (
                        <>
                            {/* Asset Info Card */}
                            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                                <h2 style={{
                                    fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)',
                                    marginBottom: 'var(--spacing-md)',
                                    color: 'var(--text-primary)'
                                }}>
                                    Asset Information
                                </h2>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: 'var(--spacing-md)'
                                }}>
                                    <div>
                                        <p style={{
                                            color: 'var(--text-tertiary)',
                                            fontSize: 'var(--font-size-sm)',
                                            marginBottom: 'var(--spacing-xs)'
                                        }}>
                                            Equipment Name
                                        </p>
                                        <p style={{
                                            color: 'var(--text-primary)',
                                            fontSize: 'var(--font-size-lg)',
                                            fontWeight: '600'
                                        }}>
                                            {analysisData.asset_info.equipment_name}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{
                                            color: 'var(--text-tertiary)',
                                            fontSize: 'var(--font-size-sm)',
                                            marginBottom: 'var(--spacing-xs)'
                                        }}>
                                            Tag Number
                                        </p>
                                        <p style={{
                                            color: 'var(--text-primary)',
                                            fontSize: 'var(--font-size-lg)',
                                            fontWeight: '600'
                                        }}>
                                            {analysisData.asset_info.tag_number}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{
                                            color: 'var(--text-tertiary)',
                                            fontSize: 'var(--font-size-sm)',
                                            marginBottom: 'var(--spacing-xs)'
                                        }}>
                                            Criticality Level
                                        </p>
                                        <span
                                            className={`badge badge-${analysisData.asset_info.criticality_level.toLowerCase() === 'high' ? 'danger' : analysisData.asset_info.criticality_level.toLowerCase() === 'medium' ? 'warning' : 'success'}`}
                                            style={{ fontSize: 'var(--font-size-base)' }}
                                        >
                                            {analysisData.asset_info.criticality_level}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Metrics Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
                                gap: 'var(--spacing-md)',
                                marginBottom: 'var(--spacing-lg)'
                            }}>
                                {/* Risk Assessment */}
                                <div className="card">
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        marginBottom: 'var(--spacing-md)'
                                    }}>
                                        <div style={{
                                            background: 'var(--gradient-primary)',
                                            padding: 'var(--spacing-sm)',
                                            borderRadius: 'var(--radius-md)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <AlertTriangle size={isMobile ? 20 : 24} color="white" />
                                        </div>
                                    </div>
                                    <h3 style={{
                                        fontSize: 'var(--font-size-lg)',
                                        marginBottom: 'var(--spacing-sm)',
                                        color: 'var(--text-primary)'
                                    }}>
                                        Risk Assessment
                                    </h3>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--spacing-sm)'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                                Overall Risk
                                            </span>
                                            <span style={{
                                                color: getRiskColor(analysisData.risk_assessment.overall_risk),
                                                fontWeight: '700',
                                                fontSize: 'var(--font-size-lg)'
                                            }}>
                                                {analysisData.risk_assessment.overall_risk}
                                            </span>
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                                RPN
                                            </span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                                                {analysisData.risk_assessment.risk_priority_number}
                                            </span>
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                                Failure Modes
                                            </span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                                                {analysisData.risk_assessment.failure_modes}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Maintenance Recommendations */}
                                <div className="card">
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        marginBottom: 'var(--spacing-md)'
                                    }}>
                                        <div style={{
                                            background: 'var(--gradient-accent)',
                                            padding: 'var(--spacing-sm)',
                                            borderRadius: 'var(--radius-md)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Wrench size={isMobile ? 20 : 24} color="white" />
                                        </div>
                                    </div>
                                    <h3 style={{
                                        fontSize: 'var(--font-size-lg)',
                                        marginBottom: 'var(--spacing-sm)',
                                        color: 'var(--text-primary)'
                                    }}>
                                        Maintenance Plan
                                    </h3>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--spacing-sm)'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                                Frequency
                                            </span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                                                {analysisData.maintenance_recommendations.frequency}
                                            </span>
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                                Type
                                            </span>
                                            <span style={{
                                                color: 'var(--text-primary)',
                                                fontWeight: '600',
                                                fontSize: isMobile ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                                                textAlign: 'right'
                                            }}>
                                                {analysisData.maintenance_recommendations.type}
                                            </span>
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                                Priority
                                            </span>
                                            <span
                                                className={`badge badge-${analysisData.maintenance_recommendations.priority.toLowerCase() === 'high' ? 'danger' : 'warning'}`}
                                            >
                                                {analysisData.maintenance_recommendations.priority}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Cost Analysis */}
                                <div className="card">
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        marginBottom: 'var(--spacing-md)'
                                    }}>
                                        <div style={{
                                            background: 'linear-gradient(135deg, var(--success-500) 0%, var(--success-700) 100%)',
                                            padding: 'var(--spacing-sm)',
                                            borderRadius: 'var(--radius-md)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <DollarSign size={isMobile ? 20 : 24} color="white" />
                                        </div>
                                    </div>
                                    <h3 style={{
                                        fontSize: 'var(--font-size-lg)',
                                        marginBottom: 'var(--spacing-sm)',
                                        color: 'var(--text-primary)'
                                    }}>
                                        Cost Analysis
                                    </h3>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--spacing-sm)'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                                Annual Cost
                                            </span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                                                {formatCurrency(analysisData.cost_analysis.estimated_annual_cost)}
                                            </span>
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                                Potential Savings
                                            </span>
                                            <span style={{ color: 'var(--success-500)', fontWeight: '700', fontSize: 'var(--font-size-lg)' }}>
                                                {formatCurrency(analysisData.cost_analysis.potential_savings)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Info Box */}
                            <div style={{
                                padding: 'var(--spacing-md)',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--primary-500)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 'var(--spacing-md)',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-secondary)'
                            }}>
                                <CheckCircle size={20} style={{ color: 'var(--primary-500)', flexShrink: 0, marginTop: '2px' }} />
                                <p style={{ margin: 0 }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>Analysis Complete:</strong> {isMobile ? 'Data auto-generated from your assets.' : 'This data is automatically generated by n8n based on your asset information. Click refresh to get the latest analysis results.'}
                                </p>
                            </div>
                        </>
                    )}
                </div>

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
