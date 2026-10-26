// ========================================
// COST ANALYSIS ENGINE
// Lifecycle Cost and Economic Analysis
// ========================================

import { CostData, Asset, MaintenanceHistory, MaintenanceTask } from '../../types/rcm';

/**
 * Calculate total downtime cost based on failure frequency
 */
export const calculateDowntimeCost = (
    downtimeCostPerHour: number,
    mttr: number,
    failureFrequency: number
): number => {
    return downtimeCostPerHour * mttr * failureFrequency;
};

/**
 * Calculate annual maintenance cost
 */
export const calculateMaintenanceCost = (
    tasks: MaintenanceTask[],
    laborCostPerHour: number,
    sparePartsCost: number
): number => {
    // Estimate labor hours per task type
    const laborHours = {
        Preventive: 2,
        Predictive: 1,
        Corrective: 4,
        'Run-to-Failure': 0,
    };

    let totalCost = 0;

    tasks.forEach(task => {
        const hours = laborHours[task.task_type];
        const frequency = getAnnualFrequency(task.interval);
        totalCost += hours * laborCostPerHour * frequency;
    });

    // Add spare parts cost
    totalCost += sparePartsCost;

    return totalCost;
};

/**
 * Get annual frequency based on interval
 */
const getAnnualFrequency = (interval: string): number => {
    const intervals: { [key: string]: number } = {
        Daily: 365,
        Weekly: 52,
        Biweekly: 26,
        Monthly: 12,
        Quarterly: 4,
        'Semi-annually': 2,
        Annually: 1,
    };

    return intervals[interval] || 12;
};

/**
 * Calculate cost per failure
 */
export const calculateCostPerFailure = (
    repairCost: number,
    downtimeCostPerHour: number,
    mttr: number,
    sparePartsCost: number
): number => {
    return repairCost + (downtimeCostPerHour * mttr) + sparePartsCost;
};

/**
 * Calculate annual operating cost
 */
export const calculateAnnualOperatingCost = (
    asset: Asset,
    costData: CostData,
    maintenanceHistory: MaintenanceHistory,
    tasks: MaintenanceTask[]
): {
    total: number;
    breakdown: {
        operating: number;
        downtime: number;
        maintenance: number;
        failures: number;
    };
} => {
    // Operating cost
    const annualOperatingHours = asset.operating_hours_per_day * 365;
    const operatingCost = asset.operating_cost_per_hour * annualOperatingHours;

    // Downtime cost
    const downtimeCost = calculateDowntimeCost(
        costData.downtime_cost_per_hour,
        maintenanceHistory.mttr_hours,
        maintenanceHistory.failure_frequency_per_year
    );

    // Maintenance cost
    const maintenanceCost = calculateMaintenanceCost(
        tasks,
        costData.labor_cost_per_hour,
        costData.spare_parts_cost
    );

    // Failure cost
    const costPerFailure = calculateCostPerFailure(
        costData.repair_cost,
        costData.downtime_cost_per_hour,
        maintenanceHistory.mttr_hours,
        costData.spare_parts_cost
    );
    const failuresCost = costPerFailure * maintenanceHistory.failure_frequency_per_year;

    return {
        total: operatingCost + downtimeCost + maintenanceCost + failuresCost,
        breakdown: {
            operating: operatingCost,
            downtime: downtimeCost,
            maintenance: maintenanceCost,
            failures: failuresCost,
        },
    };
};

/**
 * Calculate lifecycle cost
 */
export const calculateLifecycleCost = (
    initialCost: number,
    annualOperatingCost: number,
    annualMaintenanceCost: number,
    lifespan: number,
    discountRate: number = 0.05
): number => {
    let totalCost = initialCost;

    for (let year = 1; year <= lifespan; year++) {
        const yearCost = annualOperatingCost + annualMaintenanceCost;
        const discountedCost = yearCost / Math.pow(1 + discountRate, year);
        totalCost += discountedCost;
    }

    return totalCost;
};

/**
 * Compare preventive vs reactive maintenance costs
 */
