// ========================================
// MAINTENANCE STRATEGY SELECTION ENGINE
// Intelligent Task Recommendation
// ========================================

import { FMEAResult, MaintenanceTask, Asset, MaintenanceHistory } from '../../types/rcm';

export type MaintenanceStrategyType = 'Preventive' | 'Predictive' | 'Corrective' | 'Run-to-Failure';

/**
 * Select optimal maintenance strategy based on FMEA results and asset characteristics
 */
export const selectMaintenanceStrategy = (
    fmea: FMEAResult,
    asset: Asset,
    history?: MaintenanceHistory
): {
    strategy: MaintenanceStrategyType;
    justification: string;
    interval: string;
    interval_hours?: number;
} => {
    const { rpn, risk_level, severity, occurrence, detection } = fmea;
    const isCritical = asset.criticality_level === 'High';

    // Decision tree for strategy selection

    // High severity or high RPN → Preventive or Predictive
    if (severity >= 9 || rpn >= 400) {
        return {
            strategy: 'Predictive',
            justification: `Critical failure mode with ${severity >= 9 ? 'catastrophic consequences' : 'very high RPN (' + rpn + ')'}. ` +
                `Continuous condition monitoring is essential to prevent failure and ensure safety.`,
            interval: 'Continuous',
            interval_hours: asset.operating_hours_per_day * 365,
        };
    }

    // High risk with poor detection
    if (risk_level === 'High' && detection >= 7) {
        return {
            strategy: 'Predictive',
            justification: `High risk failure with poor detectability (${detection}/10). ` +
                `Predictive monitoring provides early warning before failure occurrence.`,
            interval: 'Weekly',
            interval_hours: 168,
        };
    }

    // High occurrence → Preventive
    if (occurrence >= 7 || (history && history.failure_frequency_per_year >= 4)) {
        const interval = occurrence >= 8 ? 'Monthly' : 'Quarterly';
        const hours = occurrence >= 8 ? 730 : 2190;

        return {
            strategy: 'Preventive',
            justification: `High failure frequency (${occurrence}/10) requires scheduled preventive maintenance ` +
                `to reduce occurrence and prevent unplanned downtime.`,
            interval,
            interval_hours: hours,
        };
    }

    // Medium to high risk on critical asset
    if ((risk_level === 'High' || risk_level === 'Medium') && isCritical) {
        return {
            strategy: 'Preventive',
            justification: `${risk_level} risk on critical asset. Preventive maintenance ensures reliability ` +
                `and minimizes production impact.`,
            interval: risk_level === 'High' ? 'Monthly' : 'Quarterly',
            interval_hours: risk_level === 'High' ? 730 : 2190,
        };
    }

    // Medium risk with moderate occurrence
    if (risk_level === 'Medium' && occurrence >= 4) {
        return {
            strategy: 'Preventive',
            justification: `Medium risk with moderate failure rate. Scheduled preventive maintenance ` +
                `is cost-effective to maintain reliability.`,
            interval: 'Quarterly',
            interval_hours: 2190,
        };
    }

    // Low severity and low occurrence → Run-to-Failure acceptable
    if (severity <= 3 && occurrence <= 3 && !isCritical) {
        return {
            strategy: 'Run-to-Failure',
            justification: `Low severity (${severity}/10) and low occurrence (${occurrence}/10) on non-critical asset. ` +
                `Reactive maintenance is most cost-effective. Maintain spare parts inventory.`,
            interval: 'As needed',
        };
    }

    // Default: Corrective maintenance with monitoring
    return {
        strategy: 'Corrective',
        justification: `Moderate risk profile suitable for corrective maintenance. ` +
            `Monitor performance and address issues as they arise. Schedule inspections semi-annually.`,
        interval: 'Semi-annually',
        interval_hours: 4380,
    };
};

/**
 * Generate maintenance task from FMEA analysis
 */
export const generateMaintenanceTask = (
    fmea: FMEAResult,
    asset: Asset,
    history?: MaintenanceHistory
): Omit<MaintenanceTask, 'task_id' | 'created_at'> => {
    const strategy = selectMaintenanceStrategy(fmea, asset, history);

    // Generate task description based on failure mode
    const taskDescription = generateTaskDescription(
        fmea.failure_mode,
        strategy.strategy,
        fmea.failure_cause
    );

    // Calculate due date based on interval
    const dueDate = calculateDueDate(strategy.interval);

    return {
        asset_id: asset.asset_id,
        fmea_id: fmea.fmea_id,
        task_type: strategy.strategy,
        task_description: taskDescription,
        interval: strategy.interval,
        interval_hours: strategy.interval_hours,
        due_date: dueDate,
        status: 'Pending',
        engineering_justification: strategy.justification,
    };
};

/**
 * Generate specific task description based on failure mode
 */
