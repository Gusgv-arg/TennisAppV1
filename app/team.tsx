import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMembers, useAcademyMutations, useArchivedAcademyMembers, useCurrentAcademy } from '@/src/features/academy/hooks/useAcademy';
import { useMemberMutations, usePendingInvitations } from '@/src/features/academy/hooks/useMembers';
import { getRoleColor, getRoleDisplayName, usePermissions } from '@/src/hooks/usePermissions';
import { useTheme } from '@/src/hooks/useTheme';
import { AcademyMember } from '@/src/types/academy';

type Tab = 'members' | 'invitations' | 'archived';

export default function TeamScreen() {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const router = useRouter();
    const { isOwner } = usePermissions();
    const { data: academy } = useCurrentAcademy();
    const { data: members, isLoading: loadingMembers, refetch: refetchMembers } = useAcademyMembers();

    const { data: invitations, isLoading: loadingInvitations, refetch: refetchInvitations } = usePendingInvitations();
    const { data: archivedMembers, isLoading: loadingArchived, refetch: refetchArchived } = useArchivedAcademyMembers();

    const { inviteMember, updateMember, removeMember, restoreMember, promoteMember, revokeAccess, grantAccess, cancelInvitation, resendInvitation } = useMemberMutations();

    const [activeTab, setActiveTab] = useState<Tab>('members');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteRole, setInviteRole] = useState<'owner' | 'coach' | 'assistant' | 'viewer'>('coach');
    const [giveAppAccess, setGiveAppAccess] = useState(true);
    const [inviteError, setInviteError] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [successTitle, setSuccessTitle] = useState('¡Listo!');
    const [successMessage, setSuccessMessage] = useState('');

    const [searchQuery, setSearchQuery] = useState('');

    const { registerMember } = useAcademyMutations();

    // Delete confirmation state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editTarget, setEditTarget] = useState<{ id: string, name: string, role: string, hasAppAccess: boolean, memberEmail?: string } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'member' | 'invitation', id: string, name: string } | null>(null);
    const [promotionEmail, setPromotionEmail] = useState('');
    const [promotionError, setPromotionError] = useState('');
    const [confirmPromotion, setConfirmPromotion] = useState(false);

    const handleRefresh = () => {
        refetchMembers();
        refetchInvitations();
        refetchArchived();
    };

    const handleInvite = async () => {
        // Validation for registered-only members
        if (!giveAppAccess) {
            if (!inviteName.trim()) {
                setInviteError('El nombre es requerido');
                return;
            }

            setInviteError('');

            try {
                await registerMember.mutateAsync({
                    member_name: inviteName.trim(),
                    member_email: inviteEmail.trim() || undefined,
                    role: inviteRole === 'owner' ? 'coach' : inviteRole, // Can't register owners
                });

                setShowInviteModal(false);
                resetInviteForm();
                setSuccessTitle('¡Miembro creado!');
                setSuccessMessage(`${inviteName} fue agregado al equipo (sin acceso a la app)`);
                setShowSuccess(true);
            } catch (err: any) {
                setInviteError(err.message || 'Error al crear miembro');
            }
            return;
        }

        // Validation for invited members (with app access)
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
            resetInviteForm();
            setSuccessTitle('¡Invitación enviada!');
            setSuccessMessage(`Invitación enviada a ${inviteEmail}`);
            setShowSuccess(true);
        } catch (err: any) {
            setInviteError(err.message || 'Error al enviar invitación');
        }
    };

    const resetInviteForm = () => {
        setInviteEmail('');
        setInviteName('');
        setInviteRole('coach');
        setGiveAppAccess(true);
        setInviteError('');
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



    const handleUpdateRole = async (newRole: 'owner' | 'coach' | 'assistant' | 'viewer') => {
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

    const handlePromote = async () => {
        if (!editTarget) return;

        if (!promotionEmail.trim()) {
            setPromotionError('El email es requerido');
            return;
        }

        if (!promotionEmail.includes('@')) {
            setPromotionError('Ingresá un email válido');
            return;
        }

        setPromotionError('');

        try {
            await promoteMember.mutateAsync({
                memberId: editTarget.id,
                email: promotionEmail.trim(),
            });

            setEditTarget(null);
            setPromotionEmail('');
            setSuccessTitle('¡Invitación enviada!');
            setSuccessMessage(`Se envió la invitación a ${promotionEmail}`);
            setShowSuccess(true);
        } catch (err: any) {
            setPromotionError(err.message || 'Error al enviar invitación');
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
        const isRegisteredOnly = item.has_app_access === false;

        // Get display name: from user profile if available, otherwise from member_name
        const displayName = user?.full_name || user?.email || item.member_name || 'Sin nombre';
        const displayEmail = user?.email || item.member_email || '';

        // Get badge text: add "sin acceso" for registered-only members
        const badgeText = isRegisteredOnly
            ? `${getRoleDisplayName(item.role)} sin acceso`
            : getRoleDisplayName(item.role);

        return (
            <Card style={styles.memberCard} padding="md">
                <View style={styles.memberRow}>
                    <Avatar
                        name={displayName}
                        source={user?.avatar_url}
                        size="md"
                    />
                    <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { color: theme.text.primary }]}>
                            {displayName}
                        </Text>
                        <View style={styles.memberSecondLine}>
                            <Text style={[styles.memberEmail, { color: theme.text.secondary }]}>
                                {displayEmail || ' '}
                            </Text>
                            <View style={[styles.roleBadge, { backgroundColor: isRegisteredOnly ? theme.background.subtle : roleColors.bg }]}>
                                <Text style={[styles.roleText, { color: isRegisteredOnly ? theme.text.secondary : roleColors.text }]}>
                                    {badgeText}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Edit button for all members (owners can edit themselves) */}
                    {isOwner && (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                style={[styles.removeBtn, { backgroundColor: theme.components.button.primary.bg + '15' }]} // 10% opacity roughly
                                onPress={() => {
                                    setEditTarget({
                                        id: item.id,
                                        name: displayName,
                                        role: item.role,
                                        hasAppAccess: item.has_app_access !== false,
                                        memberEmail: item.member_email || undefined,
                                    });
                                    // Pre-fill promotion email
                                    setPromotionEmail(item.member_email || '');
                                    setPromotionError('');
                                }}
                            >
                                <Ionicons name="create-outline" size={20} color={theme.components.button.primary.bg} />
                            </TouchableOpacity>
                            {/* Delete button only for non-owners */}
                            {item.role !== 'owner' && (
                                <TouchableOpacity
                                    style={styles.removeBtn}
                                    onPress={() => handleRemoveMember(item)}
                                >
                                    <Ionicons name="trash-outline" size={20} color={theme.status.error} />
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
                    <View style={[styles.inviteIcon, { marginRight: 12, backgroundColor: theme.background.subtle }]}>
                        <Ionicons name="mail" size={24} color={theme.text.tertiary} />
                    </View>

                    {/* Column 2: Content */}
                    <View style={{ flex: 1 }}>
                        {/* Row 1: Email */}
                        <Text
                            style={[styles.memberName, { marginBottom: 2, color: theme.text.primary }]} // Tight spacing
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
                                    <Text style={[styles.expiredText, { marginTop: 0, color: theme.status.error }]}>Expirada</Text>
                                ) : (
                                    <Text style={[styles.pendingText, { marginTop: 0, color: theme.status.warning }]}>Pendiente</Text>
                                )}
                            </View>

                            {/* Right: Actions */}
                            {isOwner && (
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                        style={[styles.removeBtn, { backgroundColor: theme.components.button.primary.bg + '15', padding: 4 }]}
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
                                        <Ionicons name="refresh-outline" size={18} color={theme.components.button.primary.bg} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.removeBtn, { padding: 4 }]}
                                        onPress={() => handleCancelInvitation(item.id, item.email)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={theme.status.error} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Card >
        );
    };

    // Render archived member card
    const renderArchivedMember = ({ item }: { item: AcademyMember }) => {
        const user = (item as any).user;
        const roleColors = getRoleColor(item.role);

        // For registered-only members, use member_name and member_email
        const displayName = user?.full_name || user?.email || item.member_name || 'Sin nombre';
        const displayEmail = user?.full_name ? user?.email : (item.member_email || ' ');

        return (
            <Card style={{ ...styles.memberCard, opacity: 0.8 }} padding="md">
                <View style={styles.memberRow}>
                    <Avatar
                        name={displayName}
                        source={user?.avatar_url}
                        size="md"
                    />
                    <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { color: theme.text.primary }]}>
                            {displayName}
                        </Text>
                        <View style={styles.memberSecondLine}>
                            <Text style={[styles.memberEmail, { color: theme.text.secondary }]}>
                                {displayEmail}
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
                            style={[styles.removeBtn, { backgroundColor: theme.status.success + '15' }]}
                            onPress={async () => {
                                try {
                                    await restoreMember.mutateAsync(item.id);
                                    setSuccessTitle('¡Miembro restaurado!');
                                    setSuccessMessage(`${displayName} fue reactivado`);
                                    setShowSuccess(true);
                                } catch (error) {
                                    console.error('Error restoring member:', error);
                                }
                            }}
                        >
                            <Ionicons name="refresh-outline" size={20} color={theme.status.success} />
                        </TouchableOpacity>
                    )}
                </View>
            </Card>
        );
    };

    const isLoading = activeTab === 'members' ? loadingMembers : activeTab === 'invitations' ? loadingInvitations : loadingArchived;

    // Search Filtering Logic
    const getFilteredData = () => {
        const rawData = activeTab === 'members' ? members : activeTab === 'invitations' ? invitations : archivedMembers;
        if (!rawData) return [];
        if (!searchQuery.trim()) return rawData;

        const query = searchQuery.toLowerCase().trim();
        return rawData.filter((item: any) => {
            if (activeTab === 'invitations') {
                return item.email?.toLowerCase().includes(query);
            }
            const user = item.user;
            const name = user?.full_name || item.member_name || '';
            const email = user?.email || item.member_email || '';
            return name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
        });
    };

    const data = getFilteredData();
    const renderItem = activeTab === 'members' ? renderMember : activeTab === 'invitations' ? renderInvitation : renderArchivedMember;

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="people" size={24} color={theme.components.button.primary.bg} />
                            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text.primary }}>Equipo</Text>
                        </View>
                    ),
                    headerTitleAlign: 'center',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginLeft: spacing.sm }}
                        >
                            <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
                        </TouchableOpacity>
                    ),
                    headerStyle: { backgroundColor: theme.background.surface },
                    headerShadowVisible: false,
                }}
            />

            {/* Desktop Center Wrapper */}
            <View style={styles.centerWrapper}>
                {/* Academy Info */}
                {/* Subtitle & Actions */}
                <View style={[styles.academyHeader, { flexDirection: 'column', alignItems: 'stretch', gap: spacing.md, paddingRight: spacing.md }]}>
                    <Text style={{ fontSize: 13, color: theme.text.secondary }}>
                        Creá y administrá los miembros de tu Academia
                    </Text>

                    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                            <Input
                                placeholder="Buscar miembro..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                leftIcon={<Ionicons name="search" size={20} color={theme.text.tertiary} />}
                                containerStyle={{ marginBottom: 0 }}
                                size="md"
                            />
                        </View>

                        {isOwner && (
                            <Button
                                label="Crear"
                                leftIcon={<Ionicons name="add" size={18} color="white" />}
                                onPress={() => setShowInviteModal(true)}
                                size="md"
                                shadow
                                style={{ minWidth: 100 }}
                            />
                        )}
                    </View>
                </View>

                {/* Filter Tabs (pill style with horizontal scroll) */}
                <View style={styles.filterContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterTabsContent}
                    >
                        <TouchableOpacity
                            style={[
                                styles.filterTab,
                                { backgroundColor: theme.background.surface, borderColor: theme.border.subtle },
                                activeTab === 'members' && { backgroundColor: theme.components.button.primary.bg, borderColor: theme.components.button.primary.bg }
                            ]}
                            onPress={() => setActiveTab('members')}
                        >
                            <Ionicons
                                name="people"
                                size={16}
                                color={activeTab === 'members' ? theme.text.inverse : theme.text.tertiary}
                            />
                            <Text style={[styles.filterTabText, { color: activeTab === 'members' ? theme.text.inverse : theme.text.secondary }, activeTab === 'members' && styles.activeFilterTabText]}>
                                Miembros
                            </Text>
                            {(members?.length || 0) > 0 && (
                                <View style={[styles.countBadge, { backgroundColor: activeTab === 'members' ? 'rgba(255,255,255,0.2)' : theme.background.subtle }]}>
                                    <Text style={[styles.countBadgeText, { color: activeTab === 'members' ? theme.text.inverse : theme.text.secondary }]}>
                                        {members?.length || 0}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.filterTab,
                                { backgroundColor: theme.background.surface, borderColor: theme.border.subtle },
                                activeTab === 'invitations' && { backgroundColor: theme.components.button.primary.bg, borderColor: theme.components.button.primary.bg }
                            ]}
                            onPress={() => setActiveTab('invitations')}
                        >
                            <Ionicons
                                name="mail"
                                size={16}
                                color={activeTab === 'invitations' ? theme.text.inverse : theme.text.tertiary}
                            />
                            <Text style={[styles.filterTabText, { color: activeTab === 'invitations' ? theme.text.inverse : theme.text.secondary }, activeTab === 'invitations' && styles.activeFilterTabText]}>
                                Invitaciones
                            </Text>
                            {(invitations?.length || 0) > 0 && (
                                <View style={[styles.countBadge, { backgroundColor: activeTab === 'invitations' ? 'rgba(255,255,255,0.2)' : theme.background.subtle }]}>
                                    <Text style={[styles.countBadgeText, { color: activeTab === 'invitations' ? theme.text.inverse : theme.text.secondary }]}>
                                        {invitations?.length || 0}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.filterTab,
                                { backgroundColor: theme.background.surface, borderColor: theme.border.subtle },
                                activeTab === 'archived' && { backgroundColor: theme.components.button.primary.bg, borderColor: theme.components.button.primary.bg }
                            ]}
                            onPress={() => setActiveTab('archived')}
                        >
                            <Ionicons
                                name="archive"
                                size={16}
                                color={activeTab === 'archived' ? theme.text.inverse : theme.text.tertiary}
                            />
                            <Text style={[styles.filterTabText, { color: activeTab === 'archived' ? theme.text.inverse : theme.text.secondary }, activeTab === 'archived' && styles.activeFilterTabText]}>
                                Archivados
                            </Text>
                            {(archivedMembers?.length || 0) > 0 && (
                                <View style={[styles.countBadge, { backgroundColor: activeTab === 'archived' ? 'rgba(255,255,255,0.2)' : theme.background.subtle }]}>
                                    <Text style={[styles.countBadgeText, { color: activeTab === 'archived' ? theme.text.inverse : theme.text.secondary }]}>
                                        {archivedMembers?.length || 0}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {/* List */}
                {isLoading ? (
                    <View style={[styles.loadingContainer, { backgroundColor: theme.background.default }]}>
                        <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
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
                                    color={theme.text.tertiary}
                                />
                                <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
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
            </View>

            {/* Invite Modal */}
            <Modal
                visible={showInviteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowInviteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Crear miembro</Text>

                        {/* App Access Toggle */}
                        <View style={styles.accessToggle}>
                            <Text style={[styles.accessToggleLabel, { color: theme.text.secondary }]}>¿Dar acceso a la app?</Text>
                            <View style={styles.accessToggleOptions}>
                                <TouchableOpacity
                                    style={[
                                        styles.accessOption,
                                        { backgroundColor: theme.background.subtle, borderColor: theme.border.default },
                                        giveAppAccess && { backgroundColor: theme.components.button.primary.bg, borderColor: theme.components.button.primary.bg }
                                    ]}
                                    onPress={() => setGiveAppAccess(true)}
                                >
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={16}
                                        color={giveAppAccess ? theme.text.inverse : theme.text.tertiary}
                                    />
                                    <Text style={[styles.accessOptionText, { color: giveAppAccess ? theme.text.inverse : theme.text.secondary }]}>Sí</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.accessOption,
                                        { backgroundColor: theme.background.subtle, borderColor: theme.border.default },
                                        !giveAppAccess && { backgroundColor: theme.components.button.primary.bg, borderColor: theme.components.button.primary.bg }
                                    ]}
                                    onPress={() => setGiveAppAccess(false)}
                                >
                                    <Ionicons
                                        name="close-circle"
                                        size={16}
                                        color={!giveAppAccess ? theme.text.inverse : theme.text.tertiary}
                                    />
                                    <Text style={[styles.accessOptionText, { color: !giveAppAccess ? theme.text.inverse : theme.text.secondary }]}>No</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Name field (always shown for no-access, optional hint for access) */}
                        {!giveAppAccess && (
                            <Input
                                label="Nombre completo *"
                                placeholder="Nombre del miembro"
                                value={inviteName}
                                onChangeText={(text) => {
                                    setInviteName(text);
                                    setInviteError('');
                                }}
                            />
                        )}

                        <Input
                            label={giveAppAccess ? "Email *" : "Email (opcional)"}
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

                        {/* Role selector - hide owner for no-access */}
                        <Text style={styles.roleLabel}>Rol</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleOptions}>
                            {giveAppAccess && (
                                <TouchableOpacity
                                    style={[styles.roleOption, inviteRole === 'owner' && styles.roleOptionActive]}
                                    onPress={() => setInviteRole('owner')}
                                >
                                    <Text style={[styles.roleOptionText, inviteRole === 'owner' && styles.roleOptionTextActive]}>
                                        Administrador
                                    </Text>
                                </TouchableOpacity>
                            )}
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
                            {giveAppAccess && (
                                <TouchableOpacity
                                    style={[
                                        styles.roleOption,
                                        { backgroundColor: theme.background.subtle, borderColor: theme.border.default },
                                        inviteRole === 'viewer' && { backgroundColor: theme.components.button.primary.bg, borderColor: theme.components.button.primary.bg }
                                    ]}
                                    onPress={() => setInviteRole('viewer')}
                                >
                                    <Text style={[styles.roleOptionText, { color: inviteRole === 'viewer' ? theme.text.inverse : theme.text.secondary }]}>
                                        Lector
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>

                        {/* Role description hint - different messages for app access vs no access */}
                        <Text style={styles.roleHint}>
                            {giveAppAccess ? (
                                <>
                                    {inviteRole === 'owner' && 'Acceso total: configuración, pagos, alumnos y clases.'}
                                    {inviteRole === 'coach' && 'Gestiona alumnos, clases y registra pagos.'}
                                    {inviteRole === 'assistant' && 'Visualiza alumnos y gestiona clases.'}
                                    {inviteRole === 'viewer' && 'Solo puede visualizar información, sin modificar.'}
                                </>
                            ) : (
                                <>
                                    {inviteRole === 'coach' && 'Sin acceso a la app. Podrás asignarlo como profesor en clases.'}
                                    {inviteRole === 'assistant' && 'Sin acceso a la app. Podrás asignarlo como asistente en clases.'}
                                </>
                            )}
                        </Text>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.cancelButton, { backgroundColor: theme.background.subtle }]}
                                onPress={() => {
                                    setShowInviteModal(false);
                                    resetInviteForm();
                                }}
                            >
                                <Text style={[styles.cancelButtonText, { color: theme.text.secondary }]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmButton, { backgroundColor: theme.components.button.primary.bg }]}
                                onPress={handleInvite}
                            >
                                <Text style={[styles.confirmButtonText, { color: theme.text.inverse }]}>
                                    {giveAppAccess ? 'Enviar invitación' : 'Crear miembro'}
                                </Text>
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
                    <View style={[styles.modalContent, { backgroundColor: theme.background.surface }]}>
                        <View style={[styles.deleteIconContainer, { backgroundColor: theme.status.error + '15' }]}>
                            <Ionicons name="warning" size={48} color={theme.status.error} />
                        </View>
                        <Text style={[styles.modalTitle, { color: theme.text.primary }]}>
                            {deleteTarget?.type === 'member' ? 'Eliminar miembro' : 'Cancelar invitación'}
                        </Text>
                        <Text style={[styles.deleteMessage, { color: theme.text.secondary }]}>
                            {deleteTarget?.type === 'member'
                                ? `¿Estás seguro de eliminar a ${deleteTarget?.name}?`
                                : `¿Cancelar la invitación a ${deleteTarget?.name}?`}
                        </Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.cancelButton, { backgroundColor: theme.background.subtle }]}
                                onPress={() => {
                                    setShowDeleteModal(false);
                                    setDeleteTarget(null);
                                }}
                            >
                                <Text style={[styles.cancelButtonText, { color: theme.text.secondary }]}>No, volver</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmButton, { backgroundColor: theme.status.error }]}
                                onPress={handleConfirmDelete}
                            >
                                <Text style={[styles.confirmButtonText, { color: theme.text.inverse }]}>Sí, eliminar</Text>
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
                    <View style={[styles.modalContent, { backgroundColor: theme.background.surface }]}>
                        {/* Close button */}
                        <TouchableOpacity
                            style={{ position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 1 }}
                            onPress={() => {
                                setEditTarget(null);
                                setPromotionEmail('');
                                setPromotionError('');
                                setConfirmPromotion(false);
                            }}
                        >
                            <Ionicons name="close" size={24} color={theme.text.tertiary} />
                        </TouchableOpacity>

                        <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Cambiar Rol</Text>
                        <Text style={[styles.modalSubtitle, { color: theme.text.secondary }]}>
                            Selecciona el nuevo rol para {editTarget?.name}
                        </Text>

                        <View style={{ gap: spacing.sm, marginVertical: spacing.md, width: '100%' }}>
                            {(['owner', 'coach', 'assistant', 'viewer'] as const)
                                .filter(role => {
                                    // Hide owner and viewer for members without app access
                                    if (!editTarget?.hasAppAccess && (role === 'owner' || role === 'viewer')) {
                                        return false;
                                    }
                                    return true;
                                })
                                .map((role) => (
                                    <TouchableOpacity
                                        key={role}
                                        style={{
                                            padding: spacing.md,
                                            borderRadius: 8,
                                            backgroundColor: editTarget?.role === role ? theme.components.button.primary.bg + '15' : theme.background.subtle,
                                            borderWidth: 1,
                                            borderColor: editTarget?.role === role ? theme.components.button.primary.bg : 'transparent',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}
                                        onPress={() => handleUpdateRole(role)}
                                    >
                                        <View>
                                            <Text style={{ fontWeight: '600', color: theme.text.primary }}>
                                                {getRoleDisplayName(role)}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: theme.text.secondary }}>
                                                {role === 'owner' ? 'Acceso total a la academia'
                                                    : role === 'coach' ? 'Gestión total de alumnos y clases'
                                                        : role === 'assistant' ? 'Gestión limitada de clases'
                                                            : 'Solo lectura'}
                                            </Text>
                                        </View>
                                        {editTarget?.role === role && (
                                            <Ionicons name="checkmark-circle" size={24} color={theme.components.button.primary.bg} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                        </View>

                        {/* Revoke access section for members WITH app access */}
                        {editTarget?.hasAppAccess === true && editTarget?.role !== 'owner' && (
                            <View style={[styles.promotionSection, { borderTopColor: theme.border.default }]}>
                                <View style={styles.promotionHeader}>
                                    <Ionicons name="remove-circle-outline" size={20} color={theme.status.error} />
                                    <Text style={[styles.promotionTitle, { color: theme.status.error }]}>Revocar acceso a la app</Text>
                                </View>
                                <Text style={[styles.promotionDesc, { color: theme.text.secondary }]}>
                                    El miembro ya no podrá acceder a esta academia desde la app.
                                </Text>
                                <TouchableOpacity
                                    style={[styles.confirmButton, { marginTop: spacing.sm, backgroundColor: theme.status.error }]}
                                    onPress={async () => {
                                        try {
                                            await revokeAccess.mutateAsync(editTarget.id);
                                            setEditTarget(null);
                                            setSuccessTitle('Acceso revocado');
                                            setSuccessMessage(`${editTarget.name} ya no tiene acceso a la app`);
                                            setShowSuccess(true);
                                        } catch (err: any) {
                                            Alert.alert('Error', err.message || 'No se pudo revocar el acceso');
                                        }
                                    }}
                                    disabled={revokeAccess.isPending}
                                >
                                    <Text style={[styles.confirmButtonText, { color: theme.text.inverse }]}>
                                        {revokeAccess.isPending ? 'Revocando...' : 'Revocar acceso'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Grant access for members with revoked access (has user_id but no app access) */}
                        {editTarget?.hasAppAccess === false && members?.find(m => m.id === editTarget.id)?.user_id && (
                            <View style={[styles.promotionSection, { borderTopColor: theme.border.default }]}>
                                <View style={styles.promotionHeader}>
                                    <Ionicons name="phone-portrait-outline" size={20} color={theme.status.success} />
                                    <Text style={[styles.promotionTitle, { color: theme.status.success }]}>Restaurar acceso</Text>
                                </View>
                                <Text style={[styles.promotionDesc, { color: theme.text.secondary }]}>
                                    Este miembro ya tiene cuenta. Restaurar su acceso a la academia.
                                </Text>
                                <TouchableOpacity
                                    style={[styles.confirmButton, { marginTop: spacing.sm, backgroundColor: theme.status.success }]}
                                    onPress={async () => {
                                        try {
                                            await grantAccess.mutateAsync(editTarget.id);
                                            setEditTarget(null);
                                            setSuccessTitle('¡Acceso restaurado!');
                                            setSuccessMessage(`${editTarget.name} puede acceder nuevamente`);
                                            setShowSuccess(true);
                                        } catch (err: any) {
                                            Alert.alert('Error', err.message || 'No se pudo restaurar el acceso');
                                        }
                                    }}
                                    disabled={grantAccess.isPending}
                                >
                                    <Text style={[styles.confirmButtonText, { color: theme.text.inverse }]}>
                                        {grantAccess.isPending ? 'Restaurando...' : 'Restaurar acceso'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Promotion section for registered-only members */}
                        {editTarget?.hasAppAccess === false && (
                            <View style={[styles.promotionSection, { borderTopColor: theme.border.default }]}>
                                {/* "ó" separator */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                                    <View style={{ flex: 1, height: 1, backgroundColor: theme.border.default }} />
                                    <Text style={{ paddingHorizontal: spacing.md, color: theme.text.tertiary, fontSize: typography.size.sm }}>ó</Text>
                                    <View style={{ flex: 1, height: 1, backgroundColor: theme.border.default }} />
                                </View>

                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}
                                    onPress={() => setConfirmPromotion(!confirmPromotion)}
                                >
                                    <Ionicons
                                        name={confirmPromotion ? 'checkbox' : 'square-outline'}
                                        size={18}
                                        color={confirmPromotion ? theme.components.button.primary.bg : theme.text.tertiary}
                                    />
                                    <Ionicons name="phone-portrait" size={18} color={theme.components.button.primary.bg} />
                                    <Text style={[styles.promotionTitle, { color: theme.components.button.primary.bg }]}>Invitar a la app</Text>
                                </TouchableOpacity>
                                <Text style={[styles.promotionDesc, { marginLeft: 28, color: theme.text.secondary }]}>
                                    Enviá una invitación para que este miembro pueda usar la app.
                                </Text>
                                {confirmPromotion && (
                                    <>
                                        <Input
                                            label="Email"
                                            placeholder="email@ejemplo.com"
                                            value={promotionEmail}
                                            onChangeText={(text) => {
                                                setPromotionEmail(text);
                                                setPromotionError('');
                                            }}
                                            error={promotionError}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                        />
                                        <TouchableOpacity
                                            style={[styles.confirmButton, { marginTop: spacing.sm, backgroundColor: theme.components.button.primary.bg }]}
                                            onPress={handlePromote}
                                            disabled={promoteMember.isPending}
                                        >
                                            <Text style={[styles.confirmButtonText, { color: theme.text.inverse }]}>
                                                {promoteMember.isPending ? 'Enviando...' : 'Enviar invitación'}
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        )}


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
    },
    academyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
    },
    academyIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    academyName: {
        fontSize: typography.size.lg,
        fontWeight: '600',
    },
    centerWrapper: {
        width: '100%',
        maxWidth: 800,
        alignSelf: 'center',
        flex: 1,
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
    },
    activeFilterTab: {
    },
    filterTabText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
    },
    activeFilterTabText: {
    },
    countBadge: {
        borderRadius: 10,
        paddingHorizontal: 4,
        height: 14,
        minWidth: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        lineHeight: 12,
    },
    activeBadge: {
    },
    activeBadgeText: {
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    pendingText: {
        fontSize: typography.size.xs,
        marginTop: 4,
    },
    expiredText: {
        fontSize: typography.size.xs,
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
    },
    inviteForm: {
        width: '100%',
        paddingTop: spacing.md,
    },
    roleLabel: {
        fontSize: typography.size.sm,
        fontWeight: '500',
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    roleOptions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    roleOption: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
    },
    roleOptionActive: {
    },
    roleOptionText: {
        fontSize: typography.size.sm,
        fontWeight: '500',
    },
    roleOptionTextActive: {
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContent: {
        borderRadius: 20,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 500,
    },
    modalTitle: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    modalSubtitle: {
        fontSize: typography.size.md,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.lg,
        justifyContent: 'center',
    },
    cancelButton: {
        minWidth: 120,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderRadius: 12,
    },
    cancelButtonText: {
        fontSize: typography.size.md,
        fontWeight: '600',
    },
    confirmButton: {
        minWidth: 120,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderRadius: 12,
    },
    confirmButtonText: {
        fontSize: typography.size.md,
        fontWeight: '600',
    },
    deleteIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: spacing.md,
    },
    deleteMessage: {
        fontSize: typography.size.md,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    accessToggle: {
        marginBottom: spacing.md,
    },
    accessToggleLabel: {
        fontSize: typography.size.sm,
        fontWeight: '500',
        marginBottom: spacing.sm,
    },
    accessToggleOptions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    accessOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        borderWidth: 1,
    },
    accessOptionActive: {
    },
    accessOptionText: {
        fontSize: typography.size.sm,
        fontWeight: '500',
    },
    accessOptionTextActive: {
    },
    roleHint: {
        fontSize: typography.size.xs,
        marginTop: spacing.xs,
    },
    noAccessHint: {
        fontSize: typography.size.xs,
        fontStyle: 'italic',
        marginTop: spacing.sm,
    },
    promotionSection: {
        width: '100%',
        borderTopWidth: 1,
        paddingTop: spacing.md,
        marginTop: spacing.md,
    },
    promotionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.xs,
    },
    promotionTitle: {
        fontSize: typography.size.md,
        fontWeight: '600',
    },
    promotionDesc: {
        fontSize: typography.size.sm,
        marginBottom: spacing.md,
    },
});

