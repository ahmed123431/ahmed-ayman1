// ========================================
// RCM APPLICATION - TYPE DEFINITIONS
// ========================================

// Project Types
export interface Project {
    project_id: string;
    project_name: string;
    location: string;
    industry: string;
    description: string;
    start_date: string;
    created_at?: string;
    user_id?: string;
}

// Asset / Equipment Types
export interface Asset {
    asset_id: string;
    project_id: string;
    equipment_name: string;
    tag_number: string;
    system: string;
    subsystem: string;
    manufacturer: string;
    model: string;
    installation_date: string;
    operating_hours_per_day: number;
    operating_cost_per_hour: number;
    criticality_level: 'Low' | 'Medium' | 'High';
    created_at?: string;
}

// Functional Analysis Types
export interface FunctionalAnalysis {
    functional_analysis_id: string;
    asset_id: string;
    primary_function: string;
    performance_standard: string;
    operating_context: string;
    created_at?: string;
}

// FMEA Input Types
export interface FMEAInput {
    fmea_id: string;
    asset_id: string;
    failure_mode: string;
    failure_cause: string;
    failure_effect: string;
    severity: number; // 1-10
    occurrence: number; // 1-10
    detection: number; // 1-10
    created_at?: string;
}

// FMEA Result (with calculated RPN)
export interface FMEAResult extends FMEAInput {
    rpn: number;
    risk_level: 'Low' | 'Medium' | 'High';
    recommended_action: string;
}

// Consequence Classification Types
export interface ConsequenceClassification {
    consequence_id: string;
    fmea_id: string;
    safety: boolean;
    environmental: boolean;
    operational: boolean;
    financial: boolean;
    created_at?: string;
}

// Cost Data Types
export interface CostData {
    cost_id: string;
    asset_id: string;
    downtime_cost_per_hour: number;
    repair_cost: number;
    replacement_cost: number;
    spare_parts_cost: number;
    labor_cost_per_hour: number;
    created_at?: string;
}

// Maintenance History Types
export interface MaintenanceHistory {
    history_id: string;
    asset_id: string;
    mtbf_hours: number; // Mean Time Between Failures
    mttr_hours: number; // Mean Time To Repair
    failure_frequency_per_year: number;
    created_at?: string;
}

// Task & Calendar Types
export interface MaintenanceTask {
    task_id: string;
    asset_id: string;
    fmea_id?: string;
    task_type: 'Preventive' | 'Predictive' | 'Corrective' | 'Run-to-Failure';
    task_description: string;
    interval: string; // e.g., "Weekly", "Monthly", "Quarterly"
    interval_hours?: number;
    due_date: string;
    status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
    assigned_to?: string;
    engineering_justification: string;
    created_at?: string;
}

// Chat Message Types
export interface ChatMessage {
    message_id: string;
    project_id?: string;
    asset_id?: string;
    user_id: string;
    message: string;
    response?: string;
    timestamp: string;
}

// Risk Assessment Types
export interface RiskAssessment {
    risk_id: string;
    fmea_id: string;
    risk_category: 'Safety' | 'Environmental' | 'Operational' | 'Financial';
    risk_level: 'Low' | 'Medium' | 'High';
    mitigation_action: string;
    created_at?: string;
}

// Replacement Analysis Types
export interface ReplacementAnalysis {
    analysis_id: string;
    asset_id: string;
    current_age_years: number;
    repair_cost_trend: 'Increasing' | 'Stable' | 'Decreasing';
    replacement_recommendation: 'Continue' | 'Planned Replacement' | 'Immediate Replacement';
    justification: string;
    cost_comparison: {
        continue_cost: number;
        replace_cost: number;
    };
    created_at?: string;
}

// Chart Data Types
export interface ChartData {
    labels: string[];
    values: number[];
    categories?: string[];
}

// Report Types
export interface RCMReport {
    project: Project;
    asset: Asset;
    executive_summary: string;
    fmea_summary: FMEAResult[];
    risk_assessment: RiskAssessment[];
    maintenance_plan: MaintenanceTask[];
    cost_analysis: {
        total_annual_cost: number;
        downtime_cost: number;
        maintenance_cost: number;
        breakdown: {
            preventive: number;
            predictive: number;
            corrective: number;
        };
    };
    replacement_analysis?: ReplacementAnalysis;
    generated_at: string;
}

// User Types
export interface User {
    user_id: string;
    email: string;
    full_name?: string;
    role?: 'Admin' | 'Engineer' | 'Technician' | 'Viewer';
    created_at?: string;
}

// Dashboard Statistics
export interface DashboardStats {
    total_projects: number;
    total_assets: number;
    high_risk_items: number;
    pending_tasks: number;
    total_cost: number;
}
