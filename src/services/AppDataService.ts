/**
 * AppDataService - Centralized data CRUD operations for all entity types.
 * All data is persisted to localStorage and changes are broadcast via custom events.
 */

// ============ INTERFACES ============

export interface Project {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    status: 'active' | 'completed' | 'archived';
    assetCount?: number;
}

export interface Asset {
    id: string;
    projectId?: string;
    equipment_name: string;
    tag_number: string;
    quantity?: number;
    system: string;
    manufacturer: string;
    specifications?: string;
    status?: string;
    operating_hours?: number;
    // Legacy fields (kept for backward compatibility)
    model?: string;
    criticality_level?: 'High' | 'Medium' | 'Low';
    installation_date?: string;
    operating_hours_per_day?: number;
    created_at: string;
}

export interface FMEAItem {
    id: string;
    component: string;
    function?: string;
    functionalFailure?: string;
    failureMode: string;
    failureCause: string;
    failureEffect: string;
    severity: number;
    occurrence: number;
    detection: number;
    rpn: number;
    riskLevel: string;
    criticalityIndex?: number;
    recommendedAction?: string;
    revisedRpn?: number;
}

export interface RiskItem {
    id: string;
    risk: string;
    component?: string;
    failureMode?: string;
    failureEffect?: string;
    evidenceType?: string;
    severity: number;
    occurrence: number;
    detection: number;
    rpn: number;
    level: string; // High, Medium, Low based on RPN
    criticalityIndex?: number;
    recommendedAction?: string;
    revisedRpn?: number;
    mitigation: string;
    category: string;
    safetyConsequence?: string;
    environmentalConsequence?: string;
    operationalConsequence?: string;
}

export interface CostItem {
    id: string;
    equipmentName: string;
    downtimeCostPerHour: number;
    repairCost: number;
    replacementCost: number;
    sparePartsCost: number;
    laborCostPerHour: number;
    operatingHoursPerDay: number;
    operatingCostPerHour: number;
    annualOperatingCost: number;
    annualMaintenanceCost: number;
    costPerFailure: number;
}

export interface ReplacementItem {
    id: string;
    equipment: string;
    tagNumber: string;
    currentAge: number; // Current operating time t
    
    // Weibull Parameters
    shapeParameter: number; // Beta (β)
    scaleParameter: number; // Eta (η)
    
    // Cost Parameters
    plannedReplacementCost: number; // Cp
    unplannedFailureCost: number; // Cu (Must be > Cp)

    // Calculated fields
    optimumTime: number;
    minCPUT: number;
    curvePoints: { t: number, cput: number }[];
    status: 'Good' | 'Monitor' | 'Replace Soon' | 'Run To Failure';
}

// ============ STORAGE KEYS ============

const STORAGE_KEYS = {
    projects: 'projects',
    assets: 'projectAssets',
    currentProject: 'currentProjectId',
    fmea: 'fmeaData',
    risks: 'riskData',
    costs: 'costData',
    replacement: 'replacementData',
} as const;

// ============ DEFAULT DATA ============

// No default/preview data — all services start empty for new users.

// ============ UTILITY ============

const generateId = (): string => Date.now().toString() + Math.random().toString(36).slice(2, 7);

const broadcastUpdate = (dataType: string) => {
    window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { type: dataType } }));
};

// RPN risk level calculation
const calculateRiskLevel = (rpn: number): string => {
    if (rpn >= 300) return 'High';
    if (rpn >= 100) return 'Medium';
    return 'Low';
};

// Replacement status calculation
const calculateReplacementStatus = (currentAge: number, optimalTime: number, beta: number): ReplacementItem['status'] => {
    if (beta <= 1) return 'Run To Failure';
    const remaining = optimalTime - currentAge;
    if (remaining <= 0) return 'Replace Soon';
    if (remaining <= optimalTime * 0.15) return 'Monitor'; // Within 15% of optimum
    return 'Good';
};

