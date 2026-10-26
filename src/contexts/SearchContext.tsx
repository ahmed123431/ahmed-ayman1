import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

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
    projectId: string;
    equipment_name: string;
    tag_number: string;
    system: string;
    manufacturer: string;
    model: string;
    criticality_level: 'High' | 'Medium' | 'Low';
    installation_date: string;
    operating_hours_per_day: number;
    created_at: string;
}

// Page types for scoping search
export type PageType =
    | 'dashboard'
    | 'projects'
    | 'assets'
    | 'fmea'
    | 'risks'
    | 'costs'
    | 'replacement'
    | 'maintenance'
    | 'reports'
    | 'settings';

// Generic search result that can hold any page-specific data
export interface SearchResult {
    type: 'project' | 'asset' | 'fmea' | 'risk' | 'cost' | 'replacement' | 'maintenance' | 'setting';
    item: any;
    projectName?: string;
    displayTitle: string;
    displaySubtitle: string;
    badge?: { label: string; variant: 'danger' | 'warning' | 'success' | 'info' };
}

// Interface for page-specific data registration
export interface PageSearchData {
    items: any[];
    searchFields: string[];
    resultType: SearchResult['type'];
    formatResult: (item: any) => { displayTitle: string; displaySubtitle: string; badge?: SearchResult['badge'] };
}

interface SearchContextType {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchResults: SearchResult[];
    selectedResult: SearchResult | null;
    setSelectedResult: (result: SearchResult | null) => void;
    isSearchOpen: boolean;
    setIsSearchOpen: (open: boolean) => void;
    performSearch: (query: string, pageType?: PageType) => void;
    clearSearch: () => void;
    registerPageData: (pageType: PageType, data: PageSearchData) => void;
    unregisterPageData: (pageType: PageType) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [pageDataRegistry, setPageDataRegistry] = useState<Map<PageType, PageSearchData>>(new Map());

    const registerPageData = useCallback((pageType: PageType, data: PageSearchData) => {
        setPageDataRegistry(prev => {
            const next = new Map(prev);
            next.set(pageType, data);
            return next;
        });
    }, []);

    const unregisterPageData = useCallback((pageType: PageType) => {
        setPageDataRegistry(prev => {
            const next = new Map(prev);
            next.delete(pageType);
            return next;
        });
    }, []);

    // Search projects from localStorage
    const searchProjects = (lowerQuery: string): SearchResult[] => {
        const results: SearchResult[] = [];
        const projectsStr = localStorage.getItem('projects');
        if (projectsStr) {
            const projects: Project[] = JSON.parse(projectsStr);
            const matchingProjects = projects.filter(project =>
                project.name.toLowerCase().includes(lowerQuery) ||
                project.description?.toLowerCase().includes(lowerQuery)
            );
            matchingProjects.forEach(project => {
                results.push({
                    type: 'project',
                    item: project,
                    displayTitle: project.name,
                    displaySubtitle: project.description || 'No description',
                });
            });
        }
        return results;
    };

    // Search assets from localStorage
    const searchAssets = (lowerQuery: string): SearchResult[] => {
        const results: SearchResult[] = [];
        const assetsStr = localStorage.getItem('projectAssets');
        if (assetsStr) {
            const assets: Asset[] = JSON.parse(assetsStr);
            const projectsStr = localStorage.getItem('projects');
            const projects: Project[] = projectsStr ? JSON.parse(projectsStr) : [];

            const matchingAssets = assets.filter(asset =>
                asset.equipment_name.toLowerCase().includes(lowerQuery) ||
                asset.tag_number.toLowerCase().includes(lowerQuery) ||
                asset.system?.toLowerCase().includes(lowerQuery) ||
                asset.manufacturer?.toLowerCase().includes(lowerQuery) ||
                asset.model?.toLowerCase().includes(lowerQuery)
            );

            matchingAssets.forEach(asset => {
                const project = projects.find(p => p.id === asset.projectId);
                const projectName = project?.name || 'Unknown Project';
                results.push({
                    type: 'asset',
                    item: asset,
                    projectName,
                    displayTitle: asset.equipment_name,
                    displaySubtitle: `${asset.tag_number} • ${projectName}`,
                    badge: {
                        label: asset.criticality_level,
                        variant: asset.criticality_level === 'High' ? 'danger' :
                            asset.criticality_level === 'Medium' ? 'warning' : 'success'
                    }
                });
            });
        }
        return results;
    };

    // Search page-specific registered data
    const searchPageData = (lowerQuery: string, pageType: PageType): SearchResult[] => {
        const results: SearchResult[] = [];
        const pageData = pageDataRegistry.get(pageType);
        if (!pageData) return results;

        const matchingItems = pageData.items.filter(item =>
            pageData.searchFields.some(field => {
                const value = item[field];
                if (value === undefined || value === null) return false;
                return String(value).toLowerCase().includes(lowerQuery);
            })
        );

        matchingItems.forEach(item => {
            const formatted = pageData.formatResult(item);
            results.push({
                type: pageData.resultType,
                item,
                ...formatted,
            });
        });

        return results;
    };

    const performSearch = (query: string, pageType?: PageType) => {
        setSearchQuery(query);

        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        const lowerQuery = query.toLowerCase();
        let results: SearchResult[] = [];

        if (!pageType || pageType === 'dashboard' || pageType === 'reports') {
            // Dashboard & Reports: search everything (projects + assets)
            results = [...searchProjects(lowerQuery), ...searchAssets(lowerQuery)];
        } else if (pageType === 'projects') {
            // Projects page: only projects
            results = searchProjects(lowerQuery);
        } else if (pageType === 'assets') {
            // Asset Management page: only assets
            results = searchAssets(lowerQuery);
        } else if (pageType === 'settings') {
            // Settings: no search (or minimal)
            results = [];
        } else {
            // FMEA, Risks, Costs, Replacement: use registered page data
            results = searchPageData(lowerQuery, pageType);
        }

        setSearchResults(results);
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setSelectedResult(null);
        setIsSearchOpen(false);
    };

    return (
        <SearchContext.Provider value={{
            searchQuery,
            setSearchQuery,
            searchResults,
            selectedResult,
            setSelectedResult,
            isSearchOpen,
            setIsSearchOpen,
            performSearch,
            clearSearch,
            registerPageData,
            unregisterPageData,
        }}>
            {children}
        </SearchContext.Provider>
    );
}

export function useSearch() {
    const context = useContext(SearchContext);
    if (context === undefined) {
        throw new Error('useSearch must be used within a SearchProvider');
    }
    return context;
}
