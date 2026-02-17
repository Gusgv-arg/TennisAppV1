import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
import { AttendanceStatus } from '@/src/types/session';
import { AttendanceRecord, useAttendanceMutations, useSessionAttendance } from '../hooks/useAttendance';

interface Player {
    id: string;
    full_name: string;
    avatar_url?: string | null;
}

interface AttendanceModalProps {
    visible: boolean;
    onClose: () => void;
    sessionId: string;
    sessionTime: string;
    sessionLocation: string;
    players: Player[];
    onSaved?: () => void;
}

// Only present and absent - removed excused per user request
const getStatusOptions = (theme: Theme) => [
    { value: 'present', icon: 'checkmark-circle', color: theme.status.success },
    { value: 'absent', icon: 'close-circle', color: theme.status.error },
];

export default function AttendanceModal({
    visible,
    onClose,
    sessionId,
    sessionTime,
    sessionLocation,
    players,
    onSaved,
}: AttendanceModalProps) {
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const STATUS_OPTIONS = React.useMemo(() => getStatusOptions(theme), [theme]);
    const { t } = useTranslation();
    const { saveAttendance } = useAttendanceMutations();
    const { data: existingAttendance, isLoading } = useSessionAttendance(sessionId);

    // Local state for attendance records
    const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
    // Local state for notes per player
    const [notesMap, setNotesMap] = useState<Record<string, string>>({});

    // Initialize from existing data or default to absent
    useEffect(() => {
        if (visible) {
            const initialAttendance: Record<string, AttendanceStatus> = {};
            const initialNotes: Record<string, string> = {};
            players.forEach(player => {
                const existing = existingAttendance?.find(a => a.player_id === player.id);
                initialAttendance[player.id] = existing?.status || 'absent';
                initialNotes[player.id] = existing?.notes || '';
            });
            setAttendanceMap(initialAttendance);
            setNotesMap(initialNotes);
        }
    }, [visible, players, existingAttendance]);

    const handleStatusChange = (playerId: string, status: AttendanceStatus) => {
        setAttendanceMap(prev => ({
            ...prev,
            [playerId]: status,
        }));
    };

    const handleNotesChange = (playerId: string, notes: string) => {
        setNotesMap(prev => ({
            ...prev,
            [playerId]: notes,
        }));
    };

    const handleSave = async () => {
        const records: AttendanceRecord[] = Object.entries(attendanceMap).map(([player_id, status]) => ({
            player_id,
            status,
            notes: notesMap[player_id] || undefined,
        }));

        await saveAttendance.mutateAsync({ sessionId, records });
        onSaved?.();
        onClose();
    };

    const getStatusTranslation = (status: AttendanceStatus) => {
        switch (status) {
            case 'present': return t('attendance.present');
            case 'absent': return t('attendance.absent');
            case 'excused': return t('attendance.excused');
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[
                    styles.container,
                ]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <Ionicons name="reader-outline" size={24} color={theme.components.button.primary.bg} />
                            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>{t('attendance.title')}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Session Info */}
                    <View style={[styles.sessionInfo, { backgroundColor: theme.background.surface }]}>
                        <View style={styles.sessionInfoRow}>
                            <Ionicons name="time-outline" size={16} color={theme.text.secondary} />
                            <Text style={[styles.sessionInfoText, { color: theme.text.secondary }]}>{sessionTime}</Text>
                        </View>
                        {sessionLocation && (
                            <View style={styles.sessionInfoRow}>
                                <Ionicons name="location-outline" size={16} color={theme.text.secondary} />
                                <Text style={[styles.sessionInfoText, { color: theme.text.secondary }]}>{sessionLocation}</Text>
                            </View>
                        )}
                    </View>

                    {/* Players List */}
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
                        </View>
                    ) : players.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="people-outline" size={48} color={theme.text.disabled || theme.text.tertiary} />
                            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>{t('attendance.noPlayers')}</Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.playersList} contentContainerStyle={styles.playersContent}>
                            {players.map(player => {
                                const currentStatus = attendanceMap[player.id] || 'absent';
                                const currentNotes = notesMap[player.id] || '';
                                return (
                                    <View key={player.id} style={styles.playerCard}>
                                        {/* Player row with avatar, name and status buttons */}
                                        <View style={styles.playerRow}>
                                            <View style={styles.playerInfo}>
                                                <Avatar name={player.full_name} source={player.avatar_url || undefined} size="sm" />
                                                <Text style={[styles.playerName, { color: theme.text.primary }]}>{player.full_name}</Text>
                                            </View>
                                            <View style={styles.statusButtons}>
                                                {STATUS_OPTIONS.map(option => {
                                                    const isSelected = currentStatus === option.value;
                                                    return (
                                                        <TouchableOpacity
                                                            key={option.value}
                                                            style={[
                                                                styles.statusButton,
                                                                isSelected && { backgroundColor: option.color + '20', borderColor: option.color },
                                                            ]}
                                                            onPress={() => handleStatusChange(player.id, option.value as AttendanceStatus)}
                                                        >
                                                            <Ionicons
                                                                name={option.icon as any}
                                                                size={18}
                                                                color={isSelected ? option.color : theme.text.secondary}
                                                            />
                                                            <Text style={[
                                                                styles.statusButtonText,
                                                                { color: isSelected ? option.color : theme.text.secondary }
                                                            ]}>
                                                                {getStatusTranslation(option.value as AttendanceStatus)}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                        {/* Notes input */}
                                        <View style={[styles.notesContainer, { backgroundColor: theme.background.input, borderColor: theme.border.default }]}>
                                            <Ionicons name="chatbubble-outline" size={14} color={theme.text.secondary} />
                                            <TextInput
                                                style={[styles.notesInput, { color: theme.text.primary }]}
                                                placeholder={t('attendance.addComment')}
                                                placeholderTextColor={theme.text.tertiary || theme.text.secondary}
                                                value={currentNotes}
                                                onChangeText={(text) => handleNotesChange(player.id, text)}
                                                multiline={false}
                                            />
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    )}

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Button
                            label={t('save')}
                            onPress={handleSave}
                            loading={saveAttendance.isPending}
                            disabled={players.length === 0}
                            style={styles.saveButton}
                            leftIcon={<Ionicons name="checkmark" size={18} color="white" />}
                        />
                        <Button
                            label={t('cancel')}
                            variant="outline"
                            onPress={onClose}
                            style={styles.cancelButton}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    overlay: {
        flex: 1,
    },
    container: {
        flex: 1,
        backgroundColor: theme.background.surface,
        borderColor: theme.border.subtle,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitle: {
        ...typography.variants.h3,
    },
    closeButton: {
        padding: spacing.xs,
    },
    sessionInfo: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.xs,
    },
    sessionInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    sessionInfoText: {
        ...typography.variants.bodyMedium,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    emptyText: {
        ...typography.variants.bodyLarge,
    },
    playersList: {
        flex: 1,
    },
    playersContent: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    playerCard: {
        backgroundColor: theme.background.surface,
        borderRadius: 12,
        padding: spacing.md,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: theme.border.subtle,
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    playerName: {
        ...typography.variants.bodyLarge,
        fontWeight: '600',
        flexShrink: 1,
    },
    statusButtons: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    statusButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.border.default,
        backgroundColor: theme.background.surface,
        gap: 4,
    },
    statusButtonText: {
        ...typography.variants.labelSmall,
    },
    notesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        borderRadius: 8,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderWidth: 1,
    },
    notesInput: {
        flex: 1,
        ...typography.variants.bodyMedium,
        paddingVertical: 4,
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: theme.border.subtle,
        gap: spacing.sm,
        backgroundColor: theme.background.surface,
    },
    saveButton: {
        width: '100%',
    },
    cancelButton: {
        width: '100%',
    },
});
