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

            if (event === 'SIGNED_OUT') {
                // Only clear profile on explicit sign-out
                setProfile(null);
                setLoading(false);
            } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                // Re-fetch profile only on actual sign-in or user update
                if (session?.user) {
                    fetchProfile(session.user.id);
                }
            }
            // For TOKEN_REFRESHED and INITIAL_SESSION: keep existing profile, no flicker
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId: string, retries = 3) => {
        console.log(`[useAuth] fetchProfile called for ${userId}, retries left: ${retries}`);
        try {
            // Add a 10s timeout to the profile fetch
            const fetchPromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('TIMEOUT_PROFILE_FETCH')), 10000)
            );

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

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

                // Defensive: verify current_academy_id has valid active membership
                // Wrapped in try-catch so it never blocks profile loading
                if (data.current_academy_id) {
                    try {
                        const { data: membership } = await supabase
                            .from('academy_members')
                            .select('id')
                            .eq('user_id', userId)
                            .eq('academy_id', data.current_academy_id)
                            .eq('is_active', true)
                            .maybeSingle();

                        if (!membership) {
                            console.warn('[useAuth] current_academy_id has no active membership, auto-correcting...');
                            const { data: validMembership } = await supabase
                                .from('academy_members')
                                .select('academy_id')
                                .eq('user_id', userId)
                                .eq('is_active', true)
                                .limit(1)
                                .maybeSingle();

                            const correctedAcademyId = validMembership?.academy_id || null;
                            console.log('[useAuth] Correcting current_academy_id to:', correctedAcademyId);

                            await supabase
                                .from('profiles')
                                .update({ current_academy_id: correctedAcademyId })
                                .eq('id', userId);

                            data.current_academy_id = correctedAcademyId;
                        }
                    } catch (validationError) {
                        // Non-blocking: if validation fails, still load the profile as-is
                        console.warn('[useAuth] Membership validation failed (non-blocking):', validationError);
                    }
                }

                setProfile(data);
                setLoading(false); // Success path
            }
        } catch (error) {
            console.error('[useAuth] CRITICAL Error fetching profile:', error);
            // On any unexpected error or if we're out of retries, we must stop the loader
            showError('Error de perfil', 'No se pudo cargar tu perfil. Revisa tu conexión.');
            setLoading(false);
        }
    };

    return { fetchProfile };
};
