/**
 * AIAssistant - Intelligent assistant engine with NLP command parsing,
 * comprehensive RCM knowledge base, file processing, and data execution.
 */

import {
    ProjectService, AssetService, FMEAService, RiskService, CostService, ReplacementService, ScopedDataService,
    getAppDataSummary, getScopedDataSummary,
    type Project, type Asset, type FMEAItem, type RiskItem, type ReplacementItem,
} from './AppDataService';

// File attachment info passed from chat
export interface FileInfo {
    name: string;
    type: 'image' | 'document' | 'spreadsheet' | 'other';
    size: string;
    textContent?: string; // Extracted text from file
    parsedData?: Record<string, string>[]; // Parsed CSV rows
}

export interface AIResponse {
    message: string;
    action?: string; // Description of action taken
    dataChanged?: boolean; // Whether app data was modified
}

interface AIContext {
    userName: string;
    userRole: string;
    currentPage: string;
    projectId?: string | null;
    assetId?: string | null;
}

// ============ KNOWLEDGE BASE ============

const KNOWLEDGE_BASE: Record<string, string> = {
    // App features
    'app_overview': `**RCMAPP** is a Reliability Centered Maintenance application with the following modules:

1. **Projects** — Create and manage maintenance projects. Each project can contain multiple assets.
2. **Dashboard** — Overview of the selected project's assets, health metrics, and KPIs.
3. **Asset Management** — Add, edit, and manage equipment/machines within a project. Track name, tag number, system, manufacturer, model, criticality, installation date, and operating hours.
4. **FMEA Analysis** — Failure Mode and Effects Analysis. Identify failure modes, causes, effects, and calculate RPN (Risk Priority Number) using Severity × Occurrence × Detection ratings (1-10 scale).
5. **Risk Management** — Identify, assess, and mitigate risks. Categorize risks by Safety, Environmental, Operational, or Financial. Rate by probability and impact.
6. **Operating Costs** — Track equipment operating costs including downtime, repair, replacement, spare parts, and labor costs. Calculate annual costs and cost per failure.
7. **Optimal Replacement** — Analyze equipment age vs. optimal replacement age. Track MTBF, MTTR, failure frequency, and determine replacement timing.
8. **Reports** — Generate comprehensive RCM reports in PDF or Word format.
9. **Settings** — Manage profile, notifications, appearance, language, and report settings.`,

    'projects_help': `**Projects Page** — How to use:

• **Create a Project**: Click "+ New Project", enter a name and description, then save.
• **Navigate to a Project**: Click on a project card to select it and view its dashboard.
• **Edit a Project**: Click the edit icon on a project card to modify its name, description, or status.
• **Delete a Project**: Click the delete icon. This will also remove all associated assets.
• **Project Statuses**: Active, Completed, or Archived.

💡 *Tip: Start by creating a project for each maintenance area or production line.*`,

    'assets_help': `**Asset Management** — How to use:

• **Add an Asset**: Click "+ Add Asset" and fill in equipment details (name, tag number, system, manufacturer, model, criticality level, installation date, operating hours).
• **Criticality Levels**: High, Medium, Low — determines maintenance priority.
• **Edit an Asset**: Click the edit icon on an asset row.
• **Delete an Asset**: Click the delete icon.
• **View Details**: Click on an asset name to view its detailed dashboard with FMEA data.

💡 *Tip: Use standardized tag numbers (e.g., PUMP-001, HX-002) for consistency.*`,

    'fmea_help': `**FMEA Analysis** — How to use:

• **Add an Entry**: Click "+ Add FMEA Entry". Fill in component, failure mode, cause, and effect.
• **Rate each factor** on a 1-10 scale:
  - **Severity**: Impact of the failure (10 = catastrophic)
  - **Occurrence**: Likelihood of failure (10 = almost certain)
  - **Detection**: Difficulty to detect before it happens (10 = undetectable)
• **RPN** = Severity × Occurrence × Detection (range: 1-1000)
• **Risk Levels**: High (RPN ≥ 300), Medium (100-299), Low (< 100)

💡 *Tip: Focus improvement efforts on items with the highest RPN values first.*`,

    'risk_help': `**Risk Management** — How to use:

• **Add a Risk**: Click "+ Add Risk". Provide the risk description, probability, impact, mitigation strategy, and category.
• **Categories**: Safety, Environmental, Operational, Financial
• **Probability**: Low, Medium, High
• **Impact**: Minor, Moderate, Severe, Critical
• **Risk Level** is auto-calculated from Probability × Impact matrix
• **Mitigation**: Document your risk reduction strategies

💡 *Tip: Review and update risk assessments quarterly to reflect changing conditions.*`,

    'costs_help': `**Operating Costs** — How to use:

• **Add Equipment Cost Data**: Enter equipment name, downtime cost/hr, repair cost, replacement cost, spare parts cost, labor cost/hr, operating hours/day, and operating cost/hr.
• **Calculated Fields**:
  - Annual Operating Cost = cost/hr × hours/day × 365
  - Annual Maintenance Cost = repair + spare parts + (labor × MTTR)
  - Cost Per Failure = repair + (downtime × MTTR) + spare parts
• **Analysis**: Compare equipment to identify the most expensive to operate and maintain.

💡 *Tip: Use these costs to justify preventive vs. corrective maintenance strategies.*`,

    'replacement_help': `**Optimal Replacement** — How to use:

• **Add Equipment**: Enter name, tag number, current age, optimal replacement age, replacement cost, MTBF, MTTR, and failure frequency.
• **Status** is auto-calculated:
  - **Good**: > 15% remaining to optimum
  - **Monitor**: ≤ 15% remaining
  - **Replace Soon**: past optimum time
  - **Run To Failure**: shape parameter <= 1
• **Key Metrics**:
  - Shape Parameter (β) = describes failure behavior
  - Scale Parameter (η) = characteristic life
  - Optimum Time = calculated via Weibull CPUT integration

💡 *Tip: If β ≤ 1, preventive maintenance has no mathematical benefit.*`,

    'rpn_calculation': `**RPN (Risk Priority Number) Calculation:**

RPN = Severity × Occurrence × Detection

Each factor is rated 1-10:

**Severity Scale:**
10 = Hazardous without warning
 9 = Hazardous with warning
 8 = Very High (inoperable)
 7 = High (degraded performance)
 5-6 = Moderate
 3-4 = Low/Minor
 1-2 = Very Minor/None

**Occurrence Scale:**
10 = Very High (1 in 2)
 8-9 = High (1 in 3-8)
 5-7 = Moderate (1 in 80-400)
 2-4 = Low (1 in 2,000-150,000)
 1 = Remote (1 in 1,500,000)

**Detection Scale:**
10 = Cannot detect
 7-9 = Very low chance to detect
 4-6 = Moderate chance
 2-3 = High chance
 1 = Almost certain detection

**Thresholds:** High ≥ 300, Medium 100-299, Low < 100`,

    'rcm_overview': `**Reliability Centered Maintenance (RCM)** is a systematic approach to maintenance planning that focuses on:

1. **Identifying Functions** — What does the equipment do? What are its performance standards?
2. **Identifying Failures** — How can the equipment fail to fulfill its functions?
3. **Identifying Failure Modes** — What causes each functional failure?
4. **Identifying Effects** — What happens when a failure occurs?
5. **Assessing Consequences** — Safety, environmental, operational, and economic impacts
6. **Selecting Maintenance Tasks** — Condition-based, time-based, or run-to-failure

**Benefits:**
• Reduced maintenance costs (30-50% typical)
• Improved equipment reliability
• Better safety and environmental compliance
• Optimized spare parts inventory
• Data-driven decision making`,
};