// ============ PROJECTS ============

export const ProjectService = {
    getAll(): Project[] {
        const data = localStorage.getItem(STORAGE_KEYS.projects);
        return data ? JSON.parse(data) : [];
    },

    getById(id: string): Project | undefined {
        return this.getAll().find(p => p.id === id);
    },

    create(data: { name: string; description: string; status?: string }): Project {
        const projects = this.getAll();
        const project: Project = {
            id: generateId(),
            name: data.name,
            description: data.description || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: (data.status as Project['status']) || 'active',
            assetCount: 0,
        };
        projects.push(project);
        localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
        broadcastUpdate('projects');
        return project;
    },

    update(id: string, updates: Partial<Project>): Project | null {
        const projects = this.getAll();
        const idx = projects.findIndex(p => p.id === id);
        if (idx === -1) return null;
        projects[idx] = { ...projects[idx], ...updates, updatedAt: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
        broadcastUpdate('projects');
        return projects[idx];
    },

    delete(id: string): boolean {
        const projects = this.getAll();
        const filtered = projects.filter(p => p.id !== id);
        if (filtered.length === projects.length) return false;
        localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(filtered));
        // Also delete associated assets
        const assets = AssetService.getAll().filter(a => a.projectId !== id);
        localStorage.setItem(STORAGE_KEYS.assets, JSON.stringify(assets));
        broadcastUpdate('projects');
        broadcastUpdate('assets');
        return true;
    },

    count(): number {
        return this.getAll().length;
    }
};

// ============ ASSETS ============

export const AssetService = {
    getAll(): Asset[] {
        const data = localStorage.getItem(STORAGE_KEYS.assets);
        return data ? JSON.parse(data) : [];
    },

    getByProject(projectId: string): Asset[] {
        return this.getAll().filter(a => a.projectId === projectId);
    },

    getById(id: string): Asset | undefined {
        return this.getAll().find(a => a.id === id);
    },

    getCurrentProjectId(): string {
        return localStorage.getItem(STORAGE_KEYS.currentProject) || 'default';
    },

    create(data: Partial<Asset> & { equipment_name: string; tag_number: string }): Asset {
        const all = this.getAll();
        const asset: Asset = {
            id: generateId(),
            projectId: data.projectId || this.getCurrentProjectId(),
            equipment_name: data.equipment_name,
            tag_number: data.tag_number,
            quantity: data.quantity || 1,
            system: data.system || '',
            manufacturer: data.manufacturer || '',
            specifications: data.specifications || '',
            status: data.status || 'Operational',
            operating_hours: data.operating_hours,
            model: data.model || '',
            criticality_level: data.criticality_level || 'Medium',
            installation_date: data.installation_date || new Date().toISOString().split('T')[0],
            operating_hours_per_day: data.operating_hours_per_day || 8,
            created_at: new Date().toISOString(),
        };
        all.push(asset);
        localStorage.setItem(STORAGE_KEYS.assets, JSON.stringify(all));
        broadcastUpdate('assets');
        return asset;
    },

    update(id: string, updates: Partial<Asset>): Asset | null {
        const all = this.getAll();
        const idx = all.findIndex(a => a.id === id);
        if (idx === -1) return null;
        all[idx] = { ...all[idx], ...updates };
        localStorage.setItem(STORAGE_KEYS.assets, JSON.stringify(all));
        broadcastUpdate('assets');
        return all[idx];
    },

    delete(id: string): boolean {
        const all = this.getAll();
        const filtered = all.filter(a => a.id !== id);
        if (filtered.length === all.length) return false;
        localStorage.setItem(STORAGE_KEYS.assets, JSON.stringify(filtered));
        broadcastUpdate('assets');
        return true;
    },

    count(): number {
        return this.getAll().length;
    }
};

// ============ FMEA ============

