import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Profile } from '../types/profile';

interface AuthState {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    isLoading: boolean;
    pendingInviteToken: string | null;
    setSession: (session: Session | null) => void;
    setUser: (user: User | null) => void;
    setProfile: (profile: Profile | null) => void;
    setLoading: (isLoading: boolean) => void;
    setPendingInviteToken: (token: string | null) => void;
    signOut: () => void;
    initializeToken: () => Promise<void>;
}

// Manual storage helper to avoid import.meta/ESM issues in production
const TOKEN_KEY = 'tenis-lab-pending-invite-token';

const saveToken = async (token: string | null) => {
    try {
        if (!token) {
            if (Platform.OS === 'web') localStorage.removeItem(TOKEN_KEY);
            else await SecureStore.deleteItemAsync(TOKEN_KEY);
        } else {
            if (Platform.OS === 'web') localStorage.setItem(TOKEN_KEY, token);
            else await SecureStore.setItemAsync(TOKEN_KEY, token);
        }
    } catch (e) {
        console.error('[AuthStore] Error saving token:', e);
    }
};

const loadToken = async (): Promise<string | null> => {
    try {
        if (Platform.OS === 'web') return localStorage.getItem(TOKEN_KEY);
        return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (e) {
        return null;
    }
};

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    user: null,
    profile: null,
    isLoading: true,
    pendingInviteToken: null,
    setSession: (session) => set({ session }),
    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    setLoading: (isLoading) => set({ isLoading }),
    setPendingInviteToken: (token) => {
        set({ pendingInviteToken: token });
        saveToken(token); // Manual persist
    },
    initializeToken: async () => {
        const token = await loadToken();
        if (token) set({ pendingInviteToken: token });
    },
    signOut: () => {
        set({ session: null, user: null, profile: null, pendingInviteToken: null });
        saveToken(null);
    },
}));
