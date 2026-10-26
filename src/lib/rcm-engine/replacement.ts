// ========================================
// OPTIMUM REPLACEMENT ANALYSIS ENGINE
// Repair vs Replace Decision Support
// ========================================

import { Asset, CostData, MaintenanceHistory, ReplacementAnalysis } from '../../types/rcm';

/**
 * Calculate asset age from installation date
 */
export const calculateAssetAge = (installationDate: string): number => {
    const installation = new Date(installationDate);
    const now = new Date();
    const ageMs = now.getTime() - installation.getTime();
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    return Math.floor(ageYears * 10) / 10; // Round to 1 decimal
};

/**
 * Analyze repair cost trend based on maintenance history
 */
export const analyzeRepairCostTrend = (
    maintenanceHistory: MaintenanceHistory,
    costData: CostData
): 'Increasing' | 'Stable' | 'Decreasing' => {
    // Simple heuristic based on failure frequency and MTBF
    const failureRate = maintenanceHistory.failure_frequency_per_year;

    if (failureRate > 4) {
        return 'Increasing';
    } else if (failureRate >= 2) {
        return 'Stable';
    } else {
        return 'Decreasing';
    }
};

/**
 * Calculate equivalent annual cost for continue vs replace decision
 */
const calculateEquivalentAnnualCost = (
    presentCost: number,
    lifespan: number,
    discountRate: number = 0.08
): number => {
    if (lifespan === 0) return 0;

    const factor = (discountRate * Math.pow(1 + discountRate, lifespan)) /
        (Math.pow(1 + discountRate, lifespan) - 1);

    return presentCost * factor;
};

/**
 * Perform optimum replacement analysis
 */
export const performReplacementAnalysis = (
    asset: Asset,
    costData: CostData,
    maintenanceHistory: MaintenanceHistory,
    estimatedRemainingLife: number = 5
): ReplacementAnalysis => {
    const assetAge = calculateAssetAge(asset.installation_date);
    const repairTrend = analyzeRepairCostTrend(maintenanceHistory, costData);

    // Calculate cost to continue with current asset
    const annualMaintenanceCost = costData.repair_cost * maintenanceHistory.failure_frequency_per_year;
    const annualDowntimeCost = costData.downtime_cost_per_hour *
        maintenanceHistory.mttr_hours *
        maintenanceHistory.failure_frequency_per_year;

    const continueCost = calculateEquivalentAnnualCost(
        (annualMaintenanceCost + annualDowntimeCost) * estimatedRemainingLife,
        estimatedRemainingLife
    );

    // Calculate cost to replace
    // Replacement cost includes purchase + installation - salvage value
    const salvageValue = costData.replacement_cost * 0.1; // Assume 10% salvage
    const netReplacementCost = costData.replacement_cost - salvageValue;

    // New asset will have lower maintenance costs (assume 50% reduction in first years)
    const newAssetAnnualCost = (annualMaintenanceCost + annualDowntimeCost) * 0.3;
    const assumedNewLifespan = 15; // years

    const replaceCost = netReplacementCost + calculateEquivalentAnnualCost(
        newAssetAnnualCost * assumedNewLifespan,
        assumedNewLifespan
    );

    // Decision logic
    let recommendation: 'Continue' | 'Planned Replacement' | 'Immediate Replacement';
    let justification = '';

    // Critical factors
    const isCriticalAsset = asset.criticality_level === 'High';
    const hasHighFailureRate = maintenanceHistory.failure_frequency_per_year >= 4;
    const isOld = assetAge > 15;
    const costDifference = continueCost - replaceCost;
    const costDifferencePercentage = (costDifference / continueCost) * 100;

    if (hasHighFailureRate && (isCriticalAsset || repairTrend === 'Increasing')) {
        recommendation = 'Immediate Replacement';
        justification = `High failure rate (${maintenanceHistory.failure_frequency_per_year}/year) combined with ${isCriticalAsset ? 'high criticality' : 'increasing repair costs'
            } makes immediate replacement necessary to avoid operational disruption and escalating costs.`;
    } else if (costDifferencePercentage > 20 || isOld) {
        recommendation = 'Planned Replacement';
        justification = `Economic analysis shows ${costDifferencePercentage.toFixed(1)}% cost advantage for replacement. ` +
            `Asset age (${assetAge} years) ${isOld ? 'exceeds typical lifespan' : 'approaching end of economic life'}. ` +
            `Plan replacement within next 12-24 months.`;
    } else if (repairTrend === 'Increasing' && assetAge > 10) {
        recommendation = 'Planned Replacement';
        justification = `Increasing repair costs trend detected with asset age of ${assetAge} years. ` +
            `While current costs are manageable, plan replacement within 2-3 years to avoid future cost escalation.`;
    } else {
        recommendation = 'Continue';
        justification = `Asset is performing adequately with ${repairTrend.toLowerCase()} repair costs. ` +
            `Continue current maintenance strategy. Re-evaluate annually or if failure rate increases.`;
    }

    return {
        analysis_id: `${asset.asset_id}_replacement_${Date.now()}`,
        asset_id: asset.asset_id,
        current_age_years: assetAge,
        repair_cost_trend: repairTrend,
        replacement_recommendation: recommendation,
        justification,
        cost_comparison: {
            continue_cost: Math.round(continueCost),
            replace_cost: Math.round(replaceCost),
        },
        created_at: new Date().toISOString(),
    };
};

