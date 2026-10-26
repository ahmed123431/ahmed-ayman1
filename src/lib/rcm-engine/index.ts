// ========================================
// RCM ENGINE ORCHESTRATOR
// Main interface for all RCM analysis functions
// ========================================

import {
    Asset,
    CostData,
    FMEAInput,
    FMEAResult,
    MaintenanceHistory,
    MaintenanceTask,
    ConsequenceClassification,
    RiskAssessment,
    ReplacementAnalysis,
    RCMReport,
    Project,
} from '../../types/rcm';

import {
    analyzeFMEA,
    analyzeFMEABatch,
    getFMEAStatistics,
    getCriticalFailureModes,
    generateFMEASummary,
} from './fmea';

import {
    classifyRisk,
    getRiskDistribution,
    getUnacceptableRisks,
    generateRiskReport,
    prioritizeRisks,
} from './risk';

import {
    calculateAnnualOperatingCost,
    compareMaintenanceStrategies,
    calculatePredictiveMaintenanceROI,
    generateCostReport,
} from './cost';

import {
    performReplacementAnalysis,
    generateReplacementReport,
    getReplacementPriority,
} from './replacement';

import {
    selectMaintenanceStrategy,
    generateMaintenanceTask,
    prioritizeMaintenanceTasks,
    generateMaintenancePlan,
    optimizeMaintenanceInterval,
} from './strategy';

/**
 * Complete RCM Analysis
 * This is the main orchestrator that performs a full RCM study
 */
export const performCompleteRCMAnalysis = (input: {
    project: Project;
    asset: Asset;
    fmeas: FMEAInput[];
    consequences: ConsequenceClassification[];
    costData: CostData;
    maintenanceHistory: MaintenanceHistory;
}): {
    fmeaResults: FMEAResult[];
    riskAssessments: RiskAssessment[];
    maintenanceTasks: MaintenanceTask[];
    replacementAnalysis: ReplacementAnalysis;
    costAnalysis: ReturnType<typeof calculateAnnualOperatingCost>;
    executiveSummary: string;
} => {
    const { project, asset, fmeas, consequences, costData, maintenanceHistory } = input;

    // Step 1: FMEA Analysis
    const fmeaResults = analyzeFMEABatch(fmeas);
    const fmeaStats = getFMEAStatistics(fmeaResults);
    const criticalFailures = getCriticalFailureModes(fmeaResults);

    // Step 2: Risk Classification
    let allRisks: RiskAssessment[] = [];
    consequences.forEach((consequence) => {
        const fmea = fmeaResults.find((f) => f.fmea_id === consequence.fmea_id);
        if (fmea) {
            const risks = classifyRisk(consequence, fmea.rpn);
            allRisks = [...allRisks, ...risks];
        }
    });
    const prioritizedRisks = prioritizeRisks(allRisks);
    const unacceptableRisks = getUnacceptableRisks(allRisks);

    // Step 3: Generate Maintenance Tasks
    const tasks: MaintenanceTask[] = fmeaResults.map((fmea) =>
        generateMaintenanceTask(fmea, asset, maintenanceHistory)
    ).map((task, index) => ({
        ...task,
        task_id: `task_${asset.asset_id}_${index}`,
        created_at: new Date().toISOString(),
    }));
    const prioritizedTasks = prioritizeMaintenanceTasks(tasks);

    // Step 4: Cost Analysis
    const costAnalysis = calculateAnnualOperatingCost(
        asset,
        costData,
        maintenanceHistory,
        tasks
    );

    // Step 5: Replacement Analysis
    const replacementAnalysis = performReplacementAnalysis(
        asset,
        costData,
        maintenanceHistory
    );

    // Step 6: Generate Executive Summary
    const executiveSummary = generateExecutiveSummary({
        project,
        asset,
        fmeaStats,
        criticalFailures,
        unacceptableRisks,
        costAnalysis,
        replacementAnalysis,
        taskCount: tasks.length,
    });

    return {
        fmeaResults,
        riskAssessments: prioritizedRisks,
        maintenanceTasks: prioritizedTasks,
        replacementAnalysis,
        costAnalysis,
        executiveSummary,
    };
};

/**
 * Generate Executive Summary for RCM Report
 */
