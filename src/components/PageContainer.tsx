import { useSidebar } from '../contexts/SidebarContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { CSSProperties, ReactNode } from 'react';

interface PageContainerProps {
    children: ReactNode;
    style?: CSSProperties;
}

// Height of mobile header bar
const MOBILE_HEADER_HEIGHT = '60px';

export default function PageContainer({ children, style }: PageContainerProps) {
    const { sidebarWidth, isMobile } = useSidebar();
    const { direction } = useLanguage();

    return (
        <div
            style={{
                minHeight: '100vh',
                background: 'var(--bg-primary)',
                padding: 'var(--spacing-xl)',
                // On mobile, add padding-top for the fixed header
                paddingTop: isMobile
                    ? `calc(${MOBILE_HEADER_HEIGHT} + var(--spacing-xl))`
                    : 'var(--spacing-xl)',
                // On desktop, add padding for sidebar
                paddingLeft: isMobile
                    ? 'var(--spacing-md)'
                    : direction === 'rtl'
                        ? 'var(--spacing-xl)'
                        : `calc(${sidebarWidth} + var(--spacing-xl))`,
                paddingRight: isMobile
                    ? 'var(--spacing-md)'
                    : direction === 'rtl'
                        ? `calc(${sidebarWidth} + var(--spacing-xl))`
                        : 'var(--spacing-xl)',
                transition: 'padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                ...style
            }}
        >
            {children}
        </div>
    );
}
