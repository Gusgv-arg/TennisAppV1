import { supabase } from '@/src/services/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import Modal from './Modal';
import { HelpModal, HelpItem } from '@/src/components/HelpModal';

import { SelectorOption, SelectorSheet } from '@/src/components/SelectorSheet';
import StatusModal from '@/src/components/StatusModal';
import { commonStyles } from '@/src/design/common';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { Row } from '@/src/design/components/Row';
import { Section } from '@/src/design/components/Section';
import { Selector } from '@/src/design/components/Selector';
import { Theme } from '@/src/design/theme';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useClassGroup, useClassGroupMutations } from '@/src/features/calendar/hooks/useClassGroups';
import { usePricingPlans } from '@/src/features/payments/hooks/usePricingPlans';
import { useSubscriptions } from '@/src/features/payments/hooks/useSubscriptions';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useGroupImageUpload } from '@/src/hooks/useGroupImageUpload';
import { useImagePicker } from '@/src/hooks/useImagePicker';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/store/useAuthStore';
import { ClassGroup } from '@/src/types/classGroups';
import { showError, showSuccess } from '@/src/utils/toast';

interface GroupModalProps {
    visible: boolean;
    onClose: () => void;
    groupId: string | null;
    mode: 'view' | 'edit' | 'create';
}

