import { TimePickerModal } from '@/src/features/calendar/components/TimePickerModal';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { useSession, useSessionMutations } from '@/src/features/calendar/hooks/useSessions';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { SessionStatus, SessionType } from '@/src/types/session';

interface FormData {
    player_id: string;
    scheduled_at: Date;
    duration_minutes: string;
    location: string;
    session_type: SessionType;
    status: SessionStatus;
    notes: string;
}

export default function EditSessionScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const { data: session, isLoading: loadingSession } = useSession(id);
    const { data: players, isLoading: loadingPlayers } = usePlayers();
    const { updateSession } = useSessionMutations();

    const [playerPickerVisible, setPlayerPickerVisible] = useState(false);
    const [selectedPlayerName, setSelectedPlayerName] = useState('');
    const [timePickerVisible, setTimePickerVisible] = useState(false);

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
            player_id: '',
            scheduled_at: new Date(),
            duration_minutes: '60',
            location: '',
            session_type: 'individual',
            status: 'scheduled',
            notes: '',
        },
    });

    useEffect(() => {
        if (session) {
            reset({
                player_id: session.player_id || '',
                scheduled_at: new Date(session.scheduled_at),
                duration_minutes: session.duration_minutes.toString(),
                location: session.location || '',
                session_type: session.session_type || 'individual',
                status: session.status,
                notes: session.notes || '',
            });
            setSelectedPlayerName(session.player?.full_name || '');
        }
    }, [session, reset]);

    const scheduledAt = watch('scheduled_at');

    const onSubmit = async (data: FormData) => {
        try {
            await updateSession.mutateAsync({
                id,
                input: {
                    player_id: data.player_id,
                    scheduled_at: data.scheduled_at.toISOString(),
                    duration_minutes: parseInt(data.duration_minutes),
                    location: data.location || null,
                    session_type: data.session_type,
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

    const handleModalClose = () => {
        setModalVisible(false);
        if (modalConfig.type === 'success') {
            router.back();
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

                <Text style={styles.label}>{t('selectPlayer')}</Text>
                <TouchableOpacity
                    style={[styles.pickerTrigger, errors.player_id && styles.pickerError]}
                    onPress={() => setPlayerPickerVisible(true)}
                >
                    <Ionicons name="person-outline" size={20} color={colors.neutral[500]} />
                    <Text style={[styles.pickerValue, !selectedPlayerName && styles.pickerPlaceholder]}>
                        {selectedPlayerName || t('selectPlayer')}
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
                                value={scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                editable={false}
                                pointerEvents="none"
                                leftIcon={<Ionicons name="time-outline" size={20} color={colors.neutral[500]} />}
                            />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                        <Controller
                            control={control}
                            name="duration_minutes"
                            render={({ field: { onChange, value } }) => (
                                <Input
                                    label={t('duration')}
                                    onChangeText={onChange}
                                    value={value}
                                    keyboardType="number-pad"
                                />
                            )}
                        />
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
                        />
                    )}
                />

                <Text style={[styles.label, { marginTop: spacing.md }]}>{t('status')}</Text>
                <Controller
                    control={control}
                    name="status"
                    render={({ field: { onChange, value } }) => (
                        <View style={styles.selectorContainer}>
                            {(['scheduled', 'completed', 'cancelled'] as SessionStatus[]).map((st) => (
                                <TouchableOpacity
                                    key={st}
                                    style={[
                                        styles.selectorOption,
                                        value === st && styles.selectorOptionActive,
                                    ]}
                                    onPress={() => onChange(st)}
                                >
                                    <Text style={[
                                        styles.selectorText,
                                        value === st && styles.selectorTextActive
                                    ]}>
                                        {t(`session.${st}`)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                />

                <Text style={[styles.label, { marginTop: spacing.md }]}>Tipo de Sesión</Text>
                <Controller
                    control={control}
                    name="session_type"
                    render={({ field: { onChange, value } }) => (
                        <View style={styles.selectorContainer}>
                            {(['individual', 'group', 'match'] as SessionType[]).map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.selectorOption,
                                        value === type && styles.selectorOptionActive,
                                    ]}
                                    onPress={() => onChange(type)}
                                >
                                    <Text style={[
                                        styles.selectorText,
                                        value === type && styles.selectorTextActive
                                    ]}>
                                        {t(type)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
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

                <Button
                    label={t('save')}
                    onPress={handleSubmit(onSubmit)}
                    loading={updateSession.isPending}
                    style={styles.saveBtn}
                />
            </ScrollView>

            <Modal visible={playerPickerVisible} animationType="slide">
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{t('selectPlayer')}</Text>
                        <TouchableOpacity onPress={() => setPlayerPickerVisible(false)}>
                            <Ionicons name="close" size={24} color={colors.neutral[900]} />
                        </TouchableOpacity>
                    </View>
                    {loadingPlayers ? (
                        <ActivityIndicator color={colors.primary[500]} style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            data={players}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.playerItem}
                                    onPress={() => {
                                        setValue('player_id', item.id);
                                        setSelectedPlayerName(item.full_name);
                                        setPlayerPickerVisible(false);
                                    }}
                                >
                                    <Avatar name={item.full_name} source={item.avatar_url || undefined} size="sm" />
                                    <Text style={styles.playerNameItem}>{item.full_name}</Text>
                                    <Ionicons name="chevron-forward" size={20} color={colors.neutral[300]} />
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{ padding: spacing.md }}
                        />
                    )}
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
    saveBtn: {
        marginTop: spacing.xl,
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
});