const generateTaskDescription = (
    failureMode: string,
    strategy: MaintenanceStrategyType,
    failureCause: string
): string => {
    const lowerMode = failureMode.toLowerCase();

    if (strategy === 'Predictive') {
        if (lowerMode.includes('bearing')) {
            return 'Vibration analysis and oil analysis to detect bearing degradation';
        } else if (lowerMode.includes('motor') || lowerMode.includes('electrical')) {
            return 'Thermal imaging and current signature analysis';
        } else if (lowerMode.includes('leak') || lowerMode.includes('seal')) {
            return 'Ultrasonic leak detection and visual inspection';
        } else if (lowerMode.includes('corrosion')) {
            return 'Ultrasonic thickness measurement and visual inspection';
        } else {
            return `Condition monitoring for ${failureMode.toLowerCase()}`;
        }
    }

    if (strategy === 'Preventive') {
        if (lowerMode.includes('bearing')) {
            return 'Lubrication service and bearing inspection';
        } else if (lowerMode.includes('filter')) {
            return 'Filter replacement and system check';
        } else if (lowerMode.includes('belt') || lowerMode.includes('coupling')) {
            return 'Alignment check, tension adjustment, and wear inspection';
        } else if (lowerMode.includes('motor')) {
            return 'Motor winding resistance test and insulation check';
        } else if (lowerMode.includes('pump')) {
            return 'Pump performance test and seal inspection';
        } else {
            return `Scheduled inspection and servicing to prevent ${failureMode.toLowerCase()}`;
        }
    }

    if (strategy === 'Corrective') {
        return `Monitor and address ${failureMode.toLowerCase()} when detected. Root cause: ${failureCause}`;
    }

    // Run-to-Failure
    return `Maintain spare parts for ${failureMode.toLowerCase()}. Repair upon failure.`;
};

/**
 * Calculate due date based on interval
 */
const calculateDueDate = (interval: string): string => {
    const now = new Date();

    const intervalDays: { [key: string]: number } = {
        Continuous: 1,
        Daily: 1,
        Weekly: 7,
        Biweekly: 14,
        Monthly: 30,
        Quarterly: 90,
        'Semi-annually': 180,
        Annually: 365,
        'As needed': 9999,
    };

    const days = intervalDays[interval] || 30;
    now.setDate(now.getDate() + days);

    return now.toISOString().split('T')[0];
};

/**
 * Optimize maintenance intervals based on cost-benefit analysis
 */
export const optimizeMaintenanceInterval = (
    taskCost: number,
    failureCost: number,
    failureRate: number, // failures per year
    preventionEffectiveness: number = 0.7 // 0-1
): {
    optimalInterval: string;
    optimalIntervalMonths: number;
    expectedSavings: number;
    justification: string;
} => {
    // Calculate optimal frequency (tasks per year)
    const costRatio = failureCost / taskCost;
    const optimalFrequency = Math.sqrt((failureRate * preventionEffectiveness * costRatio) / 2);

    const optimalMonths = Math.max(1, Math.min(12, Math.round(12 / optimalFrequency)));

    // Calculate expected savings
    const annualTaskCost = taskCost * (12 / optimalMonths);
    const reducedFailures = failureRate * (1 - preventionEffectiveness);
    const annualFailureCost = reducedFailures * failureCost;
    const totalCost = annualTaskCost + annualFailureCost;

    const noMaintenanceCost = failureRate * failureCost;
    const expectedSavings = noMaintenanceCost - totalCost;

    // Map to standard intervals
    const intervalMap: { [key: number]: string } = {
        1: 'Monthly',
        2: 'Biweekly',
        3: 'Quarterly',
        4: 'Quarterly',
        6: 'Semi-annually',
        12: 'Annually',
    };

    const optimalInterval = intervalMap[optimalMonths] || 'Quarterly';

    const justification = `Optimal interval of ${optimalInterval} (every ${optimalMonths} months) ` +
        `balances task cost ($${taskCost}) with failure prevention. ` +
        `Expected to reduce failures by ${(preventionEffectiveness * 100).toFixed(0)}% ` +
        `with annual savings of $${expectedSavings.toFixed(2)}.`;

    return {
        optimalInterval,
        optimalIntervalMonths: optimalMonths,
        expectedSavings,
        justification,
    };
};

/**
 * Prioritize maintenance tasks
 */
export const prioritizeMaintenanceTasks = (tasks: MaintenanceTask[]): MaintenanceTask[] => {
    return tasks.sort((a, b) => {
        // Priority order:
        // 1. Overdue tasks
        // 2. Predictive tasks
        // 3. Preventive tasks
        // 4. Corrective tasks
        // 5. Run-to-Failure tasks

        const now = new Date();
        const aDue = new Date(a.due_date);
        const bDue = new Date(b.due_date);

        const aOverdue = aDue < now ? 1 : 0;
        const bOverdue = bDue < now ? 1 : 0;

        if (aOverdue !== bOverdue) return bOverdue - aOverdue;

        const typePriority: { [key: string]: number } = {
            Predictive: 4,
            Preventive: 3,
            Corrective: 2,
            'Run-to-Failure': 1,
        };

        const aPriority = typePriority[a.task_type] || 0;
        const bPriority = typePriority[b.task_type] || 0;

        if (aPriority !== bPriority) return bPriority - aPriority;

        // Sort by due date
        return aDue.getTime() - bDue.getTime();
    });
};

/**
 * Generate maintenance plan summary
 */
export const generateMaintenancePlan = (tasks: MaintenanceTask[]): string => {
    const tasksByType = {
        Predictive: tasks.filter(t => t.task_type === 'Predictive'),
        Preventive: tasks.filter(t => t.task_type === 'Preventive'),
        Corrective: tasks.filter(t => t.task_type === 'Corrective'),
        'Run-to-Failure': tasks.filter(t => t.task_type === 'Run-to-Failure'),
    };

    let plan = 'Maintenance Plan Summary\n\n';

    Object.entries(tasksByType).forEach(([type, typeTasks]) => {
        if (typeTasks.length > 0) {
            plan += `=== ${type} Maintenance (${typeTasks.length} tasks) ===\n`;
            typeTasks.forEach((task, index) => {
                plan += `${index + 1}. ${task.task_description}\n`;
                plan += `   Interval: ${task.interval} | Due: ${task.due_date} | Status: ${task.status}\n`;
            });
            plan += '\n';
        }
    });

    return plan;
};
