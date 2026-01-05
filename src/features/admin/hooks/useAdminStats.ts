import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Country, State } from 'country-state-city';
import { supabase } from '../../../services/supabaseClient';

interface GeographicDistribution {
    country: string;
    state_province: string;
    city: string;
    coach_count: number;
    country_name: string;
    state_name: string;
}

export const useAdminStats = () => {
    // Total coaches activos (de profiles + players con intended_role=coach)
    const useCoachesCount = () => {
        return useQuery({
            queryKey: ['admin', 'coaches-count'],
            queryFn: async () => {
                // Coaches con cuenta en profiles
                const { count: profileCoaches, error: profileError } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', 'coach')
                    .eq('is_active', true);

                if (profileError) throw profileError;

                // Coaches dados de alta en players (sin cuenta aún)
                const { count: playerCoaches, error: playerError } = await supabase
                    .from('players')
                    .select('*', { count: 'exact', head: true })
                    .eq('intended_role', 'coach')
                    .eq('is_archived', false);

                if (playerError) throw playerError;

                return (profileCoaches || 0) + (playerCoaches || 0);
            },
        });
    };

    // Conteo de usuarios por rol
    const useUsersByRole = () => {
        return useQuery({
            queryKey: ['admin', 'users-by-role'],
            queryFn: async () => {
                const { data, error } = await supabase
                    .from('players')
                    .select('intended_role')
                    .eq('is_archived', false);

                if (error) throw error;

                const counts = {
                    total: data?.length || 0,
                    coach: 0,
                    collaborator: 0,
                    player: 0,
                };

                data?.forEach(p => {
                    const role = p.intended_role || 'player';
                    if (role === 'coach') counts.coach++;
                    else if (role === 'collaborator') counts.collaborator++;
                    else counts.player++;
                });

                return counts;
            },
        });
    };

    // Sesiones del mes actual
    const useSessionsThisMonth = () => {
        return useQuery({
            queryKey: ['admin', 'sessions-this-month'],
            queryFn: async () => {
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                const { count, error } = await supabase
                    .from('sessions')
                    .select('*', { count: 'exact', head: true })
                    .gte('scheduled_at', startOfMonth.toISOString());

                if (error) throw error;
                return count || 0;
            },
        });
    };

    // Ubicaciones activas (conteo de ubicaciones únicas)
    const useActiveLocations = () => {
        return useQuery({
            queryKey: ['admin', 'active-locations'],
            queryFn: async () => {
                const { data, error } = await supabase
                    .from('locations')
                    .select('id')
                    .eq('is_archived', false);

                if (error) throw error;
                return data?.length || 0;
            },
        });
    };

    // Distribución geográfica de usuarios (por rol y ubicación del coach)
    const useGeographicDistribution = () => {
        return useQuery({
            queryKey: ['admin', 'geographic-distribution'],
            queryFn: async () => {
                // Get all players with their coach's location
                const { data: players, error: playersError } = await supabase
                    .from('players')
                    .select(`
                        id,
                        intended_role,
                        coach_id,
                        is_archived
                    `)
                    .eq('is_archived', false);

                if (playersError) throw playersError;

                // Get all coaches' locations
                const { data: coaches, error: coachesError } = await supabase
                    .from('profiles')
                    .select('id, country, state_province, city');

                if (coachesError) throw coachesError;

                // Create coach location map
                const coachLocationMap = new Map<string, { country: string; state_province: string; city: string }>();
                coaches?.forEach(coach => {
                    if (coach.country) {
                        coachLocationMap.set(coach.id, {
                            country: coach.country,
                            state_province: coach.state_province || '',
                            city: coach.city || '',
                        });
                    }
                });

                // Group players by location and role
                interface LocationRoleCount {
                    country: string;
                    state_province: string;
                    city: string;
                    country_name: string;
                    state_name: string;
                    coach_count: number;
                    collaborator_count: number;
                    player_count: number;
                    total_count: number;
                }

                const locationMap = new Map<string, LocationRoleCount>();

                players?.forEach((player) => {
                    const coachLocation = coachLocationMap.get(player.coach_id);
                    if (!coachLocation) return; // Skip if coach has no location

                    const key = `${coachLocation.country}-${coachLocation.state_province}-${coachLocation.city}`;
                    const role = player.intended_role || 'player';

                    if (locationMap.has(key)) {
                        const existing = locationMap.get(key)!;
                        if (role === 'coach') existing.coach_count += 1;
                        else if (role === 'collaborator') existing.collaborator_count += 1;
                        else existing.player_count += 1;
                        existing.total_count += 1;
                    } else {
                        // Get human-readable names
                        const country = Country.getCountryByCode(coachLocation.country);
                        const state = coachLocation.state_province && coachLocation.country
                            ? State.getStateByCodeAndCountry(coachLocation.state_province, coachLocation.country)
                            : null;

                        const counts = {
                            country: coachLocation.country,
                            state_province: coachLocation.state_province,
                            city: coachLocation.city,
                            country_name: country?.name || coachLocation.country,
                            state_name: state?.name || coachLocation.state_province || '',
                            coach_count: role === 'coach' ? 1 : 0,
                            collaborator_count: role === 'collaborator' ? 1 : 0,
                            player_count: role === 'player' ? 1 : 0,
                            total_count: 1,
                        };
                        locationMap.set(key, counts);
                    }
                });

                // Convert to array and sort by total count
                return Array.from(locationMap.values())
                    .sort((a, b) => b.total_count - a.total_count);
            },
        });
    };

    // Lista de todos los coaches con gestión
    const useAllCoaches = () => {
        return useQuery({
            queryKey: ['admin', 'all-coaches'],
            queryFn: async () => {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('role', 'coach')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return data;
            },
        });
    };

    return {
        useCoachesCount,
        useUsersByRole,
        useSessionsThisMonth,
        useActiveLocations,
        useGeographicDistribution,
        useAllCoaches,
    };
};

// Mutation para activar/desactivar coaches
export const useCoachManagement = () => {
    const queryClient = useQueryClient();

    const toggleCoachStatus = useMutation({
        mutationFn: async ({ coachId, isActive }: { coachId: string; isActive: boolean }) => {
            const { data, error } = await supabase
                .from('profiles')
                .update({ is_active: isActive })
                .eq('id', coachId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            // Invalidate all admin queries to refetch data
            queryClient.invalidateQueries({ queryKey: ['admin'] });
        },
    });

    return {
        toggleCoachStatus,
    };
};

// Mutation para cambiar el rol de un usuario (solo admin)
export const useUserManagement = () => {
    const queryClient = useQueryClient();

    const changeUserRole = useMutation({
        mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'admin' | 'coach' | 'collaborator' | 'player' }) => {
            const { data, error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            // Invalidate all admin queries to refetch data
            queryClient.invalidateQueries({ queryKey: ['admin'] });
        },
    });

    return {
        changeUserRole,
    };
};
