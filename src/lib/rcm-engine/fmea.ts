// ========================================
// FMEA ANALYSIS ENGINE
// Risk Priority Number (RPN) Calculations
// ========================================

import type { FMEAInput, FMEAResult } from '../../types/rcm';

/**
 * Calculate Risk Priority Number (RPN)
 * RPN = Severity × Occurrence × Detection
 * Range: 1 - 1000
 */
export const calculateRPN = (
    severity: number,
    occurrence: number,
    detection: number
): number => {
    // Validate inputs (must be 1-10)
    if (severity < 1 || severity > 10 ||
        occurrence < 1 || occurrence > 10 ||
        detection < 1 || detection > 10) {
        throw new Error('Severity, Occurrence, and Detection must be between 1 and 10');
    }

    return severity * occurrence * detection;
};

/**
 * Determine risk level based on RPN
 * Low: 1-100
 * Medium: 101-300
 * High: 301-1000
 */
export const getRiskLevel = (rpn: number): 'Low' | 'Medium' | 'High' => {
    if (rpn <= 100) return 'Low';
    if (rpn <= 300) return 'Medium';
    return 'High';
};

/**
 * Get recommended action based on RPN and risk level
 */
export const getRecommendedAction = (
    rpn: number,
    severity: number,
    occurrence: number,
    detection: number
): string => {
    const riskLevel = getRiskLevel(rpn);

    // High severity (safety/catastrophic) always gets priority
    if (severity >= 9) {
        return 'CRITICAL: Implement immediate safety controls and predictive monitoring. Consider redundancy.';
    }

    if (riskLevel === 'High') {
        if (occurrence >= 7) {
            return 'Implement predictive maintenance with continuous monitoring. Analyze root causes and redesign if needed.';
        } else if (detection >= 7) {
            return 'Improve detection methods. Implement condition monitoring and early warning systems.';
        } else {
            return 'Implement preventive maintenance with enhanced inspection protocols.';
        }
    }

    if (riskLevel === 'Medium') {
        if (occurrence >= 5) {
            return 'Implement scheduled preventive maintenance. Monitor failure trends.';
        } else {
            return 'Continue current maintenance with periodic review. Consider condition-based monitoring.';
        }
    }

    // Low risk
    return 'Run-to-failure acceptable. Perform reactive maintenance only. Keep spare parts available.';
};

/**
 * Perform complete FMEA analysis on a single failure mode
 */
export const analyzeFMEA = (input: FMEAInput): FMEAResult => {
    const rpn = calculateRPN(input.severity, input.occurrence, input.detection);
    const riskLevel = getRiskLevel(rpn);
    const recommendedAction = getRecommendedAction(
        rpn,
        input.severity,
        input.occurrence,
        input.detection
    );

    return {
        ...input,
        rpn,
        risk_level: riskLevel,
        recommended_action: recommendedAction,
    };
};

/**
 * Analyze multiple failure modes and rank by RPN
 */
export const analyzeFMEABatch = (inputs: FMEAInput[]): FMEAResult[] => {
    const results = inputs.map(analyzeFMEA);

    // Sort by RPN (highest to lowest)
    return results.sort((a, b) => b.rpn - a.rpn);
};

/**
 * Get FMEA statistics
 */
export const getFMEAStatistics = (results: FMEAResult[]) => {
    const total = results.length;
    const highRisk = results.filter(r => r.risk_level === 'High').length;
    const mediumRisk = results.filter(r => r.risk_level === 'Medium').length;
    const lowRisk = results.filter(r => r.risk_level === 'Low').length;

    const avgRPN = results.reduce((sum, r) => sum + r.rpn, 0) / total;
    const maxRPN = Math.max(...results.map(r => r.rpn));
    const minRPN = Math.min(...results.map(r => r.rpn));

    return {
        total,
        highRisk,
        mediumRisk,
        lowRisk,
        avgRPN: Math.round(avgRPN),
        maxRPN,
        minRPN,
        highRiskPercentage: Math.round((highRisk / total) * 100),
    };
};

/**
 * Identify critical failure modes that need immediate attention
 */
export const getCriticalFailureModes = (results: FMEAResult[]): FMEAResult[] => {
    return results.filter(r => r.risk_level === 'High' || r.rpn >= 300);
};

/**
 * Generate FMEA summary for reporting
 */
export const generateFMEASummary = (results: FMEAResult[]): string => {
    const stats = getFMEAStatistics(results);
    const critical = getCriticalFailureModes(results);

    let summary = `FMEA Analysis Summary\n`;
    summary += `Total failure modes analyzed: ${stats.total}\n`;
    summary += `High risk: ${stats.highRisk} (${stats.highRiskPercentage}%)\n`;
    summary += `Medium risk: ${stats.mediumRisk}\n`;
    summary += `Low risk: ${stats.lowRisk}\n`;
    summary += `Average RPN: ${stats.avgRPN}\n`;
    summary += `RPN range: ${stats.minRPN} - ${stats.maxRPN}\n\n`;

    if (critical.length > 0) {
        summary += `Critical Failure Modes Requiring Immediate Action:\n`;
        critical.forEach((fm, index) => {
            summary += `${index + 1}. ${fm.failure_mode} (RPN: ${fm.rpn})\n`;
            summary += `   Action: ${fm.recommended_action}\n`;
        });
    }

    return summary;
};
