import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, Send, X, Sparkles, Maximize2, Minimize2, Plus, Image, FileText, FileSpreadsheet, File, Paperclip, XCircle, Mic, MicOff } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useSidebar } from '../contexts/SidebarContext';
import { useAssetContext } from '../contexts/AssetContext';
import { GeminiService } from '../services/GeminiService';
import { AlertsEngine } from '../services/AlertsEngine';
import type { FileInfo } from '../services/AIAssistant';
import RCM7QLogo from './RCM7QLogo';

// File attachment type
interface FileAttachment {
    id: string;
    file: File;
    name: string;
    type: 'image' | 'document' | 'spreadsheet' | 'other';
    previewUrl?: string;
    size: string;
}

// Define message type
type Message = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    attachments?: FileAttachment[];
};

// Context data type for AI awareness
interface AIContext {
    user: {
        name: string;
        email: string;
        role: string;
    };
    currentPage: string;
    timestamp: string;
    projectId: string | null;
    assetId: string | null;
}

// Classify file type from MIME or extension
const classifyFile = (file: File): FileAttachment['type'] => {
    const mime = file.type.toLowerCase();
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (mime.startsWith('image/')) return 'image';
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'ppt', 'pptx'].includes(ext) ||
        mime.includes('pdf') || mime.includes('word') || mime.includes('text') || mime.includes('presentation')) return 'document';
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext) ||
        mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return 'spreadsheet';
    return 'other';
};

// Format file size
const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Accepted file types per category
const FILE_ACCEPT_MAP: Record<string, string> = {
    image: 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/bmp',
    document: '.pdf,.doc,.docx,.txt,.rtf,.odt,.ppt,.pptx',
    spreadsheet: '.xls,.xlsx,.csv,.ods',
};

// Detect if text contains Arabic characters
const isArabicText = (text: string): boolean => {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
};

