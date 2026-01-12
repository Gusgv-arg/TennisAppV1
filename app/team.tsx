import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMembers, useArchivedAcademyMembers, useCurrentAcademy } from '@/src/features/academy/hooks/useAcademy';
import { useMemberMutations, usePendingInvitations } from '@/src/features/academy/hooks/useMembers';
import { getRoleColor, getRoleDisplayName, usePermissions } from '@/src/hooks/usePermissions';
import { AcademyMember } from '@/src/types/academy';

type Tab = 'members' | 'invitations' | 'archived';

export default function TeamScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { isOwner } = usePermissions();
    const { data: academy } = useCurrentAcademy();
    const { data: members, isLoading: loadingMembers, refetch: refetchMembers } = useAcademyMembers();

    const pendingInvitationsConfig = usePendingInvitations();
    const { data: invitations, isLoading: loadingInvitations, refetch: refetchInvitations } = useQuery(pendingInvitationsConfig);
    const { data: archivedMembers, isLoading: loadingArchived, refetch: refetchArchived } = useArchivedAcademyMembers();

    const { inviteMember, updateMember, removeMember, restoreMember, cancelInvitation, resendInvitation } = useMemberMutations();

    const [activeTab, setActiveTab] = useState<Tab>('members');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'owner' | 'coach' | 'assistant' | 'viewer'>('coach');
    const [inviteError, setInviteError] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [successTitle, setSuccessTitle] = useState('¡Listo!');
    const [successMessage, setSuccessMessage] = useState('');

    // Delete confirmation state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editTarget, setEditTarget] = useState<{ id: string, name: string, role: string } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'member' | 'invitation', id: string, name: string } | null>(null);

    const handleRefresh = () => {
        refetchMembers();
        refetchInvitations();
        refetchArchived();
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
            setSuccessTitle('¡Invitación enviada!');
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



    const handleUpdateRole = async (newRole: 'owner' | 'coach' | 'assistant') => {
        if (!editTarget) return;

        // Validation: If current role is owner and changing to non-owner, 
        // check if there's at least one other owner
        if (editTarget.role === 'owner' && newRole !== 'owner') {
            const ownerCount = members?.filter(m => m.role === 'owner' && m.is_active).length || 0;
            if (ownerCount <= 1) {
                Alert.alert(
                    'No podés dejar de ser dueño',
                    'Debe haber al menos un dueño en la academia. Primero asigná a otro miembro como dueño.',
                    [{ text: 'Entendido' }]
                );
                return;
            }
        }

        try {
            await updateMember.mutateAsync({
                memberId: editTarget.id,
                role: newRole
            });
            setSuccessTitle('¡Rol actualizado!');
            setShowSuccess(true);
            setSuccessMessage(`Rol actualizado a ${getRoleDisplayName(newRole)}`);
            setEditTarget(null);
        } catch (error) {
            console.error('Error updating role:', error);
        }
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
                            {user?.full_name || user?.email || 'Sin nombre'}
                        </Text>
                        <View style={styles.memberSecondLine}>
                            <Text style={styles.memberEmail}>
                                {user?.full_name ? user?.email : ' '}
                            </Text>
                            <View style={[styles.roleBadge, { backgroundColor: roleColors.bg }]}>
                                <Text style={[styles.roleText, { color: roleColors.text }]}>
                                    {getRoleDisplayName(item.role)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Edit button for all members (owners can edit themselves) */}
                    {isOwner && (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                style={[styles.removeBtn, { backgroundColor: colors.primary[50] }]}
                                onPress={() => setEditTarget({
                                    id: item.id,
                                    name: user?.full_name || user?.email,
                                    role: item.role
                                })}
                            >
                                <Ionicons name="create-outline" size={20} color={colors.primary[500]} />
                            </TouchableOpacity>
                            {/* Delete button only for non-owners */}
                            {item.role !== 'owner' && (
                                <TouchableOpacity
                                    style={styles.removeBtn}
                                    onPress={() => handleRemoveMember(item)}
                                >
                                    <Ionicons name="trash-outline" size={20} color={colors.error[400]} />
                                </TouchableOpacity>
                            )}
                        </View>
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
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    {/* Column 1: Icon */}
                    <View style={[styles.inviteIcon, { marginRight: 12 }]}>
                        <Ionicons name="mail" size={24} color={colors.neutral[400]} />
                    </View>

                    {/* Column 2: Content */}
                    <View style={{ flex: 1 }}>
                        {/* Row 1: Email */}
                        <Text
                            style={[styles.memberName, { marginBottom: 2 }]} // Tight spacing
                            numberOfLines={2}
                            adjustsFontSizeToFit={false}
                        >
                            {item.email}
                        </Text>

                        {/* Row 2: Metadata + Actions */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            {/* Left: Role & Status */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[styles.roleBadge, { backgroundColor: roleColors.bg, marginTop: 0 }]}>
                                    <Text style={[styles.roleText, { color: roleColors.text }]}>
                                        {getRoleDisplayName(item.role)}
                                    </Text>
                                </View>
                                {isExpired ? (
                                    <Text style={[styles.expiredText, { marginTop: 0 }]}>Expirada</Text>
                                ) : (
                                    <Text style={[styles.pendingText, { marginTop: 0 }]}>Pendiente</Text>
                                )}
                            </View>

                            {/* Right: Actions */}
                            {isOwner && (
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                        style={[styles.removeBtn, { backgroundColor: colors.primary[50], padding: 4 }]}
                                        onPress={async () => {
                                            try {
                                                await resendInvitation.mutateAsync(item.id);
                                                setSuccessMessage(`Se reenvió la invitación a ${item.email}`);
                                                setShowSuccess(true);
                                            } catch (error) {
                                                Alert.alert('Error', 'No se pudo reenviar la invitación');
                                            }
                                        }}
                                    >
                                        <Ionicons name="refresh-outline" size={18} color={colors.primary[500]} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.removeBtn, { padding: 4 }]}
                                        onPress={() => handleCancelInvitation(item.id, item.email)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={colors.error[400]} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

    // Render archived member card
    const renderArchivedMember = ({ item }: { item: AcademyMember }) => {
        const user = (item as any).user;
        const roleColors = getRoleColor(item.role);

        return (
            <Card style={{ ...styles.memberCard, opacity: 0.8 }} padding="md">
                <View style={styles.memberRow}>
                    <Avatar
                        name={user?.full_name || user?.email || '?'}
                        source={user?.avatar_url}
                        size="md"
                    />
                    <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                            {user?.full_name || user?.email || 'Sin nombre'}
                        </Text>
                        <View style={styles.memberSecondLine}>
                            <Text style={styles.memberEmail}>
                                {user?.full_name ? user?.email : ' '}
                            </Text>
                            <View style={[styles.roleBadge, { backgroundColor: roleColors.bg }]}>
                                <Text style={[styles.roleText, { color: roleColors.text }]}>
                                    {getRoleDisplayName(item.role)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {isOwner && (
                        <TouchableOpacity
                            style={[styles.removeBtn, { backgroundColor: colors.success[50] }]}
                            onPress={async () => {
                                try {
                                    await restoreMember.mutateAsync(item.id);
                                    setSuccessTitle('¡Miembro restaurado!');
                                    setSuccessMessage(`${user?.full_name || user?.email} fue reactivado`);
                                    setShowSuccess(true);
                                } catch (error) {
                                    console.error('Error restoring member:', error);
                                }
                            }}
                        >
                            <Ionicons name="refresh-outline" size={20} color={colors.success[500]} />
                        </TouchableOpacity>
                    )}
                </View>
            </Card>
        );
    };

    const isLoading = activeTab === 'members' ? loadingMembers : activeTab === 'invitations' ? loadingInvitations : loadingArchived;
    const data = activeTab === 'members' ? members : activeTab === 'invitations' ? invitations : archivedMembers;
    const renderItem = activeTab === 'members' ? renderMember : activeTab === 'invitations' ? renderInvitation : renderArchivedMember;

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

                }}
            />

            {/* Academy Info */}
            {/* Subtitle & Actions */}
            <View style={[styles.academyHeader, { flexDirection: 'column', alignItems: 'stretch', gap: spacing.sm, paddingRight: spacing.md }]}>
                <Text style={{ fontSize: 13, color: colors.neutral[500] }}>
                    Creá y administrá los miembros de tu Academia
                </Text>

                {isOwner && (
                    <View style={{ alignItems: 'flex-end' }}>
                        <TouchableOpacity
                            onPress={() => setShowInviteModal(true)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: colors.primary[500],
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 20,
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                                <Ionicons name="add" size={18} color="white" style={{ marginRight: 2, fontWeight: 'bold' }} />
                                <Ionicons name="person" size={16} color="white" />
                            </View>
                            <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>Invitar</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Filter Tabs (pill style with horizontal scroll) */}
            <View style={styles.filterContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterTabsContent}
                >
                    <TouchableOpacity
                        style={[styles.filterTab, activeTab === 'members' && styles.activeFilterTab]}
                        onPress={() => setActiveTab('members')}
                    >
                        <Ionicons
                            name="people"
                            size={16}
                            color={activeTab === 'members' ? colors.common.white : colors.neutral[400]}
                        />
                        <Text style={[styles.filterTabText, activeTab === 'members' && styles.activeFilterTabText]}>
                            Miembros
                        </Text>
                        {(members?.length || 0) > 0 && (
                            <View style={[styles.countBadge, activeTab === 'members' && styles.activeBadge]}>
                                <Text style={[styles.countBadgeText, activeTab === 'members' && styles.activeBadgeText]}>
                                    {members?.length || 0}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterTab, activeTab === 'invitations' && styles.activeFilterTab]}
                        onPress={() => setActiveTab('invitations')}
                    >
                        <Ionicons
                            name="mail"
                            size={16}
                            color={activeTab === 'invitations' ? colors.common.white : colors.neutral[400]}
                        />
                        <Text style={[styles.filterTabText, activeTab === 'invitations' && styles.activeFilterTabText]}>
                            Invitaciones
                        </Text>
                        {(invitations?.length || 0) > 0 && (
                            <View style={[styles.countBadge, activeTab === 'invitations' && styles.activeBadge]}>
                                <Text style={[styles.countBadgeText, activeTab === 'invitations' && styles.activeBadgeText]}>
                                    {invitations?.length || 0}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterTab, activeTab === 'archived' && styles.activeFilterTab]}
                        onPress={() => setActiveTab('archived')}
                    >
                        <Ionicons
                            name="archive"
                            size={16}
                            color={activeTab === 'archived' ? colors.common.white : colors.neutral[400]}
                        />
                        <Text style={[styles.filterTabText, activeTab === 'archived' && styles.activeFilterTabText]}>
                            Archivados
                        </Text>
                        {(archivedMembers?.length || 0) > 0 && (
                            <View style={[styles.countBadge, activeTab === 'archived' && styles.activeBadge]}>
                                <Text style={[styles.countBadgeText, activeTab === 'archived' && styles.activeBadgeText]}>
                                    {archivedMembers?.length || 0}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </ScrollView>
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
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={false} onRefresh={handleRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons
                                name={activeTab === 'members' ? 'people-outline' : activeTab === 'invitations' ? 'mail-outline' : 'archive-outline'}
                                size={64}
                                color={colors.neutral[300]}
                            />
                            <Text style={styles.emptyText}>
                                {activeTab === 'members'
                                    ? 'No hay miembros'
                                    : activeTab === 'invitations'
                                        ? 'No hay invitaciones pendientes'
                                        : 'No hay miembros archivados'}
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

                        <Text style={styles.roleLabel}>Rol</Text>
                        <View style={styles.roleOptions}>
                            <TouchableOpacity
                                style={[styles.roleOption, inviteRole === 'owner' && styles.roleOptionActive]}
                                onPress={() => setInviteRole('owner')}
                            >
                                <Text style={[styles.roleOptionText, inviteRole === 'owner' && styles.roleOptionTextActive]}>
                                    Administrador
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.roleOption, inviteRole === 'coach' && styles.roleOptionActive]}
                                onPress={() => setInviteRole('coach')}
                            >
                                <Text style={[styles.roleOptionText, inviteRole === 'coach' && styles.roleOptionTextActive]}>
                                    Profesor
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.roleOption, inviteRole === 'assistant' && styles.roleOptionActive]}
                                onPress={() => setInviteRole('assistant')}
                            >
                                <Text style={[styles.roleOptionText, inviteRole === 'assistant' && styles.roleOptionTextActive]}>
                                    Asistente
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    setShowInviteModal(false);
                                    setInviteEmail('');
                                    setInviteRole('coach');
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

            {/* Edit Role Modal */}
            <Modal
                visible={!!editTarget}
                transparent
                animationType="fade"
                onRequestClose={() => setEditTarget(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Cambiar Rol</Text>
                        <Text style={styles.modalSubtitle}>
                            Selecciona el nuevo rol para {editTarget?.name}
                        </Text>

                        <View style={{ gap: spacing.sm, marginVertical: spacing.md, width: '100%' }}>
                            {(['owner', 'coach', 'assistant'] as const).map((role) => (
                                <TouchableOpacity
                                    key={role}
                                    style={{
                                        padding: spacing.md,
                                        borderRadius: 8,
                                        backgroundColor: editTarget?.role === role ? colors.primary[50] : colors.neutral[100],
                                        borderWidth: 1,
                                        borderColor: editTarget?.role === role ? colors.primary[500] : 'transparent',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                    onPress={() => handleUpdateRole(role)}
                                >
                                    <View>
                                        <Text style={{ fontWeight: '600', color: colors.neutral[900] }}>
                                            {getRoleDisplayName(role)}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: colors.neutral[500] }}>
                                            {role === 'owner' ? 'Acceso total a la academia' : role === 'coach' ? 'Gestión total de alumnos y sesiones' : 'Gestión limitada de sesiones'}
                                        </Text>
                                    </View>
                                    {editTarget?.role === role && (
                                        <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setEditTarget(null)}
                        >
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Success Modal */}
            <StatusModal
                visible={showSuccess}
                type="success"
                title={successTitle}
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
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
    },
    filterTabsContent: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 20,
        backgroundColor: colors.neutral[100],
    },
    activeFilterTab: {
        backgroundColor: colors.primary[500],
    },
    filterTabText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: colors.neutral[600],
    },
    activeFilterTabText: {
        color: colors.common.white,
    },
    countBadge: {
        backgroundColor: colors.neutral[300],
        borderRadius: 10,
        paddingHorizontal: 4,
        height: 14,
        minWidth: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countBadgeText: {
        color: colors.neutral[700],
        fontSize: 9,
        fontWeight: '800',
        lineHeight: 12,
    },
    activeBadge: {
        backgroundColor: colors.common.white,
    },
    activeBadgeText: {
        color: colors.primary[500],
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
    memberSecondLine: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginTop: 2,
    },
    memberEmail: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
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
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[600],
    },
    roleOptionText: {
        fontSize: typography.size.sm,
        fontWeight: '500',
        color: colors.neutral[600],
    },
    roleOptionTextActive: {
        color: colors.common.white,
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
    modalSubtitle: {
        fontSize: typography.size.md,
        color: colors.neutral[600],
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
