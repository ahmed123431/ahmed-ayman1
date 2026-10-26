// ========================================
// RISK MANAGEMENT ENGINE
// Risk Classification and Assessment
// ========================================

import { ConsequenceClassification, RiskAssessment, FMEAResult } from '../../types/rcm';

/**
 * Classify risk based on consequences
 */
export const classifyRisk = (
    consequence: ConsequenceClassification,
    rpn: number
): RiskAssessment[] => {
    const risks: RiskAssessment[] = [];

    // Safety Risk
    if (consequence.safety) {
        risks.push({
            risk_id: `${consequence.consequence_id}_safety`,
            fmea_id: consequence.fmea_id,
            risk_category: 'Safety',
            risk_level: rpn >= 300 ? 'High' : rpn >= 100 ? 'Medium' : 'Low',
            mitigation_action: getSafetyMitigation(rpn),
            created_at: new Date().toISOString(),
        });
    }

    // Environmental Risk
    if (consequence.environmental) {
        risks.push({
            risk_id: `${consequence.consequence_id}_environmental`,
            fmea_id: consequence.fmea_id,
            risk_category: 'Environmental',
            risk_level: rpn >= 250 ? 'High' : rpn >= 100 ? 'Medium' : 'Low',
            mitigation_action: getEnvironmentalMitigation(rpn),
            created_at: new Date().toISOString(),
        });
    }

    // Operational Risk
    if (consequence.operational) {
        risks.push({
            risk_id: `${consequence.consequence_id}_operational`,
            fmea_id: consequence.fmea_id,
            risk_category: 'Operational',
            risk_level: rpn >= 300 ? 'High' : rpn >= 150 ? 'Medium' : 'Low',
            mitigation_action: getOperationalMitigation(rpn),
            created_at: new Date().toISOString(),
        });
    }

    // Financial Risk
    if (consequence.financial) {
        risks.push({
            risk_id: `${consequence.consequence_id}_financial`,
            fmea_id: consequence.fmea_id,
            risk_category: 'Financial',
            risk_level: rpn >= 300 ? 'High' : rpn >= 150 ? 'Medium' : 'Low',
            mitigation_action: getFinancialMitigation(rpn),
            created_at: new Date().toISOString(),
        });
    }

    return risks;
};

/**
 * Get safety-specific mitigation actions
 */
const getSafetyMitigation = (rpn: number): string => {
    if (rpn >= 300) {
        return 'CRITICAL: Implement safety interlocks, emergency shutdown systems, and continuous monitoring. Conduct safety audit.';
    }
    if (rpn >= 100) {
        return 'Implement safety procedures, PPE requirements, and regular safety inspections. Train personnel on hazards.';
    }
    return 'Maintain standard safety procedures and periodic safety reviews.';
};

/**
 * Get environmental mitigation actions
 */
const getEnvironmentalMitigation = (rpn: number): string => {
    if (rpn >= 250) {
        return 'Install environmental monitoring systems, containment measures, and leak detection. Ensure regulatory compliance.';
    }
    if (rpn >= 100) {
        return 'Implement environmental controls and regular environmental inspections. Prepare spill response procedures.';
    }
    return 'Follow standard environmental procedures and periodic compliance checks.';
};

/**
 * Get operational mitigation actions
 */
const getOperationalMitigation = (rpn: number): string => {
    if (rpn >= 300) {
        return 'Implement redundancy, backup systems, and real-time monitoring. Develop comprehensive contingency plans.';
    }
    if (rpn >= 150) {
        return 'Establish preventive maintenance program and maintain critical spare parts inventory.';
    }
    return 'Maintain standard operating procedures and routine maintenance.';
};

/**
 * Get financial mitigation actions
 */
const getFinancialMitigation = (rpn: number): string => {
    if (rpn >= 300) {
        return 'Implement condition-based maintenance to prevent costly failures. Consider insurance or risk transfer options.';
    }
    if (rpn >= 150) {
        return 'Optimize maintenance schedule to balance cost and reliability. Build financial reserves for repairs.';
    }
    return 'Monitor costs and optimize maintenance intervals based on cost-benefit analysis.';
};

/**
 * Build risk matrix data for visualization
 */
export const buildRiskMatrix = (
    fmeas: FMEAResult[]
): { severity: number; occurrence: number; rpn: number; label: string }[] => {
    return fmeas.map(fmea => ({
        severity: fmea.severity,
        occurrence: fmea.occurrence,
        rpn: fmea.rpn,
        label: fmea.failure_mode,
    }));
};

/**
 * Get risk distribution by category
 */
export const getRiskDistribution = (risks: RiskAssessment[]) => {
    const distribution = {
        Safety: { High: 0, Medium: 0, Low: 0 },
        Environmental: { High: 0, Medium: 0, Low: 0 },
        Operational: { High: 0, Medium: 0, Low: 0 },
        Financial: { High: 0, Medium: 0, Low: 0 },
    };

    risks.forEach(risk => {
        distribution[risk.risk_category][risk.risk_level]++;
    });

    return distribution;
};

/**
 * Identify unacceptable risks
 * Unacceptable = High-level safety or environmental risks
 */
export const getUnacceptableRisks = (risks: RiskAssessment[]): RiskAssessment[] => {
    return risks.filter(
        risk =>
            risk.risk_level === 'High' &&
            (risk.risk_category === 'Safety' || risk.risk_category === 'Environmental')
    );
};

/**
 * Generate risk assessment report
 */
export const generateRiskReport = (risks: RiskAssessment[]): string => {
    const unacceptable = getUnacceptableRisks(risks);
    const distribution = getRiskDistribution(risks);

    let report = 'Risk Assessment Report\n\n';

    report += '=== Risk Distribution ===\n';
    Object.entries(distribution).forEach(([category, levels]) => {
        const total = levels.High + levels.Medium + levels.Low;
        report += `${category}: ${total} total (High: ${levels.High}, Medium: ${levels.Medium}, Low: ${levels.Low})\n`;
    });

    report += '\n=== Unacceptable Risks (Immediate Action Required) ===\n';
    if (unacceptable.length === 0) {
        report += 'No unacceptable risks identified.\n';
    } else {
        unacceptable.forEach((risk, index) => {
            report += `${index + 1}. ${risk.risk_category} Risk (${risk.risk_level})\n`;
            report += `   Mitigation: ${risk.mitigation_action}\n`;
        });
    }

    return report;
};

/**
 * Prioritize risks for action planning
 */
export const prioritizeRisks = (risks: RiskAssessment[]): RiskAssessment[] => {
    // Priority order: Safety High > Environmental High > Others High > Safety Medium > etc.
    const priority = {
        Safety: 4,
        Environmental: 3,
        Operational: 2,
        Financial: 1,
    };

    const levelScore = {
        High: 100,
        Medium: 10,
        Low: 1,
    };

    return risks.sort((a, b) => {
        const scoreA = levelScore[a.risk_level] + priority[a.risk_category];
        const scoreB = levelScore[b.risk_level] + priority[b.risk_category];
        return scoreB - scoreA;
    });
};