export default function GroupModal({ visible, onClose, groupId, mode: initialMode }: GroupModalProps) {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const { theme, isDark } = useTheme();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const isDesktop = windowWidth >= 768;

    const [mode, setMode] = useState<'view' | 'edit' | 'create'>(initialMode);

    // Data Hooks
    const { data: group, isLoading: isFetchingGroup } = useClassGroup(groupId || '');
    const isLoadingGroup = isFetchingGroup && !!groupId;
    const { data: players } = usePlayers();
    const { plans } = usePricingPlans();
    const { createGroup, updateGroup } = useClassGroupMutations();
    const { assignPlan } = useSubscriptions();

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        plan_id: null as string | null,
        members: [] as { player_id: string; plan_id: string | null; is_plan_exempt?: boolean }[],
    });
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [memberSearch, setMemberSearch] = useState('');

    // UI State
    const [showGroupPlanSelector, setShowGroupPlanSelector] = useState(false);
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);


    // Confirmation Modal for Future Sessions
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [pendingSave, setPendingSave] = useState(false);
    const [futureSessionsCount, setFutureSessionsCount] = useState(0);

    // Image Upload
    const { pickImageFromCamera, pickImageFromGallery } = useImagePicker();
    const { uploadGroupImage, isUploading } = useGroupImageUpload();
    
    // Help Modal
    const [helpModalVisible, setHelpModalVisible] = useState(false);
    const [helpModalConfig, setHelpModalConfig] = useState<{ title: string; items: HelpItem[] }>({
        title: '',
        items: []
    });

    // Init Logic
    useEffect(() => {
        if (visible) {
            setMode(initialMode);
            if (initialMode === 'create') {
                resetForm();
            }
        }
    }, [visible, initialMode]);

    useEffect(() => {
        if (group && visible && (mode === 'edit' || mode === 'view')) {
            loadGroupData(group);
        }
    }, [group, visible, mode]);

    const resetForm = () => {
        setFormData({ name: '', description: '', plan_id: null, members: [] });
        setAvatarUri(null);
        setMemberSearch('');
    };

    const loadGroupData = (data: ClassGroup) => {
        setFormData({
            name: data.name,
            description: data.description || '',
            plan_id: data.plan_id || null,
            members: data.members?.map(m => ({
                player_id: m.player_id,
                plan_id: m.plan_id || null,
                is_plan_exempt: m.is_plan_exempt
            })) || [],
        });
        setAvatarUri(data.image_url || null);
    };

    // Member Search Logic
    const filteredMembers = useMemo(() => {
        if (memberSearch.length < 1 || !players) return [];
        const currentMemberIds = formData.members.map(m => m.player_id);
        return players
            .filter((p: any) =>
                !currentMemberIds.includes(p.id) &&
                p.full_name?.toLowerCase().includes(memberSearch.toLowerCase())
            )
            .slice(0, 5);
    }, [memberSearch, players, formData.members]);

    // Actions
    const handleAvatarPress = async () => {
        if (mode === 'view') return;
        
        if (Platform.OS === 'web') {
            const uri = await pickImageFromGallery();
            if (uri) setAvatarUri(uri);
            return;
        }
        
        Alert.alert(
            t('players.modals.group.labels.profilePhoto') || 'Foto del grupo',
            t('players.modals.group.labels.chooseOption') || 'Elige una opción',
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('players.modals.group.labels.takePhoto') || 'Tomar foto',
                    onPress: async () => {
                        const uri = await pickImageFromCamera();
                        if (uri) setAvatarUri(uri);
                    },
                },
                {
                    text: t('players.modals.group.labels.chooseFromGallery') || 'Elegir de galería',
                    onPress: async () => {
                        const uri = await pickImageFromGallery();
                        if (uri) setAvatarUri(uri);
                    },
                },
            ]
        );
    };

    const handleSave = async (force: boolean = false) => {
        if (!formData.name.trim()) {
            showError(t('error'), t('players.modals.group.validation.nameRequired'));
            return;
        }

        // --- Check for future sessions if editing and not already confirmed ---
        if (mode === 'edit' && groupId && !force) {
            try {
                const now = new Date().toISOString();
                const { count, error: countError } = await supabase
                    .from('sessions')
                    .select('*', { count: 'exact', head: true })
                    .eq('class_group_id', groupId)
                    .gte('scheduled_at', now)
                    .neq('status', 'cancelled')
                    .is('deleted_at', null);

                if (!countError && count && count > 0) {
                    setFutureSessionsCount(count);
                    setConfirmModalVisible(true);
                    return; // Stop here, wait for modal
                }
            } catch (err) {
                console.warn('[GroupModal] Error checking future sessions:', err);
                // We continue if check fails to not block user
            }
        }

        // Proceed with save logic
        try {
            const subscriptionPromises = formData.members.map(async (m) => {
                if (m.is_plan_exempt) return;
                const targetPlanId = m.plan_id || formData.plan_id;
                if (!targetPlanId) return;

                const player = players?.find((p: any) => p.id === m.player_id);
                if (!player) return;

                const hasActiveSub = player.active_subscriptions?.some(
                    (s: any) => s.plan?.id === targetPlanId && s.status === 'active'
                );

                if (!hasActiveSub) {
                    await assignPlan({
                        playerId: m.player_id,
                        planId: targetPlanId,
                    });
                }
            });

            await Promise.all(subscriptionPromises);
        } catch (error) {
            console.error('[Auto-Sub] Error:', error);
        }

        try {
            const idToUse = groupId || `temp_${Date.now()}`;
            let image_url = mode === 'edit' && group ? group.image_url : undefined;

            if (avatarUri && !avatarUri.startsWith('http')) {
                const uploadedUrl = await uploadGroupImage(avatarUri, idToUse);
                if (uploadedUrl) image_url = uploadedUrl;
            }

            const { profile } = useAuthStore.getState();

            const membersPayload = formData.members.map(m => ({
                player_id: m.player_id,
                plan_id: m.plan_id,
                is_plan_exempt: m.is_plan_exempt
            }));

            if (mode === 'edit' && groupId) {
                await updateGroup.mutateAsync({
                    id: groupId,
                    input: { ...formData, members: membersPayload, image_url },
                });
            } else {
                await createGroup.mutateAsync({
                    ...formData,
                    members: membersPayload,
                    image_url,
                    academy_id: profile?.current_academy_id
                });
            }

            // Close modal first, then show success toast from the root layout
            onClose();
            setTimeout(() => {
                if (mode === 'edit') {
                    showSuccess(
                        t('players.notifications.groupUpdated'),
                        t('players.notifications.groupUpdatedDetail')
                    );
                } else {
                    showSuccess(
                        t('players.notifications.groupCreated'),
                        t('players.notifications.groupCreatedDetail').replace(' de pago unificado', '')
                    );
                }
            }, 400); 
        } catch (error) {
            console.error(error);
            showError(t('error'), t('errorOccurred'));
        }
    };



    // Member Management
    const addMember = (pid: string) => {
        setFormData(prev => ({
            ...prev,
            members: [...prev.members, { player_id: pid, plan_id: null, is_plan_exempt: false }],
        }));
    };

    const removeMember = (pid: string) => {
        setFormData(prev => ({
            ...prev,
            members: prev.members.filter(m => m.player_id !== pid),
        }));
    };

    const updateMemberPlan = (pid: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            members: prev.members.map(m => {
                if (m.player_id !== pid) return m;

                if (value === '__default__') {
                    return { ...m, plan_id: null, is_plan_exempt: false };
                } else if (value === 'none_explicit') {
                    return { ...m, plan_id: null, is_plan_exempt: true };
                } else {
                    return { ...m, plan_id: value, is_plan_exempt: false };
                }
            }),
        }));
    };

    const showGroupPlanHelp = () => {
        setHelpModalConfig({
            title: t('players.modals.group.fields.plan'),
            items: [
                {
                    icon: 'people-outline',
                    title: t('players.modals.group.validation.help.groupPlan.items.default.title') || 'Plan Base',
                    description: t('players.modals.group.validation.help.groupPlan.items.default.desc') || 'Es el cobro que se aplica a todos los miembros del grupo por defecto.'
                },
                {
                    icon: 'person-add-outline',
                    title: t('players.modals.group.validation.help.groupPlan.items.individual.title') || 'Planes Distintos',
                    description: t('players.modals.group.validation.help.groupPlan.items.individual.desc') || 'Podés asignar un plan diferente a alumnos específicos si lo necesitás.'
                },
                {
                    icon: 'sync-outline',
                    title: t('players.modals.group.validation.help.groupPlan.items.sync.title') || 'Cambio Automático',
                    description: t('players.modals.group.validation.help.groupPlan.items.sync.desc') || 'Al cambiar el plan del grupo, el nuevo valor se aplica a todos los miembros que no tengan un plan individual.'
                }
            ]
        });
        setHelpModalVisible(true);
    };

    // Helper Display Logic
    const getMemberPlanLabel = (member: { plan_id: string | null; is_plan_exempt?: boolean }) => {
        if (member.is_plan_exempt) return t('players.modals.group.labels.excludedFromPayment');
        if (member.plan_id) return plans?.find(p => p.id === member.plan_id)?.name || t('players.modals.group.labels.customPlan');
        return t('players.modals.group.labels.groupPlan');
    };

    const selectedGroupPlanLabel = useMemo(() => {
        if (!formData.plan_id) return t('players.modals.group.labels.noGroupPlan');
        return plans?.find((p: any) => p.id === formData.plan_id)?.name || t('players.modals.group.labels.noGroupPlan');
    }, [formData.plan_id, plans, t]);

    const planOptions: SelectorOption[] = [
        { label: t('players.modals.group.labels.noGroupPlan'), value: '', icon: 'remove-circle-outline' },
        ...(plans?.map((p: any) => ({
            label: p.name,
            value: p.id,
            icon: 'pricetag-outline' as const
        })) || [])
    ];

    const getMemberPlanOptions = (): SelectorOption[] => {
        const defaultPlanId = plans?.find((p: any) => p.is_default)?.id || null;
        const defaultPlanName = plans?.find((p: any) => p.id === (formData.plan_id || defaultPlanId))?.name || t('players.modals.group.labels.noGroupPlan');

        return [
            {
                label: t('players.modals.group.labels.groupPlan'),
                subLabel: t('players.modals.group.labels.inheritLabel', { plan: defaultPlanName }),
                value: '__default__',
                icon: 'people-outline',
                color: theme.components.button.primary.bg
            },
            {
                label: t('players.modals.group.labels.excludedFromPayment'),
                subLabel: t('players.modals.group.labels.excludeDescription'),
                value: 'none_explicit',
                icon: 'alert-circle-outline',
                color: theme.status.error,
                isDestructive: true
            },
            ...(plans?.map((p: any) => ({
                label: p.name,
                value: p.id,
                icon: 'pricetag-outline' as const
            })) || [])
        ];
    };

    const closeModal = () => {
        onClose();
    };



    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={closeModal}
        >
            <View style={[styles.modalOverlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[
                    styles.modalContainer,
                    isDesktop && { width: 500, alignSelf: 'center' }
                ]}>
                    <View
                        style={{ flex: 1 }}
                    >
                        {/* Header */}
                        <View style={[styles.modalHeader, { backgroundColor: theme.background.surface, borderBottomColor: theme.border.subtle }]}>
                            <View style={{ width: 44 }}>
                                {mode === 'view' && (
                                    <TouchableOpacity onPress={() => setMode('edit')} style={styles.headerBtn}>
                                        <Ionicons name="create-outline" size={24} color={theme.components.button.primary.bg} />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <Text style={[styles.modalTitle, { color: theme.text.primary, textAlign: 'center', flex: 1 }]}>
                                {!isLoadingGroup && (mode === 'create' ? t('players.modals.group.titleCreate') : (mode === 'edit' ? t('players.modals.group.titleEdit') : t('players.modals.group.titleView')))}
                            </Text>
                            <TouchableOpacity onPress={closeModal} style={styles.headerBtn}>
                                <Ionicons name="close" size={24} color={theme.text.primary} />
                            </TouchableOpacity>
                        </View>

                        {isLoadingGroup && groupId ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
                            </View>
                        ) : (
                            <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                                <View style={[styles.formContainer, isDesktop && styles.desktopContainer]}>
                                    {/* Avatar */}
                                    <View style={styles.sectionCentered}>
                                        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={mode === 'view' ? 1 : 0.8} disabled={mode === 'view'}>
                                            <Avatar
                                                source={avatarUri || undefined}
                                                name={formData.name || '?'}
                                                size="xl"
                                            />
                                            {mode !== 'view' && (
                                                <View style={styles.editBadge}>
                                                    <Ionicons name="camera" size={14} color="white" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    </View>



                                    {/* Name */}
                                    <Section title={t('players.modals.group.fields.name')}>
                                        {mode === 'view' ? (
                                            <Text style={[{ color: theme.text.primary }, typography.variants.bodyLarge]}>{formData.name}</Text>
                                        ) : (
                                            <Input
                                                value={formData.name}
                                                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                                                placeholder={t('players.modals.group.placeholders.name')}
                                            />
                                        )}
                                    </Section>

                                    {/* Plan */}
                                    <Section
                                        title={t('players.modals.group.fields.plan')}
                                        icon="pricetag-outline"
                                        footer={t('players.modals.group.labels.planInherit')}
                                        onHelpPress={mode !== 'view' ? showGroupPlanHelp : undefined}
                                    >
                                        {mode === 'view' ? (
                                            <Row>
                                                <Text style={[{ color: theme.text.primary }, typography.variants.bodyLarge]}>
                                                    {selectedGroupPlanLabel}
                                                </Text>
                                            </Row>
                                        ) : (
                                            <>
                                                <Selector
                                                    value={selectedGroupPlanLabel}
                                                    onPress={() => setShowGroupPlanSelector(true)}
                                                    leftIcon={
                                                        <Ionicons
                                                            name={formData.plan_id ? "pricetag" : "pricetag-outline"}
                                                            size={20}
                                                            color={formData.plan_id ? theme.text.primary : theme.text.secondary}
                                                        />
                                                    }
                                                />
                                            </>
                                        )}
                                    </Section>



                                    <Section title={`${t('players.modals.group.fields.members')} (${formData.members.length})`}>

                                        <View style={styles.membersList}>
                                            {formData.members.map((member: any) => {
                                                const player = players?.find((p: any) => p.id === member.player_id);
                                                if (!player) return null;
                                                const planLabel = getMemberPlanLabel(member);

                                                return (
                                                    <View key={member.player_id} style={[styles.memberRow, { backgroundColor: isDark ? theme.background.subtle : theme.background.input }]}>
                                                        <Avatar name={player.full_name} source={player.avatar_url} size="sm" />
                                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                                            <Text style={[styles.memberName, { color: theme.text.primary }]}>{player.full_name}</Text>
                                                            {mode === 'view' ? (
                                                                <Text style={[
                                                                    styles.memberPlanText,
                                                                    member.is_plan_exempt && { color: theme.status.error },
                                                                    member.plan_id && { color: theme.text.primary }
                                                                ]}>
                                                                    {planLabel}
                                                                </Text>
                                                            ) : (
                                                                <Selector
                                                                    value={planLabel}
                                                                    onPress={() => setEditingMemberId(member.player_id)}
                                                                    size="sm"
                                                                    style={[styles.memberPlanBadge]}
                                                                    valueStyle={[
                                                                        member.is_plan_exempt && { color: theme.status.error },
                                                                        member.plan_id && { color: theme.text.primary },
                                                                        typography.variants.labelSmall,
                                                                    ]}
                                                                    rightIcon={<Ionicons name="chevron-down" size={12} color={theme.text.secondary} />}
                                                                />
                                                            )}
                                                        </View>
                                                        {mode !== 'view' && (
                                                            <TouchableOpacity
                                                                onPress={() => removeMember(member.player_id)}
                                                                style={styles.removeMemberBtn}
                                                            >
                                                                <Ionicons name="close-circle" size={20} color={theme.text.secondary} />
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                );
                                            })}
                                            {formData.members.length === 0 && (
                                                <Text style={[styles.emptyMembersText, { color: theme.text.secondary }]}>{t('players.emptyState.noMembers')}</Text>
                                            )}
                                        </View>



                                        {mode !== 'view' && (
                                            <>
                                                <Input
                                                    value={memberSearch}
                                                    onChangeText={setMemberSearch}
                                                    placeholder={t('players.modals.group.placeholders.searchMembers')}
                                                    leftIcon={<Ionicons name="search" size={18} color={theme.text.secondary} />}
                                                />

                                                {memberSearch.length >= 1 && (
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
                                                        {filteredMembers.map((player: any) => (
                                                            <TouchableOpacity
                                                                key={player.id}
                                                                style={[styles.suggestionChip, { backgroundColor: theme.background.surface, borderColor: theme.border.default }]}
                                                                onPress={() => {
                                                                    addMember(player.id);
                                                                    setMemberSearch('');
                                                                }}
                                                            >
                                                                <Avatar name={player.full_name} size="xs" />
                                                                <Text style={[styles.suggestionText, { color: theme.text.primary }]}>{player.full_name}</Text>
                                                                <Ionicons name="add-circle" size={18} color={theme.status.info} style={{ marginLeft: 4 }} />
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                )}
                                            </>
                                        )}
                                    </Section>



                                    {/* Notes */}
                                    <Section title={t('players.modals.group.fields.notes')}>
                                        {mode === 'view' ? (
                                            <Text style={[{ color: theme.text.primary }, typography.variants.bodyLarge]}>{formData.description || t('players.modals.group.labels.noNotes')}</Text>
                                        ) : (
                                            <Input
                                                inputStyle={{ minHeight: 100, textAlignVertical: 'top' }}
                                                value={formData.description}
                                                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                                                placeholder={t('players.modals.group.placeholders.notes')}
                                                multiline
                                            />
                                        )}
                                    </Section>

                                    {mode !== 'view' && (
                                        <View style={[styles.footerInner, { marginTop: spacing.md, paddingBottom: spacing.lg }]}>
                                            <View style={{ width: 'auto', minWidth: 200, alignSelf: 'center' }}>
                                                <Button
                                                    label={mode === 'edit' ? t('common.saveChanges') : t('players.addGroup')}
                                                    onPress={() => handleSave()}
                                                    loading={createGroup.isPending || updateGroup.isPending || isUploading}
                                                    variant="primary"
                                                />
                                            </View>
                                        </View>
                                    )}


                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View >
            </View >

            {/* Selectors */}
            {
                mode !== 'view' && (
                    <>
                        <SelectorSheet
                            visible={showGroupPlanSelector}
                            title={t('players.modals.group.fields.plan')}
                            options={planOptions}
                            onSelect={(val) => {
                                setFormData(prev => ({ ...prev, plan_id: val === '' ? null : val }));
                                setShowGroupPlanSelector(false);
                            }}
                            onClose={() => setShowGroupPlanSelector(false)}
                            selectedValue={formData.plan_id || ''}
                        />

                        <SelectorSheet
                            visible={!!editingMemberId}
                            title={t('players.modals.player.labels.assignPlan')}
                            options={getMemberPlanOptions()}
                            onSelect={(val) => {
                                if (editingMemberId) updateMemberPlan(editingMemberId, val);
                                setEditingMemberId(null);
                            }}
                            onClose={() => setEditingMemberId(null)}
                            selectedValue={
                                editingMemberId
                                    ? (formData.members.find(m => m.player_id === editingMemberId)?.is_plan_exempt
                                        ? 'none_explicit'
                                        : (formData.members.find(m => m.player_id === editingMemberId)?.plan_id || '__default__'))
                                    : null
                            }
                        />
                    </>
                )
            }

            <StatusModal
                visible={confirmModalVisible}
                type="warning"
                title={t('players.modals.group.conflicts.futureSessionsTitle')}
                message={
                    <Text style={{ textAlign: 'center', color: theme.text.secondary, lineHeight: 20, marginBottom: 10 }}>
                        {t(futureSessionsCount === 1 ? 'players.modals.group.conflicts.futureSessionsMessage_singular' : 'players.modals.group.conflicts.futureSessionsMessage', { count: futureSessionsCount })} {"\n\n"}
                        {t('players.modals.group.conflicts.noAutoApply')} {"\n\n"}
                        {t('players.modals.group.conflicts.massEditNotice')}
                    </Text>
                }
                showCancel={true}
                cancelText={t('back')}
                buttonText={t('save')}
                onClose={() => setConfirmModalVisible(false)}
                onConfirm={() => {
                    setConfirmModalVisible(false);
                    handleSave(true); // Call save again, forcing bypass of check
                }}
            />
            
            <HelpModal
                visible={helpModalVisible}
                onClose={() => setHelpModalVisible(false)}
                title={helpModalConfig.title}
                items={helpModalConfig.items}
            />

        </Modal >
    );
}

const createStyles = (theme: Theme): any => StyleSheet.create({
    modalOverlay: {
        ...commonStyles.modal.overlay,
    },
    modalContainer: {
        ...commonStyles.modal.content,
        backgroundColor: theme.background.surface,
        borderWidth: 1,
        borderColor: theme.border.subtle,
        // Fix robusto para Android: evita que el modal colapse a altura 0
        ...(Platform.OS !== 'web' && {
            height: '92%',
            maxHeight: '92%',
            width: '100%',
        })
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
    },
    modalTitle: {
        ...typography.variants.h3,
    },
    headerBtn: {
        padding: spacing.sm,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        // Removed flex: 1 to avoid Android collapse inside the ScrollView
    },
    formContainer: {
        padding: spacing.md,
    },
    desktopContainer: {
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
    },
    sectionCentered: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: theme.status.success,
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: theme.background.surface,
    },
    selectorButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        height: 48,
        borderWidth: 1,
    },
    viewText: {
        ...typography.variants.bodyLarge,
        color: theme.text.primary,
    },
    selectorText: {
        ...typography.variants.bodyLarge,
        fontWeight: '500', // keeping medium weight for selector
    },
    membersList: {
        marginBottom: spacing.sm,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.xs,
        paddingRight: spacing.sm,
        borderRadius: 30, // Pill shape
        marginBottom: spacing.xs,
    },
    planName: {
        ...typography.variants.label,
        color: theme.mode === 'dark' ? colors.primary[400] : colors.primary[600],
    },
    memberName: {
        ...typography.variants.label,
        color: theme.text.primary,
    },
    memberPlanBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    memberInitialText: {
        ...typography.variants.labelSmall,
        color: theme.text.inverse,
    },
    memberPlanText: {
        ...typography.variants.bodySmall,
        fontWeight: '500',
        color: theme.text.secondary,
    },
    removeMemberBtn: {
        padding: 4,
    },
    emptyMembersText: {
        ...typography.variants.bodyMedium,
        fontStyle: 'italic',
        marginBottom: spacing.sm,
    },
    suggestionsScroll: {
        marginTop: spacing.sm,
        flexDirection: 'row',
    },
    suggestionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginRight: spacing.sm,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
        elevation: 1,
    },
    emptyText: {
        ...typography.variants.bodyMedium,
        color: theme.text.tertiary,
        textAlign: 'center',
    },
    suggestionText: {
        ...typography.variants.label,
        marginLeft: 8,
    },
    footerInner: {
        marginTop: spacing.md,
    }
});
