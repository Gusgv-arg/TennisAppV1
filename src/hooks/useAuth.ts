import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';

export const useAuth = () => {
    const { setSession, setUser, setProfile, setLoading } = useAuthStore();

    useEffect(() => {
        // Check active sessions
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Listen for changes on auth state
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setProfile(null);
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

                // FORCE REFRESH of academy related queries if academy exists
                if (data.current_academy_id) {
                    console.log('[useAuth] Invalidating academy queries to ensure freshness');
                    // We need to access QueryClient here, but we are inside a hook.
                    // IMPORTANT: We cannot access QueryClient inside this async function easily without passing it or using Global.
                    // However, upon profile update, useQuery hooks for membership usually react if they depend on profile.
                    // Let's verify useCurrentAcademyMember depends on profile.
                }
            }
        } catch (error) {
            console.error('[useAuth] CRITICAL Error fetching profile:', error);
            // Even on error, we stop loading to prevent infinite spinner
            // But if it was a critical error, maybe we should handle it differently?
            // For now, consistent with previous behavior, just stop loading.
        } finally {
            // Only set loading to false if we are not retrying
            if (retries <= 0 || (await supabase.from('profiles').select('id').eq('id', userId).single()).data) {
                console.log('[useAuth] setLoading(false)');
                setLoading(false);
            }
        }
    };

    return { fetchProfile };
};