export const FMEAService = {
    getAll(): FMEAItem[] {
        const data = localStorage.getItem(STORAGE_KEYS.fmea);
        return data ? JSON.parse(data) : [];
    },

    save(items: FMEAItem[]) {
        localStorage.setItem(STORAGE_KEYS.fmea, JSON.stringify(items));
        broadcastUpdate('fmea');
    },

    create(data: { component: string; function?: string; functionalFailure?: string; failureMode: string; failureCause: string; failureEffect: string; severity: number; occurrence: number; detection: number }): FMEAItem {
        const all = this.getAll();
        const rpn = data.severity * data.occurrence * data.detection;
        const item: FMEAItem = {
            id: generateId(),
            ...data,
            rpn,
            riskLevel: calculateRiskLevel(rpn),
        };
        all.push(item);
        this.save(all);
        return item;
    },

    update(id: string, updates: Partial<FMEAItem>): FMEAItem | null {
        const all = this.getAll();
        const idx = all.findIndex(i => i.id === id);
        if (idx === -1) return null;
        all[idx] = { ...all[idx], ...updates };
        // Recalc RPN if relevant fields changed
        if (updates.severity !== undefined || updates.occurrence !== undefined || updates.detection !== undefined) {
            all[idx].rpn = all[idx].severity * all[idx].occurrence * all[idx].detection;
            all[idx].riskLevel = calculateRiskLevel(all[idx].rpn);
        }
        this.save(all);
        return all[idx];
    },

    delete(id: string): boolean {
        const all = this.getAll();
        const filtered = all.filter(i => i.id !== id);
        if (filtered.length === all.length) return false;
        this.save(filtered);
        return true;
    },

    getHighRiskItems(): FMEAItem[] {
        return this.getAll().filter(i => i.riskLevel === 'High');
    },

    count(): number {
        return this.getAll().length;
    }
};

// ============ RISKS ============

export const RiskService = {
    getAll(): RiskItem[] {
        const data = localStorage.getItem(STORAGE_KEYS.risks);
        return data ? JSON.parse(data) : [];
    },

    save(items: RiskItem[]) {
        localStorage.setItem(STORAGE_KEYS.risks, JSON.stringify(items));
        broadcastUpdate('risks');
    },

    create(data: Partial<RiskItem> & { risk: string; severity: number; occurrence: number; detection: number; mitigation: string; category: string }): RiskItem {
        const all = this.getAll();
        const rpn = data.severity * data.occurrence * data.detection;
        let riskLevel = 'Low';
        if (rpn >= 300) riskLevel = 'High';
        else if (rpn >= 100) riskLevel = 'Medium';
        
        const item: RiskItem = {
            id: generateId(),
            ...data,
            rpn,
            level: riskLevel,
        };
        all.push(item);
        this.save(all);
        return item;
    },

    update(id: string, updates: Partial<RiskItem>): RiskItem | null {
        const all = this.getAll();
        const idx = all.findIndex(i => i.id === id);
        if (idx === -1) return null;
        all[idx] = { ...all[idx], ...updates };
        
        if (updates.severity !== undefined || updates.occurrence !== undefined || updates.detection !== undefined) {
            all[idx].rpn = all[idx].severity * all[idx].occurrence * all[idx].detection;
            if (all[idx].rpn >= 300) all[idx].level = 'High';
            else if (all[idx].rpn >= 100) all[idx].level = 'Medium';
            else all[idx].level = 'Low';
        }
        
        this.save(all);
        return all[idx];
    },

    delete(id: string): boolean {
        const all = this.getAll();
        const filtered = all.filter(i => i.id !== id);
        if (filtered.length === all.length) return false;
        this.save(filtered);
        return true;
    },

    count(): number {
        return this.getAll().length;
    }
};

// ============ COSTS ============

