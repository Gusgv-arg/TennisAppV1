import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { usePlayerMutations } from '@/src/features/players/hooks/usePlayerMutations';
import { usePlayer } from '@/src/features/players/hooks/usePlayers';

export default function PlayerDetailScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data: player, isLoading } = usePlayer(id!);
    const { archivePlayer, unarchivePlayer } = usePlayerMutations();

    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState({
        type: 'success' as StatusType,
        title: '',
        message: '',
    });

    const handleDelete = () => {
        setModalConfig({
            type: 'warning',
            title: t('delete'),
            message: t('deleteConfirm'),
        });
        setModalVisible(true);
    };

    const handleReactivate = () => {
        setModalConfig({
            type: 'warning',
            title: t('reactivate'),
            message: t('reactivateConfirm'),
        });
        setModalVisible(true);
    };

    const confirmDelete = async () => {
        console.log('Delete confirmed for id:', id);
        try {
            await archivePlayer.mutateAsync(id!);
            console.log('Archive mutation successful');
            setModalConfig({
                type: 'success',
                title: t('delete'),
                message: t('playerDeleted'),
            });
        } catch (error: any) {
            console.error('Archive mutation failed:', error);
            setModalConfig({
                type: 'error',
                title: 'Error',
                message: error.message || t('errorOccurred'),
            });
        }
    };

    const confirmReactivate = async () => {
        console.log('Reactivate confirmed for id:', id);
        try {
            await unarchivePlayer.mutateAsync(id!);
            console.log('Reactivate mutation successful');
            setModalConfig({
                type: 'success',
                title: t('reactivate'),
                message: t('playerReactivated'),
            });
        } catch (error: any) {
            console.error('Reactivate mutation failed:', error);
            setModalConfig({
                type: 'error',
                title: 'Error',
                message: error.message || t('errorOccurred'),
            });
        }
    };

    const handleModalClose = () => {
        if (modalConfig.type === 'success') {
            setModalVisible(false);
            router.replace('/(tabs)/players');
        } else {
            setModalVisible(false);
        }
    };

    if (isLoading || !player) {
        return (
            <View style={styles.loadingContainer}>
                <Text>{t('loading')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: t('playerDetails'),
                headerRight: () => (
                    <TouchableOpacity onPress={() => router.push(`/players/edit?id=${id}`)}>
                        <Ionicons name="create-outline" size={24} color={colors.primary[500]} />
                    </TouchableOpacity>
                )
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
                </Card>

                {player.notes && (
                    <Card style={styles.notesCard} padding="md">
                        <Text style={styles.sectionTitle}>{t('notes')}</Text>
                        <Text style={styles.notesText}>{player.notes}</Text>
                    </Card>
                )}

                <Button
                    label={t('editPlayer')}
                    onPress={() => router.push(`/players/edit?id=${id}`)}
                    style={styles.editButton}
                    leftIcon={<Ionicons name="create-outline" size={20} color={colors.common.white} style={{ marginRight: spacing.sm }} />}
                />

                {!player.is_archived ? (
                    <Button
                        label={t('delete')}
                        variant="outline"
                        onPress={handleDelete}
                        style={styles.deleteButton}
                        labelStyle={{ color: colors.error[500] }}
                        leftIcon={<Ionicons name="trash-outline" size={20} color={colors.error[500]} style={{ marginRight: spacing.sm }} />}
                    />
                ) : (
                    <Button
                        label={t('reactivate')}
                        variant="primary"
                        onPress={handleReactivate}
                        style={styles.reactivateButton}
                        leftIcon={<Ionicons name="refresh-outline" size={20} color={colors.common.white} style={{ marginRight: spacing.sm }} />}
                    />
                )}
            </ScrollView>

            <StatusModal
                visible={modalVisible}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
                onClose={handleModalClose}
                onConfirm={modalConfig.type === 'warning' ? (modalConfig.title === t('delete') ? confirmDelete : confirmReactivate) : undefined}
                showCancel={modalConfig.type === 'warning'}
                cancelText={t('cancel')}
                buttonText={modalConfig.type === 'warning' ? (modalConfig.title === t('delete') ? t('delete') : t('reactivate')) : undefined}
            />
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
        marginTop: 2,
    },
    editButton: {
        marginTop: spacing.lg,
    },
    deleteButton: {
        marginTop: spacing.md,
        borderColor: colors.error[200],
    },
    reactivateButton: {
        marginTop: spacing.md,
    },
});
