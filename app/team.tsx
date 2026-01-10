import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Modal, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMembers, useCurrentAcademy } from '@/src/features/academy/hooks/useAcademy';
import { useMemberMutations, usePendingInvitations } from '@/src/features/academy/hooks/useMembers';
import { getRoleColor, getRoleDisplayName, usePermissions } from '@/src/hooks/usePermissions';
import { AcademyMember } from '@/src/types/academy';

type Tab = 'members' | 'invitations';

export default function TeamScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { isOwner } = usePermissions();
    const { data: academy } = useCurrentAcademy();
    const { data: members, isLoading: loadingMembers, refetch: refetchMembers } = useAcademyMembers();

    const pendingInvitationsConfig = usePendingInvitations();
    const { data: invitations, isLoading: loadingInvitations, refetch: refetchInvitations } = useQuery(pendingInvitationsConfig);

    const { inviteMember, removeMember, cancelInvitation } = useMemberMutations();

    const [activeTab, setActiveTab] = useState<Tab>('members');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'coach' | 'assistant' | 'viewer'>('coach');
    const [inviteError, setInviteError] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Delete confirmation state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'member' | 'invitation', id: string, name: string } | null>(null);

    const handleRefresh = () => {
        refetchMembers();
        refetchInvitations();
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim()) {
            setInviteError('El email es requerido');
            return;
        }

        if (!inviteEmail.includes('@')) {
            setInviteError('Ingresá un email válido');
            return;
        }

        setInviteError('');

        try {
            await inviteMember.mutateAsync({
                email: inviteEmail.trim(),
                role: inviteRole,
            });

            setShowInviteModal(false);
            setInviteEmail('');
            setInviteRole('coach');
            setSuccessMessage(`Invitación enviada a ${inviteEmail}`);
            setShowSuccess(true);
        } catch (err: any) {
            setInviteError(err.message || 'Error al enviar invitación');
        }
    };

    const handleRemoveMember = (member: AcademyMember) => {
        if (member.role === 'owner') {
            return; // Can't remove owner
        }
        const user = (member as any).user;
        setDeleteTarget({
            type: 'member',
            id: member.id,
            name: user?.full_name || user?.email || 'este miembro'
        });
        setShowDeleteModal(true);
    };

    const handleCancelInvitation = (invitationId: string, email: string) => {
        setDeleteTarget({
            type: 'invitation',
            id: invitationId,
            name: email
        });
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;

        try {
            if (deleteTarget.type === 'member') {
                await removeMember.mutateAsync(deleteTarget.id);
            } else {
                await cancelInvitation.mutateAsync(deleteTarget.id);
            }
            setShowDeleteModal(false);
            setDeleteTarget(null);
        } catch (error) {
            console.error('Error deleting:', error);
        }
    };

    const renderMember = ({ item }: { item: AcademyMember }) => {
        const user = (item as any).user;
        const roleColors = getRoleColor(item.role);

        return (
            <Card style={styles.memberCard} padding="md">
                <View style={styles.memberRow}>
                    <Avatar
                        name={user?.full_name || user?.email || '?'}
                        source={user?.avatar_url}
                        size="md"
                    />
                    <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                            {user?.full_name || user?.email}
                        </Text>
                        {user?.full_name && (
                            <Text style={styles.memberEmail}>{user?.email}</Text>
                        )}
                        <View style={[styles.roleBadge, { backgroundColor: roleColors.bg }]}>
                            <Text style={[styles.roleText, { color: roleColors.text }]}>
                                {getRoleDisplayName(item.role)}
                            </Text>
                        </View>
                    </View>

                    {isOwner && item.role !== 'owner' && (
                        <TouchableOpacity
                            style={styles.removeBtn}
                            onPress={() => handleRemoveMember(item)}
                        >
                            <Ionicons name="close-circle" size={24} color={colors.error[400]} />
                        </TouchableOpacity>
                    )}
                </View>
            </Card>
        );
    };

    const renderInvitation = ({ item }: { item: any }) => {
        const roleColors = getRoleColor(item.role);
        const isExpired = new Date(item.expires_at) < new Date();

        return (
            <Card style={styles.memberCard} padding="md">
                <View style={styles.memberRow}>
                    <View style={styles.inviteIcon}>
                        <Ionicons name="mail" size={24} color={colors.neutral[400]} />
                    </View>
                    <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{item.email}</Text>
                        <View style={[styles.roleBadge, { backgroundColor: roleColors.bg }]}>
                            <Text style={[styles.roleText, { color: roleColors.text }]}>
                                {getRoleDisplayName(item.role)}
                            </Text>
                        </View>
                        {isExpired ? (
                            <Text style={styles.expiredText}>Expirada</Text>
                        ) : (
                            <Text style={styles.pendingText}>Pendiente</Text>
                        )}
                    </View>

                    {isOwner && (
                        <TouchableOpacity
                            style={styles.removeBtn}
                            onPress={() => handleCancelInvitation(item.id, item.email)}
                        >
                            <Ionicons name="trash-outline" size={20} color={colors.error[400]} />
                        </TouchableOpacity>
                    )}
                </View>
            </Card>
        );
    };

    const isLoading = activeTab === 'members' ? loadingMembers : loadingInvitations;
    const data = activeTab === 'members' ? members : invitations;

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="people" size={24} color={colors.primary[500]} />
                            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.neutral[900] }}>Equipo</Text>
                        </View>
                    ),
                    headerTitleAlign: 'center',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginLeft: spacing.sm }}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.neutral[900]} />
                        </TouchableOpacity>
                    ),
                    headerRight: isOwner ? () => (
                        <TouchableOpacity
                            onPress={() => setShowInviteModal(true)}
                            style={{ marginRight: spacing.md }}
                        >
                            <Ionicons name="person-add" size={24} color={colors.primary[500]} />
                        </TouchableOpacity>
                    ) : undefined,
                }}
            />

            {/* Academy Info */}
            <View style={styles.academyHeader}>
                <View style={styles.academyIcon}>
                    <Ionicons name="school" size={32} color={colors.primary[500]} />
                </View>
                <Text style={styles.academyName}>{academy?.name}</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'members' && styles.activeTab]}
                    onPress={() => setActiveTab('members')}
                >
                    <Text style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>
                        Miembros ({members?.length || 0})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'invitations' && styles.activeTab]}
                    onPress={() => setActiveTab('invitations')}
                >
                    <Text style={[styles.tabText, activeTab === 'invitations' && styles.activeTabText]}>
                        Invitaciones ({invitations?.length || 0})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* List */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary[500]} />
                </View>
            ) : (
                <FlatList
                    data={data as any[]}
                    keyExtractor={(item) => item.id}
                    renderItem={activeTab === 'members' ? renderMember : renderInvitation}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={false} onRefresh={handleRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons
                                name={activeTab === 'members' ? 'people-outline' : 'mail-outline'}
                                size={64}
                                color={colors.neutral[300]}
                            />
                            <Text style={styles.emptyText}>
                                {activeTab === 'members'
                                    ? 'No hay miembros'
                                    : 'No hay invitaciones pendientes'}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Invite Modal */}
            <Modal
                visible={showInviteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowInviteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Invitar miembro</Text>

                        <Input
                            label="Email"
                            placeholder="email@ejemplo.com"
                            value={inviteEmail}
                            onChangeText={(text) => {
                                setInviteEmail(text);
                                setInviteError('');
                            }}
                            error={inviteError}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <Text style={styles.roleLabel}>Rol:</Text>
                        <View style={styles.roleOptions}>
                            {(['coach', 'assistant', 'viewer'] as const).map((role) => (
                                <TouchableOpacity
                                    key={role}
                                    style={[
                                        styles.roleOption,
                                        inviteRole === role && styles.roleOptionActive,
                                    ]}
                                    onPress={() => setInviteRole(role)}
                                >
                                    <Text style={[
                                        styles.roleOptionText,
                                        inviteRole === role && styles.roleOptionTextActive,
                                    ]}>
                                        {getRoleDisplayName(role)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    setShowInviteModal(false);
                                    setInviteEmail('');
                                    setInviteError('');
                                }}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={handleInvite}
                            >
                                <Text style={styles.confirmButtonText}>Enviar invitación</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDeleteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.deleteIconContainer}>
                            <Ionicons name="warning" size={48} color={colors.error[500]} />
                        </View>
                        <Text style={styles.modalTitle}>
                            {deleteTarget?.type === 'member' ? 'Eliminar miembro' : 'Cancelar invitación'}
                        </Text>
                        <Text style={styles.deleteMessage}>
                            {deleteTarget?.type === 'member'
                                ? `¿Estás seguro de eliminar a ${deleteTarget?.name}?`
                                : `¿Cancelar la invitación a ${deleteTarget?.name}?`}
                        </Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    setShowDeleteModal(false);
                                    setDeleteTarget(null);
                                }}
                            >
                                <Text style={styles.cancelButtonText}>No, volver</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmButton, { backgroundColor: colors.error[500] }]}
                                onPress={handleConfirmDelete}
                            >
                                <Text style={styles.confirmButtonText}>Sí, eliminar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Success Modal */}
            <StatusModal
                visible={showSuccess}
                type="success"
                title="¡Invitación enviada!"
                message={successMessage}
                onClose={() => setShowSuccess(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    academyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.common.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
    },
    academyIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    academyName: {
        fontSize: typography.size.lg,
        fontWeight: '600',
        color: colors.neutral[900],
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: colors.common.white,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
        paddingBottom: spacing.sm,
    },
    tab: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: colors.neutral[100],
    },
    activeTab: {
        backgroundColor: colors.primary[500],
    },
    tabText: {
        fontSize: typography.size.sm,
        fontWeight: '500',
        color: colors.neutral[600],
    },
    activeTabText: {
        color: colors.common.white,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: spacing.md,
    },
    memberCard: {
        marginBottom: spacing.sm,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    memberInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    memberName: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[900],
    },
    memberEmail: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        marginBottom: 4,
    },
    roleBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
    },
    roleText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
    },
    removeBtn: {
        padding: spacing.xs,
    },
    inviteIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.neutral[100],
        justifyContent: 'center',
        alignItems: 'center',
    },
    pendingText: {
        fontSize: typography.size.xs,
        color: colors.warning[500],
        marginTop: 4,
    },
    expiredText: {
        fontSize: typography.size.xs,
        color: colors.error[500],
        marginTop: 4,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyText: {
        marginTop: spacing.md,
        fontSize: typography.size.md,
        color: colors.neutral[500],
    },
    inviteForm: {
        width: '100%',
        paddingTop: spacing.md,
    },
    roleLabel: {
        fontSize: typography.size.sm,
        fontWeight: '500',
        color: colors.neutral[700],
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    roleOptions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    roleOption: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: colors.neutral[100],
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    roleOptionActive: {
        backgroundColor: colors.primary[50],
        borderColor: colors.primary[500],
    },
    roleOptionText: {
        fontSize: typography.size.sm,
        fontWeight: '500',
        color: colors.neutral[600],
    },
    roleOptionTextActive: {
        color: colors.primary[700],
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContent: {
        backgroundColor: colors.common.white,
        borderRadius: 20,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.lg,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: colors.neutral[100],
    },
    cancelButtonText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[600],
    },
    confirmButton: {
        flex: 1,
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: colors.primary[500],
    },
    confirmButtonText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.common.white,
    },
    deleteIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.error[50],
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: spacing.md,
    },
    deleteMessage: {
        fontSize: typography.size.md,
        color: colors.neutral[600],
        textAlign: 'center',
        marginBottom: spacing.md,
    },
});