export const compareMaintenanceStrategies = (
    costData: CostData,
    maintenanceHistory: MaintenanceHistory,
    preventiveTasks: number
): {
    preventive: {
        cost: number;
        failureReduction: number;
        netSavings: number;
    };
    reactive: {
        cost: number;
    };
    recommendation: string;
} => {
    // Reactive (run-to-failure) cost
    const costPerFailure = calculateCostPerFailure(
        costData.repair_cost,
        costData.downtime_cost_per_hour,
        maintenanceHistory.mttr_hours,
        costData.spare_parts_cost
    );
    const reactiveCost = costPerFailure * maintenanceHistory.failure_frequency_per_year;

    // Preventive maintenance cost
    const preventiveCostPerTask = costData.labor_cost_per_hour * 2; // Assume 2 hours per PM task
    const preventiveBaseCost = preventiveCostPerTask * preventiveTasks * 12; // Monthly tasks

    // Assume preventive maintenance reduces failures by 60-80%
    const failureReduction = 0.7;
    const reducedFailures = maintenanceHistory.failure_frequency_per_year * (1 - failureReduction);
    const residualFailureCost = costPerFailure * reducedFailures;

    const totalPreventiveCost = preventiveBaseCost + residualFailureCost;
    const netSavings = reactiveCost - totalPreventiveCost;

    let recommendation = '';
    if (netSavings > 0) {
        recommendation = `Preventive maintenance is recommended. Expected annual savings: $${netSavings.toFixed(2)}`;
    } else {
        recommendation = 'Reactive maintenance may be more cost-effective for this asset.';
    }

    return {
        preventive: {
            cost: totalPreventiveCost,
            failureReduction: failureReduction * 100,
            netSavings,
        },
        reactive: {
            cost: reactiveCost,
        },
        recommendation,
    };
};

/**
 * Calculate ROI for predictive maintenance implementation
 */
export const calculatePredictiveMaintenanceROI = (
    implementationCost: number,
    annualSavings: number,
    paybackPeriodYears: number = 3
): {
    roi: number;
    paybackPeriod: number;
    npv: number;
    recommendation: string;
} => {
    const totalSavings = annualSavings * paybackPeriodYears;
    const roi = ((totalSavings - implementationCost) / implementationCost) * 100;
    const paybackPeriod = implementationCost / annualSavings;

    // Calculate NPV (Net Present Value)
    const discountRate = 0.08;
    let npv = -implementationCost;
    for (let year = 1; year <= paybackPeriodYears; year++) {
        npv += annualSavings / Math.pow(1 + discountRate, year);
    }

    let recommendation = '';
    if (roi > 50 && paybackPeriod < 2) {
        recommendation = 'Highly recommended. Excellent ROI with quick payback.';
    } else if (roi > 20 && paybackPeriod < 3) {
        recommendation = 'Recommended. Good ROI with reasonable payback period.';
    } else if (roi > 0) {
        recommendation = 'Consider implementation. Positive ROI but longer payback period.';
    } else {
        recommendation = 'Not recommended. Negative ROI - costs exceed savings.';
    }

    return {
        roi,
        paybackPeriod,
        npv,
        recommendation,
    };
};

/**
 * Generate cost analysis report
 */
export const generateCostReport = (
    asset: Asset,
    costData: CostData,
    maintenanceHistory: MaintenanceHistory,
    tasks: MaintenanceTask[]
): string => {
    const annualCost = calculateAnnualOperatingCost(asset, costData, maintenanceHistory, tasks);

    let report = `Cost Analysis Report: ${asset.equipment_name}\n\n`;
    report += `=== Annual Cost Breakdown ===\n`;
    report += `Total Annual Cost: $${annualCost.total.toFixed(2)}\n`;
    report += `  - Operating Cost: $${annualCost.breakdown.operating.toFixed(2)}\n`;
    report += `  - Downtime Cost: $${annualCost.breakdown.downtime.toFixed(2)}\n`;
    report += `  - Maintenance Cost: $${annualCost.breakdown.maintenance.toFixed(2)}\n`;
    report += `  - Failure Cost: $${annualCost.breakdown.failures.toFixed(2)}\n\n`;

    const costPerFailure = calculateCostPerFailure(
        costData.repair_cost,
        costData.downtime_cost_per_hour,
        maintenanceHistory.mttr_hours,
        costData.spare_parts_cost
    );

    report += `Cost per Failure Event: $${costPerFailure.toFixed(2)}\n`;
    report += `Annual Failure Frequency: ${maintenanceHistory.failure_frequency_per_year}\n`;

    return report;
};
