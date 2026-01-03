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
import { checkSessionConflicts, useSession, useSessionMutations } from '@/src/features/calendar/hooks/useSessions';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useAuthStore } from '@/src/store/useAuthStore';
import { SessionStatus } from '@/src/types/session';

interface FormData {
    player_ids: string[];
    scheduled_at: Date;
    ends_at: Date;
    location: string;
    status: SessionStatus;
    notes: string;
}

export default function EditSessionScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const { data: session, isLoading: loadingSession } = useSession(id);
    const { data: players, isLoading: loadingPlayers } = usePlayers();
    const { updateSession, deleteSession } = useSessionMutations();

    const [playerPickerVisible, setPlayerPickerVisible] = useState(false);
    const [playerSearch, setPlayerSearch] = useState('');
    const [timePickerVisible, setTimePickerVisible] = useState(false);
    const [endTimePickerVisible, setEndTimePickerVisible] = useState(false);
    const [endTimeManuallySet, setEndTimeManuallySet] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

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
                status: session.status,
                notes: session.notes || '',
            });
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

    const { user } = useAuthStore();

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

                // Rule 2: Location can't have two sessions at same time
                if (conflicts.locationConflict) {
                    setModalConfig({
                        type: 'warning',
                        title: t('schedulingConflict'),
                        message: t('locationConflictMessage', { location: data.location }),
                    });
                    setModalVisible(true);
                    return;
                }
            }

            await updateSession.mutateAsync({
                id,
                input: {
                    player_ids: data.player_ids,
                    player_id: data.player_ids[0] || null, // For backward compatibility
                    scheduled_at: data.scheduled_at.toISOString(),
                    duration_minutes: durationMinutes,
                    location: data.location || null,
                    session_type: null, // Removed from UI
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
            current.splice(index, 1);
        } else {
            current.push(id);
        }
        setValue('player_ids', current, { shouldDirty: true });
    };

    const handleModalClose = () => {
        setModalVisible(false);
        if (modalConfig.type === 'success') {
            router.back();
        }
    };

    const handleDelete = async () => {
        setDeleteConfirmVisible(false);
        try {
            await deleteSession.mutateAsync(id);
            setModalConfig({
                type: 'success',
                title: t('success'),
                message: t('sessionDeleted'),
            });
            setModalVisible(true);
        } catch (error) {
            setModalConfig({
                type: 'error',
                title: 'Error',
                message: t('errorOccurred'),
            });
            setModalVisible(true);
        }
    };

    if (loadingSession) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('editSession'), headerTitleAlign: 'center' }} />
            <ScrollView contentContainerStyle={styles.scrollContent}>

                <Text style={styles.label}>{t('selectPlayers')}</Text>
                <TouchableOpacity
                    style={[styles.pickerTrigger, errors.player_ids && styles.pickerError]}
                    onPress={() => setPlayerPickerVisible(true)}
                >
                    <Ionicons name="people-outline" size={20} color={colors.neutral[500]} />
                    <Text style={[styles.pickerValue, !selectedPlayersText && styles.pickerPlaceholder]}>
                        {selectedPlayersText || t('selectPlayers')}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.neutral[400]} />
                </TouchableOpacity>

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

                <Controller
                    control={control}
                    name="location"
                    render={({ field: { onChange, value } }) => (
                        <Input
                            label={t('location')}
                            onChangeText={onChange}
                            value={value}
                            placeholder={t('locationPlaceholder')}
                            leftIcon={<Ionicons name="location-outline" size={18} color={colors.neutral[400]} />}
                        />
                    )}
                />

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
                        leftIcon={<Ionicons name="checkmark-outline" size={18} color={colors.common.white} />}
                    />

                    <Button
                        label={t('cancel')}
                        variant="warning"
                        onPress={() => router.back()}
                        style={styles.flexButton}
                        shadow
                        leftIcon={<Ionicons name="close-outline" size={18} color={colors.common.white} />}
                    />

                    <Button
                        label={t('delete')}
                        variant="danger"
                        onPress={() => setDeleteConfirmVisible(true)}
                        style={styles.flexButton}
                        shadow
                        leftIcon={<Ionicons name="trash-outline" size={18} color={colors.common.white} />}
                    />
                </View>
            </ScrollView>

            {/* Delete Confirmation Modal */}
            <StatusModal
                visible={deleteConfirmVisible}
                type="warning"
                title={t('delete')}
                message={t('deleteSessionConfirm')}
                buttonText={t('delete')}
                showCancel
                onClose={() => setDeleteConfirmVisible(false)}
                onConfirm={handleDelete}
            />

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

            <StatusModal
                visible={modalVisible}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
                onClose={handleModalClose}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.common.white,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
    searchContainer: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
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
    deleteBtn: {
        marginTop: spacing.lg,
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
    modalFooter: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[100],
    },
    modalSaveBtn: {
        width: '100%',
    },
});
