/**
 * RCM7QLogo - Reusable brand logo component
 * Renders the exact mechanical gear + intertwined "Q/7" design with 7 precise dots.
 * Adapts to light/dark mode via CSS variables and uses a layered contour
 * technique to create premium background-colored gaps between overlapping elements.
 */
import React from 'react';

interface RCM7QLogoProps {
    /** Overall size in pixels */
    size?: number;
    /** Deprecated: whether to show text */
    showText?: boolean;
    /** Optional className */
    className?: string;
    /** Optional inline styles */
    style?: React.CSSProperties;
}

export default function RCM7QLogo({ size = 48, className, style }: RCM7QLogoProps) {
    return (
        <div
            className={className}
            style={{
                width: size,
                height: size,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                ...style
            }}
        >
            <img
                src="/brand-logo-cropped.png"
                alt="RCM7Q Brand Logo"
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                }}
            />
        </div>
    );
}
