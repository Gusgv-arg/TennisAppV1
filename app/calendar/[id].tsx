import { TimePickerModal } from '@/src/features/calendar/components/TimePickerModal';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { commonStyles } from '@/src/design/common';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import { DatePickerModal } from '@/src/features/calendar/components/DatePickerModal';
import { checkSessionConflicts, useSession, useSessionMutations } from '@/src/features/calendar/hooks/useSessions';
import { useCollaborators } from '@/src/features/collaborators/hooks/useCollaborators';
import { useLocations } from '@/src/features/locations/hooks/useLocations';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/store/useAuthStore';
import { SessionStatus } from '@/src/types/session';

interface FormData {
    player_ids: string[];
    scheduled_at: Date;
    ends_at: Date;
    location: string;
    court: string;
    instructor_id: string | null;
    status: SessionStatus;
    notes: string;
}

export default function EditSessionScreen() {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const { data: session, isLoading: loadingSession } = useSession(id);
    const { data: players, isLoading: loadingPlayers } = usePlayers();
    const { data: locations, isLoading: loadingLocations } = useLocations();
    const { updateSession } = useSessionMutations();

    const [playerPickerVisible, setPlayerPickerVisible] = useState(false);
    const [playerSearch, setPlayerSearch] = useState('');
    const [timePickerVisible, setTimePickerVisible] = useState(false);
    const [endTimePickerVisible, setEndTimePickerVisible] = useState(false);
    const [endTimeManuallySet, setEndTimeManuallySet] = useState(false);
    const [locationPickerVisible, setLocationPickerVisible] = useState(false);
    const [locationSearch, setLocationSearch] = useState('');
    const [collaboratorPickerVisible, setCollaboratorPickerVisible] = useState(false);
    const [collaboratorSearch, setCollaboratorSearch] = useState('');
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    // State to track which subscription each player uses for billing
    const [playerSubscriptions, setPlayerSubscriptions] = useState<Record<string, string | null>>({});
    // Multi-academy: selected academy for this session
    const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);

    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        type: StatusType;
        title: string;
        message: string;
    }>({
        type: 'info',
        title: '',
        message: '',
    });

    const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
        defaultValues: {
            player_ids: [],
            scheduled_at: new Date(),
            ends_at: new Date(),
            location: '',
            court: '',
            instructor_id: null,
            status: 'scheduled',
            notes: '',
        },
    });

    useEffect(() => {
        if (session) {
            const start = new Date(session.scheduled_at);
            const end = new Date(start);
            end.setMinutes(end.getMinutes() + session.duration_minutes);

            reset({
                player_ids: session.players?.map(p => p.id) || (session.player_id ? [session.player_id] : []),
                scheduled_at: start,
                ends_at: end,
                location: session.location || '',
                court: session.court || '',
                instructor_id: (session as any).instructor_id || null,
                status: session.status,
                notes: session.notes || '',
            });
            const initialSubs: Record<string, string | null> = {};
            session.players?.forEach((p: any) => {
                if (p.subscription_id) {
                    initialSubs[p.id] = p.subscription_id;
                }
            });
            setPlayerSubscriptions(initialSubs);
            // Sync academy from loaded session
            if (session.academy_id) {
                setSelectedAcademyId(session.academy_id);
            }
        }
    }, [session, reset]);

    const scheduledAt = watch('scheduled_at');
    const endsAt = watch('ends_at');
    const selectedPlayerIds = watch('player_ids');

    const selectedPlayersText = useMemo(() => {
        if (!players || selectedPlayerIds.length === 0) return '';
        const selectedNames = selectedPlayerIds
            .map(id => players.find(p => p.id === id)?.full_name)
            .filter(Boolean);
        return selectedNames.join(', ');
    }, [players, selectedPlayerIds]);

    const locationName = watch('location');
    const instructorId = watch('instructor_id');

    const { data: collaborators, isLoading: loadingCollaborators } = useCollaborators('', false);
    const { user, profile } = useAuthStore();
    const { data: academiesData } = useUserAcademies();

    // Multi-academy: list of active academies
    const academies = academiesData?.active || [];
    const hasMultipleAcademies = academies.length > 1;

    const instructorName = useMemo(() => {
        if (!instructorId) return profile?.full_name || t('you');
        const instructor = collaborators?.find((s: any) => s.id === instructorId);
        return instructor?.full_name || '';
    }, [instructorId, collaborators, profile, t]);

    // Calculate exempt players from session context (class group)
    const exemptPlayerIds = useMemo(() => {
        if (!session?.class_group?.members) return new Set<string>();
        return new Set(session.class_group.members
            .filter((m: any) => m.is_plan_exempt)
            .map((m: any) => m.player_id));
    }, [session]);

    const onSubmit = async (data: FormData) => {
        try {
            // Calculate duration in minutes
            const durationMs = data.ends_at.getTime() - data.scheduled_at.getTime();
            const durationMinutes = Math.max(0, Math.round(durationMs / (1000 * 60)));

            // Check for scheduling conflicts (exclude current session)
            if (user?.id) {
                const conflicts = await checkSessionConflicts(
                    user.id,
                    data.player_ids,
                    data.scheduled_at,
                    durationMinutes,
                    data.location || null,
                    data.court || null,
                    data.instructor_id,
                    id // Exclude this session from conflict check
                );

                // Rule 1: Player can't be in two sessions at same time
                if (conflicts.playerConflicts.length > 0) {
                    const conflictingNames = conflicts.playerConflicts
                        .map((pid: string) => players?.find(p => p.id === pid)?.full_name)
                        .filter(Boolean)
                        .join(', ');

                    setModalConfig({
                        type: 'warning',
                        title: t('schedulingConflict'),
                        message: t('playerConflictMessage', { players: conflictingNames }),
                    });
                    setModalVisible(true);
                    return;
                }

                // Rule 2: Instructor can't have two sessions at same time
                if (conflicts.instructorConflict) {
                    setModalConfig({
                        type: 'warning',
                        title: t('schedulingConflict'),
                        message: t('instructorConflictMessage', { instructor: instructorName }),
                    });
                    setModalVisible(true);
                    return;
                }

                // Rule 3: Location/Court can't have two sessions at same time
                if (conflicts.locationConflict) {
                    const message = data.court
                        ? t('locationAndCourtConflictMessage', { location: data.location, court: data.court })
                        : t('locationConflictMessage', { location: data.location });

                    setModalConfig({
                        type: 'warning',
                        title: t('schedulingConflict'),
                        message: message,
                    });
                    setModalVisible(true);
                    return;
                }
            }

            // Validation: Ensure all players have a selected plan
            const missingPlanPlayers = data.player_ids.filter(pid => {
                const player = players?.find(p => p.id === pid);

                // Check exemption (from session group OR global player prop)
                const isExempt = exemptPlayerIds.has(pid) || player?.is_plan_exempt;
                if (isExempt) return false;

                const hasSub = playerSubscriptions[pid];
                // Check if player has any ACTIVE subscriptions
                const activeSubs = player?.active_subscriptions?.filter((s: any) => s.plan?.is_active !== false) || [];
                const hasAvailableSubs = activeSubs.length > 0;

                return !hasSub || !hasAvailableSubs;
            });

            if (missingPlanPlayers.length > 0) {
                const missingNames = missingPlanPlayers.map(pid =>
                    players?.find(p => p.id === pid)?.full_name
                ).join(', ');

                setModalConfig({
                    type: 'warning',
                    title: t('missingPlan') || 'Falta Plan de Pago',
                    message: `Es obligatorio seleccionar un plan de pago para: ${missingNames}. \n\nSi no tienen plan, asignales uno desde la sección Alumnos.`
                });
                setModalVisible(true);
                return;
            }

            // Validation: Check for archived plans
            const playersWithArchivedPlans = data.player_ids.map(pid => {
                const player = players?.find(p => p.id === pid);
                const isExempt = exemptPlayerIds.has(pid) || player?.is_plan_exempt;
                if (isExempt) return null; // Skip check for exempt players

                const subId = playerSubscriptions[pid];
                if (!player || !subId) return null;

                const sub = player.active_subscriptions?.find((s: any) => s.id === subId);
                // Check if plan exists and is inactive (is_active === false)
                if (sub?.plan && sub.plan.is_active === false) {
                    return {
                        name: player.full_name,
                        planName: sub.plan.name
                    };
                }
                return null;
            }).filter((item): item is { name: string; planName: string } => item !== null);

            if (playersWithArchivedPlans.length > 0) {
                const message = playersWithArchivedPlans.map(p =>
                    `• ${p.name} (${p.planName})`
                ).join('\n');

                setModalConfig({
                    type: 'warning',
                    title: 'Plan Archivado',
                    message: `Los siguientes alumnos tienen un plan archivado:\n\n${message}\n\nDebes asignarles un plan activo antes de agendar.`
                });
                setModalVisible(true);
                return;
            }

            // Build player_subscriptions array from state
            const playerSubscriptionsArray = data.player_ids.map(pid => ({
                player_id: pid,
                subscription_id: playerSubscriptions[pid] || null // Allow null for exempt
            }));

            await updateSession.mutateAsync({
                id,
                input: {
                    player_ids: data.player_ids,
                    player_subscriptions: playerSubscriptionsArray, // Pass subscriptions!
                    academy_id: selectedAcademyId, // Multi-academy support
                    scheduled_at: data.scheduled_at.toISOString(),
                    duration_minutes: durationMinutes,
                    location: data.location || null,
                    court: data.court || null,
                    instructor_id: data.instructor_id,
                    status: data.status,
                    notes: data.notes || null,
                }
            });

            setModalConfig({
                type: 'success',
                title: t('success'),
                message: t('sessionUpdated'),
            });
            setModalVisible(true);
        } catch (error) {
            setModalConfig({
                type: 'error',
                title: 'Error',
                message: t('saveError'),
            });
            setModalVisible(true);
        }
    };

    const togglePlayer = (id: string) => {
        const current = [...selectedPlayerIds];
        const index = current.indexOf(id);
        if (index > -1) {
            // Removing player
            current.splice(index, 1);
            setPlayerSubscriptions(prev => {
                const newState = { ...prev };
                delete newState[id];
                return newState;
            });
        } else {
            // Adding player - auto assign if single ACTIVE plan
            current.push(id);
            const player = players?.find(p => p.id === id);
            const activeSubs = player?.active_subscriptions?.filter((s: any) => s.plan?.is_active !== false) || [];

            if (activeSubs.length === 1) {
                setPlayerSubscriptions(prev => ({
                    ...prev,
                    [id]: activeSubs[0].id
                }));
            }
        }
        setValue('player_ids', current, { shouldDirty: true });
    };



    if (loadingSession) {
        return (
            <View style={commonStyles.modal.overlay}>
                <View style={[commonStyles.modal.content, {
                    backgroundColor: theme.background.surface,
                    width: '100%',
                    maxWidth: 600,
                    maxHeight: '95%',
                    padding: 0,
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: 200,
                }]}>
                    <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
                </View>
            </View>
        );
    }



    const handleModalClose = () => {
        setModalVisible(false);
        if (modalConfig.type === 'success') {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/(tabs)/calendar');
            }
        }
    };

    return (
        <View style={commonStyles.modal.overlay}>
            <View style={[commonStyles.modal.content, {
                backgroundColor: theme.background.surface,
                width: '100%',
                maxWidth: 600,
                maxHeight: '95%',
                padding: 0,
            }]}>
                {/* Custom Modal Header */}
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border.default,
                }}>
                    <Text style={{
                        fontSize: typography.size.lg,
                        fontWeight: '700',
                        color: theme.text.primary,
                    }}>
                        {t('editSession')}
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ padding: 4 }}
                    >
                        <Ionicons name="close" size={24} color={theme.text.primary} />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xl }]} showsVerticalScrollIndicator={false}>
                    <View style={styles.formContainer}>

                        {/* Academy Context Badge (Read-only) */}
                        {selectedAcademyId && (
                            <View style={{ marginBottom: spacing.md }}>
                                <Text style={[styles.label, { color: theme.text.secondary }]}>Academia</Text>
                                <View style={{
                                    alignSelf: 'flex-start',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: theme.components.button.primary.bg + '15',
                                    paddingHorizontal: spacing.md,
                                    paddingVertical: spacing.xs,
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: theme.components.button.primary.bg + '30',
                                    gap: spacing.xs
                                }}>
                                    <Ionicons name="school" size={16} color={theme.components.button.primary.bg} />
                                    <Text style={{
                                        fontSize: 13,
                                        fontWeight: '600',
                                        color: theme.components.button.primary.bg
                                    }}>
                                        {academies.find(a => a.id === selectedAcademyId)?.name || 'Academia'}
                                    </Text>
                                </View>
                            </View>
                        )}

                        <Text style={[styles.label, { color: theme.text.secondary }]}>{t('date')}</Text>
                        <TouchableOpacity
                            style={[styles.pickerTrigger, { marginBottom: spacing.md, backgroundColor: theme.background.subtle, borderColor: theme.border.default }]}
                            onPress={() => setDatePickerVisible(true)}
                        >
                            <Ionicons name="calendar-outline" size={20} color={theme.text.tertiary} />
                            <Text style={[styles.pickerValue, { color: theme.text.primary }]}>
                                {scheduledAt.toLocaleDateString(undefined, {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                })}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={theme.text.tertiary} />
                        </TouchableOpacity>

                        <Text style={[styles.label, { color: theme.text.secondary }]}>{t('assignedCoach')}</Text>
                        <TouchableOpacity
                            style={[styles.pickerTrigger, { marginBottom: spacing.md, backgroundColor: theme.background.subtle, borderColor: theme.border.default }]}
                            onPress={() => setCollaboratorPickerVisible(true)}
                        >
                            <Ionicons name="person-circle-outline" size={20} color={theme.text.tertiary} />
                            <Text style={[styles.pickerValue, { color: theme.text.primary }]}>
                                {instructorName}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={theme.text.tertiary} />
                        </TouchableOpacity>

                        <Text style={[styles.label, { color: theme.text.secondary }]}>{t('selectPlayers')}</Text>
                        {!selectedPlayerIds.length && (
                            <>
                                <TouchableOpacity
                                    style={[styles.pickerTrigger, { backgroundColor: theme.background.subtle, borderColor: errors.player_ids ? theme.status.error : theme.border.default }]}
                                    onPress={() => setPlayerPickerVisible(true)}
                                >
                                    <Ionicons name="people-outline" size={20} color={theme.text.tertiary} />
                                    <Text style={[styles.pickerValue, styles.pickerPlaceholder, { color: theme.text.tertiary }]}>
                                        {t('selectPlayers')}
                                    </Text>
                                    <Ionicons name="chevron-down" size={20} color={theme.text.tertiary} />
                                </TouchableOpacity>
                            </>
                        )}

                        {selectedPlayerIds.length > 0 && players && (
                            <View style={{ marginBottom: spacing.md }}>
                                <View style={{ gap: spacing.sm }}>
                                    {players.filter(p => selectedPlayerIds.includes(p.id)).map(player => {
                                        // Filter out archived plans from the options
                                        const subs = (player.active_subscriptions || []).filter((s: any) => s.plan?.is_active !== false);
                                        const hasMultiplePlans = subs.length > 1;
                                        const selectedSubId = playerSubscriptions[player.id];
                                        const selectedPlan = subs.find((s: any) => s.id === selectedSubId);
                                        const isExempt = exemptPlayerIds.has(player.id) || player.is_plan_exempt;

                                        return (
                                            <View key={player.id} style={{
                                                padding: spacing.md,
                                                backgroundColor: theme.components.button.primary.bg + '15',
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: !selectedSubId && subs.length > 0 ? theme.status.warning : theme.border.default
                                            }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                                                        <Avatar name={player.full_name} size="sm" />
                                                        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text.primary }}>
                                                            {player.full_name}
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity onPress={() => togglePlayer(player.id)}>
                                                        <Ionicons name="close-circle" size={22} color={theme.status.error} />
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Plan selector */}
                                                {isExempt ? (
                                                    <Text style={{ fontSize: 12, color: theme.status.success, marginTop: spacing.xs, fontWeight: '600' }}>
                                                        ✅ Excluido del cobro
                                                    </Text>
                                                ) : subs.length === 0 ? (
                                                    <Text style={{ fontSize: 12, color: theme.status.error, marginTop: spacing.xs, fontWeight: '500' }}>
                                                        ⛔ Sin plan activo. Asigna uno en Alumnos.
                                                    </Text>
                                                ) : subs.length === 1 ? (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: 4 }}>
                                                        <Ionicons name="pricetag-outline" size={12} color={theme.components.button.primary.bg} />
                                                        <Text style={{ fontSize: 12, color: theme.components.button.primary.bg }}>
                                                            {subs[0].plan?.name || 'Plan'}
                                                        </Text>
                                                    </View>
                                                ) : (
                                                    <View style={{ marginTop: spacing.sm }}>
                                                        <Text style={{ fontSize: 11, color: theme.text.secondary, marginBottom: 4 }}>
                                                            Seleccionar plan para facturar:
                                                        </Text>
                                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                                                            {subs.map((sub: any) => (
                                                                <TouchableOpacity
                                                                    key={sub.id}
                                                                    onPress={() => setPlayerSubscriptions(prev => ({
                                                                        ...prev,
                                                                        [player.id]: sub.id
                                                                    }))}
                                                                    style={{
                                                                        paddingHorizontal: spacing.sm,
                                                                        paddingVertical: 4,
                                                                        borderRadius: 12,
                                                                        backgroundColor: selectedSubId === sub.id ? theme.components.button.primary.bg : theme.background.subtle,
                                                                        borderWidth: 1,
                                                                        borderColor: selectedSubId === sub.id ? theme.components.button.primary.bg : theme.border.default,
                                                                    }}
                                                                >
                                                                    <Text style={{
                                                                        fontSize: 12,
                                                                        color: selectedSubId === sub.id ? theme.text.inverse : theme.text.secondary,
                                                                        fontWeight: selectedSubId === sub.id ? '600' : '400'
                                                                    }}>
                                                                        {sub.plan?.name || 'Plan'}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                        {!selectedSubId && (
                                                            <Text style={{ fontSize: 11, color: theme.status.warning, marginTop: 4 }}>
                                                                ⚠️ Selecciona un plan
                                                            </Text>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                                <TouchableOpacity
                                    onPress={() => setPlayerPickerVisible(true)}
                                    style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
                                >
                                    <Text style={{ color: theme.components.button.primary.bg, fontSize: 13, fontWeight: '500' }}>
                                        + Agregar alumno
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={[styles.row, { marginTop: spacing.md }]}>
                            <View style={{ flex: 1 }}>
                                <TouchableOpacity
                                    activeOpacity={1}
                                    onPress={() => setTimePickerVisible(true)}
                                >
                                    <Input
                                        label={t('scheduledAt')}
                                        value={scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                        editable={false}
                                        pointerEvents="none"
                                        leftIcon={<Ionicons name="time-outline" size={20} color={theme.text.tertiary} />}
                                    />
                                </TouchableOpacity>
                            </View>
                            <View style={{ flex: 1, marginLeft: spacing.md }}>
                                <TouchableOpacity
                                    activeOpacity={1}
                                    onPress={() => setEndTimePickerVisible(true)}
                                >
                                    <Input
                                        label={t('endsAt')}
                                        value={endsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                        editable={false}
                                        pointerEvents="none"
                                        leftIcon={<Ionicons name="time" size={20} color={theme.text.tertiary} />}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TimePickerModal
                            visible={timePickerVisible}
                            onClose={() => setTimePickerVisible(false)}
                            selectedTime={scheduledAt}
                            onSelect={(h, m) => {
                                const newDate = new Date(scheduledAt);
                                newDate.setHours(h);
                                newDate.setMinutes(m);
                                setValue('scheduled_at', newDate, { shouldDirty: true });

                                // If end time was not manually set OR if it's now before the start time, 
                                // automatically adjust it to be 60 minutes after the start time.
                                if (!endTimeManuallySet || newDate >= endsAt) {
                                    const newEndsAt = new Date(newDate);
                                    newEndsAt.setHours(newEndsAt.getHours() + 1);
                                    setValue('ends_at', newEndsAt, { shouldDirty: true });
                                }
                            }}
                        />

                        <TimePickerModal
                            visible={endTimePickerVisible}
                            onClose={() => setEndTimePickerVisible(false)}
                            selectedTime={endsAt}
                            onSelect={(h, m) => {
                                const newDate = new Date(endsAt);
                                newDate.setHours(h);
                                newDate.setMinutes(m);
                                setValue('ends_at', newDate, { shouldDirty: true });
                                setEndTimeManuallySet(true);
                            }}
                        />

                        <Text style={[styles.label, { color: theme.text.secondary }]}>{t('location')}</Text>
                        <TouchableOpacity
                            style={[styles.pickerTrigger, { backgroundColor: theme.background.subtle, borderColor: theme.border.default }]}
                            onPress={() => setLocationPickerVisible(true)}
                        >
                            <Ionicons name="location-outline" size={20} color={theme.text.tertiary} />
                            <Text style={[styles.pickerValue, { color: !locationName ? theme.text.tertiary : theme.text.primary }]}>
                                {locationName || t('locationPlaceholder')}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={theme.text.tertiary} />
                        </TouchableOpacity>

                        <View style={{ marginTop: spacing.md }}>
                            <Controller
                                control={control}
                                name="court"
                                render={({ field: { onChange, value } }) => (
                                    <Input
                                        label={t('court')}
                                        onChangeText={onChange}
                                        value={value}
                                        placeholder="Ej: 1, Cancha Rápida, etc."
                                        leftIcon={<Ionicons name="grid-outline" size={20} color={theme.text.tertiary} />}
                                    />
                                )}
                            />
                        </View>

                        <Modal visible={locationPickerVisible} animationType="fade" transparent={true} onRequestClose={() => setLocationPickerVisible(false)}>
                            <View style={[styles.overlay, isDesktop && styles.overlay]}>
                                <View style={[styles.dialog, { backgroundColor: theme.background.surface }, isDesktop && styles.dialogDesktop]}>
                                    <View style={[styles.modalHeader, { borderBottomColor: theme.border.default }]}>
                                        <Text style={[styles.modalTitle, { color: theme.text.primary }]}>{t('tabLocations')}</Text>
                                        <TouchableOpacity onPress={() => setLocationPickerVisible(false)}>
                                            <Ionicons name="close" size={24} color={theme.text.primary} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.searchContainer}>
                                        <Input
                                            placeholder={t('searchLocations')}
                                            value={locationSearch}
                                            onChangeText={setLocationSearch}
                                            leftIcon={<Ionicons name="search" size={18} color={theme.text.tertiary} />}
                                        />
                                    </View>
                                    {loadingLocations ? (
                                        <ActivityIndicator color={theme.components.button.primary.bg} style={{ marginTop: 20 }} />
                                    ) : (
                                        <FlatList
                                            data={locations?.filter(l => l.name.toLowerCase().includes(locationSearch.toLowerCase()))}
                                            keyExtractor={(item) => item.id}
                                            renderItem={({ item }) => (
                                                <TouchableOpacity
                                                    style={[styles.playerItem, { borderBottomColor: theme.border.default }, watch('location') === item.name && { backgroundColor: theme.components.button.primary.bg + '15', borderColor: theme.components.button.primary.bg }]}
                                                    onPress={() => {
                                                        setValue('location', item.name, { shouldDirty: true });
                                                        setLocationPickerVisible(false);
                                                    }}
                                                >
                                                    <View style={[styles.locationIconContainer, { backgroundColor: theme.components.button.primary.bg + '15' }]}>
                                                        <Ionicons name="location-outline" size={20} color={theme.components.button.primary.bg} />
                                                    </View>
                                                    <Text style={[styles.playerNameItem, { color: theme.text.primary }, watch('location') === item.name && { color: theme.components.button.primary.bg }]}>
                                                        {item.name}
                                                    </Text>
                                                    {watch('location') === item.name && (
                                                        <Ionicons name="checkmark-circle" size={24} color={theme.components.button.primary.bg} />
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                            contentContainerStyle={{ padding: spacing.md }}
                                            ListEmptyComponent={
                                                <View style={styles.emptyContainer}>
                                                    <Text style={[styles.emptyText, { color: theme.text.secondary }]}>{t('noLocationsFound')}</Text>
                                                    <Button
                                                        label={t('tabLocations')}
                                                        variant="outline"
                                                        onPress={() => {
                                                            setLocationPickerVisible(false);
                                                            router.push('/locations');
                                                        }}
                                                        style={{ marginTop: spacing.md }}
                                                    />
                                                </View>
                                            }
                                        />
                                    )}
                                </View>
                            </View>
                        </Modal>

                        <Controller
                            control={control}
                            name="notes"
                            render={({ field: { onChange, value } }) => (
                                <Input
                                    label={t('notes')}
                                    onChangeText={onChange}
                                    value={value}
                                    multiline
                                    numberOfLines={4}
                                    placeholder={t('notesPlaceholder')}
                                />
                            )}
                        />

                        <View style={styles.buttonRow}>
                            <Button
                                label={t('save')}
                                onPress={handleSubmit(onSubmit)}
                                loading={updateSession.isPending}
                                style={styles.flexButton}
                                shadow
                            />
                        </View>




                    </View>
                </ScrollView>

                {/* Collaborator Picker Modal */}
                <Modal visible={collaboratorPickerVisible} animationType="fade" transparent={true} onRequestClose={() => setCollaboratorPickerVisible(false)}>
                    <View style={[styles.overlay, isDesktop && styles.overlay]}>
                        <View style={[styles.dialog, { backgroundColor: theme.background.surface }, isDesktop && styles.dialogDesktop]}>
                            <View style={[styles.modalHeader, { borderBottomColor: theme.border.default }]}>
                                <Text style={[styles.modalTitle, { color: theme.text.primary }]}>{t('assignedCoach')}</Text>
                                <TouchableOpacity onPress={() => setCollaboratorPickerVisible(false)}>
                                    <Ionicons name="close" size={24} color={theme.text.primary} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.searchContainer}>
                                <Input
                                    placeholder={t('searchCollaborators')}
                                    value={collaboratorSearch}
                                    onChangeText={setCollaboratorSearch}
                                    leftIcon={<Ionicons name="search" size={18} color={theme.text.tertiary} />}
                                />
                            </View>
                            {loadingCollaborators ? (
                                <ActivityIndicator color={theme.components.button.primary.bg} style={{ marginTop: 20 }} />
                            ) : (
                                <FlatList
                                    data={collaborators?.filter(s => s.full_name.toLowerCase().includes(collaboratorSearch.toLowerCase())) || []}
                                    keyExtractor={(item) => item.id}
                                    renderItem={({ item }) => {
                                        const isSelected = instructorId === item.id;
                                        return (
                                            <TouchableOpacity
                                                style={[styles.playerItem, { borderBottomColor: theme.border.default }, isSelected && { backgroundColor: theme.components.button.primary.bg + '15', borderColor: theme.components.button.primary.bg }]}
                                                onPress={() => {
                                                    setValue('instructor_id', item.id, { shouldDirty: true });
                                                    setCollaboratorPickerVisible(false);
                                                }}
                                            >
                                                <Avatar name={item.full_name} size="sm" />
                                                <Text style={[styles.playerNameItem, { color: theme.text.primary }, isSelected && { color: theme.components.button.primary.bg }]}>
                                                    {item.full_name}
                                                </Text>
                                                {isSelected && (
                                                    <Ionicons name="checkmark-circle" size={24} color={theme.components.button.primary.bg} />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    }}
                                    contentContainerStyle={{ padding: spacing.md }}
                                    ListEmptyComponent={
                                        <View style={styles.emptyContainer}>
                                            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>{t('noCollaborators')}</Text>
                                            <Button
                                                label="Gestionar Equipo"
                                                variant="outline"
                                                onPress={() => {
                                                    setCollaboratorPickerVisible(false);
                                                    router.push('/team' as any);
                                                }}
                                                style={{ marginTop: spacing.md }}
                                            />
                                        </View>
                                    }
                                />
                            )}
                        </View>
                    </View>
                </Modal>

                <Modal visible={playerPickerVisible} animationType="fade" transparent={true} onRequestClose={() => setPlayerPickerVisible(false)}>
                    <View style={[styles.overlay, isDesktop && styles.overlay]}>
                        <View style={[styles.dialog, { backgroundColor: theme.background.surface }, isDesktop && styles.dialogDesktop]}>
                            <View style={[styles.modalHeader, { borderBottomColor: theme.border.default }]}>
                                <Text style={[styles.modalTitle, { color: theme.text.primary }]}>{t('selectPlayers')}</Text>
                                <TouchableOpacity onPress={() => setPlayerPickerVisible(false)}>
                                    <Ionicons name="close" size={24} color={theme.text.primary} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.searchContainer}>
                                <Input
                                    placeholder={t('searchPlayers')}
                                    value={playerSearch}
                                    onChangeText={setPlayerSearch}
                                    leftIcon={<Ionicons name="search" size={18} color={theme.text.tertiary} />}
                                />
                            </View>
                            {loadingPlayers ? (
                                <ActivityIndicator color={theme.components.button.primary.bg} style={{ marginTop: 20 }} />
                            ) : (
                                <FlatList
                                    data={players?.filter(p => p.full_name.toLowerCase().includes(playerSearch.toLowerCase()))}
                                    keyExtractor={(item) => item.id}
                                    renderItem={({ item }) => {
                                        const isSelected = selectedPlayerIds.includes(item.id);
                                        return (
                                            <TouchableOpacity
                                                style={[styles.playerItem, { borderBottomColor: theme.border.default }, isSelected && { backgroundColor: theme.components.button.primary.bg + '15', borderColor: theme.components.button.primary.bg }]}
                                                onPress={() => togglePlayer(item.id)}
                                            >
                                                <Avatar name={item.full_name} source={item.avatar_url || undefined} size="sm" />
                                                <Text style={[styles.playerNameItem, { color: theme.text.primary }, isSelected && { color: theme.components.button.primary.bg }]}>
                                                    {item.full_name}
                                                </Text>
                                                {isSelected && (
                                                    <Ionicons name="checkmark-circle" size={24} color={theme.components.button.primary.bg} />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    }}
                                    contentContainerStyle={{ padding: spacing.md }}
                                />
                            )}
                            <View style={[styles.modalFooter, { borderTopColor: theme.border.default }]}>
                                <Button
                                    label={t('confirm')}
                                    onPress={() => setPlayerPickerVisible(false)}
                                    style={styles.modalSaveBtn}
                                    size="sm"
                                />
                            </View>
                        </View>
                    </View>
                </Modal>



                <StatusModal
                    visible={modalVisible}
                    type={modalConfig.type}
                    title={modalConfig.title}
                    message={modalConfig.message}
                    onClose={handleModalClose}
                />

                <DatePickerModal
                    visible={datePickerVisible}
                    onClose={() => setDatePickerVisible(false)}
                    selectedDate={scheduledAt}
                    onSelect={(selectedDate) => {
                        const newDate = new Date(scheduledAt);
                        newDate.setFullYear(selectedDate.getFullYear());
                        newDate.setMonth(selectedDate.getMonth());
                        newDate.setDate(selectedDate.getDate());
                        setValue('scheduled_at', newDate, { shouldDirty: true });

                        const newEndsAt = new Date(endsAt);
                        newEndsAt.setFullYear(selectedDate.getFullYear());
                        newEndsAt.setMonth(selectedDate.getMonth());
                        newEndsAt.setDate(selectedDate.getDate());
                        setValue('ends_at', newEndsAt, { shouldDirty: true });
                    }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,

    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        flexGrow: 1,
        padding: spacing.lg,
    },
    formContainer: {
        width: '100%',
        maxWidth: 600, // Limit width on large screens
        alignSelf: 'center', // Center horizontally
    },
    label: {
        fontSize: typography.size.sm,
        fontWeight: '600',

        marginBottom: spacing.xs,
    },
    pickerTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,

        borderRadius: 8,
        borderWidth: 1,

    },
    pickerError: {

    },
    pickerValue: {
        flex: 1,
        marginLeft: spacing.sm,
        fontSize: typography.size.md,

    },
    pickerPlaceholder: {

    },
    row: {
        flexDirection: 'row',
    },
    selectorContainer: {
        flexDirection: 'row',

        borderRadius: 8,
        padding: 4,
        marginTop: spacing.xs,
    },
    selectorOption: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 6,
    },
    selectorOptionActive: {

        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 2,
    },
    selectorText: {
        fontSize: 12,
        fontWeight: '600',

    },
    selectorTextActive: {

    },
    searchContainer: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    saveBtn: {
        marginTop: spacing.xl,
    },
    buttonRow: {
        flexDirection: 'row',
        marginTop: spacing.lg,
        gap: spacing.md,
        justifyContent: 'center',
    },
    flexButton: {
        width: 160,
    },
    cancelBtn: {
        marginTop: spacing.sm,
    },
    deleteBtn: {
        marginTop: spacing.lg,
    },
    modalContainer: {
        flex: 1,

    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,

    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',

    },
    playerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,

    },
    playerNameItem: {
        flex: 1,
        marginLeft: spacing.md,
        fontSize: typography.size.md,

    },
    playerItemSelected: {


        borderRadius: 8,
    },
    playerNameItemSelected: {
        fontWeight: '600',

    },
    locationIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,

        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl,
    },
    emptyText: {
        fontSize: typography.size.md,

        textAlign: 'center',
    },
    modalFooter: {
        padding: spacing.md,
        borderTopWidth: 1,

        alignItems: 'center',
    },
    modalSaveBtn: {
        minWidth: 120,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dialog: {

        width: '100%',
        height: '100%',
    },
    dialogDesktop: {
        width: '100%',
        maxWidth: 500,
        height: 'auto',
        maxHeight: '80%',
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        overflow: 'hidden',
    },
});
