import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/src/design/components/Avatar';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { usePlayerMutations } from '@/src/features/players/hooks/usePlayerMutations';
import { usePlayer } from '@/src/features/players/hooks/usePlayers';
import { useAuthStore } from '@/src/store/useAuthStore';

export default function PlayerDetailScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data: player, isLoading } = usePlayer(id!);
    const { profile } = useAuthStore();
    const { updatePlayer } = usePlayerMutations();
    const isAdmin = profile?.role === 'admin';

    if (isLoading || !player) {
        return (
            <View style={styles.loadingContainer}>
                <Text>{t('loading')}</Text>
            </View>
        );
    }

    const handleRoleChange = (newRole: 'coach' | 'collaborator' | 'player') => {
        if (newRole === (player.intended_role || 'player')) return;

        Alert.alert(
            t('role'),
            t('admin.confirmRoleChange'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('confirm'),
                    onPress: async () => {
                        try {
                            await updatePlayer.mutateAsync({
                                id: player.id,
                                input: { intended_role: newRole } as any,
                            });
                            Alert.alert(t('success'), t('admin.roleChanged'));
                        } catch (error: any) {
                            Alert.alert(t('error'), error.message);
                        }
                    },
                },
            ]
        );
    };

    const currentRole = player.intended_role || 'player';

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: t('playerDetails'),
            }} />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Avatar name={player.full_name} source={player.avatar_url || undefined} size="lg" />
                    <Text style={styles.name}>{player.full_name}</Text>
                    <View style={styles.badgeContainer}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{t(`level.${player.level || 'beginner'}`)}</Text>
                        </View>
                        {player.is_archived && (
                            <View style={[styles.badge, styles.archivedBadge]}>
                                <Text style={styles.archivedBadgeText}>{t('archived')}</Text>
                            </View>
                        )}
                    </View>
                </View>

                <Card style={styles.infoCard} padding="md">
                    <DetailItem label={t('email')} value={player.contact_email || '-'} icon="mail-outline" />
                    <DetailItem label={t('phone')} value={player.contact_phone || '-'} icon="call-outline" />
                    <DetailItem
                        label={t('birthDate')}
                        value={player.birth_date ? (
                            player.birth_date.startsWith('1900-')
                                ? player.birth_date.split('-').slice(1).reverse().join('/')
                                : player.birth_date.split('-').reverse().join('/')
                        ) : '-'}
                        icon="calendar-outline"
                    />
                    <DetailItem label={t('dominantHand')} value={t(`hand.${player.dominant_hand || 'right'}`)} icon="hand-right-outline" />
                    {/* Role - Always read only in view mode */}
                    <DetailItem label={t('role')} value={t(`roles.${currentRole}`)} icon="shield-outline" />
                </Card>

                {player.notes && (
                    <Card style={styles.notesCard} padding="md">
                        <Text style={styles.sectionTitle}>{t('notes')}</Text>
                        <Text style={styles.notesText}>{player.notes}</Text>
                    </Card>
                )}
            </ScrollView>
        </View>
    );
}

const DetailItem = ({ label, value, icon }: { label: string; value: string; icon: any }) => (
    <View style={styles.detailItem}>
        <View style={styles.iconContainer}>
            <Ionicons name={icon} size={20} color={colors.primary[500]} />
        </View>
        <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: spacing.md,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.lg,
        marginTop: spacing.sm,
    },
    name: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
        marginTop: spacing.md,
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    badge: {
        backgroundColor: colors.primary[100],
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 20,
    },
    archivedBadge: {
        backgroundColor: colors.neutral[200],
    },
    badgeText: {
        color: colors.primary[700],
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    archivedBadgeText: {
        color: colors.neutral[600],
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    infoCard: {
        marginBottom: spacing.md,
    },
    notesCard: {
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[500],
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
    },
    notesText: {
        fontSize: typography.size.md,
        color: colors.neutral[800],
        lineHeight: 22,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    detailContent: {
        flex: 1,
    },
    detailLabel: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        fontWeight: '500',
    },
    detailValue: {
        fontSize: typography.size.md,
        color: colors.neutral[900],
        fontWeight: '600',
    },
    roleEditItem: {
        paddingVertical: spacing.sm,
    },
    roleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    roleButtons: {
        flexDirection: 'row',
        gap: spacing.xs,
        marginLeft: 40 + spacing.md, // Align with other content
    },
    roleButton: {
        flex: 1,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: 8,
        backgroundColor: colors.neutral[100],
        borderWidth: 1,
        borderColor: colors.neutral[300],
        alignItems: 'center',
    },
    roleButtonActive: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    roleButtonText: {
        fontSize: typography.size.xs,
        color: colors.neutral[700],
        fontWeight: '500',
    },
    roleButtonTextActive: {
        color: colors.common.white,
        fontWeight: '700',
    },
});
