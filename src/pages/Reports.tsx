import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import GlobalSearch from '../components/GlobalSearch';
import { FileText, Download, Eye, ArrowLeft, FileEdit, FolderOpen, ChevronDown, ChevronRight, Cpu, ArrowRight, FileSpreadsheet, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useLanguage } from '../contexts/LanguageContext';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface AssetDataStatus {
    fmea: number;
    risks: number;
    costs: number;
    replacements: number;
    tasks: number;
    logicTree: number;
    aiIntervals: number;
}

interface Project {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    status: 'active' | 'completed' | 'archived';
    assetCount?: number;
}

interface Asset {
    id: string;
    equipment_name: string;
    tag_number: string;
    system: string;
    manufacturer: string;
    criticality_level: string;
    projectId: string;
}

export default function Reports() {
    const navigate = useNavigate();
    const { t, language } = useLanguage();
    const { isMobile } = useSidebar();
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
    const [projectAssets, setProjectAssets] = useState<Asset[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [assetDataStatus, setAssetDataStatus] = useState<Record<string, AssetDataStatus>>({});

    const loadProjects = async () => {
        if (!user) return;
        try {
            const { data: projectsData, error: pErr } = await supabase.from('projects').select('*').eq('user_id', user.id);
            if (pErr) throw pErr;
            const { data: assetsData, error: aErr } = await supabase.from('assets').select('id, project_id').eq('user_id', user.id);
            if (aErr) throw aErr;
            const projectsWithCounts = (projectsData || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description || '',
                createdAt: p.created_at,
                updatedAt: p.updated_at || p.created_at,
                status: p.status || 'active',
                assetCount: (assetsData || []).filter((a: any) => a.project_id === p.id).length
            }));
            setProjects(projectsWithCounts);
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    };

    useEffect(() => {
        loadProjects();
    }, [user]);

    const loadProjectAssets = async (projectId: string) => {
        if (!user) return;
        try {
            const { data, error } = await supabase.from('assets').select('*').eq('project_id', projectId).eq('user_id', user.id);
            if (error) throw error;
            const assets = (data || []).map((a: any) => ({
                id: a.id,
                equipment_name: a.equipment_name,
                tag_number: a.tag_number,
                system: a.system,
                manufacturer: a.manufacturer,
                criticality_level: a.criticality_level,
                projectId: a.project_id
            }));
            setProjectAssets(assets);

            // Fetch data availability counts for each asset in parallel
            const assetIds = assets.map((a: Asset) => a.id);
            if (assetIds.length > 0) {
                const [fmeaRes, risksRes, costsRes, replRes, tasksRes, ltRes, aiRes] = await Promise.all([
                    supabase.from('fmea').select('id, asset_id').in('asset_id', assetIds),
                    supabase.from('risks').select('id, asset_id').in('asset_id', assetIds),
                    supabase.from('costs').select('id, asset_id').in('asset_id', assetIds),
                    supabase.from('replacements').select('id, asset_id').in('asset_id', assetIds),
                    supabase.from('tasks').select('id, asset_id').in('asset_id', assetIds),
                    supabase.from('logic_tree').select('id, asset_id').in('asset_id', assetIds),
                    supabase.from('ai_interval_results').select('id, asset_id').in('asset_id', assetIds),
                ]);

                const countByAsset = (rows: any[] | null, assetId: string) =>
                    (rows || []).filter((r: any) => r.asset_id === assetId).length;

                const statusMap: Record<string, AssetDataStatus> = {};
                assetIds.forEach((id: string) => {
                    statusMap[id] = {
                        fmea: countByAsset(fmeaRes.data, id),
                        risks: countByAsset(risksRes.data, id),
                        costs: countByAsset(costsRes.data, id),
                        replacements: countByAsset(replRes.data, id),
                        tasks: countByAsset(tasksRes.data, id),
                        logicTree: countByAsset(ltRes.data, id),
                        aiIntervals: countByAsset(aiRes.data, id),
                    };
                });
                setAssetDataStatus(prev => ({ ...prev, ...statusMap }));
            }
        } catch (error) {
            console.error('Error loading project assets:', error);
        }
    };

    const toggleProject = (projectId: string) => {
        if (expandedProjectId === projectId) {
            setExpandedProjectId(null);
            setProjectAssets([]);
        } else {
            setExpandedProjectId(projectId);
            loadProjectAssets(projectId);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadProjects();
        if (expandedProjectId) await loadProjectAssets(expandedProjectId);
        setIsRefreshing(false);
    };


    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'badge-success';
            case 'completed': return 'badge-primary';
            case 'archived': return 'badge-warning';
            default: return 'badge-primary';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'active': return t('projects.active');
            case 'completed': return t('projects.completed');
            case 'archived': return t('projects.archived');
            default: return status;
        }
    };

    const getCriticalityColor = (level: string) => {
        switch (level) {
            case 'High': return 'badge-danger';
            case 'Medium': return 'badge-warning';
            case 'Low': return 'badge-success';
            default: return 'badge-primary';
        }
    };

    const handleGenerateProjectReport = (project: Project) => {
        const reportName = `${project.name} - Full Project Report`;
        navigate(`/report-preview?name=${encodeURIComponent(reportName)}&projectId=${project.id}`);
    };

    const handlePreviewProjectReport = (project: Project) => {
        const reportName = `${project.name} - Full Project Report`;
        navigate(`/report-preview?name=${encodeURIComponent(reportName)}&projectId=${project.id}`);
    };

    const handleGenerateAssetReport = (asset: Asset, _type: 'pdf' | 'preview') => {
        const reportName = `${asset.equipment_name} (${asset.tag_number}) - Asset Report`;
        navigate(`/report-preview?name=${encodeURIComponent(reportName)}&assetId=${asset.id}`);
    };

    const handleGenerateWord = async (reportName: string, projectId?: string) => {
        if (!user) return;
        try {
            // Resolve target asset IDs (all user assets, or scoped to a project)
            let scopedAssetIds: string[] | null = null;
            if (projectId) {
                const { data: pAssets } = await supabase
                    .from('assets').select('id').eq('project_id', projectId).eq('user_id', user.id);
                scopedAssetIds = (pAssets || []).map((a: any) => a.id);
            }

            // Build asset name lookup
            const { data: assetRows } = await supabase.from('assets').select('id, equipment_name').eq('user_id', user.id);
            const assetMap: Record<string, string> = {};
            (assetRows || []).forEach((a: any) => { assetMap[a.id] = a.equipment_name; });

            // Build FMEA lookup
            const { data: fmeaRows } = await supabase.from('fmea').select('id, component, failure_mode').eq('user_id', user.id);
            const fmeaById: Record<string, { component: string; failure_mode: string }> = {};
            (fmeaRows || []).forEach((f: any) => { fmeaById[f.id] = { component: f.component, failure_mode: f.failure_mode }; });

            // Fetch AI interval results from source table
            let aiQuery = supabase.from('ai_interval_results')
                .select('id, asset_id, component_id, failure_mode_id, recommended_interval, interval_unit, created_at')
                .eq('user_id', user.id).order('created_at', { ascending: false });
            if (scopedAssetIds) aiQuery = aiQuery.in('asset_id', scopedAssetIds);
            const { data: aiData } = await aiQuery;

            // Fetch replacements from source table
            let repQuery = supabase.from('replacements')
                .select('id, asset_id, equipment, optimum_time, created_at')
                .eq('user_id', user.id).order('created_at', { ascending: false });
            if (scopedAssetIds) repQuery = repQuery.in('asset_id', scopedAssetIds);
            const { data: repData } = await repQuery;

            // Map to display rows
            const aiTasks = (aiData || []).map((r: any) => ({
                component: fmeaById[r.failure_mode_id]?.component || assetMap[r.asset_id] || 'AI Result',
                task_name: fmeaById[r.failure_mode_id]?.failure_mode || 'Maintenance Interval',
                task_type: 'AI',
                interval: `${r.recommended_interval} ${r.interval_unit}`.trim(),
                date: new Date(r.created_at).toLocaleDateString(),
            }));
            const rrTasks = (repData || []).map((r: any) => ({
                component: r.equipment || 'Unknown',
                task_name: 'Scheduled Replacement',
                task_type: 'RR',
                interval: (!r.optimum_time || r.optimum_time > 1e9) ? 'RTF' : `${Math.round(r.optimum_time)} h`,
                date: new Date(r.created_at).toLocaleDateString(),
            }));
            const allTasks = [...rrTasks, ...aiTasks];

            // Group by component
            const grouped: Record<string, typeof allTasks> = {};
            allTasks.forEach(t => {
                if (!grouped[t.component]) grouped[t.component] = [];
                grouped[t.component].push(t);
            });

            const taskSections = Object.entries(grouped).map(([comp, taskRows]) => `
    <div class="section">
        <h3>&#9654; Component: ${comp}</h3>
        <table>
            <tr><th>Task Name</th><th>Task Type</th><th>Assigned Interval</th><th>Last Calculated</th></tr>
            ${taskRows.map(r => `<tr>
                <td>${r.task_name}</td>
                <td style="font-weight:bold;color:#1a7ab8">${r.task_type}</td>
                <td style="font-weight:bold;color:#059669">${r.interval}</td>
                <td>${r.date}</td>
            </tr>`).join('')}
        </table>
    </div>`).join('');

            const htmlContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta charset="UTF-8">
    <title>${reportName}</title>
    <style>
        @page { size: 210mm 297mm; margin: 25mm 20mm 25mm 20mm; mso-page-orientation: portrait; }
        @page Section1 { size: 210mm 297mm; margin: 25mm 20mm 25mm 20mm; mso-page-orientation: portrait; }
        div.Section1 { page: Section1; }
        body { font-family: 'Calibri', sans-serif; line-height: 1.6; margin: 0; padding: 0; }
        h1 { color: #1a7ab8; border-bottom: 2px solid #1a7ab8; padding-bottom: 10px; }
        h2 { color: #1a7ab8; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
        h3 { color: #374151; margin-top: 20px; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0 24px; }
        th, td { border: 1px solid #d1d5db; padding: 10px 8px; text-align: left; font-size: 13px; }
        th { background-color: #1a7ab8; color: white; font-weight: 600; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        .section { margin-bottom: 28px; }
        .meta { color: #6b7280; font-size: 13px; margin-bottom: 4px; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #d1d5db; color: #6b7280; font-size: 12px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    </style>
</head>
<body>
    <div class="Section1">
        <h1>${reportName}</h1>
        <p class="meta"><strong>Generated:</strong> ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        <p class="meta"><strong>Generated by:</strong> RCM7Q — Reliability Centered Maintenance System</p>

        <div class="section">
            <h2>Comprehensive Maintenance Tasks</h2>
            <p class="meta">Tasks are grouped by component. Each component maintains its own independent P-F curve isolation.</p>
            ${allTasks.length === 0
                ? '<p style="color:#6b7280;font-style:italic">No maintenance tasks recorded yet.</p>'
                : taskSections}
        </div>

        <div class="footer"><p>RCM7Q | ${new Date().getFullYear()}</p></div>
    </div>
</body>
</html>`;

            const blob = new Blob([htmlContent], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error generating Word report:', err);
        }
    };

    const handleGenerateExcel = async (reportName: string, projectId?: string) => {
        if (!user) return;
        try {
            // Fetch assets from Supabase
            let assetsQuery = supabase.from('assets').select('*').eq('user_id', user.id);
            if (projectId) assetsQuery = assetsQuery.eq('project_id', projectId);
            const { data: assets } = await assetsQuery;
            if (!assets || assets.length === 0) {
                // Fall through to empty-data handling below
            }

            const assetIds = (assets || []).map((a: any) => a.id);

            // Fetch all related data in parallel
            const [{ data: fmeaRaw }, { data: risksRaw }, { data: costsRaw }, { data: replRaw }, { data: tasksRaw }, { data: aiRaw }, { data: cbmRaw }, { data: ltRaw }, { data: sparesRaw }, { data: faultsRaw }, { data: componentsRaw }] = await Promise.all([
                supabase.from('fmea').select('*').in('asset_id', assetIds),
                supabase.from('risks').select('*').in('asset_id', assetIds),
                supabase.from('costs').select('*').in('asset_id', assetIds),
                supabase.from('replacements').select('id, asset_id, equipment, optimum_time, status, created_at, shape_parameter, scale_parameter, planned_replacement_cost, unplanned_failure_cost').in('asset_id', assetIds),
                supabase.from('tasks').select('*').in('asset_id', assetIds),
                supabase.from('ai_interval_results').select('id, asset_id, failure_mode_id, recommended_interval, interval_unit, created_at').in('asset_id', assetIds).order('created_at', { ascending: false }),
                supabase.from('cbm_curves').select('*').in('asset_id', assetIds),
                supabase.from('logic_tree').select('*').in('asset_id', assetIds),
                supabase.from('spares').select('*').in('asset_id', assetIds),
                supabase.from('faults').select('*').in('asset_id', assetIds),
                supabase.from('components').select('*').in('asset_id', assetIds)
            ]);

            const assetMap: Record<string, string> = {};
            (assets || []).forEach((a: any) => { assetMap[a.id] = a.equipment_name; });

            // Build FMEA lookup for AI result enrichment
            const fmeaById: Record<string, { component: string; failure_mode: string }> = {};
            (fmeaRaw || []).forEach((f: any) => { fmeaById[f.id] = { component: f.component, failure_mode: f.failure_mode }; });

            const fmeaData = (fmeaRaw || []).map((f: any) => ({ ...f, assetName: assetMap[f.asset_id] || '' }));
            const risksData = (risksRaw || []).map((r: any) => ({ ...r, assetName: assetMap[r.asset_id] || '' }));
            const costsData = (costsRaw || []).map((c: any) => ({ ...c, assetName: assetMap[c.asset_id] || '' }));
            const replacementData = (replRaw || []).map((r: any) => ({ ...r, assetName: assetMap[r.asset_id] || '' }));
            const tasksData = (tasksRaw || []).map((t: any) => ({ ...t, assetName: assetMap[t.asset_id] || '' }));
            const cbmCurvesData = (cbmRaw || []).map((c: any) => ({ ...c, assetName: assetMap[c.asset_id] || '' }));
            const sparesData = (sparesRaw || []).map((s: any) => ({ ...s, assetName: assetMap[s.asset_id] || '' }));

            const compMap: Record<string, string> = {};
            (componentsRaw || []).forEach((c: any) => { compMap[c.id] = c.name; });

            const faultsData = (faultsRaw || []).map((f: any) => ({
                ...f,
                assetName: assetMap[f.asset_id] || '',
                componentName: compMap[f.component_id] || f.description?.split(': ')[0] || 'Unknown'
            }));

            const logicTreeExport = (ltRaw || []).map((lt: any) => {
                const fItem = fmeaById[lt.failure_mode_id] || { component: 'N/A', failure_mode: 'N/A' };
                return {
                    ...lt,
                    assetName: assetMap[lt.asset_id] || '',
                    component: fItem.component,
                    failureMode: fItem.failure_mode,
                    hiddenConsequence: lt.hidden_consequence,
                    criticalRisk: lt.critical_risk,
                    operationalRisk: lt.operational_risk,
                    financialRisk: lt.financial_risk,
                    cbmFeasibility: lt.cbm_feasibility,
                    tbmFeasibility: lt.tbm_feasibility,
                    strategyCode: lt.strategy_code
                };
            });

            // Build maintTasksData from source tables directly (same logic as the component)
            const rrMapped = (replRaw || []).map((r: any) => ({
                assetName: assetMap[r.asset_id] || '',
                component_name: r.equipment || 'Unknown',
                task_id: r.id, task_name: 'Scheduled Replacement', task_type: 'RR',
                assigned_interval: (!r.optimum_time || r.optimum_time > 1e9) ? 'RTF' : `${Math.round(r.optimum_time)} h`,
                last_updated: r.created_at,
            }));
            const aiMapped = (aiRaw || []).map((r: any) => ({
                assetName: assetMap[r.asset_id] || '',
                component_name: fmeaById[r.failure_mode_id]?.component || assetMap[r.asset_id] || 'AI Result',
                task_id: r.id,
                task_name: fmeaById[r.failure_mode_id]?.failure_mode || 'Maintenance Interval',
                task_type: 'AI',
                assigned_interval: `${r.recommended_interval} ${r.interval_unit}`.trim(),
                last_updated: r.created_at,
            }));
            const maintTasksData = [...rrMapped, ...aiMapped];

        // Helper to escape XML
        const esc = (val: any) => String(val ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        // Helper to create a worksheet
        const makeSheet = (name: string, headers: string[], rows: string[][]) => {
            let xml = `<Worksheet ss:Name="${esc(name)}"><Table>\n`;
            // Header row
            xml += '<Row>';
            headers.forEach(h => {
                xml += `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`;
            });
            xml += '</Row>\n';
            // Data rows
            rows.forEach(row => {
                xml += '<Row>';
                row.forEach((cell, i) => {
                    const isNum = !isNaN(Number(cell)) && cell !== '' && headers[i] !== 'ID' && headers[i] !== 'Tag Number';
                    xml += `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${esc(cell)}</Data></Cell>`;
                });
                xml += '</Row>\n';
            });
            xml += '</Table></Worksheet>\n';
            return xml;
        };

        // Build XML Spreadsheet
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<?mso-application progid="Excel.Sheet"?>\n';
        xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ';
        xml += 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';

        // Styles
        xml += '<Styles><Style ss:ID="header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1a7ab8" ss:Pattern="Solid"/></Style></Styles>\n';

        // Sheet 1: Assets
        if ((assets || []).length > 0) {
            xml += makeSheet('Assets',
                ['Component Name', 'Tag Number', 'System', 'Manufacturer', 'Model', 'Criticality', 'Installation Date', 'Operating Hours/Day'],
                (assets || []).map((a: any) => [
                    a.equipment_name || a.equipmentName || '',
                    a.tag_number || a.tagNumber || '',
                    a.system || '',
                    a.manufacturer || '',
                    a.model || '',
                    a.criticality_level || a.criticalityLevel || '',
                    a.installation_date || a.installationDate || '',
                    a.operating_hours_per_day || a.operatingHoursPerDay || ''
                ])
            );
        }

        // Sheet 2: Optimal Replacement
        if (replacementData.length > 0) {
            xml += makeSheet('Optimal Replacement',
                ['Asset', 'Component', 'Tag No.', 'Current Age (h)', 'β (Shape)', 'η (Scale)', 'Cp (Planned)', 'Cu (Unplanned)', 'Optimum Time', 'Min CPUT', 'Status'],
                replacementData.map((r: any) => [r.assetName, r.equipment, r.tagNumber || '', String(r.currentAge || ''), String(r.shape_parameter || r.shapeParameter || ''), String(r.scale_parameter || r.scaleParameter || ''), String(r.planned_replacement_cost || r.plannedReplacementCost || ''), String(r.unplanned_failure_cost || r.unplannedFailureCost || ''), String(r.optimum_time === Infinity || r.optimumTime === Infinity ? 'RTF' : (r.optimum_time || r.optimumTime || '')), String(r.minCPUT ? r.minCPUT.toFixed(3) : ''), r.status])
            );
        }

        // Sheet 3: FMEA
        if (fmeaData.length > 0) {
            xml += makeSheet('FMEA Analysis',
                ['Asset', 'Component', 'Failure Mode', 'Failure Cause', 'Failure Effect', 'Severity', 'Occurrence', 'Detection', 'RPN', 'Risk Level'],
                fmeaData.map((f: any) => [f.assetName, f.component, f.failure_mode || f.failureMode, f.failure_cause || f.failureCause, f.failure_effect || f.failureEffect, String(f.severity), String(f.occurrence), String(f.detection), String(f.rpn), f.risk_level || f.riskLevel])
            );
        }

        // Sheet 4: Risk Management
        if (risksData.length > 0) {
            xml += makeSheet('Risk Management',
                ['Asset', 'Risk Description', 'Category', 'Severity', 'Occurrence', 'Detection', 'RPN', 'Risk Level', 'Mitigation Strategy'],
                risksData.map((r: any) => [r.assetName, r.risk, r.category || '', String(r.severity || ''), String(r.occurrence || ''), String(r.detection || ''), String(r.rpn || ''), r.level, r.mitigation])
            );
        }

        // Sheet 5: Maintenance Plan (legacy tasks)
        if (tasksData.length > 0) {
            xml += makeSheet('Maintenance Plan',
                ['Asset', 'Frequency', 'Task Name', 'Task Type'],
                tasksData.map((t: any) => [t.assetName, t.frequency || 'N/A', t.task_name || t.taskName || t.name, t.task_type || t.taskType || t.type || ''])
            );
        }

        // Sheet: Logic Tree Analysis
        if (logicTreeExport.length > 0) {
            xml += makeSheet('Logic Tree Analysis',
                ['Asset', 'Component', 'Failure Mode', 'Hidden Consequence', 'Critical Risk', 'Operational Risk', 'Financial Risk', 'CBM Feasibility', 'TBM Feasibility', 'Strategy Code'],
                logicTreeExport.map((l: any) => [
                    l.assetName, 
                    l.component, 
                    l.failureMode, 
                    l.hiddenConsequence === null ? '-' : l.hiddenConsequence ? 'Y' : 'N', 
                    l.criticalRisk === null ? '-' : l.criticalRisk ? 'Y' : 'N', 
                    l.operationalRisk === null ? '-' : l.operationalRisk ? 'Y' : 'N', 
                    l.financialRisk === null ? '-' : l.financialRisk ? 'Y' : 'N', 
                    l.cbmFeasibility === null ? '-' : l.cbmFeasibility ? 'Y' : 'N', 
                    l.tbmFeasibility === null ? '-' : l.tbmFeasibility ? 'Y' : 'N', 
                    l.strategyCode || 'N/A'
                ])
            );
        }

        // Sheet: Spare Parts
        if (sparesData.length > 0) {
            xml += makeSheet('Spare Parts',
                ['Asset', 'Part Name', 'Part Number', 'Quantity', 'Unit Cost', 'Location'],
                sparesData.map((s: any) => [s.assetName, s.name, s.part_number || s.partNumber, String(s.quantity), String(s.unit_cost || s.unitCost), s.location || ''])
            );
        }

        // Sheet: Fault History
        if (faultsData.length > 0) {
            xml += makeSheet('Fault History',
                ['Asset', 'Component', 'Failed at Time (Hours)', 'Date'],
                faultsData.map((f: any) => [f.assetName, f.componentName, String(f.failed_at_time || f.failedAtTime || ''), f.date ? new Date(f.date).toLocaleDateString() : 'N/A'])
            );
        }

        // Sheet 6: Comprehensive Maintenance Tasks (grouped by component)
        if (maintTasksData.length > 0) {
            // Group by component_name, then flatten with a blank separator row between groups
            const componentGroups: Record<string, any[]> = {};
            maintTasksData.forEach((t: any) => {
                const key = t.component_name || 'General';
                if (!componentGroups[key]) componentGroups[key] = [];
                componentGroups[key].push(t);
            });
            const rows: string[][] = [];
            Object.entries(componentGroups).forEach(([comp, items]) => {
                rows.push([`── Component: ${comp} ──`, '', '', '', '', '']);
                (items as any[]).forEach(t => rows.push([
                    t.assetName,
                    t.task_id?.substring(0, 8).toUpperCase() || '',
                    t.task_name || '',
                    t.task_type || '',
                    t.assigned_interval || '',
                    new Date(t.last_updated).toLocaleDateString()
                ]));
            });
            xml += makeSheet('Maintenance Tasks',
                ['Asset', 'Task ID', 'Task Name', 'Task Type', 'Assigned Interval', 'Last Updated'],
                rows
            );
        }

        // Sheet 7: Operating Costs
        if (costsData.length > 0) {
            xml += makeSheet('Operating Costs',
                ['Asset', 'Component', 'Acquisition Cost', 'Failure Cost', 'Downtime Rate ($/hr)', 'Planned Maint Cost', 'Operating Time', 'MTBF', 'MTTR'],
                costsData.map((c: any) => [c.assetName, c.equipment_name || c.equipmentName || '', String(c.acquisition_cost || ''), String(c.failure_cost || ''), String(c.downtime_cost_rate || ''), String(c.planned_maint_cost || ''), String(c.operating_time || ''), String(c.mtbf || ''), String(c.mttr || '')])
            );
        }

        // Sheet 8: CBM Curves Data
        if (cbmCurvesData.length > 0) {
            xml += makeSheet('CBM Curves Data',
                ['Asset', 'Component', 'P-Days', 'F-Days', 'Date 0', 'Date P', 'Date F'],
                cbmCurvesData.map((c: any) => [c.assetName, c.component_name || '', String(c.p_days || ''), String(c.f_days || ''), c.date_0 || '', c.date_p || '', c.date_f || ''])
            );
        }


        // If no data sheets were added, create a summary sheet
        if ((assets || []).length === 0 && fmeaData.length === 0 && risksData.length === 0 && costsData.length === 0 && replacementData.length === 0 && tasksData.length === 0 && maintTasksData.length === 0) {
            xml += makeSheet('Summary',
                ['Report', 'Generated', 'Note'],
                [[reportName, new Date().toLocaleString(), 'No data available. Add data to the application pages first.']]
            );
        }

        xml += '</Workbook>';

        // Download
        const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generating Excel:', error);
        }
    };

    return (
        <>
            <Sidebar />
            <PageContainer style={{ padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-2xl)' }}>
                {/* Header */}
                <div className="animate-fade-in" style={{
                    marginBottom: 'var(--spacing-xl)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--spacing-md)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                        <button onClick={() => navigate('/')} className="btn btn-ghost" style={{ padding: 'var(--spacing-sm)', minWidth: 'auto' }}>
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 style={{ marginBottom: 'var(--spacing-sm)', fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)' }}>
                                {t('reports.title')}
                            </h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-lg)' }}>
                                {t('reports.subtitle')}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 14px', borderRadius: 'var(--radius-md)',
                                border: 'none',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                cursor: isRefreshing ? 'wait' : 'pointer',
                                fontSize: '13px', fontWeight: 600,
                                opacity: isRefreshing ? 0.7 : 1,
                            }}
                        >
                            {isRefreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                            {isMobile ? '' : (isRefreshing ? 'Refreshing...' : 'Refresh')}
                        </button>
                        <GlobalSearch pageType="reports" />
                    </div>
                </div>

                {/* Projects Section */}
                <div className="animate-fade-in" style={{ marginBottom: 'var(--spacing-xl)', animationDelay: '100ms' }}>
                    <h3 style={{
                        marginBottom: 'var(--spacing-lg)',
                        fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)'
                    }}>
                        <FolderOpen size={20} style={{ color: 'var(--primary-500)' }} />
                        {language === 'ar' ? 'تقارير المشاريع' : 'Project Reports'}
                    </h3>

                    {projects.length === 0 ? (
                        <div className="card" style={{
                            textAlign: 'center',
                            padding: isMobile ? 'var(--spacing-xl)' : 'var(--spacing-3xl)'
                        }}>
                            <FolderOpen
                                size={isMobile ? 48 : 64}
                                style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--spacing-md)' }}
                            />
                            <h3 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-primary)' }}>
                                {language === 'ar' ? 'لا توجد مشاريع' : 'No Projects Found'}
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)' }}>
                                {language === 'ar' ? 'قم بإنشاء مشروع أولاً لإنشاء تقارير' : 'Create a project first to generate reports'}
                            </p>
                            <button
                                onClick={() => navigate('/projects')}
                                className="btn btn-primary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}
                            >
                                <ArrowRight size={18} />
                                {language === 'ar' ? 'الذهاب إلى المشاريع' : 'Go to Projects'}
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {projects.map((project, index) => (
                                <div
                                    key={project.id}
                                    className="card"
                                    style={{
                                        animationDelay: `${150 + (index * 50)}ms`,
                                        overflow: 'hidden',
                                        padding: 0
                                    }}
                                >
                                    {/* Project Header - Clickable */}
                                    <div
                                        onClick={() => toggleProject(project.id)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: isMobile ? 'column' : 'row',
                                            alignItems: isMobile ? 'stretch' : 'center',
                                            justifyContent: 'space-between',
                                            gap: 'var(--spacing-md)',
                                            padding: 'var(--spacing-lg)',
                                            cursor: 'pointer',
                                            transition: 'background var(--transition-fast)',
                                            background: expandedProjectId === project.id ? 'var(--bg-tertiary)' : 'transparent'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (expandedProjectId !== project.id) e.currentTarget.style.background = 'var(--bg-tertiary)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (expandedProjectId !== project.id) e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flex: 1, minWidth: 0 }}>
                                            {/* Expand Icon */}
                                            <div style={{
                                                color: 'var(--primary-500)',
                                                transition: 'transform 0.2s ease',
                                                flexShrink: 0
                                            }}>
                                                {expandedProjectId === project.id
                                                    ? <ChevronDown size={20} />
                                                    : <ChevronRight size={20} />
                                                }
                                            </div>
                                            {/* Folder Icon */}
                                            <div style={{
                                                background: 'var(--gradient-primary)',
                                                padding: 'var(--spacing-sm)',
                                                borderRadius: 'var(--radius-md)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <FolderOpen size={20} color="white" />
                                            </div>
                                            {/* Project Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--spacing-sm)',
                                                    marginBottom: '2px',
                                                    flexWrap: 'wrap'
                                                }}>
                                                    <span style={{
                                                        color: 'var(--text-primary)',
                                                        fontWeight: '600',
                                                        fontSize: 'var(--font-size-md)'
                                                    }}>
                                                        {project.name}
                                                    </span>
                                                    <span className={`badge ${getStatusColor(project.status)}`} style={{ textTransform: 'capitalize' }}>
                                                        {getStatusLabel(project.status)}
                                                    </span>
                                                </div>
                                                <div style={{
                                                    color: 'var(--text-tertiary)',
                                                    fontSize: 'var(--font-size-sm)',
                                                    display: 'flex',
                                                    gap: 'var(--spacing-md)',
                                                    flexWrap: 'wrap'
                                                }}>
                                                    <span>{project.assetCount || 0} {language === 'ar' ? 'أصول' : 'assets'}</span>
                                                    <span>•</span>
                                                    <span>{language === 'ar' ? 'آخر تحديث' : 'Updated'}: {formatDate(project.updatedAt)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Project-level report buttons */}
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: 'var(--spacing-sm)',
                                                flexShrink: 0,
                                                flexWrap: 'wrap'
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => handleGenerateProjectReport(project)}
                                                style={{
                                                    fontSize: 'var(--font-size-sm)',
                                                    padding: 'var(--spacing-xs) var(--spacing-md)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--spacing-xs)'
                                                }}
                                            >
                                                <Download size={14} />
                                                {language === 'ar' ? 'تقرير المشروع' : 'Project Report'}
                                            </button>
                                            <button
                                                className="btn"
                                                onClick={() => handleGenerateWord(`${project.name} - Full Project Report`)}
                                                style={{
                                                    fontSize: 'var(--font-size-sm)',
                                                    padding: 'var(--spacing-xs) var(--spacing-md)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--spacing-xs)',
                                                    background: 'linear-gradient(135deg, #2b5797 0%, #1e3c6e 100%)',
                                                    border: 'none',
                                                    color: 'white'
                                                }}
                                            >
                                                <FileEdit size={14} />
                                                Word
                                            </button>
                                            <button
                                                className="btn"
                                                onClick={() => handleGenerateExcel(`${project.name} - Full Project Data`, project.id)}
                                                style={{
                                                    fontSize: 'var(--font-size-sm)',
                                                    padding: 'var(--spacing-xs) var(--spacing-md)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--spacing-xs)',
                                                    background: 'linear-gradient(135deg, #217346 0%, #185a34 100%)',
                                                    border: 'none',
                                                    color: 'white'
                                                }}
                                            >
                                                <FileSpreadsheet size={14} />
                                                Excel
                                            </button>
                                            <button
                                                className="btn btn-secondary"
                                                onClick={() => handlePreviewProjectReport(project)}
                                                style={{
                                                    fontSize: 'var(--font-size-sm)',
                                                    padding: 'var(--spacing-xs) var(--spacing-md)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--spacing-xs)'
                                                }}
                                            >
                                                <Eye size={14} />
                                                {t('reports.preview')}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Assets List */}
                                    {expandedProjectId === project.id && (
                                        <div style={{
                                            borderTop: '1px solid var(--border-color)',
                                            background: 'var(--bg-primary)'
                                        }}>
                                            {/* Assets Header */}
                                            <div style={{
                                                padding: 'var(--spacing-md) var(--spacing-lg)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--spacing-sm)',
                                                borderBottom: '1px solid var(--border-color)',
                                                background: 'var(--bg-tertiary)'
                                            }}>
                                                <Cpu size={16} style={{ color: 'var(--primary-500)' }} />
                                                <span style={{
                                                    fontWeight: '600',
                                                    fontSize: 'var(--font-size-sm)',
                                                    color: 'var(--text-secondary)'
                                                }}>
                                                    {language === 'ar' ? 'أصول المشروع' : 'Project Assets'} ({projectAssets.length})
                                                </span>
                                            </div>

                                            {projectAssets.length === 0 ? (
                                                <div style={{
                                                    padding: 'var(--spacing-xl)',
                                                    textAlign: 'center',
                                                    color: 'var(--text-tertiary)',
                                                    fontSize: 'var(--font-size-sm)'
                                                }}>
                                                    <Cpu size={32} style={{ marginBottom: 'var(--spacing-sm)', opacity: 0.5 }} />
                                                    <div>{language === 'ar' ? 'لا توجد أصول في هذا المشروع' : 'No assets in this project'}</div>
                                                    <div style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-xs)' }}>
                                                        {language === 'ar' ? 'أضف أصولاً من صفحة إدارة الأصول' : 'Add assets from the Asset Management page'}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    {projectAssets.map((asset, assetIndex) => (
                                                        <div
                                                            key={asset.id}
                                                            style={{
                                                                display: 'flex',
                                                                flexDirection: isMobile ? 'column' : 'row',
                                                                alignItems: isMobile ? 'stretch' : 'center',
                                                                justifyContent: 'space-between',
                                                                gap: 'var(--spacing-md)',
                                                                padding: 'var(--spacing-md) var(--spacing-lg)',
                                                                paddingLeft: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-2xl)',
                                                                borderBottom: assetIndex < projectAssets.length - 1 ? '1px solid var(--border-color)' : 'none',
                                                                transition: 'background var(--transition-fast)'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            {/* Asset Info */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flex: 1, minWidth: 0 }}>
                                                                <div style={{
                                                                    width: '36px',
                                                                    height: '36px',
                                                                    borderRadius: 'var(--radius-md)',
                                                                    background: 'rgba(26, 122, 184, 0.15)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    flexShrink: 0
                                                                }}>
                                                                    <Cpu size={18} color="var(--primary-500)" />
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 'var(--spacing-sm)',
                                                                        flexWrap: 'wrap',
                                                                        marginBottom: '2px'
                                                                    }}>
                                                                        <span style={{
                                                                            color: 'var(--text-primary)',
                                                                            fontWeight: '600',
                                                                            fontSize: 'var(--font-size-sm)'
                                                                        }}>
                                                                            {asset.equipment_name}
                                                                        </span>
                                                                        {asset.criticality_level && (
                                                                            <span className={`badge ${getCriticalityColor(asset.criticality_level)}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                                                                                {asset.criticality_level}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{
                                                                        color: 'var(--text-tertiary)',
                                                                        fontSize: 'var(--font-size-xs)',
                                                                        display: 'flex',
                                                                        gap: 'var(--spacing-md)',
                                                                        flexWrap: 'wrap'
                                                                    }}>
                                                                        <span>{asset.tag_number}</span>
                                                                        {asset.system && <><span>•</span><span>{asset.system}</span></>}
                                                                        {asset.manufacturer && <><span>•</span><span>{asset.manufacturer}</span></>}
                                                                    </div>

                                                                    {/* Data Availability Badges */}
                                                                    {assetDataStatus[asset.id] && (() => {
                                                                        const s = assetDataStatus[asset.id];
                                                                        const modules = [
                                                                            { key: 'fmea', label: 'FMEA', count: s.fmea, color: '#1a7ab8' },
                                                                            { key: 'logicTree', label: language === 'ar' ? 'شجرة القرار' : 'Logic Tree', count: s.logicTree, color: '#b81a7a' },
                                                                            { key: 'replacements', label: language === 'ar' ? 'الاستبدال' : 'Replacement', count: s.replacements, color: '#1ab85a' },
                                                                            { key: 'risks', label: language === 'ar' ? 'المخاطر' : 'Risks', count: s.risks, color: '#b85a1a' },
                                                                            { key: 'costs', label: language === 'ar' ? 'التكاليف' : 'Costs', count: s.costs, color: '#5a1ab8' },
                                                                            { key: 'tasks', label: language === 'ar' ? 'المهام' : 'Tasks', count: s.tasks, color: '#217346' },
                                                                            { key: 'aiIntervals', label: language === 'ar' ? 'فترات AI' : 'AI Intervals', count: s.aiIntervals, color: '#0f5f8f' },
                                                                        ];
                                                                        const activeModules = modules.filter(m => m.count > 0);
                                                                        if (activeModules.length === 0) return null;
                                                                        return (
                                                                            <div style={{
                                                                                display: 'flex',
                                                                                flexWrap: 'wrap',
                                                                                gap: '4px',
                                                                                marginTop: '4px'
                                                                            }}>
                                                                                {activeModules.map(m => (
                                                                                    <span key={m.key} style={{
                                                                                        display: 'inline-flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '3px',
                                                                                        padding: '1px 6px',
                                                                                        borderRadius: '8px',
                                                                                        fontSize: '10px',
                                                                                        fontWeight: 600,
                                                                                        background: `${m.color}18`,
                                                                                        color: m.color,
                                                                                        border: `1px solid ${m.color}30`,
                                                                                    }}>
                                                                                        <CheckCircle size={9} />
                                                                                        {m.label} ({m.count})
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>

                                                            {/* Asset Report Buttons */}
                                                            <div style={{
                                                                display: 'flex',
                                                                gap: 'var(--spacing-xs)',
                                                                flexShrink: 0
                                                            }}>
                                                                <button
                                                                    className="btn btn-primary"
                                                                    onClick={() => handleGenerateAssetReport(asset, 'pdf')}
                                                                    style={{
                                                                        fontSize: 'var(--font-size-xs)',
                                                                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px'
                                                                    }}
                                                                >
                                                                    <FileText size={13} />
                                                                    {language === 'ar' ? 'تقرير' : 'Report'}
                                                                </button>
                                                                <button
                                                                    className="btn"
                                                                    onClick={() => handleGenerateWord(`${asset.equipment_name} - ${asset.tag_number}`)}
                                                                    style={{
                                                                        fontSize: 'var(--font-size-xs)',
                                                                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        background: 'linear-gradient(135deg, #2b5797 0%, #1e3c6e 100%)',
                                                                        border: 'none',
                                                                        color: 'white'
                                                                    }}
                                                                >
                                                                    <FileEdit size={13} />
                                                                    Word
                                                                </button>
                                                                <button
                                                                    className="btn"
                                                                    onClick={() => handleGenerateExcel(`${asset.equipment_name} - ${asset.tag_number}`, expandedProjectId || undefined)}
                                                                    style={{
                                                                        fontSize: 'var(--font-size-xs)',
                                                                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        background: 'linear-gradient(135deg, #217346 0%, #185a34 100%)',
                                                                        border: 'none',
                                                                        color: 'white'
                                                                    }}
                                                                >
                                                                    <FileSpreadsheet size={13} />
                                                                    Excel
                                                                </button>
                                                                <button
                                                                    className="btn btn-secondary"
                                                                    onClick={() => handleGenerateAssetReport(asset, 'preview')}
                                                                    style={{
                                                                        fontSize: 'var(--font-size-xs)',
                                                                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px'
                                                                    }}
                                                                >
                                                                    <Eye size={13} />
                                                                    {t('reports.preview')}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Stats */}
                {projects.length > 0 && (
                    <div className="animate-fade-in" style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-xl)',
                        animationDelay: '300ms'
                    }}>
                        <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>
                                {language === 'ar' ? 'إجمالي المشاريع' : 'Total Projects'}
                            </div>
                            <div style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                {projects.length}
                            </div>
                        </div>
                        <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>
                                {language === 'ar' ? 'إجمالي الأصول' : 'Total Assets'}
                            </div>
                            <div style={{ color: 'var(--primary-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                {projects.reduce((sum, p) => sum + (p.assetCount || 0), 0)}
                            </div>
                        </div>
                        <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>
                                {language === 'ar' ? 'مشاريع نشطة' : 'Active Projects'}
                            </div>
                            <div style={{ color: 'var(--success-500)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                {projects.filter(p => p.status === 'active').length}
                            </div>
                        </div>
                        <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>
                                {language === 'ar' ? 'مكتملة' : 'Completed'}
                            </div>
                            <div style={{ color: 'var(--primary-400)', fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>
                                {projects.filter(p => p.status === 'completed').length}
                            </div>
                        </div>
                    </div>
                )}


                {/* Report Info */}
                <div className="card animate-fade-in" style={{ animationDelay: '400ms' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: isMobile ? 'var(--font-size-md)' : 'var(--font-size-lg)' }}>
                        <FileText size={isMobile ? 20 : 24} color="var(--primary-500)" />
                        {t('reports.whatsIncluded')}
                    </h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                        gap: 'var(--spacing-lg)'
                    }}>
                        <div>
                            <h4 style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--spacing-sm)' }}>
                                {t('reports.executiveSummary')}
                            </h4>
                            <ul style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', paddingLeft: language === 'ar' ? 0 : '1.5rem', paddingRight: language === 'ar' ? '1.5rem' : 0, margin: 0 }}>
                                <li>{t('reports.keyFindings')}</li>
                                <li>{t('reports.criticalIssues')}</li>
                                <li>{t('reports.recommendations')}</li>
                                <li>{t('reports.costImplications')}</li>
                            </ul>
                        </div>
                        <div>
                            <h4 style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--spacing-sm)' }}>
                                {t('reports.technicalAnalysis')}
                            </h4>
                            <ul style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', paddingLeft: language === 'ar' ? 0 : '1.5rem', paddingRight: language === 'ar' ? '1.5rem' : 0, margin: 0 }}>
                                <li>{t('reports.fmeaTables')}</li>
                                <li>{t('reports.riskClassifications')}</li>
                                <li>{t('reports.maintenanceStrategies')}</li>
                                <li>{t('reports.engineeringJustifications')}</li>
                            </ul>
                        </div>
                        <div>
                            <h4 style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--spacing-sm)' }}>
                                {t('reports.visualData')}
                            </h4>
                            <ul style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', paddingLeft: language === 'ar' ? 0 : '1.5rem', paddingRight: language === 'ar' ? '1.5rem' : 0, margin: 0 }}>
                                <li>{t('reports.chartsGraphs')}</li>
                                <li>{t('reports.riskMatrices')}</li>
                                <li>{t('reports.costBreakdowns')}</li>
                                <li>{t('reports.trendAnalysis')}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </PageContainer>
        </>
    );
}
