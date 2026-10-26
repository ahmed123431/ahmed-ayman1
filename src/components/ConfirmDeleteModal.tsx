import { AlertTriangle, X } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    itemName?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDeleteModal({
    isOpen,
    title,
    message,
    itemName,
    onConfirm,
    onCancel
}: ConfirmDeleteModalProps) {
    const { isMobile } = useSidebar();

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div
                onClick={onCancel}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--spacing-md)',
                    zIndex: 'var(--z-modal)',
                    animation: 'fadeIn 0.2s ease-out'
                }}
            >
                {/* Modal */}
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        padding: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-xl)',
                        maxWidth: '440px',
                        width: '100%',
                        boxShadow: 'var(--shadow-xl)',
                        border: '1px solid var(--border-color)',
                        animation: 'slideUp 0.25s ease-out'
                    }}
                >
                    {/* Close button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-sm)' }}>
                        <button
                            onClick={onCancel}
                            className="btn btn-ghost"
                            style={{ padding: 'var(--spacing-xs)', minWidth: 'auto' }}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Warning Icon */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: 'var(--spacing-md)'
                    }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <AlertTriangle size={28} color="var(--danger-500)" />
                        </div>
                    </div>

                    {/* Title */}
                    <h3 style={{
                        textAlign: 'center',
                        margin: 0,
                        marginBottom: 'var(--spacing-sm)',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--font-size-lg)'
                    }}>
                        {title}
                    </h3>

                    {/* Message */}
                    <p style={{
                        textAlign: 'center',
                        margin: 0,
                        marginBottom: 'var(--spacing-sm)',
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--font-size-sm)',
                        lineHeight: '1.5'
                    }}>
                        {message}
                    </p>

                    {/* Item name highlight */}
                    {itemName && (
                        <div style={{
                            textAlign: 'center',
                            marginBottom: 'var(--spacing-lg)',
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            fontWeight: '600',
                            fontSize: 'var(--font-size-sm)',
                            wordBreak: 'break-word'
                        }}>
                            {itemName}
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column-reverse' : 'row',
                        gap: 'var(--spacing-sm)',
                        marginTop: itemName ? 0 : 'var(--spacing-lg)'
                    }}>
                        <button
                            onClick={onCancel}
                            className="btn btn-secondary"
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="btn"
                            style={{
                                flex: 1,
                                background: 'var(--danger-500)',
                                color: 'white',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 'var(--spacing-sm)'
                            }}
                        >
                            <AlertTriangle size={16} />
                            Delete
                        </button>
                    </div>
                </div>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </>
    );
}
