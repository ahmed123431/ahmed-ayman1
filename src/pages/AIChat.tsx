import { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import PageContainer from '../components/PageContainer';
import { MessageSquare, Send, Sparkles, HelpCircle } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';
import { useAssetContext } from '../contexts/AssetContext';
import { GeminiService } from '../services/GeminiService';

// Define message type
type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
};

export default function AIChat() {
    const { isMobile } = useSidebar();
    const { user } = useAuth();
    const { currentAssetId } = useAssetContext();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Hello! I\'m your RCM assistant. I can help you with:\n\n• FMEA analysis and RPN calculations\n• Risk assessment and mitigation strategies\n• Maintenance strategy recommendations\n• Cost analysis and ROI calculations\n• Asset lifecycle decisions\n\nHow can I assist you today?',
            timestamp: new Date().toISOString(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isSendingRef = useRef(false);

    const suggestedQuestions = [
        'What is the RPN for a high severity failure?',
        'Preventive vs predictive maintenance?',
        'How to calculate replacement ROI?',
        'What are unacceptable risks?',
    ];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);


    const handleSend = async () => {
        if (!input.trim()) return;
        if (isSendingRef.current) return;
        isSendingRef.current = true;

        // Add user message
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user' as const,
            content: input,
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');
        setIsTyping(true);

        try {
            const chatHistory = messages.map(m => ({
                role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
                parts: m.content
            }));

            const replyContent = await GeminiService.sendChatMessage(
                currentInput,
                {
                    projectId: currentAssetId,
                },
                chatHistory
            );

            const aiResponse: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant' as const,
                content: replyContent,
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, aiResponse]);
        } catch (error) {
            console.error('Error fetching AI response:', error);
            const errorResponse: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant' as const,
                content: 'Sorry, I could not reach the Gemini AI agent. Please check your connection or API key in Settings.',
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorResponse]);
        } finally {
            setIsTyping(false);
            isSendingRef.current = false;
        }
    };

    const handleSuggestedQuestion = (question: string) => {
        setInput(question);
    };

    return (
        <>
            <Sidebar />
            <PageContainer style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                height: '100vh',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-2xl)',
                    paddingBottom: 'var(--spacing-md)',
                    borderBottom: '1px solid var(--border-color)',
                    flexShrink: 0
                }}>
                    <h1 style={{
                        marginBottom: 'var(--spacing-xs)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)'
                    }}>
                        <Sparkles size={isMobile ? 24 : 32} color="var(--accent-500)" />
                        AI Assistant
                    </h1>
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-lg)'
                    }}>
                        {isMobile ? 'RCM engineering expert' : 'RCM engineering expert powered by advanced analysis algorithms.'}
                    </p>
                </div>

                {/* Messages Container */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-2xl)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-md)'
                }}>
                    {messages.map((message, index) => (
                        <div
                            key={message.id}
                            className="animate-fade-in"
                            style={{
                                display: 'flex',
                                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                                animationDelay: `${index * 50}ms`,
                            }}
                        >
                            <div style={{
                                maxWidth: isMobile ? '90%' : '70%',
                                padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)',
                                borderRadius: 'var(--radius-lg)',
                                background: message.role === 'user' ? 'var(--gradient-primary)' : 'var(--bg-secondary)',
                                border: message.role === 'assistant' ? '1px solid var(--border-color)' : 'none',
                            }}>
                                {message.role === 'assistant' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                                        <MessageSquare size={isMobile ? 14 : 18} color="var(--accent-500)" />
                                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--accent-500)' }}>
                                            RCM Assistant
                                        </span>
                                    </div>
                                )}
                                <div style={{
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: 1.6,
                                    fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)'
                                }}>
                                    {message.content}
                                </div>
                                <div style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                    {new Date(message.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <div className="card-glass" style={{ padding: 'var(--spacing-md)' }}>
                                <div className="animate-pulse" style={{ display: 'flex', gap: '4px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-500)' }}></div>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-500)', animationDelay: '0.2s' }}></div>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-500)', animationDelay: '0.4s' }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Suggested Questions */}
                {messages.length <= 1 && (
                    <div style={{
                        padding: isMobile ? '0 var(--spacing-md)' : '0 var(--spacing-2xl)',
                        paddingBottom: 'var(--spacing-md)',
                        flexShrink: 0
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                            <HelpCircle size={isMobile ? 16 : 20} color="var(--text-tertiary)" />
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>
                                {isMobile ? 'Try asking:' : 'Suggested questions:'}
                            </span>
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
                            gap: 'var(--spacing-sm)'
                        }}>
                            {suggestedQuestions.map((question, index) => (
                                <button
                                    key={index}
                                    className="btn btn-secondary"
                                    onClick={() => handleSuggestedQuestion(question)}
                                    style={{
                                        textAlign: 'left',
                                        fontSize: 'var(--font-size-sm)',
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}
                                >
                                    {question}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div style={{
                    padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg) var(--spacing-2xl)',
                    borderTop: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                        <input
                            type="text"
                            className="input"
                            placeholder={isMobile ? "Ask about RCM..." : "Ask about FMEA, risk assessment, maintenance strategies..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            style={{ flex: 1, fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-base)' }}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleSend}
                            disabled={!input.trim()}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 'var(--spacing-sm)',
                                padding: isMobile ? 'var(--spacing-sm) var(--spacing-md)' : 'var(--spacing-sm) var(--spacing-lg)'
                            }}
                        >
                            <Send size={isMobile ? 18 : 20} />
                            {!isMobile && 'Send'}
                        </button>
                    </div>
                </div>
            </PageContainer>
        </>
    );
}