export default function FloatingAIChat() {
    const { currentUser } = useUser();
    const { isMobile } = useSidebar();
    const { currentProjectId, currentAssetId, currentAsset } = useAssetContext();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<FileAttachment[]>([]);
    const [isListening, setIsListening] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachMenuRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const [currentAccept, setCurrentAccept] = useState('');
    const isSendingRef = useRef(false); // guard against double-send

    // Get current page name for context
    const getPageName = useCallback((path: string) => {
        const pageNames: Record<string, string> = {
            '/': 'Projects',
            '/assets': 'Asset Management',
            '/fmea': 'FMEA Analysis',
            '/risk-management': 'Risk Management',
            '/operating-costs': 'Operating Costs',
            '/optimal-replacement': 'Optimal Replacement',
            '/maintenance-tasks': 'Maintenance Tasks',
            '/maintenance-plan': 'Maintenance Plan',
            '/reports': 'Reports',
            '/settings': 'Settings',
        };
        // Also handle dynamic routes
        if (path.startsWith('/asset-dashboard')) return 'Asset Dashboard';
        return pageNames[path] || 'Unknown Page';
    }, []);

    // Build AI context from user info and current page
    const buildAIContext = useCallback((): AIContext => ({
        user: {
            name: currentUser.name,
            email: currentUser.email,
            role: currentUser.role,
        },
        currentPage: getPageName(location.pathname),
        timestamp: new Date().toISOString(),
        projectId: currentProjectId,
        assetId: currentAssetId,
    }), [currentUser.name, currentUser.email, currentUser.role, location.pathname, currentProjectId, currentAssetId, getPageName]);

    // Initialize with context-aware greeting when opened
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const context = buildAIContext();
            const greeting: Message = {
                id: '1',
                role: 'assistant',
                content: isMobile
                    ? `Hello ${context.user.name}! 👋\n\nI'm your RCM AI Assistant on **${context.currentPage}**.\n\n**What I can do:**\n• **Read & Analyze** your data\n• **Explain** RCM concepts\n\nHow can I help you today?`
                    : `Hello ${context.user.name}! 👋\n\nI'm your RCM AI Assistant. I can see you're currently on the **${context.currentPage}** page.\n\n**What I can do:**\n• **Read and analyze** your application data to provide insights.\n• **Explain** complex Reliability Centered Maintenance (RCM) concepts.\n\nHow can I help you today?`,
                timestamp: new Date().toISOString(),
            };
            setTimeout(() => setMessages([greeting]), 0);
        }
    }, [isOpen, messages.length, buildAIContext, isMobile]);

    // Check for Speech Recognition support
    useEffect(() => {
        const win = window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any };
        const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;
        setTimeout(() => setSpeechSupported(!!SpeechRecognitionAPI), 0);
    }, []);

    // Speech recognition toggle
    const toggleListening = useCallback(() => {
        if (isListening) {
            // Stop listening
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const win = window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any };
        const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) return;

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let finalTranscript = '';

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            // Update input with what we have so far
            setInput(prev => {
                const base = prev.replace(/\s*🎙️.*$/, ''); // Remove any previous interim marker
                if (finalTranscript) {
                    return (base ? base + ' ' : '') + finalTranscript + (interimTranscript ? ' ' + interimTranscript : '');
                }
                return (base ? base + ' ' : '') + interimTranscript;
            });
        };

        recognition.onerror = (event: any) => {
            console.warn('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [isListening]);

    // Cleanup recognition on unmount
    useEffect(() => {
        return () => {
            recognitionRef.current?.stop();
        };
    }, []);

    // On mobile, auto-expand when opened
    useEffect(() => {
        if (isOpen && isMobile) {
            setTimeout(() => setIsExpanded(true), 0);
        }
    }, [isOpen, isMobile]);

    // Close attach menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
                setShowAttachMenu(false);
            }
        };
        if (showAttachMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAttachMenu]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle file selection from input
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newAttachments: FileAttachment[] = [];

        Array.from(files).forEach(file => {
            const fileType = classifyFile(file);
            const attachment: FileAttachment = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                file,
                name: file.name,
                type: fileType,
                size: formatFileSize(file.size),
            };

            // Create preview URL for images
            if (fileType === 'image') {
                attachment.previewUrl = URL.createObjectURL(file);
            }

            newAttachments.push(attachment);
        });

        setPendingAttachments(prev => [...prev, ...newAttachments]);
        setShowAttachMenu(false);

        // Reset file input so same file can be re-selected
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Trigger file input for a specific category
    const triggerFileInput = (category: string) => {
        setCurrentAccept(FILE_ACCEPT_MAP[category] || '*');
        // Small delay to ensure accept is set before click
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 50);
    };

    // Remove a pending attachment
    const removePendingAttachment = (id: string) => {
        setPendingAttachments(prev => {
            const removed = prev.find(a => a.id === id);
            if (removed?.previewUrl) {
                URL.revokeObjectURL(removed.previewUrl);
            }
            return prev.filter(a => a.id !== id);
        });
    };

    // Read text content from a file
    const readFileContent = (file: File): Promise<string | null> => {
        return new Promise((resolve) => {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            if (['csv', 'txt', 'text'].includes(ext) || file.type.includes('text') || file.type.includes('csv')) {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string || null);
                reader.onerror = () => resolve(null);
                reader.readAsText(file);
            } else {
                resolve(null);
            }
        });
    };

    const handleSend = async () => {
        if (!input.trim() && pendingAttachments.length === 0) return;
        if (isSendingRef.current) return; // prevent double-send
        isSendingRef.current = true;

        const context = buildAIContext();
        const capturedInput = input;

        // Add user message
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: capturedInput,
            timestamp: new Date().toISOString(),
            attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
        };

        setMessages(prev => [...prev, userMessage]);
        const sentAttachments = [...pendingAttachments];
        setInput('');
        setPendingAttachments([]);
        setIsTyping(true);

        // Process file attachments for context (text content only — no local AI processing)
        const fileDescriptions: string[] = [];
        for (const att of sentAttachments) {
            const textContent = await readFileContent(att.file);
            if (textContent) {
                fileDescriptions.push(`[File: ${att.name}]\n${textContent.slice(0, 2000)}`);
            } else {
                fileDescriptions.push(`[File attached: ${att.name} (${att.size})]`);
            }
        }

        try {
            const fullMessage = capturedInput + (fileDescriptions.length > 0 ? '\n\n' + fileDescriptions.join('\n\n') : '');

            // Convert conversation history for Gemini
            const chatHistory = messages.map(m => ({
                role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
                parts: m.content
            }));

            // Collect active alerts for grounded context
            const activeAlerts = await AlertsEngine.evaluateMachineAlerts({
                userId: currentUser?.id,
                projectId: currentProjectId,
                currentAssetId: currentAssetId
            }).catch(() => []);

            const replyContent = await GeminiService.sendChatMessage(
                fullMessage,
                {
                    projectName: context.projectId || 'Plant Maintenance Program',
                    projectId: currentProjectId,
                    currentAsset: currentAsset ? {
                        name: currentAsset.equipment_name,
                        tag: currentAsset.tag_number,
                        system: currentAsset.system,
                        criticality: currentAsset.criticality_level
                    } : null,
                    alerts: activeAlerts.map(a => ({
                        severity: a.severity,
                        title: a.title,
                        message: a.message,
                        assetName: a.assetName
                    }))
                },
                chatHistory
            );

            const aiResponse: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: replyContent,
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, aiResponse]);
        } catch (error: any) {
            console.error('Error in Gemini AI response:', error);
            const errorResponse: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an issue generating an AI response. Please check your Gemini API key in Settings or connection.',
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorResponse]);
        } finally {
            setIsTyping(false);
            isSendingRef.current = false;
        }
    };

    if (!isOpen) {
        // Floating button - don't show on login/signup pages
        if (location.pathname === '/login' || location.pathname === '/signup') {
            return null;
        }

        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: isMobile ? '16px' : '24px',
                    left: isMobile ? '16px' : '24px',
                    width: isMobile ? '52px' : '60px',
                    height: isMobile ? '52px' : '60px',
                    borderRadius: '50%',
                    background: 'var(--gradient-primary)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 20px rgba(26, 122, 184, 0.4)',
                    transition: 'all 0.3s ease',
                    zIndex: 9998,
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.boxShadow = '0 6px 28px rgba(26, 122, 184, 0.6)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(26, 122, 184, 0.4)';
                }}
                title="AI Assistant"
            >
                <RCM7QLogo size={isMobile ? 28 : 32} />
            </button>
        );
    }

    // Chat window
    const chatWidth = isMobile || isExpanded ? '100vw' : '400px';
    const chatHeight = isMobile || isExpanded ? '100vh' : '550px';

    // Attachment menu options
    const attachOptions = [
        {
            label: 'Images',
            sublabel: 'PNG, JPG, GIF, WebP',
            icon: Image,
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.12)',
            category: 'image',
        },
        {
            label: 'Documents',
            sublabel: 'PDF, Word, TXT, PPT',
            icon: FileText,
            color: '#3b82f6',
            bgColor: 'rgba(59, 130, 246, 0.12)',
            category: 'document',
        },
        {
            label: 'Spreadsheets',
            sublabel: 'Excel, CSV, ODS',
            icon: FileSpreadsheet,
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.12)',
            category: 'spreadsheet',
        },
    ];

    // Get icon for file type
    const getFileIcon = (type: FileAttachment['type']) => {
        switch (type) {
            case 'image': return Image;
            case 'document': return FileText;
            case 'spreadsheet': return FileSpreadsheet;
            default: return File;
        }
    };

    const getFileColor = (type: FileAttachment['type']) => {
        switch (type) {
            case 'image': return '#10b981';
            case 'document': return '#3b82f6';
            case 'spreadsheet': return '#f59e0b';
            default: return 'var(--text-tertiary)';
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                bottom: isMobile || isExpanded ? '0' : '24px',
                left: isMobile || isExpanded ? '0' : '24px',
                width: chatWidth,
                height: chatHeight,
                background: 'var(--bg-primary)',
                border: isMobile || isExpanded ? 'none' : '1px solid var(--border-color)',
                borderRadius: isMobile || isExpanded ? '0' : 'var(--radius-xl)',
                boxShadow: '0 8px 40px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 9999,
                overflow: 'hidden',
                transition: 'all 0.3s ease',
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: isMobile ? 'var(--spacing-sm) var(--spacing-md)' : 'var(--spacing-md) var(--spacing-lg)',
                    background: 'var(--gradient-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <RCM7QLogo size={isMobile ? 24 : 28} />
                    <div>
                        <div style={{ fontWeight: 600, color: 'white', fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)' }}>
                            RCM AI Assistant
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.8)' }}>
                            {getPageName(location.pathname)}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                    {!isMobile && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                width: '32px',
                                height: '32px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            title={isExpanded ? 'Minimize' : 'Maximize'}
                        >
                            {isExpanded ? <Minimize2 size={18} color="white" /> : <Maximize2 size={18} color="white" />}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            if (isMobile) setIsExpanded(false);
                        }}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            width: '32px',
                            height: '32px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        title="Close"
                    >
                        <X size={18} color="white" />
                    </button>
                </div>
            </div>

            {/* User Context Banner */}
            <div
                style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-secondary)',
                    flexShrink: 0,
                }}
            >
                <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--gradient-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    color: 'white',
                    fontWeight: 600,
                    flexShrink: 0,
                }}>
                    {currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    <strong>{currentUser.name}</strong> • {currentUser.role}
                </span>
            </div>

            {/* Messages */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 'var(--spacing-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-md)',
                }}
            >
                {messages.map((message) => (
                    <div
                        key={message.id}
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-start',
                        }}
                    >
                        <div
                            style={{
                                maxWidth: isMobile ? '90%' : '85%',
                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                borderRadius: 'var(--radius-lg)',
                                background: message.role === 'user' ? 'var(--gradient-primary)' : 'var(--bg-secondary)',
                                border: message.role === 'assistant' ? '1px solid var(--border-color)' : 'none',
                                fontSize: 'var(--font-size-sm)',
                            }}
                        >
                            {message.role === 'assistant' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                    <MessageSquare size={12} color="var(--accent-500)" />
                                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent-500)' }}>AI</span>
                                </div>
                            )}

                            {/* Render attachments */}
                            {message.attachments && message.attachments.length > 0 && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    marginBottom: message.content ? '8px' : '0',
                                }}>
                                    {message.attachments.map(att => {
                                        const AttIcon = getFileIcon(att.type);
                                        const attColor = getFileColor(att.type);

                                        return (
                                            <div key={att.id}>
                                                {/* Image preview */}
                                                {att.type === 'image' && att.previewUrl && (
                                                    <div style={{
                                                        borderRadius: 'var(--radius-md)',
                                                        overflow: 'hidden',
                                                        marginBottom: '4px',
                                                        maxHeight: '160px',
                                                    }}>
                                                        <img
                                                            src={att.previewUrl}
                                                            alt={att.name}
                                                            style={{
                                                                width: '100%',
                                                                maxHeight: '160px',
                                                                objectFit: 'cover',
                                                                display: 'block',
                                                                borderRadius: 'var(--radius-md)',
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                {/* File info chip */}
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: message.role === 'user' ? 'rgba(255,255,255,0.15)' : 'var(--bg-tertiary)',
                                                    fontSize: 'var(--font-size-xs)',
                                                }}>
                                                    <AttIcon size={14} color={message.role === 'user' ? 'rgba(255,255,255,0.9)' : attColor} />
                                                    <span style={{
                                                        flex: 1,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        color: message.role === 'user' ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)',
                                                    }}>
                                                        {att.name}
                                                    </span>
                                                    <span style={{
                                                        color: message.role === 'user' ? 'rgba(255,255,255,0.6)' : 'var(--text-tertiary)',
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        {att.size}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {message.content && (
                                <div style={{
                                    lineHeight: 1.6,
                                    direction: isArabicText(message.content) ? 'rtl' : 'ltr',
                                    textAlign: isArabicText(message.content) ? 'right' : 'left',
                                }}
                                    dangerouslySetInnerHTML={{
                                        __html: message.content
                                            .replace(/&/g, '&amp;')
                                            .replace(/</g, '&lt;')
                                            .replace(/>/g, '&gt;')
                                            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                                            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                                            .replace(/`([^`]+)`/g, '<code style="background:var(--bg-tertiary);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
                                            .replace(/\n/g, '<br/>')
                                    }}
                                />
                            )}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            height: '36px'
                        }}>
                            <svg width="24" height="12" viewBox="0 0 24 12" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="3" cy="6" r="3" fill="var(--primary-500)">
                                    <animate attributeName="cy" values="6;2;6" dur="0.8s" repeatCount="indefinite" begin="0s" />
                                </circle>
                                <circle cx="12" cy="6" r="3" fill="var(--primary-500)">
                                    <animate attributeName="cy" values="6;2;6" dur="0.8s" repeatCount="indefinite" begin="0.2s" />
                                </circle>
                                <circle cx="21" cy="6" r="3" fill="var(--primary-500)">
                                    <animate attributeName="cy" values="6;2;6" dur="0.8s" repeatCount="indefinite" begin="0.4s" />
                                </circle>
                            </svg>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Pending Attachments Preview */}
            {pendingAttachments.length > 0 && (
                <div style={{
                    padding: '8px var(--spacing-md)',
                    borderTop: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    gap: '8px',
                    overflowX: 'auto',
                    flexShrink: 0,
                }}>
                    {pendingAttachments.map(att => {
                        const AttIcon = getFileIcon(att.type);
                        const attColor = getFileColor(att.type);

                        return (
                            <div
                                key={att.id}
                                style={{
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 10px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)',
                                    minWidth: att.type === 'image' && att.previewUrl ? '80px' : 'auto',
                                    maxWidth: '180px',
                                    flexShrink: 0,
                                }}
                            >
                                {/* Image thumbnail or icon */}
                                {att.type === 'image' && att.previewUrl ? (
                                    <img
                                        src={att.previewUrl}
                                        alt={att.name}
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: 'var(--radius-sm)',
                                            objectFit: 'cover',
                                        }}
                                    />
                                ) : (
                                    <AttIcon size={16} color={attColor} />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        color: 'var(--text-primary)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {att.name}
                                    </div>
                                    <div style={{
                                        fontSize: '10px',
                                        color: 'var(--text-tertiary)',
                                    }}>
                                        {att.size}
                                    </div>
                                </div>
                                {/* Remove button */}
                                <button
                                    onClick={() => removePendingAttachment(att.id)}
                                    style={{
                                        position: 'absolute',
                                        top: '-6px',
                                        right: '-6px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '50%',
                                        width: '18px',
                                        height: '18px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        padding: 0,
                                    }}
                                    title="Remove"
                                >
                                    <XCircle size={14} color="var(--text-tertiary)" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Input Area */}
            <div
                style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderTop: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    flexShrink: 0,
                    position: 'relative',
                }}
            >
                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={currentAccept}
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />

                {/* Plus / Attach button */}
                <div ref={attachMenuRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowAttachMenu(!showAttachMenu)}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: 'var(--radius-md)',
                            background: showAttachMenu ? 'var(--primary-500)' : 'var(--bg-tertiary)',
                            border: '1px solid ' + (showAttachMenu ? 'var(--primary-500)' : 'var(--border-color)'),
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            flexShrink: 0,
                        }}
                        title="Attach files"
                    >
                        {showAttachMenu ? (
                            <X size={18} color="white" />
                        ) : (
                            <Plus size={18} color="var(--text-secondary)" />
                        )}
                    </button>

                    {/* Attachment Menu Popover */}
                    {showAttachMenu && (
                        <div style={{
                            position: 'absolute',
                            bottom: 'calc(100% + 8px)',
                            left: '0',
                            width: '220px',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
                            overflow: 'hidden',
                            zIndex: 10000,
                            animation: 'slideUpFade 0.2s ease',
                        }}>
                            {/* Menu header */}
                            <div style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}>
                                <Paperclip size={14} color="var(--text-tertiary)" />
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em',
                                }}>
                                    Attach File
                                </span>
                            </div>

                            {/* Options */}
                            {attachOptions.map((option) => {
                                const OptionIcon = option.icon;
                                return (
                                    <button
                                        key={option.category}
                                        onClick={() => triggerFileInput(option.category)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'background 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{
                                            width: '34px',
                                            height: '34px',
                                            borderRadius: 'var(--radius-md)',
                                            background: option.bgColor,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <OptionIcon size={18} color={option.color} />
                                        </div>
                                        <div>
                                            <div style={{
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: 500,
                                                color: 'var(--text-primary)',
                                            }}>
                                                {option.label}
                                            </div>
                                            <div style={{
                                                fontSize: '10px',
                                                color: 'var(--text-tertiary)',
                                                marginTop: '1px',
                                            }}>
                                                {option.sublabel}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <input
                    type="text"
                    className="input"
                    placeholder={isListening ? "🎙️ Listening..." : (isMobile ? "Ask me anything..." : "Ask about RCM, FMEA, risks...")}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    style={{
                        flex: 1,
                        fontSize: 'var(--font-size-sm)',
                        borderColor: isListening ? '#ef4444' : undefined,
                        boxShadow: isListening ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined,
                        direction: isArabicText(input) ? 'rtl' : 'ltr',
                        textAlign: isArabicText(input) ? 'right' : 'left',
                    }}
                />

                {/* Microphone button */}
                {speechSupported && (
                    <button
                        onClick={toggleListening}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: 'var(--radius-md)',
                            background: isListening ? '#ef4444' : 'var(--bg-tertiary)',
                            border: `1px solid ${isListening ? '#ef4444' : 'var(--border-color)'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            flexShrink: 0,
                            animation: isListening ? 'micPulse 1.5s ease-in-out infinite' : 'none',
                            position: 'relative',
                        }}
                        title={isListening ? 'Stop listening' : 'Voice input'}
                        onMouseEnter={(e) => {
                            if (!isListening) {
                                e.currentTarget.style.background = 'var(--bg-hover)';
                                e.currentTarget.style.borderColor = 'var(--primary-500)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isListening) {
                                e.currentTarget.style.background = 'var(--bg-tertiary)';
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                            }
                        }}
                    >
                        {isListening ? (
                            <MicOff size={18} color="white" />
                        ) : (
                            <Mic size={18} color="var(--text-secondary)" />
                        )}
                    </button>
                )}

                <button
                    className="btn btn-primary"
                    onClick={handleSend}
                    disabled={!input.trim() && pendingAttachments.length === 0}
                    style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}
                >
                    <Send size={18} />
                </button>
            </div>

            {/* Animation keyframes */}
            <style>{`
                @keyframes slideUpFade {
                    from {
                        opacity: 0;
                        transform: translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes micPulse {
                    0%, 100% {
                        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
                    }
                    50% {
                        box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
                    }
                }
            `}</style>
        </div>
    );
}
