import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface SidebarContextType {
    isExpanded: boolean;
    setIsExpanded: (expanded: boolean) => void;
    toggleSidebar: () => void;
    sidebarWidth: string;
    isMobile: boolean;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (open: boolean) => void;
    toggleMobileMenu: () => void;
    isPinned: boolean;
    togglePin: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const MOBILE_BREAKPOINT = 768;

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [isPinned, setIsPinned] = useState(() => {
        try {
            const stored = localStorage.getItem('sidebar-pinned');
            return stored !== null ? stored === 'true' : true; // default to pinned
        } catch {
            return true;
        }
    });
    const [isExpanded, setIsExpanded] = useState(isPinned);
    const [isMobile, setIsMobile] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Check for mobile screen size
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < MOBILE_BREAKPOINT;
            setIsMobile(mobile);
            // Close mobile menu when switching to desktop
            if (!mobile) {
                setIsMobileMenuOpen(false);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const toggleSidebar = () => {
        setIsExpanded(!isExpanded);
    };

    const togglePin = () => {
        const newPinned = !isPinned;
        setIsPinned(newPinned);
        setIsExpanded(newPinned);
        try {
            localStorage.setItem('sidebar-pinned', String(newPinned));
        } catch {
            // ignore
        }
    };

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    // In mobile, sidebar width is 0 (content takes full width)
    // In desktop, use the normal widths
    const sidebarWidth = isMobile ? '0px' : (isExpanded ? '260px' : '70px');

    return (
        <SidebarContext.Provider value={{
            isExpanded,
            setIsExpanded,
            toggleSidebar,
            sidebarWidth,
            isMobile,
            isMobileMenuOpen,
            setIsMobileMenuOpen,
            toggleMobileMenu,
            isPinned,
            togglePin
        }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (context === undefined) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
}
