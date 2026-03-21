import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/services/supabaseClient';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useTheme } from '@/src/hooks/useTheme';
import VideoList from '@/src/components/VideoList';

export default function MyVideosScreen() {
    const { session } = useAuthStore();
    const { theme } = useTheme();

    const { data: player, isLoading: isLoadingPlayer } = useQuery({
        queryKey: ['my-player-id', session?.user?.id],
        queryFn: async () => {
             if (!session?.user?.id) return null;
             const { data, error } = await supabase
                 .from('players')
                 .select('id')
                 .eq('linked_user_id', session.user.id)
                 .single();
             if (error) throw error;
             return data;
        },
        enabled: !!session?.user?.id
    });

    if (isLoadingPlayer) {
         return (
            <View style={[styles.container, { backgroundColor: theme.background.default, justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
            </View>
        );
    }

    if (!player) {
         return (
            <View style={[styles.container, { backgroundColor: theme.background.default, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: theme.text.primary }}>No se encontró tu ficha de alumno.</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background.default }]}>
             <VideoList playerId={player.id} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
