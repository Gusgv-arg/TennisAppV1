import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
}

// Custom storage adapter (Web: localStorage, Native: SecureStore)
const storage = createJSONStorage<any>(() => {
    if (Platform.OS === 'web') {
        return localStorage;
    }
    return {
        getItem: (name) => SecureStore.getItemAsync(name),
        setItem: (name, value) => SecureStore.setItemAsync(name, value),
        removeItem: (name) => SecureStore.deleteItemAsync(name),
    };
});

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            session: null,
            user: null,
            profile: null,
            isLoading: true,
            pendingInviteToken: null,
            setSession: (session) => set({ session }),
            setUser: (user) => set({ user }),
            setProfile: (profile) => set({ profile }),
            setLoading: (isLoading) => set({ isLoading }),
            setPendingInviteToken: (pendingInviteToken) => set({ pendingInviteToken }),
            signOut: () => set({ session: null, user: null, profile: null, pendingInviteToken: null }),
        }),
        {
            name: 'tenis-lab-auth-storage',
            storage: storage,
            partialize: (state) => ({ pendingInviteToken: state.pendingInviteToken }), // ONLY persist the token
        }
    )
);
