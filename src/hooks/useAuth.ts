import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';
import { showError } from '../utils/toast';

export const useAuth = () => {
    const { setSession, setUser, setProfile, setLoading } = useAuthStore();

    useEffect(() => {
        // Check active sessions
        supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Listen for changes on auth state
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
            console.log(`[useAuth] Auth state change event: ${event}`, { hasSession: !!session, userId: session?.user?.id });
            setSession(session);
            setUser(session?.user ?? null);
            setProfile(null); // Clear profile immediately to avoid stale state during redirect
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId: string, retries = 3) => {
        console.log(`[useAuth] fetchProfile called for ${userId}, retries left: ${retries}`);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.log(`[useAuth] fetchProfile error: ${error.message} code: ${error.code}`);
                // If profile not found and we have retries left, wait and retry
                if ((error.code === 'PGRST116' || !data) && retries > 0) {
                    console.log(`[useAuth] Profile not found, retrying... (${retries} attempts left)`);
                    setTimeout(() => fetchProfile(userId, retries - 1), 1000);
                    return;
                }
                throw error;
            }

            if (data) {
                console.log('[useAuth] Profile found:', data);
                setProfile(data);
                setLoading(false); // Success path
            }
        } catch (error) {
            console.error('[useAuth] CRITICAL Error fetching profile:', error);
            if (retries <= 0) {
                showError('Error de perfil', 'No se pudo cargar tu perfil. Revisa tu conexión.');
                setLoading(false); // Error path - out of retries
            }
        }
    };

    return { fetchProfile };
};
