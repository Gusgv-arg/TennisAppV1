import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import StatusModal from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMembers, useAcademyMutations, useArchivedAcademyMembers, useCurrentAcademy } from '@/src/features/academy/hooks/useAcademy';
import { useMemberMutations, usePendingInvitations } from '@/src/features/academy/hooks/useMembers';
import { getRoleColor, getRoleDisplayName, usePermissions } from '@/src/hooks/usePermissions';
import { useTheme } from '@/src/hooks/useTheme';
import { AcademyMember } from '@/src/types/academy';
import { showError, showSuccess } from '@/src/utils/toast';

type Tab = 'members' | 'invitations' | 'archived';

export default function TeamScreen() {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const styles = createStyles(theme);
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { isOwner } = usePermissions();
    const { data: academy } = useCurrentAcademy();
    const { data: members, isLoading: loadingMembers, refetch: refetchMembers } = useAcademyMembers();

    const { data: invitations, isLoading: loadingInvitations, refetch: refetchInvitations } = usePendingInvitations();
    const { data: archivedMembers, isLoading: loadingArchived, refetch: refetchArchived } = useArchivedAcademyMembers();

    const { inviteMember, updateMember, removeMember, restoreMember, promoteMember, revokeAccess, grantAccess, cancelInvitation, resendInvitation } = useMemberMutations();

    const [activeTab, setActiveTab] = useState<Tab>('members');
    const [searchQuery, setSearchQuery] = useState('');

    const { registerMember } = useAcademyMutations();

    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteRole, setInviteRole] = useState<'owner' | 'coach' | 'assistant' | 'viewer'>('coach');
    const [giveAppAccess, setGiveAppAccess] = useState(true);
    const [inviteError, setInviteError] = useState('');

    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        type: 'warning' | 'success' | 'info' | 'error';
        title: string;
        message: string;
        onConfirm?: () => void;
        confirmText?: string;
    }>({
        type: 'info',
        title: '',
        message: '',
    });

    const [editTarget, setEditTarget] = useState<{ id: string, name: string, role: string, hasAppAccess: boolean, memberEmail?: string } | null>(null);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
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
                const name = inviteName.trim();
                resetInviteForm();
                setTimeout(() => showSuccess('¡Miembro creado!', `${name} fue agregado al equipo (sin acceso a la app)`), 100);
            } catch (err: any) {
                showError('Error', err.message || 'Error al crear miembro');
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
            const email = inviteEmail.trim();
            resetInviteForm();
            setTimeout(() => showSuccess('¡Invitación enviada!', `Invitación enviada a ${email}`), 100);
        } catch (err: any) {
            showError('Error', err.message || 'Error al enviar invitación');
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
            const ownerCount = members?.filter(m => m.role === 'owner' && m.is_active).length || 0;
            if (ownerCount <= 1) {
                Alert.alert('No se puede eliminar', 'Debe haber al menos un dueño en la academia.');
                return;
            }
        }
        const user = (member as any).user;
        const displayName = user?.full_name || user?.email || member.member_name || 'este miembro';

        setModalConfig({
            type: 'warning',
            title: 'Eliminar miembro',
            message: `¿Estás seguro de eliminar a ${displayName}?`,
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
                try {
                    await removeMember.mutateAsync(member.id);
                    setModalVisible(false);
                    setTimeout(() => showSuccess('¡Listo!', 'Miembro eliminado correctamente'), 100);
                } catch (error: any) {
                    showError('Error', error.message || 'Error al eliminar miembro');
                }
            }
        });
        setModalVisible(true);
    };

    const handleCancelInvitation = (invitationId: string, email: string) => {
        setModalConfig({
            type: 'warning',
            title: 'Cancelar invitación',
            message: `¿Cancelar la invitación a ${email}?`,
            confirmText: 'Sí, cancelar',
            onConfirm: async () => {
                try {
                    await cancelInvitation.mutateAsync(invitationId);
                    setModalVisible(false);
                    setTimeout(() => showSuccess('¡Listo!', 'Invitación cancelada'), 100);
                } catch (error: any) {
                    showError('Error', error.message || 'Error al cancelar invitación');
                }
            }
        });
        setModalVisible(true);
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
                role: newRole,
                member_name: editName.trim() || null,
                member_email: editEmail.trim() || null,
            });
            setEditTarget(null);
            setTimeout(() => showSuccess('¡Miembro actualizado!', `${editName || editTarget.name} fue actualizado correctamente`), 100);
        } catch (error: any) {
            showError('Error', error.message || 'Error al actualizar miembro');
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

            const email = promotionEmail.trim();
            setEditTarget(null);
            setPromotionEmail('');
            setTimeout(() => showSuccess('¡Invitación enviada!', `Se envió la invitación a ${email}`), 100);
        } catch (err: any) {
            showError('Error', err.message || 'Error al enviar invitación');
        }
    };

    // Obsolete - functionality moved to handleRemoveMember and handleCancelInvitation
    // const handleConfirmDelete = async () => { ... }

    const renderMember = ({ item }: { item: AcademyMember }) => {
        const user = (item as any).user;
        const roleColors = getRoleColor(item.role);
        const isRegisteredOnly = item.has_app_access === false;

        const displayName = user?.full_name || user?.email || item.member_name || 'Sin nombre';
        const displayEmail = user?.email || item.member_email || '';

        const badgeText = isRegisteredOnly
            ? `${getRoleDisplayName(item.role)} sin acceso`
            : getRoleDisplayName(item.role);

        return (
            <Card style={styles.memberCard} padding="md">
                <View style={styles.cardContent}>
                    <View style={styles.memberMainInfo}>
                        <View style={styles.infoRow}>
                            <View style={styles.headerRow}>
                                <Avatar
                                    name={displayName}
                                    source={user?.avatar_url}
                                    size="sm"
                                />
                                <Text style={styles.memberName}>{displayName}</Text>
                            </View>

                            <View style={[styles.roleBadge, { backgroundColor: isRegisteredOnly ? theme.background.subtle : roleColors.bg }]}>
                                <Text style={[styles.roleText, { color: isRegisteredOnly ? theme.text.secondary : roleColors.text }]}>
                                    {badgeText}
                                </Text>
                            </View>

                            {displayEmail ? (
                                <Text style={styles.memberEmail} numberOfLines={1}>
                                    <Text style={{ opacity: 0.5, fontWeight: '400' }}>• </Text>
                                    {displayEmail}
                                </Text>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.actionButtonsRow}>
                        {isOwner && (
                            <>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => {
                                        setEditTarget({
                                            id: item.id,
                                            name: displayName,
                                            role: item.role,
                                            hasAppAccess: item.has_app_access !== false,
                                            memberEmail: item.member_email || undefined,
                                        });
                                        setEditName(displayName);
                                        setEditEmail(displayEmail);
                                        setPromotionEmail(item.member_email || '');
                                        setPromotionError('');
                                    }}
                                >
                                    <Ionicons name="create-outline" size={20} color={theme.status.warning} />
                                </TouchableOpacity>

                                {item.role !== 'owner' || ((members?.filter(m => m.role === 'owner' && m.is_active).length || 0) > 1) ? (
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleRemoveMember(item)}
                                    >
                                        <Ionicons name="trash-outline" size={20} color={theme.status.error} />
                                    </TouchableOpacity>
                                ) : null}
                            </>
                        )}
                    </View>
                </View>
            </Card>
        );
    };

    const renderInvitation = ({ item }: { item: any }) => {
        const roleColors = getRoleColor(item.role);
        const isExpired = new Date(item.expires_at) < new Date();

        return (
            <Card style={styles.memberCard} padding="md">
                <View style={styles.cardContent}>
                    <View style={styles.memberMainInfo}>
                        <View style={styles.infoRow}>
                            <View style={styles.headerRow}>
                                <View style={styles.inviteIconContainer}>
                                    <Ionicons name="mail" size={16} color={theme.text.tertiary} />
                                </View>
                                <Text style={styles.memberName}>{item.email}</Text>
                            </View>

                            <View style={[styles.roleBadge, { backgroundColor: roleColors.bg }]}>
                                <Text style={[styles.roleText, { color: roleColors.text }]}>
                                    {getRoleDisplayName(item.role)}
                                </Text>
                            </View>

                            {isExpired ? (
                                <Text style={[styles.statusText, { color: theme.status.error }]}>
                                    <Text style={{ opacity: 0.5, fontWeight: '400' }}>• </Text>
                                    Expirada
                                </Text>
                            ) : (
                                <Text style={[styles.statusText, { color: theme.status.warning }]}>
                                    <Text style={{ opacity: 0.5, fontWeight: '400' }}>• </Text>
                                    Pendiente
                                </Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.actionButtonsRow}>
                        {isOwner && (
                            <>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={async () => {
                                        try {
                                            await resendInvitation.mutateAsync(item.id);
                                            showSuccess('¡Invitación reenviada!', `Se reenvió la invitación a ${item.email}`);
                                        } catch (error: any) {
                                            showError('Error', error.message || 'No se pudo reenviar la invitación');
                                        }
                                    }}
                                >
                                    <Ionicons name="refresh-outline" size={20} color={theme.components.button.primary.bg} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handleCancelInvitation(item.id, item.email)}
                                >
                                    <Ionicons name="trash-outline" size={20} color={theme.status.error} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Card>
        );
    };

    const renderArchivedMember = ({ item }: { item: AcademyMember }) => {
        const user = (item as any).user;
        const roleColors = getRoleColor(item.role);

        const displayName = user?.full_name || user?.email || item.member_name || 'Sin nombre';
        const displayEmail = user?.full_name ? user?.email : (item.member_email || ' ');

        return (
            <Card style={[styles.memberCard, { opacity: 0.8 }]} padding="md">
                <View style={styles.cardContent}>
                    <View style={styles.memberMainInfo}>
                        <View style={styles.infoRow}>
                            <View style={styles.headerRow}>
                                <Avatar
                                    name={displayName}
                                    source={user?.avatar_url}
                                    size="sm"
                                />
                                <Text style={styles.memberName}>{displayName}</Text>
                            </View>

                            <View style={[styles.roleBadge, { backgroundColor: roleColors.bg }]}>
                                <Text style={[styles.roleText, { color: roleColors.text }]}>
                                    {getRoleDisplayName(item.role)}
                                </Text>
                            </View>

                            {displayEmail ? (
                                <Text style={styles.memberEmail}>
                                    <Text style={{ opacity: 0.5, fontWeight: '400' }}>• </Text>
                                    {displayEmail}
                                </Text>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.actionButtonsRow}>
                        {isOwner && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={async () => {
                                    try {
                                        await restoreMember.mutateAsync(item.id);
                                        showSuccess('¡Miembro restaurado!', `${displayName} fue reactivado`);
                                    } catch (error: any) {
                                        showError('Error', error.message || 'Error al restaurar miembro');
                                    }
                                }}
                            >
                                <Ionicons name="refresh-outline" size={20} color={theme.status.success} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Card >
        );
    };

    const isLoading = activeTab === 'members' ? loadingMembers : activeTab === 'invitations' ? loadingInvitations : loadingArchived;

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
            <Stack.Screen options={{ headerShown: false }} />

            {/* Custom Header */}
            <View style={[styles.headerContainer, {
                paddingTop: insets.top + 8,
                paddingBottom: 4,
            }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                    >
                        <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
                    </TouchableOpacity>
                </View>
                <View style={[styles.headerTitleWrapper, { minHeight: 78 }]}>
                    <View style={styles.headerTitleRow}>
                        <Ionicons name="people" size={24} color={theme.components.button.primary.bg} style={{ marginRight: spacing.sm }} />
                        <Text style={styles.headerTitleText}>Equipo</Text>
                    </View>
                </View>
                <View style={styles.headerRight} />
            </View>

            {/* Body */}
            <View style={styles.bodyContainer}>
                <Text style={styles.subtitleText}>
                    Creá y administrá los miembros de tu Academia
                </Text>

                <View style={styles.controlsWrapper}>
                    <View style={styles.searchInputContainer}>
                        <Ionicons name="search" size={20} color={theme.text.tertiary} />
                        <TextInput
                            placeholder="Buscar miembro..."
                            placeholderTextColor={theme.text.tertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={styles.searchInputText}
                            textAlignVertical="center"
                        />
                    </View>
                    {isOwner && (
                        <Button
                            label="Crear"
                            leftIcon={<Ionicons name="add" size={20} color="#FFFFFF" />}
                            onPress={() => setShowInviteModal(true)}
                            style={styles.addButton}
                            size="sm"
                            shadow
                        />
                    )}
                </View>

                {/* Desktop Center Wrapper for List */}
                <View style={styles.centerWrapper}>
                    {/* Filters */}
                    <View style={styles.filterContainer}>
                        <TouchableOpacity
                            style={[
                                styles.filterTab,
                                activeTab === 'members' && styles.activeFilterTab
                            ]}
                            onPress={() => setActiveTab('members')}
                        >
                            <Ionicons
                                name="people"
                                size={16}
                                color={activeTab === 'members' ? theme.text.inverse : theme.text.tertiary}
                            />
                            <Text style={[styles.filterTabText, { color: activeTab === 'members' ? theme.text.inverse : theme.text.secondary }]}>
                                Miembros
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.filterTab,
                                activeTab === 'invitations' && styles.activeFilterTab
                            ]}
                            onPress={() => setActiveTab('invitations')}
                        >
                            <Ionicons
                                name="mail"
                                size={16}
                                color={activeTab === 'invitations' ? theme.text.inverse : theme.text.tertiary}
                            />
                            <Text style={[styles.filterTabText, { color: activeTab === 'invitations' ? theme.text.inverse : theme.text.secondary }]}>
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
                                activeTab === 'archived' && styles.activeFilterTab
                            ]}
                            onPress={() => setActiveTab('archived')}
                        >
                            <Ionicons
                                name="archive"
                                size={16}
                                color={activeTab === 'archived' ? theme.text.inverse : theme.text.tertiary}
                            />
                            <Text style={[styles.filterTabText, { color: activeTab === 'archived' ? theme.text.inverse : theme.text.secondary }]}>
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

                    </View>

                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
                        </View>
                    ) : (
                        <FlatList
                            data={data as any[]}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContent}
                            refreshControl={
                                <RefreshControl
                                    refreshing={false}
                                    onRefresh={handleRefresh}
                                    tintColor={theme.components.button.primary.bg}
                                />
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
            </View>

            <Modal
                visible={showInviteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowInviteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background.surface }]}>
                        <TouchableOpacity
                            style={{ position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 1 }}
                            onPress={() => {
                                setShowInviteModal(false);
                                resetInviteForm();
                            }}
                        >
                            <Ionicons name="close" size={24} color={theme.text.tertiary} />
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Crear miembro</Text>

                        <View style={styles.accessToggle}>
                            <Text style={styles.accessToggleLabel}>¿Dar acceso a la app?</Text>
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
                                style={[styles.confirmButton, { backgroundColor: theme.components.button.primary.bg, alignSelf: 'center', minWidth: 150, height: 40 }]}
                                onPress={handleInvite}
                            >
                                <Text style={[styles.confirmButtonText, { color: theme.text.inverse, fontSize: 14 }]}>
                                    {giveAppAccess ? 'Enviar invitación' : 'Crear miembro'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>



            <Modal
                visible={!!editTarget}
                transparent
                animationType="fade"
                onRequestClose={() => setEditTarget(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background.surface }]}>
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

                        <Text style={[styles.modalTitle, { color: theme.text.primary, marginBottom: spacing.xs }]}>Editar Miembro</Text>

                        <View style={{ gap: spacing.xs, marginVertical: spacing.sm, width: '100%' }}>
                            <Input
                                label="Nombre"
                                placeholder="Nombre del miembro"
                                value={editName}
                                onChangeText={setEditName}
                            />
                            {editTarget?.hasAppAccess === false && (
                                <Input
                                    label="Email (Opcional)"
                                    placeholder="email@ejemplo.com"
                                    value={editEmail}
                                    onChangeText={setEditEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            )}
                        </View>

                        <Text style={[styles.roleLabel, { color: theme.text.secondary, marginTop: 0, marginBottom: spacing.xs }]}>
                            Rol en la Academia
                        </Text>

                        <View style={{ gap: spacing.xs, marginVertical: spacing.sm, width: '100%' }}>
                            {(['owner', 'coach', 'assistant', 'viewer'] as const)
                                .filter(role => {
                                    if (!editTarget?.hasAppAccess && (role === 'owner' || role === 'viewer')) {
                                        return false;
                                    }
                                    return true;
                                })
                                .map((role) => (
                                    <TouchableOpacity
                                        key={role}
                                        style={{
                                            padding: spacing.sm,
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
                                            <Text style={[{ color: theme.text.secondary }, typography.variants.bodySmall]}>
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
                                            setTimeout(() => showSuccess('Acceso revocado', `${editTarget.name} ya no tiene acceso a la app`), 100);
                                        } catch (err: any) {
                                            showError('Error', err.message || 'No se pudo revocar el acceso');
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
                                            setTimeout(() => showSuccess('¡Acceso restaurado!', `${editTarget.name} puede acceder nuevamente`), 100);
                                        } catch (err: any) {
                                            showError('Error', err.message || 'No se pudo restaurar el acceso');
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

                        {editTarget?.hasAppAccess === false && (
                            <View style={[styles.promotionSection, { borderTopColor: theme.border.default, marginTop: spacing.md, paddingTop: spacing.md }]}>

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
                                            style={[styles.confirmButton, { marginTop: spacing.sm, backgroundColor: theme.components.button.primary.bg, alignSelf: 'center', minWidth: 140, height: 36 }]}
                                            onPress={handlePromote}
                                            disabled={promoteMember.isPending}
                                        >
                                            <Text style={[styles.confirmButtonText, { color: theme.text.inverse, fontSize: 13 }]}>
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

            <StatusModal
                visible={modalVisible}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
                onClose={() => setModalVisible(false)}
                onConfirm={modalConfig.onConfirm}
                buttonText={modalConfig.confirmText}
                showCancel={!!modalConfig.onConfirm}
            />
        </View >
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    // Header Styles
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.background.surface,
        borderBottomWidth: 1,
        borderColor: theme.border.subtle,
        paddingHorizontal: spacing.md,
    },
    headerLeft: {
        width: 40,
        alignItems: 'flex-start',
    },
    headerRight: {
        width: 40,
    },
    backButton: {
        padding: 4,
    },
    headerTitleWrapper: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleText: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: theme.text.primary,
    },
    // Body Styles
    bodyContainer: {
        flex: 1,
        backgroundColor: theme.background.default,
        paddingTop: spacing.md,
    },
    subtitleText: {
        fontSize: typography.size.sm,
        color: theme.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    controlsWrapper: {
        flexDirection: 'row',
        gap: spacing.sm,
        width: '100%',
        maxWidth: 480,
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        alignSelf: 'center',
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingHorizontal: spacing.sm,
        height: 38,
        backgroundColor: theme.background.input,
        borderWidth: 1,
        borderColor: theme.border.default,
    },
    searchInputText: {
        flex: 1,
        height: '100%',
        ...typography.variants.bodyMedium,
        marginLeft: spacing.xs,
        paddingVertical: 0,
        color: theme.text.primary,
        outlineStyle: 'none' as any,
    },
    addButton: {
        paddingHorizontal: spacing.md,
        height: 38,
    },

    centerWrapper: {
        width: '80%', // Reduced by 20% from full width
        maxWidth: 800, // Reduced from 1000 to apply 20% reduction
        alignSelf: 'center',
        flex: 1,
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        marginTop: 15,
        paddingVertical: spacing.sm,
        marginBottom: spacing.sm,
        gap: spacing.md,
        justifyContent: 'center',
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: 20,
        backgroundColor: theme.background.subtle,
    },
    activeFilterTab: {
        backgroundColor: theme.components.button.primary.bg,
    },
    filterTabText: {
        ...typography.variants.labelSmall,
        color: theme.text.tertiary,
    },
    activeFilterTabText: {
        color: theme.text.inverse,
    },
    loadingContainer: {
        marginTop: spacing.xl * 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: spacing.md,
        paddingTop: 0,
    },
    memberCard: {
        marginBottom: spacing.sm,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    memberMainInfo: {
        flex: 1,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: spacing.sm,
        rowGap: 4,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    memberName: {
        ...typography.variants.bodyMedium,
        fontWeight: '600',
        color: theme.text.primary,
    },
    memberEmail: {
        ...typography.variants.bodySmall,
        color: theme.text.secondary,
    },
    roleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    roleText: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    statusText: {
        ...typography.variants.bodySmall,
        fontWeight: '600',
    },
    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    actionButton: {
        padding: spacing.xs,
    },
    inviteIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.background.subtle,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
        gap: spacing.md,
    },
    emptyText: {
        ...typography.variants.bodyMedium,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: theme.background.backdrop,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContent: {
        width: '100%',
        maxWidth: 500,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.border.subtle,
        padding: spacing.lg,
    },
    modalTitle: {
        ...typography.variants.h3,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    modalSubtitle: {
        textAlign: 'center',
        marginBottom: spacing.xs,
        color: theme.text.secondary,
    },
    accessToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
        padding: spacing.sm,
        backgroundColor: theme.background.subtle,
        borderRadius: 12,
    },
    accessToggleLabel: {
        fontWeight: '600',
        color: theme.text.primary,
    },
    accessToggleOptions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    accessOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        gap: 6,
    },
    accessOptionText: {
        fontWeight: '600',
        fontSize: 12,
    },
    roleLabel: {
        fontWeight: '600',
        marginBottom: spacing.xs,
        marginTop: spacing.sm,
        color: theme.text.primary,
    },
    roleOptions: {
        gap: spacing.sm,
        paddingBottom: spacing.sm,
    },
    roleOption: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border.default,
    },
    roleOptionActive: {
        backgroundColor: theme.components.button.primary.bg,
        borderColor: theme.components.button.primary.bg,
    },
    roleOptionText: {
        fontWeight: '600',
        color: theme.text.secondary,
    },
    roleOptionTextActive: {
        color: theme.text.inverse,
    },
    roleHint: {
        ...typography.variants.bodySmall,
        color: theme.text.secondary,
        textAlign: 'center',
        marginTop: spacing.md,
        fontStyle: 'italic',
        minHeight: 40,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.lg,
        justifyContent: 'center',
    },
    confirmButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xl,
        borderRadius: 12,
        alignItems: 'center',
        minWidth: 160,
    },
    confirmButtonText: {
        fontWeight: '600',
    },
    deleteIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: spacing.md,
    },
    deleteMessage: {
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    promotionSection: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
    },
    promotionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.xs,
    },
    promotionTitle: {
        fontWeight: '700',
    },
    promotionDesc: {
        fontSize: 12,
        marginBottom: spacing.md,
    },
    countBadge: {
        borderRadius: 10,
        paddingHorizontal: 4,
        height: 14,
        minWidth: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.xs,
    },
    countBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        lineHeight: 12,
    },
});
