import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
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
    setPendingInviteToken: (pendingInviteToken) => set({ pendingInviteToken }),
    signOut: () => set({ session: null, user: null, profile: null, pendingInviteToken: null }),
}));
