import { TimePickerModal } from '@/src/features/calendar/components/TimePickerModal';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useCurrentAcademy, useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import { DatePickerModal } from '@/src/features/calendar/components/DatePickerModal';
import { useClassGroups } from '@/src/features/calendar/hooks/useClassGroups';
import { checkSessionConflicts, useSessionMutations } from '@/src/features/calendar/hooks/useSessions';
import { useCollaborators } from '@/src/features/collaborators/hooks/useCollaborators';
import { useLocations } from '@/src/features/locations/hooks/useLocations';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useAuthStore } from '@/src/store/useAuthStore';
import { CreateSessionInput, SessionStatus } from '@/src/types/session';
import { generateUUID } from '@/src/utils/uuid';

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

const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function NewSessionScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const initialDate = useMemo(() => {
        const date = params.date
            ? new Date((params.date as string).split('-').map(Number)[0], (params.date as string).split('-').map(Number)[1] - 1, (params.date as string).split('-').map(Number)[2])
            : new Date();

        // Set to next hour by default
        date.setHours(new Date().getHours() + 1, 0, 0, 0);
        return date;
    }, [params.date]);

    const initialEndDate = useMemo(() => {
        const date = new Date(initialDate);
        date.setHours(date.getHours() + 1);
        return date;
    }, [initialDate]);

    const [playerPickerVisible, setPlayerPickerVisible] = useState(false);
    const [playerSearch, setPlayerSearch] = useState('');
    const [timePickerVisible, setTimePickerVisible] = useState(false);
    const [endTimePickerVisible, setEndTimePickerVisible] = useState(false);
    const [endTimeManuallySet, setEndTimeManuallySet] = useState(false);
    const [locationPickerVisible, setLocationPickerVisible] = useState(false);
    const [locationSearch, setLocationSearch] = useState('');
    const [collaboratorPickerVisible, setCollaboratorPickerVisible] = useState(false);
    const [collaboratorSearch, setCollaboratorSearch] = useState('');

    // Recurrence State
    const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
    const [recurrenceEndPickerVisible, setRecurrenceEndPickerVisible] = useState(false);
    const [recurrenceEndDate, setRecurrenceEndDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d;
    });
    const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]); // 0=Sun, 1=Mon...
    // Auto-set initial recurrence day based on selected date
    useEffect(() => {
        if (recurrenceEnabled && recurrenceDays.length === 0) {
            setRecurrenceDays([initialDate.getDay()]);
        }
    }, [recurrenceEnabled, initialDate]);
    const [datePickerVisible, setDatePickerVisible] = useState(false);


    // Per-day time configuration for recurrence
    // Per-day time configuration for recurrence. Stores Start and End times.
    const [recurrenceTimes, setRecurrenceTimes] = useState<Record<number, { start: { h: number, m: number }, end: { h: number, m: number } }>>({});
    const [recurrenceTimeDayIndex, setRecurrenceTimeDayIndex] = useState<number | null>(null);
    const [recurrenceTimeType, setRecurrenceTimeType] = useState<'start' | 'end'>('start');

    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [groupPickerVisible, setGroupPickerVisible] = useState(false);
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

    const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
        defaultValues: {
            player_ids: [],
            scheduled_at: initialDate,
            ends_at: initialEndDate,
            location: '',
            court: '',
            instructor_id: null,
            status: 'scheduled',
            notes: '',
        },
    });

    const scheduledAt = watch('scheduled_at');
    const endsAt = watch('ends_at');
    const selectedPlayerIds = watch('player_ids');

    const { data: players, isLoading: loadingPlayers } = usePlayers();
    const { data: locations, isLoading: loadingLocations } = useLocations();
    const { data: collaborators, isLoading: loadingCollaborators } = useCollaborators('', false);
    const { createSession, createSessionsBulk } = useSessionMutations();
    const { user, profile } = useAuthStore();
    const { data: classGroups } = useClassGroups();
    const { data: academiesData } = useUserAcademies();
    const { data: currentAcademy } = useCurrentAcademy();
    const locationName = watch('location');

    // Multi-academy: list of active academies
    const academies = academiesData?.active || [];
    const hasMultipleAcademies = academies.length > 1;

    // Auto-select current academy
    useEffect(() => {
        if (currentAcademy?.id) {
            setSelectedAcademyId(currentAcademy.id);
        } else if (academies.length > 0 && !selectedAcademyId) {
            setSelectedAcademyId(academies[0].id);
        }
    }, [currentAcademy, academies, selectedAcademyId]);

    // Set default location to the first one available
    useEffect(() => {
        if (locations && locations.length > 0 && !locationName) {
            setValue('location', locations[0].name);
        }
    }, [locations, locationName, setValue]);


    const selectedPlayersText = useMemo(() => {
        if (!players || selectedPlayerIds.length === 0) return '';
        if (selectedPlayerIds.length === 1) {
            return players.find(p => p.id === selectedPlayerIds[0])?.full_name || '';
        }
        return `${selectedPlayerIds.length} ${t('players')}`;
    }, [players, selectedPlayerIds, t]);

    const instructorId = watch('instructor_id');

    const instructorName = useMemo(() => {
        if (!instructorId) return profile?.full_name || t('you');
        const instructor = collaborators?.find((s: any) => s.id === instructorId);
        return instructor?.full_name || '';
    }, [instructorId, collaborators, profile, t]);

    // When a group is selected, auto-fill players
    const handleGroupSelect = (groupId: string | null) => {
        setSelectedGroupId(groupId);
        setGroupPickerVisible(false);

        if (groupId) {
            const group = classGroups?.find(g => g.id === groupId);
            if (group?.members) {
                const memberIds = group.members.map(m => m.player_id);
                setValue('player_ids', memberIds);

                // Auto-assign subscriptions for group members
                const newSubscriptions: Record<string, string | null> = {};

                group.members.forEach(member => {
                    const pid = member.player_id;
                    const player = players?.find(p => p.id === pid);

                    // Determine which plan this player SHOULD be on
                    // If is_plan_exempt is true -> Explicitly NO PLAN ('none_explicit')
                    // Else if member has individual plan -> use it
                    // Else use group default plan

                    if (member.is_plan_exempt) {
                        newSubscriptions[pid] = 'none_explicit';
                    } else {
                        const targetPlanId = member.plan_id ?? group.plan_id;

                        if (targetPlanId) {
                            // Find subscription matching this plan details
                            const matchingSub = player?.active_subscriptions?.find(
                                (s: any) => s.plan?.id === targetPlanId && s.plan?.is_active !== false
                            );

                            if (matchingSub) {
                                newSubscriptions[pid] = matchingSub.id;
                            } else {
                                // Plan is defined but no active subscription found
                                newSubscriptions[pid] = null;
                            }
                        } else {
                            // Logic if NO target plan is defined (e.g. neither member nor group has plan)
                            // Fallback to "active sub if only one exists" logic
                            const activeSubs = player?.active_subscriptions?.filter((s: any) => s.plan?.is_active !== false) || [];
                            if (activeSubs.length === 1) {
                                newSubscriptions[pid] = activeSubs[0].id;
                            }
                        }
                    }
                });
                setPlayerSubscriptions(prev => ({ ...prev, ...newSubscriptions }));
            }
        } else {
            // When removing group, also reset player selection
            setValue('player_ids', []);
            setPlayerSubscriptions({});
        }
    };

    const selectedGroupName = useMemo(() => {
        if (!selectedGroupId) return null;
        return classGroups?.find(g => g.id === selectedGroupId)?.name;
    }, [selectedGroupId, classGroups]);

    const onSubmit = async (data: FormData) => {
        try {
            // Calculate duration in minutes (fixed based on user selection)
            const durationMs = data.ends_at.getTime() - data.scheduled_at.getTime();
            const durationMinutes = Math.max(0, Math.round(durationMs / (1000 * 60)));

            // 1. Generate Session Dates
            // 1. Generate Session Dates
            let sessionsToCreate: { scheduledAt: Date, endsAt: Date }[] = [];

            if (recurrenceEnabled) {
                let current = new Date(data.scheduled_at);
                // Reset time components to match scheduled_at exactly? 
                // Actually scheduled_at has the time. data.scheduled_at is the start.
                // We iterate days, but keep the TIME.

                const endLimit = recurrenceEndDate;
                endLimit.setHours(23, 59, 59); // Include the full end day

                let safetyCount = 0;
                // Prevent infinite loops
                while (current <= endLimit && safetyCount < 365) { // Max 1 year for safety
                    const dayIndex = current.getDay();
                    if (recurrenceDays.includes(dayIndex)) {
                        const sessionDate = new Date(current);

                        // Apply specific time if set, otherwise use main scheduledAt time
                        // Apply specific time if set, otherwise use main scheduledAt time
                        const specificTime = recurrenceTimes[dayIndex];

                        // Set Start Time
                        const sH = specificTime?.start?.h ?? scheduledAt.getHours();
                        const sM = specificTime?.start?.m ?? scheduledAt.getMinutes();
                        sessionDate.setHours(sH, sM, 0, 0);

                        // Set End Time
                        // If specific end time exists, use it. Otherwise, calculate based on duration.
                        let sessionEndDate = new Date(sessionDate);
                        if (specificTime?.end) {
                            sessionEndDate.setHours(specificTime.end.h, specificTime.end.m, 0, 0);
                        } else {
                            // Default duration from main inputs
                            const durationMs = endsAt.getTime() - scheduledAt.getTime();
                            sessionEndDate = new Date(sessionDate.getTime() + durationMs);
                        }

                        sessionsToCreate.push({ scheduledAt: sessionDate, endsAt: sessionEndDate });
                    }
                    current.setDate(current.getDate() + 1);
                    safetyCount++;
                }

                if (sessionsToCreate.length === 0) {
                    setModalConfig({
                        type: 'warning',
                        title: 'Sin sesiones',
                        message: 'La configuración de repetición no generó ninguna fecha. Verifica los días seleccionados.'
                    });
                    setModalVisible(true);
                    return;
                }
            } else {
                sessionsToCreate.push({ scheduledAt: data.scheduled_at, endsAt: data.ends_at });
            }

            // 2. Check Conflicts (Loop)
            if (user?.id) {
                // Optimization: Maybe check only first and last? No, check all is safer.
                // Parallelize? 
                const conflictPromises = sessionsToCreate.map(s => checkSessionConflicts(
                    user.id,
                    data.player_ids,
                    s.scheduledAt,
                    durationMinutes,
                    data.location || null,
                    data.court || null,
                    data.instructor_id
                ));

                const results = await Promise.all(conflictPromises);

                // Aggregate conflicts
                const playerConflicts = new Set<string>();
                let instructorConflict = false;
                let locationConflict = false;

                results.forEach(r => {
                    r.playerConflicts.forEach(id => playerConflicts.add(id));
                    if (r.instructorConflict) instructorConflict = true;
                    if (r.locationConflict) locationConflict = true;
                });

                if (playerConflicts.size > 0) {
                    const conflictingNames = Array.from(playerConflicts)
                        .map((id: string) => players?.find(p => p.id === id)?.full_name)
                        .filter(Boolean)
                        .join(', ');

                    setModalConfig({
                        type: 'warning',
                        title: t('schedulingConflict'),
                        message: t('playerConflictMessage', { players: conflictingNames }) + (recurrenceEnabled ? ' (en una o más fechas)' : ''),
                    });
                    setModalVisible(true);
                    return;
                }

                if (instructorConflict) {
                    setModalConfig({
                        type: 'warning',
                        title: t('schedulingConflict'),
                        message: t('instructorConflictMessage', { instructor: instructorName }),
                    });
                    setModalVisible(true);
                    return;
                }

                if (locationConflict) {
                    setModalConfig({
                        type: 'warning',
                        title: t('schedulingConflict'),
                        message: t('locationConflictMessage', { location: data.location }),
                    });
                    setModalVisible(true);
                    return;
                }
            }

            // Validation: Ensure all players have a selected plan
            const missingPlanPlayers = data.player_ids.filter(pid => {
                const player = players?.find(p => p.id === pid);
                const subId = playerSubscriptions[pid];

                // If explicitly set to 'none_explicit', it's valid (NOT missing)
                if (subId === 'none_explicit') return false;

                // Check if player has any ACTIVE subscriptions
                const activeSubs = player?.active_subscriptions?.filter((s: any) => s.plan?.is_active !== false) || [];
                const hasAvailableSubs = activeSubs.length > 0;

                return !subId || !hasAvailableSubs;
            });

            if (missingPlanPlayers.length > 0) {
                const missingNames = missingPlanPlayers.map(pid =>
                    players?.find(p => p.id === pid)?.full_name
                ).join(', ');

                setModalConfig({
                    type: 'warning',
                    title: t('missingPlan') || 'Falta Plan de Pago',
                    message: `Es obligatorio seleccionar un plan de pago para: ${missingNames}. \n\nAsegúrate de que tengan una suscripción ACTIVA en su perfil, o selecciona una manualmente.`
                });
                setModalVisible(true);
                return;
            }

            // Validation: Check for archived plans
            const playersWithArchivedPlans = data.player_ids.map(pid => {
                const player = players?.find(p => p.id === pid);
                const subId = playerSubscriptions[pid];

                // Skip check if no plan or none_explicit
                if (!player || !subId || subId === 'none_explicit') return null;

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
                subscription_id: playerSubscriptions[pid] === 'none_explicit' ? null : playerSubscriptions[pid]!
            }));

            // Common Data
            const commonData = {
                player_ids: data.player_ids,
                player_subscriptions: playerSubscriptionsArray,
                player_id: data.player_ids[0] || null,
                academy_id: selectedAcademyId,
                duration_minutes: durationMinutes,
                location: data.location || null,
                court: data.court || null,
                instructor_id: data.instructor_id,
                class_group_id: selectedGroupId,
                session_type: (selectedGroupId ? 'group' : 'individual') as any, // Cast to fix type mismatch temporarily or update type
                status: data.status,
                notes: data.notes || null,
            };

            if (recurrenceEnabled) {
                const recurrenceGroupId = generateUUID();
                const inputs: CreateSessionInput[] = sessionsToCreate.map(s => {
                    const sDurationMs = s.endsAt.getTime() - s.scheduledAt.getTime();
                    const sDurationMinutes = Math.max(0, Math.round(sDurationMs / (1000 * 60)));

                    return {
                        ...commonData,
                        duration_minutes: sDurationMinutes,
                        scheduled_at: s.scheduledAt.toISOString(),
                        recurrence_group_id: recurrenceGroupId
                    };
                });

                await createSessionsBulk.mutateAsync(inputs);
            } else {
                await createSession.mutateAsync({
                    ...commonData,
                    scheduled_at: data.scheduled_at.toISOString(),
                });
            }

            setModalConfig({
                type: 'success',
                title: t('success'),
                message: t('sessionCreated'),
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

    const togglePlayer = (id: string) => {
        const current = [...selectedPlayerIds];
        const index = current.indexOf(id);
        if (index > -1) {
            // Removing player - also clear their subscription
            current.splice(index, 1);
            setPlayerSubscriptions(prev => {
                const newState = { ...prev };
                delete newState[id];
                return newState;
            });
        } else {
            // Adding player - auto-assign subscription if only one ACTIVE plan
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
        setValue('player_ids', current);
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('addSession'), headerTitleAlign: 'center' }} />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                <View style={styles.formContainer}>

                    {/* Academy Context Badge (Read-only) */}
                    {selectedAcademyId && (
                        <View style={{ marginBottom: spacing.md }}>
                            <Text style={styles.label}>Academia</Text>
                            <View style={{
                                alignSelf: 'flex-start',
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: colors.primary[50],
                                paddingHorizontal: spacing.md,
                                paddingVertical: spacing.xs,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: colors.primary[100],
                                gap: spacing.xs
                            }}>
                                <Ionicons name="business" size={16} color={colors.primary[700]} />
                                <Text style={{
                                    fontSize: 13,
                                    fontWeight: '600',
                                    color: colors.primary[700]
                                }}>
                                    {academies.find(a => a.id === selectedAcademyId)?.name || currentAcademy?.name}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Class Type Selector - Prominent Desktop/Mobile UI */}
                    <View style={styles.typeSelectorContainer}>
                        <TouchableOpacity
                            style={[styles.typeOption, !recurrenceEnabled && styles.typeOptionActive]}
                            onPress={() => setRecurrenceEnabled(false)}
                        >
                            <Ionicons name="person-outline" size={20} color={!recurrenceEnabled ? colors.primary[700] : colors.neutral[500]} />
                            <Text style={[styles.typeOptionText, !recurrenceEnabled && styles.typeOptionTextActive]}>Clase Individual</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.typeOption, recurrenceEnabled && styles.typeOptionActive]}
                            onPress={() => setRecurrenceEnabled(true)}
                        >
                            <Ionicons name="repeat-outline" size={20} color={recurrenceEnabled ? colors.primary[700] : colors.neutral[500]} />
                            <Text style={[styles.typeOptionText, recurrenceEnabled && styles.typeOptionTextActive]}>Multiclases</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>{recurrenceEnabled ? 'Fecha inicial' : t('date')}</Text>
                    <TouchableOpacity
                        style={[styles.pickerTrigger, { marginBottom: spacing.md }]}
                        onPress={() => setDatePickerVisible(true)}
                    >
                        <Ionicons name="calendar-outline" size={20} color={colors.neutral[500]} />
                        <Text style={styles.pickerValue}>
                            {scheduledAt.toLocaleDateString(undefined, {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color={colors.neutral[400]} />
                    </TouchableOpacity>

                    {!recurrenceEnabled && (
                        <View style={[styles.row, { marginBottom: spacing.md }]}>
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
                                        leftIcon={<Ionicons name="time-outline" size={20} color={colors.neutral[500]} />}
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
                                        leftIcon={<Ionicons name="time" size={20} color={colors.neutral[500]} />}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {recurrenceEnabled && (
                        <View style={{ marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.neutral[100], borderRadius: 8 }}>
                            <Text style={[styles.label, { marginTop: 0 }]}>Días de la semana</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
                                {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, index) => {
                                    const isSelected = recurrenceDays.includes(index);
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            onPress={() => {
                                                if (isSelected) {
                                                    // Prevent unselecting if it's the only day? No, allow user to fix.
                                                    setRecurrenceDays(prev => prev.filter(d => d !== index));
                                                } else {
                                                    setRecurrenceDays(prev => [...prev, index]);
                                                }
                                            }}
                                            style={{
                                                width: 36, height: 36, borderRadius: 18,
                                                backgroundColor: isSelected ? colors.primary[500] : colors.common.white,
                                                justifyContent: 'center', alignItems: 'center',
                                                borderWidth: 1, borderColor: isSelected ? colors.primary[500] : colors.neutral[300]
                                            }}
                                        >
                                            <Text style={{ color: isSelected ? colors.common.white : colors.neutral[600], fontWeight: '600' }}>{day}</Text>
                                        </TouchableOpacity>
                                    )
                                })}
                            </View>

                            {/* Per-day Time Selection */}
                            <View style={{ marginBottom: spacing.md }}>
                                {recurrenceDays.sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)).map(dayIndex => {
                                    const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayIndex];
                                    const customTime = recurrenceTimes[dayIndex];

                                    // Default times if not customized
                                    const startH = customTime?.start?.h ?? scheduledAt.getHours();
                                    const startM = customTime?.start?.m ?? scheduledAt.getMinutes();
                                    const endH = customTime?.end?.h ?? endsAt.getHours();
                                    const endM = customTime?.end?.m ?? endsAt.getMinutes();

                                    const formatTime = (h: number, m: number) =>
                                        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

                                    return (
                                        <View
                                            key={dayIndex}
                                            style={{
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                paddingVertical: 8,
                                                borderBottomWidth: 1,
                                                borderBottomColor: colors.neutral[200]
                                            }}
                                        >
                                            <Text style={{ fontSize: 13, color: colors.neutral[700], fontWeight: '500', width: 80 }}>{dayName}</Text>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Ionicons name="time-outline" size={16} color={colors.neutral[500]} />
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setRecurrenceTimeDayIndex(dayIndex);
                                                        setRecurrenceTimeType('start');
                                                        // Pre-fill time picker if needed? 
                                                        // We use a shared picker state, logic needs to handle this.
                                                    }}
                                                    style={{
                                                        backgroundColor: colors.common.white,
                                                        borderWidth: 1,
                                                        borderColor: colors.neutral[300],
                                                        borderRadius: 4,
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 4,
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        gap: 4
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 13, color: colors.neutral[800] }}>
                                                        {formatTime(startH, startM)}
                                                    </Text>
                                                </TouchableOpacity>

                                                <Text style={{ color: colors.neutral[400] }}>-</Text>

                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setRecurrenceTimeDayIndex(dayIndex);
                                                        setRecurrenceTimeType('end');
                                                    }}
                                                    style={{
                                                        backgroundColor: colors.common.white,
                                                        borderWidth: 1,
                                                        borderColor: colors.neutral[300],
                                                        borderRadius: 4,
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 4,
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        gap: 4
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 13, color: colors.neutral[800] }}>
                                                        {formatTime(endH, endM)}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>

                            <Text style={styles.label}>Repetir hasta</Text>
                            <TouchableOpacity
                                style={[styles.pickerTrigger, { backgroundColor: colors.common.white }]}
                                onPress={() => setRecurrenceEndPickerVisible(true)}
                            >
                                <Ionicons name="calendar-outline" size={20} color={colors.neutral[500]} />
                                <Text style={styles.pickerValue}>
                                    {recurrenceEndDate.toLocaleDateString()}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color={colors.neutral[400]} />
                            </TouchableOpacity>

                            {/* Recurrence Summary */}
                            <Text style={{ fontSize: 12, color: colors.neutral[500], marginTop: spacing.sm, fontStyle: 'italic' }}>
                                Se crearán sesiones todos los {recurrenceDays.map(d => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d]).join(', ')} hasta el {recurrenceEndDate.toLocaleDateString()}.
                            </Text>
                        </View>
                    )}

                    {/* Recurrence End Date Picker Modal */}
                    {recurrenceEnabled && (
                        <DatePickerModal
                            visible={recurrenceEndPickerVisible}
                            onClose={() => setRecurrenceEndPickerVisible(false)}
                            selectedDate={recurrenceEndDate}
                            onSelect={(d) => setRecurrenceEndDate(d)}
                        // minimumDate prop might not be supported by custom wrapper but passing it is safe if spread
                        />
                    )}

                    <Text style={styles.label}>{t('assignedCoach')}</Text>
                    <TouchableOpacity
                        style={[styles.pickerTrigger, { marginBottom: spacing.md }]}
                        onPress={() => setCollaboratorPickerVisible(true)}
                    >
                        <Ionicons name="person-outline" size={20} color={colors.neutral[500]} />
                        <Text style={styles.pickerValue}>
                            {instructorName}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color={colors.neutral[400]} />
                    </TouchableOpacity>

                    {/* Selection Mode: Group OR Individual Players (mutually exclusive) */}
                    {classGroups && classGroups.length > 0 && !selectedPlayerIds.length && !selectedGroupId && (
                        <>
                            <Text style={styles.label}>Grupo de clase</Text>
                            <TouchableOpacity
                                style={[styles.pickerTrigger, { marginBottom: spacing.md }]}
                                onPress={() => setGroupPickerVisible(true)}
                            >
                                <Ionicons name="people-circle-outline" size={20} color={colors.secondary[500]} />
                                <Text style={[styles.pickerValue, styles.pickerPlaceholder]}>
                                    Seleccionar grupo
                                </Text>
                                <Ionicons name="chevron-down" size={20} color={colors.neutral[400]} />
                            </TouchableOpacity>
                        </>
                    )}

                    {!selectedGroupId && !selectedPlayerIds.length && (
                        <>
                            <Text style={styles.label}>{t('selectPlayers')}</Text>
                            <TouchableOpacity
                                style={[styles.pickerTrigger, errors.player_ids && styles.pickerError]}
                                onPress={() => setPlayerPickerVisible(true)}
                            >
                                <Ionicons name="people-outline" size={20} color={colors.neutral[500]} />
                                <Text style={[styles.pickerValue, styles.pickerPlaceholder]}>
                                    {t('selectPlayers')}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color={colors.neutral[400]} />
                            </TouchableOpacity>
                            {errors.player_ids && <Text style={styles.errorText}>{t('fieldRequired')}</Text>}
                        </>
                    )}

                    {!selectedGroupId && selectedPlayerIds.length > 0 && players && (
                        <View style={{ marginBottom: spacing.md }}>
                            <Text style={styles.label}>Alumnos seleccionados</Text>
                            <View style={{ gap: spacing.sm }}>
                                {players.filter(p => selectedPlayerIds.includes(p.id)).map(player => {
                                    // Filter out archived plans from the options
                                    const subs = (player.active_subscriptions || []).filter((s: any) => s.plan?.is_active !== false);
                                    const hasMultiplePlans = subs.length > 1;
                                    const selectedSubId = playerSubscriptions[player.id];
                                    const selectedPlan = subs.find((s: any) => s.id === selectedSubId);

                                    return (
                                        <View key={player.id} style={{
                                            padding: spacing.md,
                                            backgroundColor: colors.primary[50],
                                            borderRadius: 8,
                                            borderWidth: 1,
                                            borderColor: !selectedSubId && subs.length > 0 ? colors.warning[400] : colors.primary[200]
                                        }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                                                    <Avatar name={player.full_name} size="sm" />
                                                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.neutral[800] }}>
                                                        {player.full_name}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity onPress={() => togglePlayer(player.id)}>
                                                    <Ionicons name="close-circle" size={22} color={colors.error[400]} />
                                                </TouchableOpacity>
                                            </View>

                                            {/* Plan selector */}
                                            {subs.length === 0 ? (
                                                <Text style={{ fontSize: 12, color: colors.error[600], marginTop: spacing.xs, fontWeight: '500' }}>
                                                    ⛔ Sin plan activo. Asigna uno en Alumnos.
                                                </Text>
                                            ) : subs.length === 1 ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: 4 }}>
                                                    <Ionicons name="pricetag-outline" size={12} color={colors.primary[600]} />
                                                    <Text style={{ fontSize: 12, color: colors.primary[700] }}>
                                                        {subs[0].plan?.name || 'Plan'}
                                                    </Text>
                                                </View>
                                            ) : (
                                                <View style={{ marginTop: spacing.sm }}>
                                                    <Text style={{ fontSize: 11, color: colors.neutral[500], marginBottom: 4 }}>
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
                                                                    backgroundColor: selectedSubId === sub.id ? colors.primary[500] : colors.neutral[100],
                                                                    borderWidth: 1,
                                                                    borderColor: selectedSubId === sub.id ? colors.primary[500] : colors.neutral[300],
                                                                }}
                                                            >
                                                                <Text style={{
                                                                    fontSize: 12,
                                                                    color: selectedSubId === sub.id ? colors.common.white : colors.neutral[700],
                                                                    fontWeight: selectedSubId === sub.id ? '600' : '400'
                                                                }}>
                                                                    {sub.plan?.name || 'Plan'}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                    {!selectedSubId && (
                                                        <Text style={{ fontSize: 11, color: colors.warning[600], marginTop: 4 }}>
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
                                <Text style={{ color: colors.primary[600], fontSize: 13, fontWeight: '500' }}>
                                    + Agregar alumno
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedGroupId && classGroups && (
                        <View style={{ marginBottom: spacing.md }}>
                            <Text style={styles.label}>Grupo seleccionado</Text>
                            <View style={{ padding: spacing.md, backgroundColor: colors.secondary[50], borderRadius: 8, borderWidth: 1, borderColor: colors.secondary[200] }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                        <Ionicons name="people-circle" size={20} color={colors.secondary[600]} />
                                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.secondary[700] }}>
                                            {selectedGroupName}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleGroupSelect(null)}>
                                        <Text style={{ color: colors.error[500], fontSize: 12 }}>Quitar</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={{ fontSize: 12, color: colors.neutral[600], marginTop: spacing.sm }}>
                                    {classGroups.find(g => g.id === selectedGroupId)?.members?.map(m => m.player?.full_name).join(', ') || 'Sin integrantes'}
                                </Text>
                            </View>
                        </View>
                    )}


                    <TimePickerModal
                        visible={timePickerVisible}
                        onClose={() => setTimePickerVisible(false)}
                        selectedTime={scheduledAt}
                        onSelect={(h, m) => {
                            const newDate = new Date(scheduledAt);
                            newDate.setHours(h);
                            newDate.setMinutes(m);
                            setValue('scheduled_at', newDate);

                            // If end time was not manually set OR if it's now before the start time, 
                            // automatically adjust it to be 60 minutes after the start time.
                            if (!endTimeManuallySet || newDate >= endsAt) {
                                const newEndsAt = new Date(newDate);
                                newEndsAt.setHours(newEndsAt.getHours() + 1);
                                setValue('ends_at', newEndsAt);
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
                            setValue('ends_at', newDate);
                            setEndTimeManuallySet(true);
                        }}
                    />

                    {/* Recurrence Day Time Picker */}
                    {/* Recurrence Day Time Picker */}
                    <TimePickerModal
                        visible={recurrenceTimeDayIndex !== null}
                        onClose={() => setRecurrenceTimeDayIndex(null)}
                        selectedTime={(() => {
                            if (recurrenceTimeDayIndex === null) return scheduledAt;
                            const custom = recurrenceTimes[recurrenceTimeDayIndex];
                            // Determine which time to show: start or end
                            const target = recurrenceTimeType === 'start' ? custom?.start : custom?.end;

                            // Fallback to global setting if no custom time set
                            const fallbackH = recurrenceTimeType === 'start' ? scheduledAt.getHours() : endsAt.getHours();
                            const fallbackM = recurrenceTimeType === 'start' ? scheduledAt.getMinutes() : endsAt.getMinutes();

                            const d = new Date();
                            d.setHours(target?.h ?? fallbackH, target?.m ?? fallbackM);
                            return d;
                        })()}
                        onSelect={(h, m) => {
                            if (recurrenceTimeDayIndex !== null) {
                                setRecurrenceTimes(prev => {
                                    const currentDay = prev[recurrenceTimeDayIndex] || {};
                                    // Make sure we preserve existing values or set defaults if missing
                                    const fallbackStart = { h: scheduledAt.getHours(), m: scheduledAt.getMinutes() };
                                    const fallbackEnd = { h: endsAt.getHours(), m: endsAt.getMinutes() };

                                    const existingStart = currentDay.start || fallbackStart;
                                    const existingEnd = currentDay.end || fallbackEnd;

                                    if (recurrenceTimeType === 'start') {
                                        // Calculate current duration in minutes
                                        const startMin = existingStart.h * 60 + existingStart.m;
                                        const endMin = existingEnd.h * 60 + existingEnd.m;
                                        let duration = endMin - startMin;
                                        if (duration <= 0) duration = 60; // Fallback to 1 hour if invalid or zero

                                        // Apply duration to new start time
                                        const newStartMin = h * 60 + m;
                                        const newEndTotal = newStartMin + duration;

                                        const newEndH = Math.floor(newEndTotal / 60) % 24;
                                        const newEndM = newEndTotal % 60;

                                        return {
                                            ...prev,
                                            [recurrenceTimeDayIndex]: {
                                                start: { h, m },
                                                end: { h: newEndH, m: newEndM }
                                            }
                                        };
                                    } else {
                                        return {
                                            ...prev,
                                            [recurrenceTimeDayIndex]: {
                                                start: existingStart,
                                                end: { h, m }
                                            }
                                        };
                                    }
                                });
                                // Close key
                                setRecurrenceTimeDayIndex(null);
                            }
                        }}
                    />

                    <Text style={styles.label}>{t('location')}</Text>
                    <TouchableOpacity
                        style={styles.pickerTrigger}
                        onPress={() => setLocationPickerVisible(true)}
                    >
                        <Ionicons name="location-outline" size={20} color={colors.neutral[500]} />
                        <Text style={[styles.pickerValue, !locationName && styles.pickerPlaceholder]}>
                            {locationName || t('locationPlaceholder')}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color={colors.neutral[400]} />
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
                                    leftIcon={<Ionicons name="grid-outline" size={20} color={colors.neutral[500]} />}
                                />
                            )}
                        />
                    </View>

                    <Modal visible={locationPickerVisible} animationType="fade" transparent={true} onRequestClose={() => setLocationPickerVisible(false)}>
                        <View style={[styles.overlay, isDesktop && styles.overlay]}>
                            <View style={[styles.dialog, isDesktop && styles.dialogDesktop]}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>{t('tabLocations')}</Text>
                                    <TouchableOpacity onPress={() => setLocationPickerVisible(false)}>
                                        <Ionicons name="close" size={24} color={colors.neutral[900]} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.searchContainer}>
                                    <Input
                                        placeholder={t('searchLocations')}
                                        value={locationSearch}
                                        onChangeText={setLocationSearch}
                                        leftIcon={<Ionicons name="search" size={18} color={colors.neutral[400]} />}
                                    />
                                </View>
                                {loadingLocations ? (
                                    <ActivityIndicator color={colors.primary[500]} style={{ marginTop: 20 }} />
                                ) : (
                                    <FlatList
                                        data={locations?.filter(l => l.name.toLowerCase().includes(locationSearch.toLowerCase()))}
                                        keyExtractor={(item) => item.id}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                style={[styles.playerItem, watch('location') === item.name && styles.playerItemSelected]}
                                                onPress={() => {
                                                    setValue('location', item.name);
                                                    setLocationPickerVisible(false);
                                                }}
                                            >
                                                <View style={styles.locationIconContainer}>
                                                    <Ionicons name="location-outline" size={20} color={colors.primary[600]} />
                                                </View>
                                                <Text style={[styles.playerNameItem, watch('location') === item.name && styles.playerNameItemSelected]}>
                                                    {item.name}
                                                </Text>
                                                {watch('location') === item.name && (
                                                    <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                                                )}
                                            </TouchableOpacity>
                                        )}
                                        contentContainerStyle={{ padding: spacing.md }}
                                        ListEmptyComponent={
                                            <View style={styles.emptyContainer}>
                                                <Text style={styles.emptyText}>{t('noLocationsFound')}</Text>
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
                            loading={createSession.isPending}
                            style={styles.flexButton}
                            shadow
                            leftIcon={<Ionicons name="checkmark-sharp" size={18} color={colors.common.white} />}
                        />

                        <Button
                            label={t('cancel')}
                            variant="outline"
                            onPress={() => {
                                if (router.canGoBack()) {
                                    router.back();
                                } else {
                                    router.replace('/(tabs)/calendar');
                                }
                            }}
                            style={styles.flexButton}
                            shadow
                            leftIcon={<Ionicons name="close-outline" size={18} color={colors.primary[500]} />}
                        />
                    </View>
                </View>
            </ScrollView>

            <Modal visible={collaboratorPickerVisible} animationType="fade" transparent={true} onRequestClose={() => setCollaboratorPickerVisible(false)}>
                <View style={[styles.overlay, isDesktop && styles.overlay]}>
                    <View style={[styles.dialog, isDesktop && styles.dialogDesktop]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('assignedCoach')}</Text>
                            <TouchableOpacity onPress={() => setCollaboratorPickerVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.neutral[900]} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.searchContainer}>
                            <Input
                                placeholder={t('searchCollaborators')}
                                value={collaboratorSearch}
                                onChangeText={setCollaboratorSearch}
                                leftIcon={<Ionicons name="search" size={18} color={colors.neutral[400]} />}
                            />
                        </View>
                        {loadingCollaborators ? (
                            <ActivityIndicator color={colors.primary[500]} style={{ marginTop: 20 }} />
                        ) : (
                            <FlatList
                                data={collaborators?.filter(s => s.full_name.toLowerCase().includes(collaboratorSearch.toLowerCase())) || []}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => {
                                    const isSelected = watch('instructor_id') === item.id;
                                    return (
                                        <TouchableOpacity
                                            style={[styles.playerItem, isSelected && styles.playerItemSelected]}
                                            onPress={() => {
                                                setValue('instructor_id', item.id);
                                                setCollaboratorPickerVisible(false);
                                            }}
                                        >
                                            <Avatar name={item.full_name} size="sm" />
                                            <Text style={[styles.playerNameItem, isSelected && styles.playerNameItemSelected]}>
                                                {item.full_name}
                                            </Text>
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                                contentContainerStyle={{ padding: spacing.md }}
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>{t('noCollaborators')}</Text>
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
                    <View style={[styles.dialog, isDesktop && styles.dialogDesktop]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('selectPlayers')}</Text>
                            <TouchableOpacity onPress={() => setPlayerPickerVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.neutral[900]} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.searchContainer}>
                            <Input
                                placeholder={t('searchPlayers')}
                                value={playerSearch}
                                onChangeText={setPlayerSearch}
                                leftIcon={<Ionicons name="search" size={18} color={colors.neutral[400]} />}
                            />
                        </View>
                        {loadingPlayers ? (
                            <ActivityIndicator color={colors.primary[500]} style={{ marginTop: 20 }} />
                        ) : (
                            <FlatList
                                data={players?.filter(p => p.full_name.toLowerCase().includes(playerSearch.toLowerCase()))}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => {
                                    const isSelected = selectedPlayerIds.includes(item.id);
                                    return (
                                        <TouchableOpacity
                                            style={[styles.playerItem, isSelected && styles.playerItemSelected]}
                                            onPress={() => togglePlayer(item.id)}
                                        >
                                            <Avatar name={item.full_name} source={item.avatar_url || undefined} size="sm" />
                                            <Text style={[styles.playerNameItem, isSelected && styles.playerNameItemSelected]}>
                                                {item.full_name}
                                            </Text>
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                                contentContainerStyle={{ padding: spacing.md }}
                            />
                        )}
                        <View style={styles.modalFooter}>
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

            {/* Class Group Picker Modal */}
            <Modal visible={groupPickerVisible} animationType="fade" transparent={true} onRequestClose={() => setGroupPickerVisible(false)}>
                <View style={[styles.overlay, isDesktop && styles.overlay]}>
                    <View style={[styles.dialog, isDesktop && styles.dialogDesktop]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar Grupo</Text>
                            <TouchableOpacity onPress={() => setGroupPickerVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.neutral[900]} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={[{ id: null, name: 'Sin grupo (selección manual)', member_count: 0 }, ...(classGroups || [])]}
                            keyExtractor={(item) => item.id || 'no-group'}
                            renderItem={({ item }) => {
                                const isSelected = selectedGroupId === item.id;
                                return (
                                    <TouchableOpacity
                                        style={[styles.playerItem, isSelected && styles.playerItemSelected]}
                                        onPress={() => handleGroupSelect(item.id)}
                                    >
                                        <View style={[styles.locationIconContainer, { backgroundColor: colors.secondary[50] }]}>
                                            <Ionicons
                                                name={item.id ? "people" : "person-add-outline"}
                                                size={20}
                                                color={colors.secondary[600]}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.playerNameItem, isSelected && styles.playerNameItemSelected]}>
                                                {item.name}
                                            </Text>
                                            {item.id && (
                                                <Text style={{ fontSize: 12, color: colors.neutral[500] }}>
                                                    {item.member_count} {item.member_count === 1 ? 'alumno' : 'alumnos'}
                                                </Text>
                                            )}
                                        </View>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                            contentContainerStyle={{ padding: spacing.md }}
                        />
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
                    setValue('scheduled_at', newDate);

                    const newEndsAt = new Date(endsAt);
                    newEndsAt.setFullYear(selectedDate.getFullYear());
                    newEndsAt.setMonth(selectedDate.getMonth());
                    newEndsAt.setDate(selectedDate.getDate());
                    setValue('ends_at', newEndsAt);
                }}
            />
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.common.white,
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
        color: colors.neutral[700],
        marginBottom: spacing.xs,
    },
    pickerTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.neutral[50],
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    pickerError: {
        borderColor: colors.error[500],
    },
    pickerValue: {
        flex: 1,
        marginLeft: spacing.sm,
        fontSize: typography.size.md,
        color: colors.neutral[900],
    },
    pickerPlaceholder: {
        color: colors.neutral[400],
    },
    row: {
        flexDirection: 'row',
    },
    selectorContainer: {
        flexDirection: 'row',
        backgroundColor: colors.neutral[100],
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
        backgroundColor: colors.common.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 2,
    },
    selectorText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.neutral[500],
    },
    selectorTextActive: {
        color: colors.primary[600],
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
    errorText: {
        color: colors.error[500],
        fontSize: 12,
        marginTop: 4,
    },
    searchContainer: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: colors.common.white,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    playerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[50],
    },
    playerNameItem: {
        flex: 1,
        marginLeft: spacing.md,
        fontSize: typography.size.md,
        color: colors.neutral[900],
    },
    playerItemSelected: {
        backgroundColor: colors.primary[50],
        borderColor: colors.primary[100],
        borderRadius: 8,
    },
    playerNameItemSelected: {
        fontWeight: '600',
        color: colors.primary[700],
    },
    locationIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary[50],
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
        color: colors.neutral[500],
        textAlign: 'center',
    },
    modalFooter: {
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[100],
        alignItems: 'center',
    },
    modalSaveBtn: {
        minWidth: 120,
    },
    typeSelectorContainer: {
        flexDirection: 'row',
        backgroundColor: colors.neutral[100],
        borderRadius: 12,
        padding: 4,
        marginBottom: spacing.lg,
    },
    typeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 8,
        borderRadius: 8,
    },
    typeOptionActive: {
        backgroundColor: colors.primary[50], // Green background for active
        borderColor: colors.primary[200],
        borderWidth: 1,
        // shadowColor: '#000', ... removed shadow for flatter look or keep? key is color.
    },
    typeOptionText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.neutral[500],
    },
    typeOptionTextActive: {
        color: colors.primary[700], // Green text
        fontWeight: '700',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dialog: {
        backgroundColor: colors.common.white,
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
