import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Card } from '@/src/design/components/Card';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
import { Player } from '@/src/types/player';
import { useUnifiedPaymentGroup, useUnifiedPaymentGroupMutations } from '../hooks/useUnifiedPaymentGroups';
import UnifiedPaymentModal from './UnifiedPaymentModal';

interface UnifiedPaymentSectionProps {
    player: Player;
    playerId: string;
}

/**
 * Sección de Pago Unificado para el perfil del alumno
 * Permite vincular/desvincular el alumno de un grupo de pago unificado
 */
export default function UnifiedPaymentSection({ player, playerId }: UnifiedPaymentSectionProps) {
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const [modalVisible, setModalVisible] = useState(false);

    const { data: group, isLoading } = useUnifiedPaymentGroup(player.unified_payment_group_id || undefined);
    const { removeMemberFromGroup } = useUnifiedPaymentGroupMutations();

    const hasGroup = !!player.unified_payment_group_id;

    const handleRemoveFromGroup = async () => {
        try {
            await removeMemberFromGroup.mutateAsync(playerId);
        } catch (error) {
            console.error('Error removing from group:', error);
        }
    };

    return (
        <View style={{ marginTop: spacing.lg }}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Ionicons name="wallet-outline" size={18} color={theme.text.secondary} />
                    <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>Pago Unificado</Text>
                </View>
            </View>

            <Card style={styles.card} padding="md">
                {isLoading ? (
                    <ActivityIndicator size="small" color={theme.components.button.primary.bg} />
                ) : hasGroup && group ? (
                    <View style={styles.groupInfo}>
                        <View style={styles.groupHeader}>
                            <View style={styles.groupNameRow}>
                                <Ionicons name="wallet" size={18} color={theme.status.success} />
                                <Text style={[styles.groupName, { color: theme.text.primary }]}>{group.name}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={handleRemoveFromGroup}
                                style={styles.removeButton}
                                disabled={removeMemberFromGroup.isPending}
                            >
                                {removeMemberFromGroup.isPending ? (
                                    <ActivityIndicator size="small" color={theme.status.error} />
                                ) : (
                                    <Ionicons name="close-circle-outline" size={20} color={theme.status.error} />
                                )}
                            </TouchableOpacity>
                        </View>

                        {group.members && group.members.length > 0 && (
                            <View style={styles.membersContainer}>
                                <Text style={styles.membersLabel}>
                                    Miembros del grupo ({group.members.length}):
                                </Text>
                                <View style={styles.membersList}>
                                    {group.members.map((member) => (
                                        <View key={member.id} style={styles.memberBadge}>
                                            <Ionicons
                                                name={member.id === playerId ? "person" : "person-outline"}
                                                size={12}
                                                color={member.id === playerId ? theme.components.button.primary.bg : theme.text.secondary}
                                            />
                                            <Text style={[
                                                styles.memberName,
                                                { color: theme.text.secondary },
                                                member.id === playerId && styles.currentMember
                                            ]}>
                                                {member.full_name}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {group.contact_name && (
                            <Text style={[styles.contactInfo, { color: theme.text.secondary }]}>
                                Responsable: {group.contact_name}
                            </Text>
                        )}
                    </View>
                ) : (
                    <View style={[styles.emptyState, { backgroundColor: theme.background.surface, borderColor: theme.border.default }]}>
                        <Ionicons name="people-outline" size={24} color={theme.text.tertiary || theme.text.secondary} />
                        <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
                            Este alumno no está vinculado a ningún grupo de pago unificado
                        </Text>
                        <TouchableOpacity
                            style={styles.linkButton}
                            onPress={() => setModalVisible(true)}
                        >
                            <Text style={styles.linkButtonText}>Vincular a grupo</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <UnifiedPaymentModal
                    visible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    playerId={playerId}
                    playerName={player.full_name}
                />
            </Card>
        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    card: {
        marginHorizontal: spacing.xs,
        backgroundColor: theme.background.surface,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    sectionTitle: {
        fontSize: typography.size.sm,
        fontWeight: '700',
    },
    actionLink: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: theme.components.button.primary.bg,
    },
    groupInfo: {
        backgroundColor: theme.components.button.primary.bg + '10',
        padding: spacing.md,
        borderRadius: 12,
    },
    groupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    groupNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    groupName: {
        fontSize: typography.size.sm,
        fontWeight: '700',
    },
    removeButton: {
        padding: spacing.xs,
    },
    membersContainer: {
        marginTop: spacing.sm,
    },
    membersLabel: {
        fontSize: typography.size.xs,
        marginBottom: spacing.xs,
    },
    membersList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    memberBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: theme.background.surface,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border.subtle,
    },
    memberName: {
        fontSize: typography.size.xs,
    },
    currentMember: {
        fontWeight: '600',
        color: theme.components.button.primary.bg,
    },
    contactInfo: {
        marginTop: spacing.sm,
        fontSize: typography.size.xs,
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: 8,
        borderStyle: 'dashed',
        borderWidth: 1,
    },
    emptyText: {
        fontSize: typography.size.xs,
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.sm,
    },
    linkButton: {
        backgroundColor: theme.components.button.primary.bg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 8,
    },
    linkButtonText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: 'white',
    },
});
