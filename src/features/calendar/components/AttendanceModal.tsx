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
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
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
const STATUS_OPTIONS: { value: AttendanceStatus; icon: string; color: string }[] = [
    { value: 'present', icon: 'checkmark-circle', color: colors.success[500] },
    { value: 'absent', icon: 'close-circle', color: colors.error[500] },
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
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <Ionicons name="reader-outline" size={24} color={colors.primary[500]} />
                        <Text style={styles.headerTitle}>{t('attendance.title')}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={colors.neutral[600]} />
                    </TouchableOpacity>
                </View>

                {/* Session Info */}
                <View style={styles.sessionInfo}>
                    <View style={styles.sessionInfoRow}>
                        <Ionicons name="time-outline" size={16} color={colors.neutral[500]} />
                        <Text style={styles.sessionInfoText}>{sessionTime}</Text>
                    </View>
                    {sessionLocation && (
                        <View style={styles.sessionInfoRow}>
                            <Ionicons name="location-outline" size={16} color={colors.neutral[500]} />
                            <Text style={styles.sessionInfoText}>{sessionLocation}</Text>
                        </View>
                    )}
                </View>

                {/* Players List */}
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary[500]} />
                    </View>
                ) : players.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={48} color={colors.neutral[300]} />
                        <Text style={styles.emptyText}>{t('attendance.noPlayers')}</Text>
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
                                            <Text style={styles.playerName}>{player.full_name}</Text>
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
                                                        onPress={() => handleStatusChange(player.id, option.value)}
                                                    >
                                                        <Ionicons
                                                            name={option.icon as any}
                                                            size={18}
                                                            color={isSelected ? option.color : colors.neutral[400]}
                                                        />
                                                        <Text style={[
                                                            styles.statusButtonText,
                                                            { color: isSelected ? option.color : colors.neutral[500] }
                                                        ]}>
                                                            {getStatusTranslation(option.value)}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>
                                    {/* Notes input */}
                                    <View style={styles.notesContainer}>
                                        <Ionicons name="chatbubble-outline" size={14} color={colors.neutral[400]} />
                                        <TextInput
                                            style={styles.notesInput}
                                            placeholder={t('attendance.addComment')}
                                            placeholderTextColor={colors.neutral[400]}
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
                        leftIcon={<Ionicons name="checkmark" size={18} color={colors.common.white} />}
                    />
                    <Button
                        label={t('cancel')}
                        variant="outline"
                        onPress={onClose}
                        style={styles.cancelButton}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.common.white,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    closeButton: {
        padding: spacing.xs,
    },
    sessionInfo: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.neutral[50],
        gap: spacing.xs,
    },
    sessionInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    sessionInfoText: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
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
        fontSize: typography.size.md,
        color: colors.neutral[500],
    },
    playersList: {
        flex: 1,
    },
    playersContent: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    playerCard: {
        backgroundColor: colors.neutral[50],
        borderRadius: 12,
        padding: spacing.md,
        gap: spacing.sm,
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
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[800],
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
        borderColor: colors.neutral[200],
        backgroundColor: colors.common.white,
        gap: 4,
    },
    statusButtonText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
    },
    notesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.common.white,
        borderRadius: 8,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    notesInput: {
        flex: 1,
        fontSize: typography.size.sm,
        color: colors.neutral[800],
        paddingVertical: 4,
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[100],
        gap: spacing.sm,
    },
    saveButton: {
        width: '100%',
    },
    cancelButton: {
        width: '100%',
    },
});
