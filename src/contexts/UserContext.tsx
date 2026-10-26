import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

export interface UserAccount {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
    avatarPath?: string;
    company?: string;
}

interface UserContextType {
    currentUser: UserAccount;
    accounts: UserAccount[];
    switchAccount: (accountId: string) => void;
    addAccount: () => void;
    updateCurrentUser: (updates: Partial<UserAccount>) => void;
    loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [currentUser, setCurrentUser] = useState<UserAccount>({
        id: '1',
        name: '',
        email: '',
        role: 'Maintenance Engineer',
    });
    const [accounts, setAccounts] = useState<UserAccount[]>([]);
    const [loading, setLoading] = useState(true);

    // Load profile from Supabase when auth user changes
    useEffect(() => {
        const loadProfile = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('Error loading profile:', error);
                }

                let displayUrl = '';
                const avatarPath = profile?.avatar_url || '';
                
                if (avatarPath) {
                    if (avatarPath.startsWith('http')) {
                        displayUrl = avatarPath; // Backward compatibility if full URL is stored
                    } else {
                        // Generate a signed URL for 7 days
                        const { data } = await supabase.storage.from('app-files').createSignedUrl(avatarPath, 3600 * 24 * 7);
                        if (data) {
                            displayUrl = data.signedUrl;
                        }
                    }
                }

                const userAccount: UserAccount = {
                    id: user.id,
                    name: profile?.full_name || user.user_metadata?.full_name || '',
                    email: user.email || '',
                    role: user.user_metadata?.role || 'Maintenance Engineer',
                    avatar: displayUrl,
                    avatarPath: avatarPath,
                    company: profile?.company || user.user_metadata?.company || '',
                };

                setCurrentUser(userAccount);
                setAccounts([userAccount]);
            } catch (err) {
                console.error('Unexpected error loading profile:', err);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [user]);

    const switchAccount = (accountId: string) => {
        const account = accounts.find(acc => acc.id === accountId);
        if (account) {
            setCurrentUser(account);
        }
    };

    const addAccount = () => {
        window.location.href = '/login';
    };

    const updateCurrentUser = async (updates: Partial<UserAccount>) => {
        let newDisplayUrl = updates.avatar !== undefined ? updates.avatar : currentUser.avatar;
        let newAvatarPath = updates.avatarPath !== undefined ? updates.avatarPath : currentUser.avatarPath;

        // If a new path was provided, generate a signed URL for immediate display
        if (updates.avatarPath !== undefined && updates.avatarPath !== '') {
            const { data } = await supabase.storage.from('app-files').createSignedUrl(updates.avatarPath, 3600 * 24 * 7);
            if (data) {
                newDisplayUrl = data.signedUrl;
            }
        } else if (updates.avatarPath === '') {
            newDisplayUrl = '';
        }

        const updatedUser = { 
            ...currentUser, 
            ...updates,
            avatar: newDisplayUrl,
            avatarPath: newAvatarPath
        };
        
        setCurrentUser(updatedUser);
        setAccounts(accounts.map(acc =>
            acc.id === currentUser.id ? updatedUser : acc
        ));

        // Sync to Supabase profiles table
        if (user) {
            const dbUpdates: Record<string, unknown> = {};
            if (updates.name !== undefined) dbUpdates.full_name = updates.name;
            if (updates.company !== undefined) dbUpdates.company = updates.company || null;
            
            // Sync avatar path to database
            if (updates.avatarPath !== undefined) {
                dbUpdates.avatar_url = updates.avatarPath || null;
            } else if (updates.avatar === '') {
                 // Fallback if someone clears using avatar: ''
                 dbUpdates.avatar_url = null;
            }

            dbUpdates.updated_at = new Date().toISOString();

            if (Object.keys(dbUpdates).length > 0) {
                const { error } = await supabase
                    .from('profiles')
                    .update(dbUpdates)
                    .eq('id', user.id);
                if (error) {
                    console.error('Error updating profile:', error);
                }
            }
        }
    };

    return (
        <UserContext.Provider value={{
            currentUser,
            accounts,
            switchAccount,
            addAccount,
            updateCurrentUser,
            loading
        }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
