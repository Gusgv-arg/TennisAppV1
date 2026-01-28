import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Avatar } from '@/src/design/components/Avatar';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';
import { useSubscriptions } from '@/src/features/payments/hooks/useSubscriptions';
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
    const { isEnabled: paymentsEnabled } = usePaymentSettings();
    const { subscriptions, isLoading: isLoadingSub } = useSubscriptions(id);





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
                <View style={styles.formWrapper}>
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

                    {/* Sección de Pagos y Suscripciones */}
                    {paymentsEnabled && (
                        <Card style={styles.paymentsCard} padding="md">
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Suscripciones</Text>
                            </View>

                            {isLoadingSub ? (
                                <ActivityIndicator size="small" color={colors.primary[500]} />
                            ) : subscriptions && subscriptions.length > 0 ? (
                                <View style={styles.subscriptionsList}>
                                    {subscriptions.map((sub) => (
                                        <View key={sub.id} style={styles.subscriptionInfo}>
                                            <View style={styles.planHeaderRow}>
                                                <View style={styles.planStatus}>
                                                    <Ionicons name="checkmark-circle" size={20} color={colors.success[500]} />
                                                    <Text style={styles.planName}>{sub.plan?.name}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.planDetails}>
                                                {sub.plan?.type === 'monthly' ? 'Plan Mensual' : `Promoción de ${sub.plan?.package_classes} clases`}
                                                {sub.custom_amount && ` • $${sub.custom_amount}`}
                                            </Text>
                                            {sub.notes && (
                                                <Text style={styles.planNotes}>{sub.notes}</Text>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.emptyPlan}>
                                    <Text style={styles.emptyPlanText}>Sin planes asignados</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.historyLink}
                                onPress={() => {
                                    // If player belongs to unified payment group, show group history
                                    // Otherwise show individual history
                                    if (player.unified_payment_group_id) {
                                        router.push({
                                            pathname: '/payments',
                                            params: {
                                                unifiedGroupId: player.unified_payment_group_id,
                                                playerId: player.id
                                            }
                                        });
                                    } else {
                                        router.push({
                                            pathname: '/payments',
                                            params: {
                                                search: player.full_name,
                                                playerId: player.id
                                            }
                                        });
                                    }
                                }}
                            >
                                <Text style={styles.historyLinkText}>Ver Historial de Pagos</Text>
                                <Ionicons name="arrow-forward" size={16} color={colors.primary[500]} />
                            </TouchableOpacity>
                        </Card>
                    )}
                </View>
            </ScrollView>

        </View >
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
    formWrapper: {
        flex: 1,
        width: '100%',
        alignSelf: 'center',
        maxWidth: Platform.OS === 'web' ? 800 : '100%',
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
    paymentsCard: {
        marginBottom: spacing.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    editLink: {
        color: colors.primary[500],
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    subscriptionInfo: {
        backgroundColor: colors.primary[50],
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.sm,
    },
    subscriptionsList: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    planHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    cancelButton: {
        padding: spacing.xs,
    },
    planStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: 4,
    },
    planName: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    planDetails: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
    },
    planNotes: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        fontStyle: 'italic',
        marginTop: spacing.xs,
    },
    emptyPlan: {
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    emptyPlanText: {
        color: colors.neutral[400],
        fontSize: typography.size.sm,
    },
    historyLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[100],
        gap: spacing.xs,
    },
    historyLinkText: {
        color: colors.primary[500],
        fontSize: typography.size.sm,
        fontWeight: '600',
    },

});
