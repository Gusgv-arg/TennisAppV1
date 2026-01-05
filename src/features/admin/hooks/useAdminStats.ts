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
    // Total coaches activos
    const useCoachesCount = () => {
        return useQuery({
            queryKey: ['admin', 'coaches-count'],
            queryFn: async () => {
                const { count, error } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', 'coach')
                    .eq('is_active', true);

                if (error) throw error;
                return count || 0;
            },
        });
    };

    // Total jugadores (todos los coaches)
    const useTotalPlayers = () => {
        return useQuery({
            queryKey: ['admin', 'total-players'],
            queryFn: async () => {
                const { count, error } = await supabase
                    .from('players')
                    .select('*', { count: 'exact', head: true })
                    .eq('is_archived', false);

                if (error) throw error;
                return count || 0;
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

    // Distribución geográfica de coaches
    const useGeographicDistribution = () => {
        return useQuery({
            queryKey: ['admin', 'geographic-distribution'],
            queryFn: async () => {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('country, state_province, city')
                    .eq('role', 'coach')
                    .not('country', 'is', null);

                if (error) throw error;

                // Group by location and count
                const locationMap = new Map<string, GeographicDistribution>();

                data?.forEach((profile) => {
                    const key = `${profile.country}-${profile.state_province || ''}-${profile.city || ''}`;

                    if (locationMap.has(key)) {
                        const existing = locationMap.get(key)!;
                        existing.coach_count += 1;
                    } else {
                        // Get human-readable names
                        const country = Country.getCountryByCode(profile.country);
                        const state = profile.state_province && profile.country
                            ? State.getStateByCodeAndCountry(profile.state_province, profile.country)
                            : null;

                        locationMap.set(key, {
                            country: profile.country,
                            state_province: profile.state_province || '',
                            city: profile.city || '',
                            coach_count: 1,
                            country_name: country?.name || profile.country,
                            state_name: state?.name || profile.state_province || '',
                        });
                    }
                });

                // Convert to array and sort by count
                return Array.from(locationMap.values())
                    .sort((a, b) => b.coach_count - a.coach_count);
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
        useTotalPlayers,
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
