import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface ReportSections {
    // Executive Summary
    keyFindings: boolean;
    criticalIssues: boolean;
    recommendations: boolean;
    costImplications: boolean;

    // Technical Analysis
    fmeaTables: boolean;
    riskClassifications: boolean;
    maintenanceStrategies: boolean;
    engineeringJustifications: boolean;

    // Visual Data
    chartsGraphs: boolean;
    riskMatrices: boolean;
    costBreakdowns: boolean;
    trendAnalysis: boolean;
}

interface ReportSettingsContextType {
    sections: ReportSections;
    toggleSection: (section: keyof ReportSections) => void;
    setSections: (sections: ReportSections) => void;
}

const defaultSections: ReportSections = {
    // Executive Summary - all enabled by default
    keyFindings: true,
    criticalIssues: true,
    recommendations: true,
    costImplications: true,

    // Technical Analysis - all enabled by default
    fmeaTables: true,
    riskClassifications: true,
    maintenanceStrategies: true,
    engineeringJustifications: true,

    // Visual Data - all enabled by default
    chartsGraphs: true,
    riskMatrices: true,
    costBreakdowns: true,
    trendAnalysis: true,
};

const ReportSettingsContext = createContext<ReportSettingsContextType | undefined>(undefined);

export function ReportSettingsProvider({ children }: { children: ReactNode }) {
    const [sections, setSectionsState] = useState<ReportSections>(() => {
        const saved = localStorage.getItem('reportSections');
        if (saved) {
            try {
                return { ...defaultSections, ...JSON.parse(saved) };
            } catch {
                return defaultSections;
            }
        }
        return defaultSections;
    });

    useEffect(() => {
        localStorage.setItem('reportSections', JSON.stringify(sections));
    }, [sections]);

    const toggleSection = (section: keyof ReportSections) => {
        setSectionsState(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const setSections = (newSections: ReportSections) => {
        setSectionsState(newSections);
    };

    return (
        <ReportSettingsContext.Provider value={{ sections, toggleSection, setSections }}>
            {children}
        </ReportSettingsContext.Provider>
    );
}

export function useReportSettings() {
    const context = useContext(ReportSettingsContext);
    if (!context) {
        throw new Error('useReportSettings must be used within a ReportSettingsProvider');
    }
    return context;
}
