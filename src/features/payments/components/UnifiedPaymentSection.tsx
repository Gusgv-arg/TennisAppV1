import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
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
        <Card style={styles.card} padding="md">
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Ionicons name="people" size={18} color={colors.primary[600]} />
                    <Text style={styles.sectionTitle}>Pago Unificado</Text>
                </View>
                {!hasGroup && (
                    <TouchableOpacity onPress={() => setModalVisible(true)}>
                        <Text style={styles.actionLink}>+ Vincular</Text>
                    </TouchableOpacity>
                )}
            </View>

            {isLoading ? (
                <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : hasGroup && group ? (
                <View style={styles.groupInfo}>
                    <View style={styles.groupHeader}>
                        <View style={styles.groupNameRow}>
                            <Ionicons name="wallet" size={18} color={colors.success[500]} />
                            <Text style={styles.groupName}>{group.name}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={handleRemoveFromGroup}
                            style={styles.removeButton}
                            disabled={removeMemberFromGroup.isPending}
                        >
                            {removeMemberFromGroup.isPending ? (
                                <ActivityIndicator size="small" color={colors.error[400]} />
                            ) : (
                                <Ionicons name="close-circle-outline" size={20} color={colors.error[400]} />
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
                                            color={member.id === playerId ? colors.primary[600] : colors.neutral[500]}
                                        />
                                        <Text style={[
                                            styles.memberName,
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
                        <Text style={styles.contactInfo}>
                            Responsable: {group.contact_name}
                        </Text>
                    )}
                </View>
            ) : (
                <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={24} color={colors.neutral[400]} />
                    <Text style={styles.emptyText}>
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
    );
}

const styles = StyleSheet.create({
    card: {
        marginTop: spacing.md,
        marginHorizontal: spacing.xs,
        backgroundColor: colors.common.white,
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
        color: colors.neutral[700],
    },
    actionLink: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.primary[500],
    },
    groupInfo: {
        backgroundColor: colors.primary[50],
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
        color: colors.neutral[900],
    },
    removeButton: {
        padding: spacing.xs,
    },
    membersContainer: {
        marginTop: spacing.sm,
    },
    membersLabel: {
        fontSize: typography.size.xs,
        color: colors.neutral[600],
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
        backgroundColor: colors.common.white,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    memberName: {
        fontSize: typography.size.xs,
        color: colors.neutral[600],
    },
    currentMember: {
        fontWeight: '600',
        color: colors.primary[600],
    },
    contactInfo: {
        marginTop: spacing.sm,
        fontSize: typography.size.xs,
        color: colors.neutral[500],
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.neutral[50],
        borderRadius: 8,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: colors.neutral[300],
    },
    emptyText: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.sm,
    },
    linkButton: {
        backgroundColor: colors.primary[500],
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 8,
    },
    linkButtonText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: colors.common.white,
    },
});
