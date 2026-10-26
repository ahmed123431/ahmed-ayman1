/**
 * GeminiService - Direct Google Gemini AI Agent integration for RCM 7Q
 * Grounded in real project data (Assets, FMEA, Tasks, Costs, Weibull Replacement, Alerts).
 */

export interface RCMContextData {
    projectName?: string;
    projectId?: string | null;
    currentAsset?: {
        name: string;
        tag: string;
        system?: string;
        criticality?: string;
        operatingHours?: number;
        manufacturer?: string;
        model?: string;
    } | null;
    allAssets?: Array<{
        name: string;
        tag: string;
        criticality?: string;
        status?: string;
    }>;
    fmeaItems?: Array<{
        component: string;
        failureMode: string;
        failureCause: string;
        failureEffect: string;
        severity: number;
        occurrence: number;
        detection: number;
        rpn: number;
        riskLevel: string;
    }>;
    maintenanceTasks?: Array<{
        taskName: string;
        assetName: string;
        taskType: string;
        priority: string;
        status: string;
        dueDate?: string;
        frequency?: string;
    }>;
    costs?: {
        totalCost: number;
        downtimeLosses: number;
        maintenanceCost: number;
        avgCostPerHour: number;
        items?: Array<{
            name: string;
            acquisition: number;
            failureCost: number;
            downtimeRate: number;
            totalCost: number;
            costPerHour: number;
        }>;
    };
    replacements?: Array<{
        equipment: string;
        tagNumber: string;
        currentAge: number;
        optimumTime: number;
        shapeParameter: number;
        status: string;
    }>;
    alerts?: Array<{
        severity: string;
        title: string;
        message: string;
        assetName: string;
    }>;
}

export interface GeminiChatMessage {
    role: 'user' | 'model';
    parts: string;
}

const STORAGE_KEY_GEMINI_KEY = 'gemini_api_key';
const STORAGE_KEY_GEMINI_MODEL = 'gemini_model';
const DEFAULT_MODEL = 'gemini-3.5-flash';

class GeminiServiceClass {
    /**
     * Get stored Gemini API key (from localStorage or Vite env)
     */
    getApiKey(): string {
        const stored = localStorage.getItem(STORAGE_KEY_GEMINI_KEY);
        if (stored && stored.trim()) return stored.trim();
        const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
        if (envKey && typeof envKey === 'string' && envKey.trim()) return envKey.trim();
        return '';
    }

    /**
     * Set / update Gemini API key in localStorage
     */
    setApiKey(key: string): void {
        if (!key || !key.trim()) {
            localStorage.removeItem(STORAGE_KEY_GEMINI_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY_GEMINI_KEY, key.trim());
        }
    }

    /**
     * Get selected model name
     */
    getModel(): string {
        const stored = localStorage.getItem(STORAGE_KEY_GEMINI_MODEL);
        if (stored && stored.trim() && !stored.includes('gemini-2.0') && !stored.includes('gemini-1.5')) return stored.trim();
        const envModel = (import.meta as any).env?.VITE_GEMINI_MODEL;
        if (envModel && typeof envModel === 'string' && envModel.trim()) return envModel.trim();
        return DEFAULT_MODEL;
    }

