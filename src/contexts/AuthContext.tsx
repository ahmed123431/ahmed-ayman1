import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    signUp: (email: string, password: string, metadata: { full_name: string; company?: string }) => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
    loginAsDemo: () => void;
}

const DEMO_USER: User = {
    id: 'demo-engineer-2026',
    app_metadata: { provider: 'email' },
    user_metadata: {
        full_name: 'Lead Reliability Engineer',
        role: 'Maintenance Engineer',
        company: 'Industrial Plant Operations'
    },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email: 'engineer@rcm7q-local.test',
    phone: '',
    role: 'authenticated',
    updated_at: new Date().toISOString()
};

const DEMO_SESSION: Session = {
    access_token: 'demo-access-token',
    token_type: 'bearer',
    expires_in: 3600 * 24 * 365,
    refresh_token: 'demo-refresh-token',
    user: DEMO_USER,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user previously selected Demo / Local Testing Mode
        if (localStorage.getItem('rcm_demo_mode') === 'true') {
            setSession(DEMO_SESSION);
            setUser(DEMO_USER);
            setLoading(false);
            return;
        }

        // Get initial session from Supabase
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (localStorage.getItem('rcm_demo_mode') === 'true') {
                setSession(DEMO_SESSION);
                setUser(DEMO_USER);
            } else {
                setSession(session);
                setUser(session?.user ?? null);
            }
            setLoading(false);
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (localStorage.getItem('rcm_demo_mode') === 'true') {
                setSession(DEMO_SESSION);
                setUser(DEMO_USER);
            } else {
                setSession(session);
                setUser(session?.user ?? null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const loginAsDemo = () => {
        localStorage.setItem('rcm_demo_mode', 'true');
        setSession(DEMO_SESSION);
        setUser(DEMO_USER);
        setLoading(false);
    };

    const signIn = async (email: string, password: string) => {
        localStorage.removeItem('rcm_demo_mode');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
    };

    const signUp = async (email: string, password: string, metadata: { full_name: string; company?: string }) => {
        localStorage.removeItem('rcm_demo_mode');
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: metadata.full_name,
                    company: metadata.company || '',
                },
            },
        });
        return { error };
    };

    const signOut = async () => {
        localStorage.removeItem('rcm_demo_mode');
        try {
            await supabase.auth.signOut();
        } catch {}
        setSession(null);
        setUser(null);
    };

    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/change-password`,
        });
        return { error };
    };

    return (
        <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut, resetPassword, loginAsDemo }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used inside <AuthProvider>');
    }
    return context;
}
