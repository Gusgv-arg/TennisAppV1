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
    View
} from 'react-native';

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { DatePickerModal } from '@/src/features/calendar/components/DatePickerModal';
import { useClassGroups } from '@/src/features/calendar/hooks/useClassGroups';
import { checkSessionConflicts, useSessionMutations } from '@/src/features/calendar/hooks/useSessions';
import { useCollaborators } from '@/src/features/collaborators/hooks/useCollaborators';
import { useLocations } from '@/src/features/locations/hooks/useLocations';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
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
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [groupPickerVisible, setGroupPickerVisible] = useState(false);
    // State to track which subscription each player uses for billing
    const [playerSubscriptions, setPlayerSubscriptions] = useState<Record<string, string | null>>({});

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
    const { createSession } = useSessionMutations();
    const { user, profile } = useAuthStore();
    const { data: classGroups } = useClassGroups();
    const locationName = watch('location');

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
            }
        } else {
            // When removing group, also reset player selection
            setValue('player_ids', []);
        }
    };

    const selectedGroupName = useMemo(() => {
        if (!selectedGroupId) return null;
        return classGroups?.find(g => g.id === selectedGroupId)?.name;
    }, [selectedGroupId, classGroups]);

    const onSubmit = async (data: FormData) => {
        try {
            // Calculate duration in minutes
            const durationMs = data.ends_at.getTime() - data.scheduled_at.getTime();
            const durationMinutes = Math.max(0, Math.round(durationMs / (1000 * 60)));

            // Check for scheduling conflicts
            if (user?.id) {
                const conflicts = await checkSessionConflicts(
                    user.id,
                    data.player_ids,
                    data.scheduled_at,
                    durationMinutes,
                    data.location || null,
                    data.court || null,
                    data.instructor_id,
                );

                // Rule 1: Player can't be in two sessions at same time
                if (conflicts.playerConflicts.length > 0) {
                    const conflictingNames = conflicts.playerConflicts
                        .map((id: string) => players?.find(p => p.id === id)?.full_name)
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

            // Build player_subscriptions array from state
            const playerSubscriptionsArray = data.player_ids.map(pid => ({
                player_id: pid,
                subscription_id: playerSubscriptions[pid] || null
            }));

            await createSession.mutateAsync({
                player_ids: data.player_ids,
                player_subscriptions: playerSubscriptionsArray,
                player_id: data.player_ids[0] || null, // For backward compatibility
                scheduled_at: data.scheduled_at.toISOString(),
                duration_minutes: durationMinutes,
                location: data.location || null,
                court: data.court || null,
                instructor_id: data.instructor_id,
                session_type: null, // Removed from UI
                status: data.status,
                notes: data.notes || null,
            });

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
            // Adding player - auto-assign subscription if only one
            current.push(id);
            const player = players?.find(p => p.id === id);
            if (player?.active_subscriptions?.length === 1) {
                setPlayerSubscriptions(prev => ({
                    ...prev,
                    [id]: player.active_subscriptions[0].id
                }));
            }
        }
        setValue('player_ids', current);
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('addSession'), headerTitleAlign: 'center' }} />
            <ScrollView contentContainerStyle={styles.scrollContent}>

                <Text style={styles.label}>{t('date')}</Text>
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
                                const subs = player.active_subscriptions || [];
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
                                            <Text style={{ fontSize: 12, color: colors.warning[600], marginTop: spacing.xs }}>
                                                ⚠️ Sin plan asignado - clase sin cargo
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
                                placeholder="Ej: 1, Pista Rápida, etc."
                                leftIcon={<Ionicons name="grid-outline" size={20} color={colors.neutral[500]} />}
                            />
                        )}
                    />
                </View>

                <Modal visible={locationPickerVisible} animationType="slide">
                    <View style={styles.modalContainer}>
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
            </ScrollView>

            <Modal visible={collaboratorPickerVisible} animationType="slide">
                <View style={styles.modalContainer}>
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
                            data={[
                                { id: null, full_name: profile?.full_name || t('you') },
                                ...(collaborators?.filter(s => s.full_name.toLowerCase().includes(collaboratorSearch.toLowerCase())) || [])
                            ]}
                            keyExtractor={(item) => item.id || 'current-user'}
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
            </Modal>

            <Modal visible={playerPickerVisible} animationType="slide">
                <View style={styles.modalContainer}>
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
                        />
                    </View>
                </View>
            </Modal>

            {/* Class Group Picker Modal */}
            <Modal visible={groupPickerVisible} animationType="slide">
                <View style={styles.modalContainer}>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.common.white,
    },
    scrollContent: {
        padding: spacing.lg,
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
        marginTop: spacing.xl,
        gap: spacing.sm,
    },
    flexButton: {
        flex: 1,
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
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[100],
    },
    modalSaveBtn: {
        width: '100%',
    },
});