const generateExecutiveSummary = (data: {
    project: Project;
    asset: Asset;
    fmeaStats: ReturnType<typeof getFMEAStatistics>;
    criticalFailures: FMEAResult[];
    unacceptableRisks: RiskAssessment[];
    costAnalysis: ReturnType<typeof calculateAnnualOperatingCost>;
    replacementAnalysis: ReplacementAnalysis;
    taskCount: number;
}): string => {
    const { project, asset, fmeaStats, criticalFailures, unacceptableRisks, costAnalysis, replacementAnalysis, taskCount } = data;

    let summary = '';

    summary += `RCM ANALYSIS EXECUTIVE SUMMARY\n`;
    summary += `${'='.repeat(60)}\n\n`;

    summary += `Project: ${project.project_name}\n`;
    summary += `Location: ${project.location}\n`;
    summary += `Industry: ${project.industry}\n`;
    summary += `Asset: ${asset.equipment_name} (${asset.tag_number})\n`;
    summary += `Criticality Level: ${asset.criticality_level}\n`;
    summary += `Analysis Date: ${new Date().toLocaleDateString()}\n\n`;

    summary += `${'='.repeat(60)}\n`;
    summary += `KEY FINDINGS\n`;
    summary += `${'='.repeat(60)}\n\n`;

    // FMEA Summary
    summary += `1. FAILURE MODE ANALYSIS\n`;
    summary += `   - Total failure modes analyzed: ${fmeaStats.total}\n`;
    summary += `   - High risk failures: ${fmeaStats.highRisk} (${fmeaStats.highRiskPercentage}%)\n`;
    summary += `   - Medium risk failures: ${fmeaStats.mediumRisk}\n`;
    summary += `   - Low risk failures: ${fmeaStats.lowRisk}\n`;
    summary += `   - Average RPN: ${fmeaStats.avgRPN}\n\n`;

    if (criticalFailures.length > 0) {
        summary += `   CRITICAL FAILURES REQUIRING IMMEDIATE ATTENTION:\n`;
        criticalFailures.slice(0, 3).forEach((cf, idx) => {
            summary += `   ${idx + 1}. ${cf.failure_mode} (RPN: ${cf.rpn})\n`;
        });
        summary += `\n`;
    }

    // Risk Summary
    summary += `2. RISK ASSESSMENT\n`;
    if (unacceptableRisks.length > 0) {
        summary += `   ⚠️  UNACCEPTABLE RISKS IDENTIFIED: ${unacceptableRisks.length}\n`;
        unacceptableRisks.forEach((risk, idx) => {
            summary += `   ${idx + 1}. ${risk.risk_category} Risk - ${risk.risk_level}\n`;
            summary += `      Action: ${risk.mitigation_action}\n`;
        });
    } else {
        summary += `   ✓ No unacceptable risks identified\n`;
        summary += `   All risks are within acceptable limits with proposed controls\n`;
    }
    summary += `\n`;

    // Maintenance Plan
    summary += `3. MAINTENANCE PLAN\n`;
    summary += `   - Total maintenance tasks: ${taskCount}\n`;
    summary += `   - Recommended strategy emphasizes: ${getMaintenanceEmphasis(taskCount)}\n`;
    summary += `   - All tasks aligned with risk levels and failure modes\n\n`;

    // Cost Analysis
    summary += `4. COST ANALYSIS\n`;
    summary += `   - Total Annual Cost: $${costAnalysis.total.toLocaleString()}\n`;
    summary += `     • Operating: $${costAnalysis.breakdown.operating.toLocaleString()}\n`;
    summary += `     • Maintenance: $${costAnalysis.breakdown.maintenance.toLocaleString()}\n`;
    summary += `     • Downtime: $${costAnalysis.breakdown.downtime.toLocaleString()}\n`;
    summary += `     • Failures: $${costAnalysis.breakdown.failures.toLocaleString()}\n\n`;

    // Replacement Analysis
    summary += `5. ASSET LIFECYCLE DECISION\n`;
    summary += `   - Current Age: ${replacementAnalysis.current_age_years} years\n`;
    summary += `   - Repair Cost Trend: ${replacementAnalysis.repair_cost_trend}\n`;
    summary += `   - RECOMMENDATION: ${replacementAnalysis.replacement_recommendation}\n`;
    summary += `   - ${replacementAnalysis.justification}\n\n`;

    // Overall Recommendation
    summary += `${'='.repeat(60)}\n`;
    summary += `OVERALL RECOMMENDATION\n`;
    summary += `${'='.repeat(60)}\n\n`;

    if (unacceptableRisks.length > 0) {
        summary += `❗ IMMEDIATE ACTION REQUIRED:\n`;
        summary += `Address ${unacceptableRisks.length} unacceptable risk(s) before resuming normal operations.\n\n`;
    }

    if (criticalFailures.length > 3) {
        summary += `⚠️  HIGH PRIORITY:\n`;
        summary += `Implement predictive/preventive maintenance for ${criticalFailures.length} critical failure modes.\n\n`;
    }

    if (replacementAnalysis.replacement_recommendation === 'Immediate Replacement') {
        summary += `🔧 ASSET REPLACEMENT:\n`;
        summary += `Plan for immediate asset replacement due to economic and reliability factors.\n\n`;
    }

    summary += `This RCM analysis provides a comprehensive maintenance strategy that balances\n`;
    summary += `safety, reliability, and cost-effectiveness. Implementation of recommended tasks\n`;
    summary += `will reduce unplanned downtime and optimize maintenance expenditures.\n`;

    return summary;
};

/**
 * Helper function to determine maintenance emphasis
 */
const getMaintenanceEmphasis = (taskCount: number): string => {
    if (taskCount >= 10) return 'Comprehensive preventive and predictive maintenance';
    if (taskCount >= 5) return 'Balanced preventive maintenance approach';
    return 'Focused critical maintenance';
};

/**
 * Export all RCM engine functions for direct use
 */
export {
    // FMEA
    analyzeFMEA,
    analyzeFMEABatch,
    getFMEAStatistics,
    getCriticalFailureModes,
    generateFMEASummary,
    // Risk
    classifyRisk,
    getRiskDistribution,
    getUnacceptableRisks,
    generateRiskReport,
    prioritizeRisks,
    // Cost
    calculateAnnualOperatingCost,
    compareMaintenanceStrategies,
    calculatePredictiveMaintenanceROI,
    generateCostReport,
    // Replacement
    performReplacementAnalysis,
    generateReplacementReport,
    getReplacementPriority,
    // Strategy
    selectMaintenanceStrategy,
    generateMaintenanceTask,
    prioritizeMaintenanceTasks,
    generateMaintenancePlan,
    optimizeMaintenanceInterval,
};