// ============ NLP COMMAND PARSER ============

type Intent = 'create' | 'read' | 'update' | 'delete' | 'analyze' | 'help' | 'import' | 'unknown';
type EntityType = 'project' | 'asset' | 'fmea' | 'risk' | 'cost' | 'replacement' | 'app' | 'unknown';

interface ParsedCommand {
    intent: Intent;
    entity: EntityType;
    params: Record<string, string>;
    rawInput: string;
}

function parseCommand(input: string): ParsedCommand {
    const lower = input.toLowerCase().trim();
    const result: ParsedCommand = { intent: 'unknown', entity: 'unknown', params: {}, rawInput: input };

    // ---- Detect Intent ----
    if (/^(add|create|new|insert|make)\b/.test(lower) || /\b(add|create)\s+(a\s+)?(new\s+)?/.test(lower)) {
        result.intent = 'create';
    } else if (/^(show|list|get|display|view|what|how many|count|tell me about|give me)\b/.test(lower) || /\bshow\s+me\b/.test(lower)) {
        result.intent = 'read';
    } else if (/^(update|change|modify|edit|set|rename)\b/.test(lower) || /\b(update|change|modify)\s+/.test(lower)) {
        result.intent = 'update';
    } else if (/^(delete|remove|drop|clear)\b/.test(lower)) {
        result.intent = 'delete';
    } else if (/\b(analyze|analysis|calculate|compare|highest|lowest|total|summary|statistics|overview|report|status)\b/.test(lower)) {
        result.intent = 'analyze';
    } else if (/\b(help|how|guide|explain|tutorial|what is|what are|learn|teach|tip|advice|recommend)\b/.test(lower)) {
        result.intent = 'help';
    } else if (/\b(import|parse|extract|upload|load|read file|from file|from csv|from excel)\b/.test(lower)) {
        result.intent = 'import';
    }

    // ---- Detect Entity ----
    if (/\b(project)\b/.test(lower)) result.entity = 'project';
    else if (/\b(asset|machine|equipment)\b/.test(lower) && !/\breplac/.test(lower)) result.entity = 'asset';
    else if (/\b(fmea|failure mode|failure analysis|rpn)\b/.test(lower)) result.entity = 'fmea';
    else if (/\b(risk)\b/.test(lower)) result.entity = 'risk';
    else if (/\b(cost|expense|budget|spending)\b/.test(lower)) result.entity = 'cost';
    else if (/\b(replac|weibull|beta|eta|cput|age|optimal)\b/.test(lower)) result.entity = 'replacement';
    else if (/\b(app|application|program|system|feature|page)\b/.test(lower)) result.entity = 'app';

    // ---- Extract Parameters ----
    // Extract quoted strings
    const quotedStrings = input.match(/"([^"]+)"|'([^']+)'/g);
    if (quotedStrings) {
        quotedStrings.forEach((q, i) => {
            result.params[`quoted_${i}`] = q.replace(/['"]/g, '');
        });
    }

    // Extract "named X" or "called X"
    const namedMatch = input.match(/(?:named?|called?|titled?)\s+["']?([^"',]+)["']?/i);
    if (namedMatch) result.params['name'] = namedMatch[1].trim();

    // Extract "with description X"
    const descMatch = input.match(/(?:with\s+)?description\s+["']?([^"']+)["']?/i);
    if (descMatch) result.params['description'] = descMatch[1].trim();

    // Extract "status X"
    const statusMatch = input.match(/status\s+(?:to\s+)?["']?(active|completed|archived)["']?/i);
    if (statusMatch) result.params['status'] = statusMatch[1].trim();

    // Extract "severity X occurrence Y detection Z"
    const sevMatch = input.match(/severity\s+(\d+)/i);
    if (sevMatch) result.params['severity'] = sevMatch[1];
    const occMatch = input.match(/occurrence\s+(\d+)/i);
    if (occMatch) result.params['occurrence'] = occMatch[1];
    const detMatch = input.match(/detection\s+(\d+)/i);
    if (detMatch) result.params['detection'] = detMatch[1];

    // Extract component, failure mode, cause, effect for FMEA
    const componentMatch = input.match(/component\s+["']?([^"',]+)["']?/i);
    if (componentMatch) result.params['component'] = componentMatch[1].trim();
    const fmMatch = input.match(/failure\s+mode\s+["']?([^"',]+)["']?/i);
    if (fmMatch) result.params['failureMode'] = fmMatch[1].trim();
    const causeMatch = input.match(/cause\s+["']?([^"',]+)["']?/i);
    if (causeMatch) result.params['failureCause'] = causeMatch[1].trim();
    const effectMatch = input.match(/effect\s+["']?([^"',]+)["']?/i);
    if (effectMatch) result.params['failureEffect'] = effectMatch[1].trim();

    // Extract probability, impact, mitigation, category for Risk
    const probMatch = input.match(/probability\s+["']?(low|medium|high)["']?/i);
    if (probMatch) result.params['probability'] = probMatch[1];
    const impMatch = input.match(/impact\s+["']?(minor|moderate|severe|critical)["']?/i);
    if (impMatch) result.params['impact'] = impMatch[1];
    const mitMatch = input.match(/mitigation\s+["']?([^"',]+)["']?/i);
    if (mitMatch) result.params['mitigation'] = mitMatch[1].trim();
    const catMatch = input.match(/category\s+["']?(safety|environmental|operational|financial)["']?/i);
    if (catMatch) result.params['category'] = catMatch[1];

    // Extract numeric values for costs
    const costMatch = input.match(/\$\s*([0-9,]+)/g);
    if (costMatch) {
        costMatch.forEach((c, i) => {
            result.params[`cost_${i}`] = c.replace(/[$,]/g, '');
        });
    }

    return result;
}

// ============ CSV PARSER ============

function parseCSV(text: string): Record<string, string>[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });
        rows.push(row);
    }

    return rows;
}

// ============ FILE DATA IMPORTER ============

function detectDataTypeFromCSV(headers: string[]): EntityType {
    const lower = headers.map(h => h.toLowerCase());

    if (lower.some(h => h.includes('failure') || h.includes('rpn') || h.includes('severity'))) return 'fmea';
    if (lower.some(h => h.includes('risk') || h.includes('mitigation') || h.includes('probability'))) return 'risk';
    if (lower.some(h => h.includes('downtime') || h.includes('repair') || h.includes('labor'))) return 'cost';
    if (lower.some(h => h.includes('cput') || h.includes('weibull') || h.includes('optimal') || h.includes('beta') || h.includes('eta') || h.includes('shape'))) return 'replacement';
    if (lower.some(h => h.includes('equipment') || h.includes('tag') || h.includes('manufacturer'))) return 'asset';
    if (lower.some(h => h.includes('project') || h.includes('description'))) return 'project';
    return 'unknown';
}

function importCSVData(rows: Record<string, string>[], targetType: EntityType): { count: number; message: string } {
    let count = 0;

    switch (targetType) {
        case 'asset': {
            rows.forEach(row => {
                const name = row['equipment_name'] || row['name'] || row['equipment'] || '';
                const tag = row['tag_number'] || row['tag'] || '';
                if (name) {
                    AssetService.create({
                        equipment_name: name,
                        tag_number: tag,
                        system: row['system'] || '',
                        manufacturer: row['manufacturer'] || '',
                        model: row['model'] || '',
                        criticality_level: (row['criticality'] || row['criticality_level'] || 'Medium') as Asset['criticality_level'],
                        installation_date: row['installation_date'] || row['date'] || '',
                        operating_hours_per_day: parseInt(row['operating_hours'] || row['hours'] || '8') || 8,
                    });
                    count++;
                }
            });
            return { count, message: `Successfully imported ${count} assets into Asset Management.` };
        }

        case 'fmea': {
            rows.forEach(row => {
                const component = row['component'] || row['item'] || '';
                const failureMode = row['failure_mode'] || row['failureMode'] || row['failure'] || '';
                if (component && failureMode) {
                    FMEAService.create({
                        component,
                        failureMode,
                        failureCause: row['failure_cause'] || row['cause'] || '',
                        failureEffect: row['failure_effect'] || row['effect'] || '',
                        severity: parseInt(row['severity'] || '5') || 5,
                        occurrence: parseInt(row['occurrence'] || '5') || 5,
                        detection: parseInt(row['detection'] || '5') || 5,
                    });
                    count++;
                }
            });
            return { count, message: `Successfully imported ${count} FMEA entries.` };
        }

        case 'risk': {
            rows.forEach(row => {
                const risk = row['risk'] || row['risk_name'] || row['description'] || '';
                if (risk) {
                    RiskService.create({
                        risk,
                        severity: parseInt(row['severity'] || '5') || 5,
                        occurrence: parseInt(row['occurrence'] || '5') || 5,
                        detection: parseInt(row['detection'] || '5') || 5,
                        mitigation: row['mitigation'] || '',
                        category: row['category'] || 'Operational',
                    });
                    count++;
                }
            });
            return { count, message: `Successfully imported ${count} risk entries.` };
        }

        case 'cost': {
            rows.forEach(row => {
                const name = row['equipment_name'] || row['equipmentName'] || row['equipment'] || row['name'] || '';
                if (name) {
                    CostService.create({
                        equipmentName: name,
                        downtimeCostPerHour: parseFloat(row['downtime_cost'] || row['downtimeCostPerHour'] || '0') || 0,
                        repairCost: parseFloat(row['repair_cost'] || row['repairCost'] || '0') || 0,
                        replacementCost: parseFloat(row['replacement_cost'] || row['replacementCost'] || '0') || 0,
                        sparePartsCost: parseFloat(row['spare_parts'] || row['sparePartsCost'] || '0') || 0,
                        laborCostPerHour: parseFloat(row['labor_cost'] || row['laborCostPerHour'] || '0') || 0,
                        operatingHoursPerDay: parseFloat(row['operating_hours'] || row['operatingHoursPerDay'] || '8') || 8,
                        operatingCostPerHour: parseFloat(row['operating_cost'] || row['operatingCostPerHour'] || '0') || 0,
                    });
                    count++;
                }
            });
            return { count, message: `Successfully imported ${count} cost entries.` };
        }

        case 'replacement': {
            rows.forEach(row => {
                const name = row['equipment'] || row['equipment_name'] || row['name'] || '';
                if (name) {
                    ReplacementService.create({
                        equipment: name,
                        tagNumber: row['tag_number'] || row['tagNumber'] || row['tag'] || '',
                        currentAge: parseFloat(row['current_age'] || row['age'] || '0') || 0,
                        shapeParameter: parseFloat(row['shape'] || row['beta'] || '2') || 2,
                        scaleParameter: parseFloat(row['scale'] || row['eta'] || '10000') || 10000,
                        plannedReplacementCost: parseFloat(row['planned_cost'] || row['cp'] || '0') || 0,
                        unplannedFailureCost: parseFloat(row['unplanned_cost'] || row['cu'] || '0') || 0,
                        optimumTime: parseFloat(row['optimal_time'] || row['optimal'] || '10000') || 10000,
                    });
                    count++;
                }
            });
            return { count, message: `Successfully imported ${count} replacement entries.` };
        }

        default:
            return { count: 0, message: 'Could not determine the data type from the file columns.' };
    }
}

// ============ MAIN AI PROCESSOR ============

export function processAIMessage(
    userInput: string,
    context: AIContext,
    files?: FileInfo[]
): AIResponse {
    // Handle file uploads first
    if (files && files.length > 0) {
        return handleFileUpload(files, userInput, context);
    }

    // Parse the command
    const cmd = parseCommand(userInput);

    // Route to appropriate handler
    switch (cmd.intent) {
        case 'help':
            return handleHelp(cmd, context);
        case 'read':
            return handleRead(cmd, context);
        case 'create':
            return handleCreate(cmd, context);
        case 'update':
            return handleUpdate(cmd, context);
        case 'delete':
            return handleDelete(cmd, context);
        case 'analyze':
            return handleAnalyze(cmd, context);
        case 'import':
            return { message: `To import data, please attach a CSV file using the **+** button below. I can process CSV files and automatically import data into the appropriate module (Assets, FMEA, Risks, Costs, or Replacement).` };
        default:
            return handleGenericResponse(userInput, context);
    }
}

// ============ INTENT HANDLERS ============

function handleHelp(cmd: ParsedCommand, context: AIContext): AIResponse {
    const lower = cmd.rawInput.toLowerCase();

    if (lower.includes('rpn') || lower.includes('risk priority')) {
        return { message: KNOWLEDGE_BASE['rpn_calculation'] };
    }
    if (lower.includes('rcm') || lower.includes('reliability')) {
        return { message: KNOWLEDGE_BASE['rcm_overview'] };
    }

    // Entity-specific help
    switch (cmd.entity) {
        case 'project':
            return { message: KNOWLEDGE_BASE['projects_help'] };
        case 'asset':
            return { message: KNOWLEDGE_BASE['assets_help'] };
        case 'fmea':
            return { message: KNOWLEDGE_BASE['fmea_help'] };
        case 'risk':
            return { message: KNOWLEDGE_BASE['risk_help'] };
        case 'cost':
            return { message: KNOWLEDGE_BASE['costs_help'] };
        case 'replacement':
            return { message: KNOWLEDGE_BASE['replacement_help'] };
        case 'app':
            return { message: KNOWLEDGE_BASE['app_overview'] };
        default:
            return {
                message: `Hello ${context.userName}! I can help you with any feature. Just ask me about:\n\n• **"Help with projects"** — Project management\n• **"Help with assets"** — Equipment & machine management\n• **"Help with FMEA"** — Failure analysis & RPN\n• **"Help with risks"** — Risk management\n• **"Help with costs"** — Operating cost analysis\n• **"Help with replacement"** — Optimal replacement timing\n• **"What is RCM?"** — RCM methodology overview\n• **"How to calculate RPN?"** — RPN calculation guide\n\nOr ask me to **add, view, update, or delete** any data!`
            };
    }
}

function handleRead(cmd: ParsedCommand, _context: AIContext): AIResponse {
    switch (cmd.entity) {
        case 'project': {
            const projects = ProjectService.getAll();
            if (projects.length === 0) return { message: `No projects found yet. Would you like me to create one? Just say: **"Create a project named [name]"**` };
            const list = projects.map(p => `• **${p.name}** — ${p.status} | ${p.description || 'No description'}`).join('\n');
            return { message: `📋 **Your Projects** (${projects.length}):\n\n${list}` };
        }
        case 'asset': {
            const assets = AssetService.getAll();
            if (assets.length === 0) return { message: `No assets found. Navigate to a project first, then I can add assets for you.` };
            const list = assets.slice(0, 10).map(a => `• **${a.equipment_name}** (${a.tag_number}) — ${a.criticality_level} criticality | ${a.system || 'N/A'}`).join('\n');
            const more = assets.length > 10 ? `\n\n...and ${assets.length - 10} more.` : '';
            return { message: `⚙️ **Assets** (${assets.length}):\n\n${list}${more}` };
        }
        case 'fmea': {
            const items = FMEAService.getAll();
            if (items.length === 0) return { message: `No FMEA entries found. Say **"Add FMEA entry"** to create one.` };
            const list = items.map(i => `• **${i.component}** — ${i.failureMode} | RPN: ${i.rpn} (${i.riskLevel})`).join('\n');
            return { message: `🔍 **FMEA Entries** (${items.length}):\n\n${list}` };
        }
        case 'risk': {
            const items = RiskService.getAll();
            if (items.length === 0) return { message: `No risks recorded. Say **"Add risk"** to create one.` };
            const list = items.map(i => `• **${i.risk}** — ${i.level} risk (RPN: ${i.rpn}) | ${i.category} | Mitigation: ${i.mitigation}`).join('\n');
            return { message: `🛡️ **Risks** (${items.length}):\n\n${list}` };
        }
        case 'cost': {
            const items = CostService.getAll();
            if (items.length === 0) return { message: `No cost data found. Say **"Add cost entry"** to create one.` };
            const list = items.map(i => `• **${i.equipmentName}** — Annual Operating: $${i.annualOperatingCost.toLocaleString()} | Maintenance: $${i.annualMaintenanceCost.toLocaleString()}`).join('\n');
            return { message: `💰 **Operating Costs** (${items.length}):\n\n${list}` };
        }
        case 'replacement': {
            const items = ReplacementService.getAll();
            if (items.length === 0) return { message: `No replacement data. Say **"Add replacement entry"** to create one.` };
            const list = items.map(i => `• **${i.equipment}** (${i.tagNumber}) — Age: ${i.currentAge}h / Optimal: ${i.optimumTime.toFixed(0)}h | Min Cost: $${i.minCPUT.toFixed(2)}/h | Status: ${i.status}`).join('\n');
            return { message: `🔄 **Replacement Analysis** (${items.length}):\n\n${list}` };
        }
        default: {
            const summary = getAppDataSummary();
            return {
                message: `📊 **Application Data Summary:**\n\n• Projects: **${summary.projects}**\n• Assets: **${summary.assets}**\n• FMEA Entries: **${summary.fmea}** (${summary.highRiskFMEA} high risk)\n• Risks: **${summary.risks}**\n• Cost Items: **${summary.costs}**\n• Replacement Items: **${summary.replacement}** (${summary.replaceDueSoon} due soon)\n• Total Annual Cost: **$${summary.totalAnnualCost.toLocaleString()}**\n\nAsk me to "show projects", "show assets", etc. for details!`
            };
        }
    }
}

function handleCreate(cmd: ParsedCommand, _context: AIContext): AIResponse {
    switch (cmd.entity) {
        case 'project': {
            const name = cmd.params['name'] || cmd.params['quoted_0'] || '';
            if (!name) {
                return { message: `To create a project, please specify a name. Example:\n**"Create a project named Production Line B"**\n\nOr: **"Add project called Refinery Maintenance"**` };
            }
            const desc = cmd.params['description'] || '';
            const project = ProjectService.create({ name, description: desc });
            return {
                message: `✅ **Project created successfully!**\n\n• Name: **${project.name}**\n• Status: ${project.status}\n• ID: ${project.id}\n${desc ? `• Description: ${desc}` : ''}\n\nYou can now navigate to it and start adding assets.`,
                action: `Created project "${project.name}"`,
                dataChanged: true,
            };
        }

        case 'asset': {
            const name = cmd.params['name'] || cmd.params['quoted_0'] || '';
            const tag = cmd.params['quoted_1'] || '';
            if (!name) {
                return { message: `To add an asset, please specify the equipment name. Example:\n**"Add asset named Centrifugal Pump D"**\n\nOr provide more details:\n**"Add asset named 'Valve V-101' tag 'VLV-101' system 'Piping' criticality High"**` };
            }
            // Extract additional params
            const systemMatch = cmd.rawInput.match(/system\s+["']?([^"',]+)["']?/i);
            const critMatch = cmd.rawInput.match(/criticality\s+["']?(high|medium|low)["']?/i);
            const mfgMatch = cmd.rawInput.match(/manufacturer\s+["']?([^"',]+)["']?/i);
            const modelMatch = cmd.rawInput.match(/model\s+["']?([^"',]+)["']?/i);
            const tagMatch2 = cmd.rawInput.match(/tag\s+(?:number\s+)?["']?([^"',]+)["']?/i);

            const asset = AssetService.create({
                equipment_name: name,
                tag_number: tagMatch2?.[1] || tag || `EQ-${Date.now().toString().slice(-4)}`,
                system: systemMatch?.[1] || '',
                manufacturer: mfgMatch?.[1] || '',
                model: modelMatch?.[1] || '',
                criticality_level: (critMatch?.[1] || 'Medium') as Asset['criticality_level'],
            });
            return {
                message: `✅ **Asset added successfully!**\n\n• Equipment: **${asset.equipment_name}**\n• Tag: ${asset.tag_number}\n• Criticality: ${asset.criticality_level}\n• System: ${asset.system || 'N/A'}\n\nThe asset has been saved. You can view it on the **Asset Management** page.`,
                action: `Created asset "${asset.equipment_name}"`,
                dataChanged: true,
            };
        }

        case 'fmea': {
            const component = cmd.params['component'] || cmd.params['name'] || cmd.params['quoted_0'] || '';
            const failureMode = cmd.params['failureMode'] || cmd.params['quoted_1'] || '';
            if (!component) {
                return { message: `To add an FMEA entry, please specify at least the component. Example:\n\n**"Add FMEA entry component 'Bearing' failure mode 'Seizure' cause 'Lack of lubrication' effect 'Shutdown' severity 8 occurrence 6 detection 4"**\n\nOr simply: **"Add FMEA for Bearing"** and I'll use default ratings.` };
            }
            const item = FMEAService.create({
                component,
                failureMode: failureMode || 'General Failure',
                failureCause: cmd.params['failureCause'] || 'To be determined',
                failureEffect: cmd.params['failureEffect'] || 'Performance degradation',
                severity: parseInt(cmd.params['severity'] || '5') || 5,
                occurrence: parseInt(cmd.params['occurrence'] || '5') || 5,
                detection: parseInt(cmd.params['detection'] || '5') || 5,
            });
            return {
                message: `✅ **FMEA entry created!**\n\n• Component: **${item.component}**\n• Failure Mode: ${item.failureMode}\n• Cause: ${item.failureCause}\n• Effect: ${item.failureEffect}\n• S×O×D = ${item.severity}×${item.occurrence}×${item.detection}\n• **RPN: ${item.rpn}** (${item.riskLevel} Risk)\n\nView it on the **FMEA Analysis** page.`,
                action: `Created FMEA entry for "${item.component}"`,
                dataChanged: true,
            };
        }

        case 'risk': {
            const risk = cmd.params['name'] || cmd.params['quoted_0'] || '';
            if (!risk) {
                return { message: `To add a risk, specify the risk description. Example:\n\n**"Add risk named 'Pump Cavitation' severity 8 occurrence 6 detection 4 category Operational mitigation 'Install vibration monitoring'"**\n\nOr simply: **"Add risk called Equipment Overheating"**` };
            }
            const item = RiskService.create({
                risk,
                severity: parseInt(cmd.params['severity'] || '5') || 5,
                occurrence: parseInt(cmd.params['occurrence'] || '5') || 5,
                detection: parseInt(cmd.params['detection'] || '5') || 5,
                mitigation: cmd.params['mitigation'] || 'To be determined',
                category: cmd.params['category'] || 'Operational',
            });
            return {
                message: `✅ **Risk added!**\n\n• Risk: **${item.risk}**\n• S×O×D = ${item.severity}×${item.occurrence}×${item.detection}\n• RPN: **${item.rpn}** | Level: **${item.level}**\n• Category: ${item.category}\n• Mitigation: ${item.mitigation}\n\nView on the **Risk Management** page.`,
                action: `Created risk "${item.risk}"`,
                dataChanged: true,
            };
        }

        case 'cost': {
            const name = cmd.params['name'] || cmd.params['quoted_0'] || '';
            if (!name) {
                return { message: `To add a cost entry, specify the equipment name. Example:\n\n**"Add cost entry named 'Pump D' downtime $500 repair $3000 replacement $50000"**` };
            }
            const item = CostService.create({
                equipmentName: name,
                downtimeCostPerHour: parseFloat(cmd.params['cost_0'] || '0'),
                repairCost: parseFloat(cmd.params['cost_1'] || '0'),
                replacementCost: parseFloat(cmd.params['cost_2'] || '0'),
                sparePartsCost: 0,
                laborCostPerHour: 0,
                operatingHoursPerDay: 8,
                operatingCostPerHour: 0,
            });
            return {
                message: `✅ **Cost entry added!**\n\n• Equipment: **${item.equipmentName}**\n• Annual Operating: $${item.annualOperatingCost.toLocaleString()}\n• Annual Maintenance: $${item.annualMaintenanceCost.toLocaleString()}\n• Cost/Failure: $${item.costPerFailure.toLocaleString()}\n\nView on the **Operating Costs** page.`,
                action: `Created cost entry for "${item.equipmentName}"`,
                dataChanged: true,
            };
        }

        case 'replacement': {
            const name = cmd.params['name'] || cmd.params['quoted_0'] || '';
            if (!name) {
                return { message: `To add a replacement entry, specify the equipment name. Example:\n\n**"Add replacement entry named 'Motor E' tag 'MTR-005' age 7000 beta 2.0 eta 15000"**` };
            }
            const ageMatch = cmd.rawInput.match(/age\s+(\d+\.?\d*)/i);
            const betaMatch = cmd.rawInput.match(/beta\s+(\d+\.?\d*)/i);
            const etaMatch = cmd.rawInput.match(/eta\s+(\d+\.?\d*)/i);
            const item = ReplacementService.create({
                equipment: name,
                tagNumber: cmd.params['quoted_1'] || `EQ-${Date.now().toString().slice(-4)}`,
                currentAge: parseFloat(ageMatch?.[1] || '0'),
                shapeParameter: parseFloat(betaMatch?.[1] || '2.0'),
                scaleParameter: parseFloat(etaMatch?.[1] || '10000'),
                plannedReplacementCost: parseFloat(cmd.params['cost_0'] || '0'),
                unplannedFailureCost: parseFloat(cmd.params['cost_1'] || '0') || (parseFloat(cmd.params['cost_0'] || '0') * 5), // default x5 if missing
            });
            return {
                message: `✅ **Replacement entry added!**\n\n• Equipment: **${item.equipment}**\n• Tag: ${item.tagNumber}\n• Age: ${item.currentAge} h / Optimal: ${item.optimumTime.toFixed(0)} h\n• Status: **${item.status}**\n• Shape (β): ${item.shapeParameter}\n• Scale (η): ${item.scaleParameter}\n\nView on the **Optimal Replacement** page.`,
                action: `Created replacement entry for "${item.equipment}"`,
                dataChanged: true,
            };
        }

        default:
            return { message: `What would you like to create? I can add:\n\n• **Projects** — "Create project named X"\n• **Assets** — "Add asset named X"\n• **FMEA Entries** — "Add FMEA for component X"\n• **Risks** — "Add risk called X"\n• **Cost Entries** — "Add cost entry for X"\n• **Replacement Entries** — "Add replacement for X"\n\nJust specify what you'd like to add!` };
    }
}

function handleUpdate(cmd: ParsedCommand, _context: AIContext): AIResponse {
    const name = cmd.params['name'] || cmd.params['quoted_0'] || '';

    switch (cmd.entity) {
        case 'project': {
            if (!name) return { message: `To update a project, specify which one. Example:\n**"Update project named 'Production Line A' status completed"**` };
            const projects = ProjectService.getAll();
            const match = projects.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
            if (!match) return { message: `Project "${name}" not found. Use **"Show projects"** to see available projects.` };
            const updates: Partial<Project> = {};
            if (cmd.params['status']) updates.status = cmd.params['status'] as Project['status'];
            if (cmd.params['description']) updates.description = cmd.params['description'];
            const updated = ProjectService.update(match.id, updates);
            return {
                message: `✅ **Project updated!**\n\n• Name: **${updated?.name}**\n• Status: ${updated?.status}\n\nChanges saved successfully.`,
                action: `Updated project "${updated?.name}"`,
                dataChanged: true,
            };
        }

        case 'fmea': {
            if (!name) return { message: `To update an FMEA entry, specify the component. Example:\n**"Update FMEA named 'Bearing' severity 9"**` };
            const items = FMEAService.getAll();
            const match = items.find(i => i.component.toLowerCase().includes(name.toLowerCase()));
            if (!match) return { message: `FMEA entry for "${name}" not found. Use **"Show FMEA"** to see all entries.` };
            const updates: Partial<FMEAItem> = {};
            if (cmd.params['severity']) updates.severity = parseInt(cmd.params['severity']);
            if (cmd.params['occurrence']) updates.occurrence = parseInt(cmd.params['occurrence']);
            if (cmd.params['detection']) updates.detection = parseInt(cmd.params['detection']);
            const updated = FMEAService.update(match.id, updates);
            return {
                message: `✅ **FMEA entry updated!**\n\n• Component: **${updated?.component}**\n• S×O×D = ${updated?.severity}×${updated?.occurrence}×${updated?.detection}\n• New RPN: **${updated?.rpn}** (${updated?.riskLevel})\n\nChanges saved.`,
                action: `Updated FMEA entry for "${updated?.component}"`,
                dataChanged: true,
            };
        }

        case 'risk': {
            if (!name) return { message: `To update a risk, specify which one. Example:\n**"Update risk named 'Equipment Failure' severity 3"**` };
            const items = RiskService.getAll();
            const match = items.find(i => i.risk.toLowerCase().includes(name.toLowerCase()));
            if (!match) return { message: `Risk "${name}" not found. Use **"Show risks"** to see all entries.` };
            const updates: Partial<RiskItem> = {};
            if (cmd.params['severity']) updates.severity = parseInt(cmd.params['severity']);
            if (cmd.params['occurrence']) updates.occurrence = parseInt(cmd.params['occurrence']);
            if (cmd.params['detection']) updates.detection = parseInt(cmd.params['detection']);
            if (cmd.params['mitigation']) updates.mitigation = cmd.params['mitigation'];
            if (cmd.params['category']) updates.category = cmd.params['category'];
            const updated = RiskService.update(match.id, updates);
            return {
                message: `✅ **Risk updated!**\n\n• Risk: **${updated?.risk}**\n• S×O×D = ${updated?.severity}×${updated?.occurrence}×${updated?.detection}\n• RPN: **${updated?.rpn}** | Level: **${updated?.level}**\n\nChanges saved.`,
                action: `Updated risk "${updated?.risk}"`,
                dataChanged: true,
            };
        }

        default:
            return { message: `To update data, specify the entity type and name. Examples:\n\n• **"Update project named 'X' status completed"**\n• **"Update FMEA named 'Bearing' severity 9"**\n• **"Update risk named 'X' probability Low"**` };
    }
}

function handleDelete(cmd: ParsedCommand, _context: AIContext): AIResponse {
    const name = cmd.params['name'] || cmd.params['quoted_0'] || '';

    if (!name) {
        return { message: `To delete an item, specify what to delete. Examples:\n\n• **"Delete project named 'Test Project'"**\n• **"Delete FMEA named 'Bearing'"**\n• **"Delete risk named 'Equipment Failure'"**\n\n⚠️ Deletions cannot be undone.` };
    }

    switch (cmd.entity) {
        case 'project': {
            const projects = ProjectService.getAll();
            const match = projects.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
            if (!match) return { message: `Project "${name}" not found.` };
            ProjectService.delete(match.id);
            return { message: `🗑️ **Project "${match.name}" deleted** along with its associated assets.`, action: `Deleted project "${match.name}"`, dataChanged: true };
        }
        case 'fmea': {
            const items = FMEAService.getAll();
            const match = items.find(i => i.component.toLowerCase().includes(name.toLowerCase()));
            if (!match) return { message: `FMEA entry for "${name}" not found.` };
            FMEAService.delete(match.id);
            return { message: `🗑️ **FMEA entry for "${match.component}" deleted.**`, action: `Deleted FMEA entry "${match.component}"`, dataChanged: true };
        }
        case 'risk': {
            const items = RiskService.getAll();
            const match = items.find(i => i.risk.toLowerCase().includes(name.toLowerCase()));
            if (!match) return { message: `Risk "${name}" not found.` };
            RiskService.delete(match.id);
            return { message: `🗑️ **Risk "${match.risk}" deleted.**`, action: `Deleted risk "${match.risk}"`, dataChanged: true };
        }
        case 'cost': {
            const items = CostService.getAll();
            const match = items.find(i => i.equipmentName.toLowerCase().includes(name.toLowerCase()));
            if (!match) return { message: `Cost entry for "${name}" not found.` };
            CostService.delete(match.id);
            return { message: `🗑️ **Cost entry for "${match.equipmentName}" deleted.**`, action: `Deleted cost entry "${match.equipmentName}"`, dataChanged: true };
        }
        case 'replacement': {
            const items = ReplacementService.getAll();
            const match = items.find(i => i.equipment.toLowerCase().includes(name.toLowerCase()));
            if (!match) return { message: `Replacement entry for "${name}" not found.` };
            ReplacementService.delete(match.id);
            return { message: `🗑️ **Replacement entry for "${match.equipment}" deleted.**`, action: `Deleted replacement entry "${match.equipment}"`, dataChanged: true };
        }
        default:
            return { message: `Please specify what type of item to delete: project, asset, FMEA, risk, cost, or replacement.` };
    }
}

function handleAnalyze(cmd: ParsedCommand, context: AIContext): AIResponse {
    const lower = cmd.rawInput.toLowerCase();

    if (lower.includes('summary') || lower.includes('overview') || lower.includes('status') || lower.includes('statistics')) {
        let s;
        let highRiskFMEA = [] as FMEAItem[];
        let replaceDue = [] as ReplacementItem[];

        if (context.projectId && context.assetId) {
            // Context aware summary!
            const prefix = `${context.projectId}-${context.assetId}-`;
            s = getScopedDataSummary(context.projectId, context.assetId);

            const fmea = ScopedDataService.getFMEA(`${prefix}fmea`);
            highRiskFMEA = fmea.filter(i => i.riskLevel === 'High');

            const replacement = ScopedDataService.getReplacement(`${prefix}replacement`);
            replaceDue = replacement.filter(i => i.status === 'Replace Soon' || i.status === 'Monitor');
        } else {
            s = getAppDataSummary();
            highRiskFMEA = FMEAService.getHighRiskItems();
            replaceDue = ReplacementService.getReplaceDueSoon();
        }

        let alerts = '';
        if (highRiskFMEA.length > 0) {
            alerts += `\n\n🚨 **High Risk FMEA Items:**\n${highRiskFMEA.map(i => `• ${i.component} — ${i.failureMode} (RPN: ${i.rpn})`).join('\n')}`;
        }
        if (replaceDue.length > 0) {
            alerts += `\n\n⚠️ **Equipment Needing Attention:**\n${replaceDue.map(i => `• ${i.equipment} — ${i.status} (Age: ${i.currentAge}h / Optimal: ${i.optimumTime}h)`).join('\n')}`;
        }

        const contextIntro = context.projectId
            ? (context.assetId ? ` for your current asset` : ` for your current project`)
            : ``;

        // Use 's' dynamically, avoiding properties not present in both
        const projectsLine = s.hasOwnProperty('projects') ? `\n• ${(s as any).projects} Projects` : '';
        const assetsLine = s.hasOwnProperty('assets') ? `\n• ${(s as any).assets} Assets tracked` : '';

        return {
            message: `📊 **System Analysis Summary${contextIntro}**:\n\n📁 **Data Overview:**${projectsLine}${assetsLine}\n• ${s.fmea} FMEA entries analyzed\n• ${s.risks} Risks identified\n• ${s.costs} Cost items tracked\n• ${s.replacement} Equipment in replacement analysis\n\n💰 **Financial:**\n• Total Annual Cost: **$${s.totalAnnualCost.toLocaleString()}**\n\n📈 **Attention Items:**\n• ${s.highRiskFMEA} high-risk FMEA items\n• ${s.replaceDueSoon} equipment due for replacement${alerts}\n\n💡 **Recommendations:**\n${s.highRiskFMEA > 0 ? '• Address high-risk FMEA items with RPN ≥ 300 first\n' : ''}${s.replaceDueSoon > 0 ? '• Plan replacement for overdue equipment\n' : ''}• Review risk mitigation strategies quarterly\n• Update cost data for budget planning`
        };
    }

    if (cmd.entity === 'fmea' || lower.includes('highest rpn') || lower.includes('critical')) {
        const items = FMEAService.getAll().sort((a, b) => b.rpn - a.rpn);
        if (items.length === 0) return { message: 'No FMEA data available for analysis.' };
        const top = items.slice(0, 5);
        const list = top.map((i, idx) => `${idx + 1}. **${i.component}** — ${i.failureMode} | RPN: **${i.rpn}** (${i.riskLevel})`).join('\n');
        return { message: `📊 **Top ${top.length} Highest RPN Items:**\n\n${list}\n\n💡 *Focus improvement efforts on items with the highest RPN first. Reduce severity, occurrence, or detection ratings through corrective actions.*` };
    }

    if (cmd.entity === 'cost' || lower.includes('expensive') || lower.includes('total cost')) {
        const items = CostService.getAll().sort((a, b) => (b.annualOperatingCost + b.annualMaintenanceCost) - (a.annualOperatingCost + a.annualMaintenanceCost));
        if (items.length === 0) return { message: 'No cost data available for analysis.' };
        const list = items.map((i, idx) => `${idx + 1}. **${i.equipmentName}** — Total: $${(i.annualOperatingCost + i.annualMaintenanceCost).toLocaleString()}/yr`).join('\n');
        const total = items.reduce((sum, i) => sum + i.annualOperatingCost + i.annualMaintenanceCost, 0);
        return { message: `💰 **Cost Analysis (Sorted by Total Annual Cost):**\n\n${list}\n\n**Total Annual Cost: $${total.toLocaleString()}**\n\n💡 *Consider preventive maintenance for the most expensive equipment to reduce downtime and failure costs.*` };
    }

    if (cmd.entity === 'replacement') {
        const items = ReplacementService.getAll().sort((a, b) => {
            const aRemaining = a.optimumTime - a.currentAge;
            const bRemaining = b.optimumTime - b.currentAge;
            return aRemaining - bRemaining;
        });
        if (items.length === 0) return { message: 'No replacement data available for analysis.' };
        const list = items.map((i, idx) => {
            const remaining = i.optimumTime - i.currentAge;
            return `${idx + 1}. **${i.equipment}** — Status: ${i.status} | Remaining: ${remaining.toFixed(0)}h | Cost: $${i.plannedReplacementCost.toLocaleString()}`;
        }).join('\n');
        return { message: `🔄 **Replacement Priority Analysis:**\n\n${list}\n\n💡 *Plan capital expenditure for equipment with 0 or negative remaining hours first.*` };
    }

    // Default analysis
    return handleRead({ ...cmd, intent: 'read' }, context);
}

function handleFileUpload(files: FileInfo[], userInput: string, context: AIContext): AIResponse {
    const results: string[] = [];
    let totalImported = 0;
    let dataChanged = false;

    for (const file of files) {
        if (file.type === 'image') {
            results.push(`📸 **${file.name}** (${file.size})\nImage received. In a full deployment, I would use OCR to extract text data from this image. For now, please describe what data is in the image, and I'll add it for you manually.\n\n💡 *Try typing the data as a command, e.g.: "Add asset named Pump XYZ tag PUMP-001 criticality High"*`);
            continue;
        }

        if (file.parsedData && file.parsedData.length > 0) {
            const headers = Object.keys(file.parsedData[0]);
            const targetType = detectDataTypeFromCSV(headers);

            if (targetType !== 'unknown') {
                const result = importCSVData(file.parsedData, targetType);
                totalImported += result.count;
                dataChanged = result.count > 0;
                results.push(`📄 **${file.name}** (${file.size})\n${result.message}\n\nDetected columns: ${headers.join(', ')}`);
            } else {
                results.push(`📄 **${file.name}** (${file.size})\nFile parsed successfully (${file.parsedData.length} rows), but I couldn't determine which module to import the data into.\n\nDetected columns: ${headers.join(', ')}\n\n💡 *The data might be imported as: assets, FMEA, risks, costs, or replacement entries. Please tell me which module to use.*`);
            }
        } else if (file.textContent) {
            // Try to parse as CSV
            const parsed = parseCSV(file.textContent);
            if (parsed.length > 0) {
                const headers = Object.keys(parsed[0]);
                const targetType = detectDataTypeFromCSV(headers);
                if (targetType !== 'unknown') {
                    const result = importCSVData(parsed, targetType);
                    totalImported += result.count;
                    dataChanged = result.count > 0;
                    results.push(`📄 **${file.name}** (${file.size})\n${result.message}`);
                } else {
                    results.push(`📄 **${file.name}** (${file.size})\nParsed ${parsed.length} rows but couldn't auto-detect the data type.\nColumns: ${headers.join(', ')}\n\n💡 *Tell me where to import this data (assets, FMEA, risks, costs, or replacement).*`);
                }
            } else {
                // Plain text file
                const preview = file.textContent.substring(0, 300);
                results.push(`📄 **${file.name}** (${file.size})\nText content extracted:\n\`\`\`\n${preview}${file.textContent.length > 300 ? '\n...(truncated)' : ''}\n\`\`\`\n\nWould you like me to extract specific data from this text? Tell me what to look for.`);
            }
        } else {
            results.push(`📎 **${file.name}** (${file.size})\nFile received. I can process CSV, TXT, and text-based files. For binary files (Excel, Word, PDF), please export to CSV format for data import.\n\n💡 *Alternatively, describe the data in the file and I'll add it for you.*`);
        }
    }

    const summary = results.join('\n\n---\n\n');
    const inputNote = userInput?.trim() ? `\n\nRegarding your message: "${userInput}" — I've processed it along with the files above.` : '';

    return {
        message: `I've processed your ${files.length} file(s), ${context.userName}:\n\n${summary}${totalImported > 0 ? `\n\n✅ **Total imported: ${totalImported} records.** Refresh the relevant page to see the changes.` : ''}${inputNote}`,
        action: totalImported > 0 ? `Imported ${totalImported} records from files` : undefined,
        dataChanged,
    };
}

function handleGenericResponse(userInput: string, context: AIContext): AIResponse {
    const lower = userInput.toLowerCase();

    // Greeting
    if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|greetings)/i.test(lower)) {
        const summary = getAppDataSummary();
        return {
            message: `Hello ${context.userName}! 👋\n\nI'm your RCM AI Assistant with full access to your application data. Here's what I can see:\n\n• ${summary.projects} project(s)\n• ${summary.assets} asset(s)\n• ${summary.fmea} FMEA entries\n• ${summary.risks} risks tracked\n\nI can **add**, **view**, **update**, **delete** data, **import from files**, and provide **expert guidance** on all RCM topics.\n\nWhat would you like to do?`
        };
    }

    // Thanks
    if (/^(thank|thanks|thx)/i.test(lower)) {
        return { message: `You're welcome, ${context.userName}! 😊 Let me know if you need anything else. I'm here to help with all your RCM needs.` };
    }

    // Catch-all with contextual suggestions
    const page = context.currentPage;
    let pageSuggestion = '';
    if (page === 'FMEA Analysis') pageSuggestion = '\n\n💡 *Since you\'re on FMEA, try: "Show FMEA", "Add FMEA for Bearing", or "What is RPN?"*';
    else if (page === 'Risk Management') pageSuggestion = '\n\n💡 *Since you\'re on Risk Management, try: "Show risks", "Add risk", or "Help with risks"*';
    else if (page === 'Operating Costs') pageSuggestion = '\n\n💡 *Since you\'re on Operating Costs, try: "Show costs", "Analyze costs", or "Help with costs"*';
    else if (page === 'Optimal Replacement') pageSuggestion = '\n\n💡 *Try: "Show replacement data", "Analyze replacement", or "Help with replacement"*';
    else if (page === 'Dashboard') pageSuggestion = '\n\n💡 *Try: "Show summary", "Analyze all data", or "What needs attention?"*';

    return {
        message: `I understand you said: "${userInput}"\n\nHere's what I can help you with:\n\n📋 **Data Commands:**\n• "Show [projects/assets/fmea/risks/costs/replacement]"\n• "Add [project/asset/fmea/risk/cost/replacement] named '...'" \n• "Update [entity] named '...' [field] [value]"\n• "Delete [entity] named '...'"\n\n📊 **Analysis:**\n• "Show summary" — Overview of all data\n• "Analyze costs" — Cost breakdown\n• "Analyze FMEA" — Highest risk items\n\n📚 **Learning:**\n• "Help with [feature]" — How to use any page\n• "What is RCM?" — RCM methodology\n• "How to calculate RPN?" — RPN guide\n\n📎 **Files:**\n• Attach CSV files via the **+** button to import data${pageSuggestion}`
    };
}

// ============ EXPORTS ============

export { parseCSV };
