import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';
import { showError } from '../utils/toast';

export const useAuth = () => {
    const { setSession, setUser, setProfile, setLoading } = useAuthStore();
    const hasInitializedRef = useRef(false);
    const isFetchingRef = useRef(false);

    useEffect(() => {
        // Single source of truth: onAuthStateChange handles ALL auth events
        // including INITIAL_SESSION (fires immediately, replaces getSession())
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
            console.log(`[useAuth] Auth event: ${event}`, { hasSession: !!session, initialized: hasInitializedRef.current });

            // Only update session/user if they actually changed (prevents redundant re-renders)
            const current = useAuthStore.getState();
            if (current.session?.access_token !== session?.access_token) {
                setSession(session);
                setUser(session?.user ?? null);
            }

            if (event === 'SIGNED_OUT') {
                setProfile(null);
                hasInitializedRef.current = false;
                isFetchingRef.current = false;
                setLoading(false);
            } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                // On web after OAuth, SIGNED_IN fires before INITIAL_SESSION.
                // We only fetch profile ONCE — whichever event fires first wins.
                if (session?.user && !hasInitializedRef.current) {
                    hasInitializedRef.current = true;
                    fetchProfile(session.user.id);
                } else if (!session) {
                    setLoading(false);
                }
            } else if (event === 'USER_UPDATED') {
                if (session?.user) {
                    fetchProfile(session.user.id);
                }
            }
            // TOKEN_REFRESHED: keep existing profile, do nothing
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId: string, retries = 3) => {
        // Prevent concurrent fetches
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        console.log(`[useAuth] fetchProfile called for ${userId}, retries left: ${retries}`);

        try {
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
                if ((error.code === 'PGRST116' || !data) && retries > 0) {
                    console.log(`[useAuth] Profile not found, retrying... (${retries} attempts left)`);
                    isFetchingRef.current = false; // Allow retry
                    setTimeout(() => fetchProfile(userId, retries - 1), 1000);
                    return;
                }
                throw error;
            }

            if (data) {
                console.log('[useAuth] Profile found:', data.id);

                // Defensive: verify current_academy_id has valid active membership
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
                        console.warn('[useAuth] Membership validation failed (non-blocking):', validationError);
                    }
                }

                setProfile(data);
                setLoading(false);
            }
        } catch (error) {
            console.error('[useAuth] CRITICAL Error fetching profile:', error);
            showError('Error de perfil', 'No se pudo cargar tu perfil. Revisa tu conexión.');
            setLoading(false);
        } finally {
            isFetchingRef.current = false;
        }
    };

    return { fetchProfile };
};
