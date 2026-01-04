import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

interface AuthState {
    session: Session | null;
    user: User | null;
    profile: any | null;
    isLoading: boolean;
    setSession: (session: Session | null) => void;
    setUser: (user: User | null) => void;
    setProfile: (profile: any | null) => void;
    setLoading: (isLoading: boolean) => void;
    signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    user: null,
    profile: null,
    isLoading: true,
    setSession: (session) => set({ session }),
    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    setLoading: (isLoading) => set({ isLoading }),
    signOut: () => set({ session: null, user: null, profile: null }),
}));