export const CostService = {
    getAll(): CostItem[] {
        const data = localStorage.getItem(STORAGE_KEYS.costs);
        return data ? JSON.parse(data) : [];
    },

    save(items: CostItem[]) {
        localStorage.setItem(STORAGE_KEYS.costs, JSON.stringify(items));
        broadcastUpdate('costs');
    },

    create(data: { equipmentName: string; downtimeCostPerHour: number; repairCost: number; replacementCost: number; sparePartsCost: number; laborCostPerHour: number; operatingHoursPerDay: number; operatingCostPerHour: number; mttr?: number }): CostItem {
        const all = this.getAll();
        const mttr = data.mttr || 4;
        const item: CostItem = {
            id: generateId(),
            equipmentName: data.equipmentName,
            downtimeCostPerHour: data.downtimeCostPerHour,
            repairCost: data.repairCost,
            replacementCost: data.replacementCost,
            sparePartsCost: data.sparePartsCost,
            laborCostPerHour: data.laborCostPerHour,
            operatingHoursPerDay: data.operatingHoursPerDay,
            operatingCostPerHour: data.operatingCostPerHour,
            annualOperatingCost: data.operatingCostPerHour * data.operatingHoursPerDay * 365,
            annualMaintenanceCost: data.repairCost + data.sparePartsCost + (data.laborCostPerHour * mttr),
            costPerFailure: data.repairCost + (data.downtimeCostPerHour * mttr) + data.sparePartsCost,
        };
        all.push(item);
        this.save(all);
        return item;
    },

    update(id: string, updates: Partial<CostItem>): CostItem | null {
        const all = this.getAll();
        const idx = all.findIndex(i => i.id === id);
        if (idx === -1) return null;
        all[idx] = { ...all[idx], ...updates };
        this.save(all);
        return all[idx];
    },

    delete(id: string): boolean {
        const all = this.getAll();
        const filtered = all.filter(i => i.id !== id);
        if (filtered.length === all.length) return false;
        this.save(filtered);
        return true;
    },

    getTotalAnnualCost(): number {
        return this.getAll().reduce((sum, i) => sum + i.annualOperatingCost + i.annualMaintenanceCost, 0);
    },

    count(): number {
        return this.getAll().length;
    }
};

// ============ REPLACEMENT ============

export const ReplacementService = {
    getAll(): ReplacementItem[] {
        const data = localStorage.getItem(STORAGE_KEYS.replacement);
        return data ? JSON.parse(data) : [];
    },

    save(items: ReplacementItem[]) {
        localStorage.setItem(STORAGE_KEYS.replacement, JSON.stringify(items));
        broadcastUpdate('replacement');
    },

    create(data: { equipment: string; tagNumber: string; currentAge?: number; shapeParameter?: number; scaleParameter?: number; plannedReplacementCost?: number; unplannedFailureCost?: number; optimumTime?: number; status?: ReplacementItem['status'] }): ReplacementItem {
        const all = this.getAll();
        const beta = data.shapeParameter || 2;
        const optsTime = data.optimumTime || 10000;
        const curAge = data.currentAge || 0;
        const item: ReplacementItem = {
            id: generateId(),
            equipment: data.equipment,
            tagNumber: data.tagNumber,
            currentAge: curAge,
            shapeParameter: beta,
            scaleParameter: data.scaleParameter || 15000,
            plannedReplacementCost: data.plannedReplacementCost || 1000,
            unplannedFailureCost: data.unplannedFailureCost || 5000,
            optimumTime: optsTime,
            minCPUT: 0.5,
            curvePoints: [],
            status: data.status || calculateReplacementStatus(curAge, optsTime, beta),
        };
        all.push(item);
        this.save(all);
        return item;
    },

    update(id: string, updates: Partial<ReplacementItem>): ReplacementItem | null {
        const all = this.getAll();
        const idx = all.findIndex(i => i.id === id);
        if (idx === -1) return null;
        all[idx] = { ...all[idx], ...updates };
        if (updates.currentAge !== undefined || updates.optimumTime !== undefined || updates.shapeParameter !== undefined) {
            all[idx].status = calculateReplacementStatus(all[idx].currentAge, all[idx].optimumTime, all[idx].shapeParameter);
        }
        this.save(all);
        return all[idx];
    },

    delete(id: string): boolean {
        const all = this.getAll();
        const filtered = all.filter(i => i.id !== id);
        if (filtered.length === all.length) return false;
        this.save(filtered);
        return true;
    },

    getReplaceDueSoon(): ReplacementItem[] {
        return this.getAll().filter(i => i.status === 'Replace Soon' || i.status === 'Monitor');
    },

    count(): number {
        return this.getAll().length;
    }
};