    /**
     * Set selected model name
     */
    setModel(model: string): void {
        localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, model);
    }

    /**
     * Test if a Gemini API key is valid
     */
    async testApiKey(key: string, model: string = DEFAULT_MODEL): Promise<{ valid: boolean; message: string }> {
        if (!key || !key.trim()) {
            return { valid: false, message: 'API Key is empty.' };
        }

        const candidateModels = [model, 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];
        const uniqueModels = Array.from(new Set(candidateModels));

        for (const candidate of uniqueModels) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${encodeURIComponent(key.trim())}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            { role: 'user', parts: [{ text: 'Hello, please respond with "OK"' }] }
                        ],
                        generationConfig: { maxOutputTokens: 10 }
                    })
                });

                if (response.ok) {
                    this.setModel(candidate);
                    return { valid: true, message: `Connection successful using ${candidate}!` };
                }

                // If not 404 or 503 (e.g. 400 Invalid Key), return the exact error
                if (response.status !== 404 && response.status !== 503) {
                    const errData = await response.json().catch(() => ({}));
                    const errMsg = errData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
                    return { valid: false, message: errMsg };
                }
            } catch (err: any) {
                return { valid: false, message: err?.message || 'Network error connecting to Gemini API.' };
            }
        }

        return { valid: false, message: 'Could not connect to any candidate Gemini models. Please check your key.' };
    }

    /**
     * Build RCM 7 Questions system prompt including current plant & machine data
     */
    private buildSystemInstruction(context: RCMContextData): string {
        const lines: string[] = [
            `You are the Senior AI Reliability Centered Maintenance (RCM) & Asset Management Engineer for an industrial plant.`,
            `Your core expertise is the SAE JA1011 & John Moubray RCM 7 Questions Methodology:`,
            `1. What are the functions and associated desired standards of performance of the asset in its present operating context?`,
            `2. In what ways can it fail to fulfil its functions (functional failures)?`,
            `3. What causes each functional failure (failure modes)?`,
            `4. What happens when each failure occurs (failure effects)?`,
            `5. In what way does each failure matter (failure consequences: Safety, Environmental, Operational, Financial)?`,
            `6. What should be done to predict or prevent each failure (proactive tasks and task intervals)?`,
            `7. What should be done if a suitable proactive task cannot be found (default actions: run-to-failure, redesign, etc.)?`,
            ``,
            `=== CURRENT PLANT & ASSET TELEMETRY DATA ===`,
            `Active Project: ${context.projectName || 'Default Plant Project'}`,
        ];

        if (context.currentAsset) {
            lines.push(`Selected Machine: ${context.currentAsset.name} (Tag: ${context.currentAsset.tag}, System: ${context.currentAsset.system || 'General'}, Criticality: ${context.currentAsset.criticality || 'Standard'}, Manufacturer: ${context.currentAsset.manufacturer || 'N/A'}, Operating Hours: ${context.currentAsset.operatingHours || 0} hrs)`);
        }

        if (context.allAssets && context.allAssets.length > 0) {
            lines.push(`Plant Assets Inventory (${context.allAssets.length}): ` + context.allAssets.map(a => `${a.name} [${a.tag}] (Crit: ${a.criticality || 'M'})`).join(', '));
        }

        if (context.alerts && context.alerts.length > 0) {
            lines.push(`ACTIVE CRITICAL ALERTS (${context.alerts.length}):`);
            context.alerts.slice(0, 8).forEach(al => {
                lines.push(`- [${al.severity.toUpperCase()}] ${al.assetName}: ${al.title} - ${al.message}`);
            });
        }

        if (context.fmeaItems && context.fmeaItems.length > 0) {
            lines.push(`FMEA & RPN RECORDS (${context.fmeaItems.length}):`);
            context.fmeaItems.slice(0, 10).forEach(f => {
                lines.push(`- Component: ${f.component} | Mode: ${f.failureMode} | Cause: ${f.failureCause} | Effect: ${f.failureEffect} | S:${f.severity} O:${f.occurrence} D:${f.detection} => RPN: ${f.rpn} (${f.riskLevel} Risk)`);
            });
        }

        if (context.replacements && context.replacements.length > 0) {
            lines.push(`WEIBULL OPTIMAL REPLACEMENT METRICS:`);
            context.replacements.slice(0, 6).forEach(r => {
                lines.push(`- ${r.equipment} (${r.tagNumber}): Age ${r.currentAge}h vs Optimum ${r.optimumTime.toFixed(0)}h | Beta: ${r.shapeParameter} | Status: ${r.status}`);
            });
        }

        if (context.costs) {
            lines.push(`COST & FINANCIAL METRICS:`);
            lines.push(`- Total Annual Cost: $${context.costs.totalCost.toLocaleString()}`);
            lines.push(`- Downtime Financial Losses: $${context.costs.downtimeLosses.toLocaleString()}`);
            lines.push(`- Maintenance Expenditure: $${context.costs.maintenanceCost.toLocaleString()}`);
            lines.push(`- Cost per Operating Hour: $${context.costs.avgCostPerHour.toFixed(2)}/hr`);
        }

        if (context.maintenanceTasks && context.maintenanceTasks.length > 0) {
            lines.push(`MAINTENANCE TASKS (${context.maintenanceTasks.length}):`);
            context.maintenanceTasks.slice(0, 8).forEach(t => {
                lines.push(`- ${t.taskName} for ${t.assetName} [${t.taskType}] - Status: ${t.status}, Priority: ${t.priority}`);
            });
        }

        lines.push(``);
        lines.push(`GUIDELINES FOR YOUR RESPONSES:`);
        lines.push(`- Give authoritative, precise, engineering-backed advice referencing the actual equipment, numbers, and RPN values from the data above.`);
        lines.push(`- Structure answers with clean markdown headings, bullet points, and highlight high-risk assets.`);
        lines.push(`- If the user asks in Arabic, answer in professional Arabic technical terminology.`);
        lines.push(`- If the user asks in English, answer in clear English engineering terminology.`);
        lines.push(`- Never fabricate facts when data is missing; suggest the proper RCM investigation steps.`);

        return lines.join('\n');
    }

    /**
     * Send a conversational chat message to Gemini
     */
    async sendChatMessage(
        userMessage: string,
        context: RCMContextData,
        chatHistory: GeminiChatMessage[] = []
    ): Promise<string> {
        const apiKey = this.getApiKey();

        // Fallback: If no API key is provided, return intelligent local guidance
        if (!apiKey) {
            return this.generateOfflineResponse(userMessage, context);
        }

        const initialModel = this.getModel();
        const candidateModels = Array.from(new Set([initialModel, 'gemini-3.5-flash', 'gemini-3.5-flash-lite']));

        const systemInstruction = this.buildSystemInstruction(context);

        // Format history for Gemini API
        const contents: any[] = [];

        // Prepend system instruction as part of conversation primer
        contents.push({
            role: 'user',
            parts: [{ text: `[SYSTEM CONTEXT & ENGINEERING DATA]\n${systemInstruction}\n\nAcknowledge this system context briefly.` }]
        });
        contents.push({
            role: 'model',
            parts: [{ text: `Acknowledged. I have loaded all asset, FMEA, Weibull, maintenance task, and operating cost data for ${context.projectName || 'the plant'}. Ready to assist with RCM analysis.` }]
        });

        // Add recent conversation history (last 6 turns)
        const recentHistory = chatHistory.slice(-6);
        for (const msg of recentHistory) {
            contents.push({
                role: msg.role === 'assistant' as any ? 'model' : msg.role,
                parts: [{ text: msg.parts }]
            });
        }

        // Add current user prompt
        contents.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });

        let lastError = '';

        for (const activeModel of candidateModels) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        generationConfig: {
                            temperature: 0.4,
                            topK: 40,
                            topP: 0.95,
                            maxOutputTokens: 2048,
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const candidate = data.candidates?.[0];
                    const text = candidate?.content?.parts?.map((p: any) => p.text).join('') || '';
                    if (activeModel !== initialModel) {
                        this.setModel(activeModel);
                    }
                    return text || 'No response generated by Gemini. Please try again.';
                }

                // If busy or model not found, try next candidate
                if (response.status === 404 || response.status === 503) {
                    const errData = await response.json().catch(() => ({}));
                    lastError = errData.error?.message || `HTTP ${response.status}`;
                    continue;
                }

                const errData = await response.json().catch(() => ({}));
                const errDetail = errData.error?.message || `HTTP ${response.status}`;
                return `⚠️ **Gemini API Error**: ${errDetail}\n\n*Tip: You can verify or change your Gemini API key in Settings.*`;
            } catch (err: any) {
                lastError = err?.message || 'Network error';
            }
        }

        return `⚠️ **Gemini Service Unavailable**: ${lastError || 'Could not complete request across candidate models.'}\n\n*Falling back to local knowledge:*\n\n${this.generateOfflineResponse(userMessage, context)}`;
    }

    /**
     * Generate Comprehensive Structured RCM Insights (one-click analysis)
     */
    async generateRCMInsights(context: RCMContextData): Promise<{
        summary: string;
        criticalActions: string[];
        costOpportunities: string[];
        reliabilityScore: number;
        rawContent: string;
    }> {
        const prompt = `Perform a comprehensive RCM 7 Questions Engineering Assessment for the current assets and data.
Provide the response in the following exact format:

# 🛡️ Executive RCM Reliability & Health Assessment
[2-3 paragraphs evaluating overall plant/machine health, failure vulnerability, and current risk posture based on the data.]

## 🚨 Top 3 Critical Equipment Risks & Immediate Actions
- **Item 1**: [Specific machine/component with high RPN or impending wearout, why it matters, and exact proactive maintenance recommendation]
- **Item 2**: [Second critical priority]
- **Item 3**: [Third critical priority]

## 💰 Maintenance Cost Optimization & ROI Opportunities
- [Specific advice on reducing downtime losses, converting high corrective costs to condition-based monitoring]
- [Weibull-based replacement timing recommendations to avoid premature or late replacements]

## 📋 Recommended Maintenance Schedule Adjustments
[Actionable task frequency adjustments based on MTBF and failure modes.]

Reliability Health Score: [Provide a number between 0 and 100 based on the data, e.g. "Reliability Health Score: 78/100"]`;

        const responseText = await this.sendChatMessage(prompt, context);

        // Parse reliability score from response text if present
        let score = 75;
        const scoreMatch = responseText.match(/Reliability Health Score:\s*(\d+)/i);
        if (scoreMatch) {
            score = Math.min(100, Math.max(0, parseInt(scoreMatch[1])));
        } else if (context.alerts && context.alerts.length > 0) {
            score = Math.max(30, 90 - (context.alerts.length * 12));
        }

        return {
            summary: responseText.slice(0, 400) + '...',
            criticalActions: [
                'Review high RPN failure modes in FMEA Analysis',
                'Inspect equipment nearing optimal replacement limit',
                'Address scheduled overdue maintenance tasks'
            ],
            costOpportunities: [
                'Transition unplanned repairs to proactive condition monitoring',
                'Optimize spare parts stock based on MTBF'
            ],
            reliabilityScore: score,
            rawContent: responseText,
        };
    }

    /**
     * Offline smart engineering guidance when no API key is yet configured
     */
    private generateOfflineResponse(userMessage: string, context: RCMContextData): string {
        const lower = userMessage.toLowerCase();
        const assetName = context.currentAsset?.name || 'Selected Asset';
        const alertCount = context.alerts?.length || 0;
        const highRPN = context.fmeaItems?.filter(f => f.rpn >= 300) || [];

        if (lower.includes('alert') || lower.includes('maintenance') || lower.includes('need')) {
            if (alertCount === 0) {
                return `✅ **Equipment Health Report**: All machines currently show acceptable operational parameters. No urgent threshold breaches detected.\n\n*To enable real-time Gemini AI deep reasoning, configure your Gemini API key in **Settings**.*`;
            }
            return `🚨 **Machine Maintenance Alerts Detected (${alertCount} active)**:\n\n` +
                (context.alerts || []).slice(0, 4).map(a => `• **${a.assetName}**: ${a.title} (${a.message})`).join('\n') +
                `\n\n**RCM Recommendation**: Navigate to the **Alerts** page to view full diagnostic root-causes and assign corrective work orders.\n\n💡 *Tip: Add your Gemini API Key in **Settings** for automatic AI root-cause diagnosis!*`;
        }

        if (lower.includes('cost') || lower.includes('saving') || lower.includes('roi')) {
            const total = context.costs?.totalCost || 156000;
            const downtime = context.costs?.downtimeLosses || 28000;
            return `💰 **RCM Cost Analysis Summary**:\n\n• **Total Operating Cost**: $${total.toLocaleString()}\n• **Downtime Losses**: $${downtime.toLocaleString()}\n• **Potential Savings**: Up to 35% ($${(downtime * 0.75).toFixed(0)}) achievable by implementing Condition-Based Monitoring (CBM) over run-to-failure.\n\nVisit the **Cost Analysis** dashboard for detailed ROI curves and interactive simulations.`;
        }

        return `🤖 **RCM 7Q AI Assistant**:\n\nI am monitoring your project data for **${assetName}**.\n\n• **Active Machine Alerts**: ${alertCount}\n• **High Risk FMEA Items**: ${highRPN.length}\n• **Active Assets**: ${context.allAssets?.length || 1}\n\nTo unlock live **Google Gemini AI generative reasoning**, enter your free Gemini API key in [Settings](/settings) or the API Key modal!`;
    }
}

export const GeminiService = new GeminiServiceClass();
