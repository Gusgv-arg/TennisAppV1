import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/services/supabaseClient';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useTheme } from '@/src/hooks/useTheme';
import { Avatar } from '@/src/design/components/Avatar';
import { Card } from '@/src/design/components/Card';
import { Section } from '@/src/design/components/Section';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/src/design/theme';
import { useTranslation } from 'react-i18next';

export default function MyProfileScreen() {
    const { session } = useAuthStore();
    const { theme } = useTheme();
    const { t } = useTranslation();

    const { data: player, isLoading } = useQuery({
        queryKey: ['my-player-profile', session?.user?.id],
        queryFn: async () => {
            if (!session?.user?.id) return null;
            const { data, error } = await supabase
                .from('players')
                .select('*')
                .eq('linked_user_id', session.user.id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!session?.user?.id
    });

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background.default, justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
            </View>
        );
    }

    if (!player) {
         return (
            <View style={[styles.container, { backgroundColor: theme.background.default, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: theme.text.primary }}>No se encontró tu perfil de alumno.</Text>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.background.default }]} contentContainerStyle={{ padding: 20 }}>
            <View style={styles.header}>
                <Avatar name={player.full_name} source={player.avatar_url || undefined} size="xl" />
                <Text style={[styles.name, { color: theme.text.primary }]}>{player.full_name}</Text>
                <View style={styles.badgeContainer}>
                    <View style={[styles.badge, { backgroundColor: theme.background.surface }]}>
                        <Text style={[styles.badgeText, { color: theme.components.button.primary.bg }]}>{t(`level.${player.level || 'beginner'}`)}</Text>
                    </View>
                </View>
            </View>

            <Card style={styles.infoCard} padding="md">
                <DetailItem label={t('email')} value={player.contact_email || '-'} icon="mail-outline" theme={theme} />
                <DetailItem label={t('phone')} value={player.contact_phone || '-'} icon="call-outline" theme={theme} />
                <DetailItem
                    label={t('birthDate')}
                    value={player.birth_date ? (
                        player.birth_date.startsWith('1900-')
                            ? player.birth_date.split('-').slice(1).reverse().join('/')
                            : player.birth_date.split('-').reverse().join('/')
                    ) : '-'}
                    icon="calendar-outline"
                    theme={theme}
                />
                <DetailItem label={t('dominantHand')} value={t(`hand.${player.dominant_hand || 'right'}`)} icon="hand-right-outline" theme={theme} />
            </Card>

            {player.notes && (
                <Card style={styles.notesCard} padding="md">
                    <Section title={t('notes')} noMargin>
                        <Text style={{ color: theme.text.secondary }}>{player.notes}</Text>
                    </Section>
                </Card>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 10,
    },
    name: {
        fontSize: 24,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 8,
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    infoCard: {
        marginBottom: 16,
    },
    notesCard: {
        marginBottom: 24,
    }
});

const DetailItem = ({ label, value, icon, theme }: { label: string; value: string; icon: any, theme: Theme }) => (
    <View style={dStyles.detailRow}>
        <View style={[dStyles.iconContainer, { backgroundColor: theme.components.button.secondary.bg }]}>
            <Ionicons name={icon} size={20} color={theme.components.button.primary.bg} />
        </View>
        <View style={dStyles.detailContent}>
            <Text style={[dStyles.detailLabel, { color: theme.text.secondary }]}>{label}</Text>
            <Text style={[dStyles.detailValue, { color: theme.text.primary }]}>{value}</Text>
        </View>
    </View>
);

const dStyles = StyleSheet.create({
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    detailContent: { flex: 1 },
    detailLabel: { fontSize: 13, marginBottom: 4 },
    detailValue: { fontSize: 16, fontWeight: '500' },
});