/**
 * Calculate optimal replacement interval
 */
export const calculateOptimalReplacementInterval = (
    initialCost: number,
    annualMaintenanceCosts: number[],
    salvageValues: number[],
    discountRate: number = 0.08
): { optimalYear: number; minCost: number } => {
    const eacByYear: { year: number; eac: number }[] = [];

    for (let year = 1; year <= annualMaintenanceCosts.length; year++) {
        let totalCost = initialCost;

        // Add discounted maintenance costs
        for (let i = 0; i < year; i++) {
            totalCost += annualMaintenanceCosts[i] / Math.pow(1 + discountRate, i + 1);
        }

        // Subtract salvage value
        totalCost -= salvageValues[year - 1] / Math.pow(1 + discountRate, year);

        // Calculate EAC
        const eac = calculateEquivalentAnnualCost(totalCost, year, discountRate);
        eacByYear.push({ year, eac });
    }

    // Find minimum EAC
    const optimal = eacByYear.reduce((min, current) =>
        current.eac < min.eac ? current : min
    );

    return {
        optimalYear: optimal.year,
        minCost: optimal.eac,
    };
};

/**
 * Generate replacement analysis report
 */
export const generateReplacementReport = (analysis: ReplacementAnalysis, assetName: string): string => {
    let report = `Optimum Replacement Analysis: ${assetName}\n\n`;

    report += `=== Asset Information ===\n`;
    report += `Current Age: ${analysis.current_age_years} years\n`;
    report += `Repair Cost Trend: ${analysis.repair_cost_trend}\n\n`;

    report += `=== Cost Comparison (Equivalent Annual Cost) ===\n`;
    report += `Continue with Current Asset: $${analysis.cost_comparison.continue_cost.toLocaleString()}\n`;
    report += `Replace with New Asset: $${analysis.cost_comparison.replace_cost.toLocaleString()}\n`;

    const savings = analysis.cost_comparison.continue_cost - analysis.cost_comparison.replace_cost;
    if (savings > 0) {
        report += `Potential Annual Savings with Replacement: $${savings.toLocaleString()}\n\n`;
    } else {
        report += `Additional Annual Cost with Replacement: $${Math.abs(savings).toLocaleString()}\n\n`;
    }

    report += `=== Recommendation ===\n`;
    report += `${analysis.replacement_recommendation}\n\n`;
    report += `=== Justification ===\n`;
    report += `${analysis.justification}\n`;

    return report;
};

/**
 * Get replacement priority score (0-100)
 * Higher score = higher priority for replacement
 */
export const getReplacementPriority = (
    analysis: ReplacementAnalysis,
    criticalityLevel: 'Low' | 'Medium' | 'High'
): number => {
    let score = 0;

    // Age factor (max 30 points)
    if (analysis.current_age_years > 20) score += 30;
    else if (analysis.current_age_years > 15) score += 20;
    else if (analysis.current_age_years > 10) score += 10;

    // Cost trend factor (max 25 points)
    if (analysis.repair_cost_trend === 'Increasing') score += 25;
    else if (analysis.repair_cost_trend === 'Stable') score += 10;

    // Economic factor (max 25 points)
    const costSavings = analysis.cost_comparison.continue_cost - analysis.cost_comparison.replace_cost;
    const savingsPercentage = (costSavings / analysis.cost_comparison.continue_cost) * 100;
    if (savingsPercentage > 30) score += 25;
    else if (savingsPercentage > 15) score += 15;
    else if (savingsPercentage > 0) score += 5;

    // Criticality factor (max 20 points)
    if (criticalityLevel === 'High') score += 20;
    else if (criticalityLevel === 'Medium') score += 10;
    else score += 5;

    return Math.min(score, 100);
};
