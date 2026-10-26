import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

interface AssetInfo {
    id: string;
    equipment_name: string;
    tag_number: string;
    system: string;
    criticality_level: string;
}

interface ProjectInfo {
    id: string;
    name: string;
}

interface AssetContextType {
    currentProjectId: string | null;
    currentAssetId: string | null;
    currentProject: ProjectInfo | null;
    currentAsset: AssetInfo | null;
    setCurrentProject: (projectId: string) => void;
    setCurrentAsset: (assetId: string) => void;
    clearAsset: () => void;
    clearProject: () => void;
    storageKeyFor: (dataType: string) => string;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

export function AssetProvider({ children }: { children: ReactNode }) {
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(
        () => localStorage.getItem('currentProjectId') || null
    );
    const [currentAssetId, setCurrentAssetId] = useState<string | null>(
        () => localStorage.getItem('currentAssetId') || null
    );
    const [currentProject, setCurrentProjectInfo] = useState<ProjectInfo | null>(null);
    const [currentAsset, setCurrentAssetInfo] = useState<AssetInfo | null>(null);

    // Load project info when projectId changes
    useEffect(() => {
        if (currentProjectId) {
            localStorage.setItem('currentProjectId', currentProjectId);
            const loadProject = async () => {
                const { data } = await supabase.from('projects').select('id, name').eq('id', currentProjectId).single();
                setCurrentProjectInfo(data ? { id: data.id, name: data.name } : null);
            };
            loadProject();
        } else {
            localStorage.removeItem('currentProjectId');
            setCurrentProjectInfo(null);
        }
    }, [currentProjectId]);

    // Load asset info when assetId changes
    useEffect(() => {
        if (currentAssetId) {
            localStorage.setItem('currentAssetId', currentAssetId);
            const loadAsset = async () => {
                const { data } = await supabase.from('assets').select('*').eq('id', currentAssetId).single();
                if (data) {
                    setCurrentAssetInfo({
                        id: data.id,
                        equipment_name: data.equipment_name,
                        tag_number: data.tag_number,
                        system: data.system,
                        criticality_level: data.criticality_level,
                    });
                } else {
                    setCurrentAssetInfo(null);
                    setCurrentAssetId(null);
                    localStorage.removeItem('currentAssetId');
                }
            };
            loadAsset();
        } else {
            localStorage.removeItem('currentAssetId');
            setCurrentAssetInfo(null);
        }
    }, [currentAssetId]);

    const setCurrentProject = useCallback((projectId: string) => {
        setCurrentProjectId(projectId);
        // Clear asset when switching projects
        setCurrentAssetId(null);
    }, []);

    const setCurrentAsset = useCallback((assetId: string) => {
        setCurrentAssetId(assetId);
    }, []);

    const clearAsset = useCallback(() => {
        setCurrentAssetId(null);
    }, []);

    const clearProject = useCallback(() => {
        setCurrentProjectId(null);
        setCurrentAssetId(null);
    }, []);

    // Generate a scoped storage key for data that belongs to the current asset
    const storageKeyFor = useCallback((dataType: string): string => {
        if (currentAssetId) {
            return `${dataType}_${currentAssetId}`;
        }
        // Fallback to global key if no asset selected
        return dataType;
    }, [currentAssetId]);

    return (
        <AssetContext.Provider value={{
            currentProjectId,
            currentAssetId,
            currentProject,
            currentAsset,
            setCurrentProject,
            setCurrentAsset,
            clearAsset,
            clearProject,
            storageKeyFor,
        }}>
            {children}
        </AssetContext.Provider>
    );
}

export function useAssetContext() {
    const context = useContext(AssetContext);
    if (context === undefined) {
        throw new Error('useAssetContext must be used within an AssetProvider');
    }
    return context;
}
