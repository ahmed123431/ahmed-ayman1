import { create } from 'zustand';

interface SidebarStore {
    isExpanded: boolean;
    setIsExpanded: (expanded: boolean) => void;
    toggleSidebar: () => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
    isExpanded: false,
    setIsExpanded: (expanded) => set({ isExpanded: expanded }),
    toggleSidebar: () => set((state) => ({ isExpanded: !state.isExpanded })),
}));