// ============ DATA SUMMARY ============

export const getAppDataSummary = () => ({
    projects: ProjectService.count(),
    assets: AssetService.count(),
    fmea: FMEAService.count(),
    risks: RiskService.count(),
    costs: CostService.count(),
    replacement: ReplacementService.count(),
    highRiskFMEA: FMEAService.getHighRiskItems().length,
    replaceDueSoon: ReplacementService.getReplaceDueSoon().length,
    totalAnnualCost: CostService.getTotalAnnualCost(),
});

export const getScopedDataSummary = (projectId: string, assetId: string) => {
    // Generate keys dynamically here
    const prefix = `${projectId}-${assetId}-`;

    const fmea = ScopedDataService.getFMEA(`${prefix}fmea`);
    const risks = ScopedDataService.getRisks(`${prefix}risks`);
    const costs = ScopedDataService.getCosts(`${prefix}costs`);
    const replacement = ScopedDataService.getReplacement(`${prefix}replacement`);
    const tasks = ScopedDataService.getTasks(`${prefix}tasks`);

    const highRiskFMEA = fmea.filter(i => i.riskLevel === 'High').length;
    const replaceDueSoon = replacement.filter(i => i.status === 'Replace Soon' || i.status === 'Monitor').length;
    const totalAnnualCost = costs.reduce((sum, item) => sum + item.annualOperatingCost, 0);

    return {
        fmea: fmea.length,
        risks: risks.length,
        costs: costs.length,
        replacement: replacement.length,
        tasks: tasks.length,
        highRiskFMEA,
        replaceDueSoon,
        totalAnnualCost,
    };
};

// ============ SCOPED DATA ACCESS (per-asset) ============
// These functions allow reading/writing data scoped to a specific asset.
// The `key` parameter is typically generated by AssetContext.storageKeyFor().

export const ScopedDataService = {
    // FMEA
    getFMEA(key: string): FMEAItem[] {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },
    saveFMEA(key: string, items: FMEAItem[]) {
        localStorage.setItem(key, JSON.stringify(items));
        broadcastUpdate('fmea');
    },

    // Risks
    getRisks(key: string): RiskItem[] {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },
    saveRisks(key: string, items: RiskItem[]) {
        localStorage.setItem(key, JSON.stringify(items));
        broadcastUpdate('risks');
    },

    // Costs
    getCosts(key: string): CostItem[] {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },
    saveCosts(key: string, items: CostItem[]) {
        localStorage.setItem(key, JSON.stringify(items));
        broadcastUpdate('costs');
    },

    // Replacement
    getReplacement(key: string): ReplacementItem[] {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },
    saveReplacement(key: string, items: ReplacementItem[]) {
        localStorage.setItem(key, JSON.stringify(items));
        broadcastUpdate('replacement');
    },

    // Maintenance Tasks
    getTasks(key: string): any[] {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },
    saveTasks(key: string, items: any[]) {
        localStorage.setItem(key, JSON.stringify(items));
        broadcastUpdate('tasks');
    },

    // Maintenance Plans
    getPlans(key: string): any[] {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },
    savePlans(key: string, items: any[]) {
        localStorage.setItem(key, JSON.stringify(items));
        broadcastUpdate('plans');
    },
};
