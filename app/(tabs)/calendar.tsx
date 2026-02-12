import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';


import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import AttendanceModal from '@/src/features/calendar/components/AttendanceModal';
import { AttendanceToggleIcon, BulkAttendanceStatus } from '@/src/features/calendar/components/AttendanceToggleIcon';
import { useAttendanceMutations } from '@/src/features/calendar/hooks/useAttendance';
import { useSessionMutations, useSessions } from '@/src/features/calendar/hooks/useSessions';
import { useCollaborators } from '@/src/features/collaborators/hooks/useCollaborators';
import { useTheme } from '@/src/hooks/useTheme';
import { useViewStore } from '@/src/store/useViewStore';
import { AttendanceStatus, Session } from '@/src/types/session';

// Configure i18n for the calendar - Moved to src/i18n/index.ts

const toLocalDateString = (date: Date) => {
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Robust date parsing for Supabase strings
const parseSupabaseDate = (dateStr: string) => {
    if (!dateStr) return new Date(NaN);
    // Replace space with T if missing, to ensure standard ISO parsing
    const normalized = dateStr.includes(' ') && !dateStr.includes('T')
        ? dateStr.replace(' ', 'T')
        : dateStr;
    return new Date(normalized);
};

export default function CalendarScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const [selectedDate, setSelectedDate] = useState(toLocalDateString(new Date()));
    const [visibleDate, setVisibleDate] = useState(toLocalDateString(new Date())); // New state for tracking viewed month
    const [calendarExpanded, setCalendarExpanded] = useState(true);
    const [cancellationReason, setCancellationReason] = useState('');
    const [isPastDelete, setIsPastDelete] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false); // Restored
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null); // Restored
    const [attendanceSession, setAttendanceSession] = useState<Session | null>(null); // Restored
    const { isGlobalView } = useViewStore();
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const { deleteSession } = useSessionMutations();
    const { saveAttendance } = useAttendanceMutations();
    const { data: collaborators } = useCollaborators('', false);

    // Locale is handled globally in src/i18n/index.ts

    // Fetch sessions with a small buffer for timezones
    // Fetch sessions with a small buffer for timezones
    const startDate = useMemo(() => {
        // Use visibleDate (month view) if available, otherwise selectedDate
        const target = visibleDate || selectedDate;
        const [y, m] = target.split('-').map(Number);
        const date = new Date(y, m - 1, 1);
        date.setHours(0, 0, 0, 0);
        // Go back 1 day to catch UTC overlap
        const buffer = new Date(date);
        buffer.setDate(buffer.getDate() - 1);
        return buffer.toISOString();
    }, [selectedDate, visibleDate]);

    const endDate = useMemo(() => {
        const target = visibleDate || selectedDate;
        const [y, m] = target.split('-').map(Number);
        const date = new Date(y, m, 0); // Last day of month
        date.setHours(23, 59, 59, 999);
        // Go forward 1 day to catch UTC overlap
        const buffer = new Date(date);
        buffer.setDate(buffer.getDate() + 1);
        return buffer.toISOString();
    }, [selectedDate, visibleDate]);
    const activityStartDate = useMemo(() => {
        // Use visibleDate if available (updates on swipe), otherwise selectedDate
        const targetDate = visibleDate || selectedDate;
        const [y, m] = targetDate.split('-').map(Number);
        const date = new Date(y, m - 1, 1);
        date.setHours(0, 0, 0, 0);
        return date.toISOString(); // Exact start of month
    }, [visibleDate, selectedDate]);

    const activityEndDate = useMemo(() => {
        const targetDate = visibleDate || selectedDate;
        const [y, m] = targetDate.split('-').map(Number);
        const date = new Date(y, m, 0); // Last day of month
        date.setHours(23, 59, 59, 999);
        return date.toISOString(); // Exact end of month
    }, [visibleDate, selectedDate]);

    // ... existing startDate/endDate for useSessions (keep slightly buffered for timezone safety on calendar dots)




    const { data: sessions, isLoading, refetch } = useSessions(startDate, endDate);

    // Refresh on focus to catch new sessions immediately
    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    const markedDates = useMemo(() => {
        const marked: any = {};

        // Mark sessions with count
        sessions?.forEach(session => {
            // Skip cancelled sessions
            if (session.status === 'cancelled' || session.deleted_at) return;

            const dateStr = toLocalDateString(parseSupabaseDate(session.scheduled_at));
            if (dateStr) {
                if (!marked[dateStr]) {
                    marked[dateStr] = { sessionCount: 1 };
                } else {
                    marked[dateStr].sessionCount = (marked[dateStr].sessionCount || 0) + 1;
                }
            }
        });

        // Mark selected date
        if (marked[selectedDate]) {
            marked[selectedDate] = { ...marked[selectedDate], selected: true, selectedColor: theme.components.button.primary.bg };
        } else {
            marked[selectedDate] = { selected: true, selectedColor: theme.components.button.primary.bg };
        }

        return marked;
    }, [sessions, selectedDate, theme]);

    const renderDay = ({ date, state, marking }: { date?: any; state?: string, marking?: any }) => {
        if (!date) return null;
        const dateString = date.dateString;
        const isSelected = dateString === selectedDate;
        const isToday = dateString === toLocalDateString(new Date());
        // Use marking prop if available, otherwise fallback (fixes update delay)
        const sessionCount = marking?.sessionCount || markedDates[dateString]?.sessionCount || 0;
        const isDisabled = state === 'disabled';

        return (
            <TouchableOpacity
                onPress={() => {
                    setSelectedDate(dateString);
                    setVisibleDate(dateString); // Sync visible date to prevent jump back
                    setCalendarExpanded(false);
                }}
                style={[
                    styles.dayContainer,
                    isSelected && [styles.daySelected, { backgroundColor: theme.components.button.primary.bg }],
                ]}
            >
                <Text style={[
                    styles.dayText,
                    { color: theme.text.primary },
                    isToday && [styles.dayToday, { color: theme.components.button.primary.bg }],
                    isSelected && styles.dayTextSelected,
                    isDisabled && [styles.dayDisabled, { color: theme.text.disabled }],
                ]}>
                    {date.day}
                </Text>
                {sessionCount > 0 && (
                    <View style={[styles.sessionCountBadge, { backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : theme.components.button.primary.bg + '20' }]}>
                        <Text style={[styles.sessionCountText, { color: isSelected ? '#FFFFFF' : theme.components.button.primary.bg }]}>{sessionCount}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const daySessions = useMemo(() => {
        const filtered = sessions?.filter(s => {
            // Filter by date AND exclude cancelled
            const matchesDate = toLocalDateString(parseSupabaseDate(s.scheduled_at)) === selectedDate;
            const isNotCancelled = s.status !== 'cancelled' && !s.deleted_at;
            return matchesDate && isNotCancelled;
        }) || [];

        return filtered.sort((a, b) => parseSupabaseDate(a.scheduled_at).getTime() - parseSupabaseDate(b.scheduled_at).getTime());
    }, [sessions, selectedDate]);

    const renderSessionItem = ({ item }: { item: Session }) => {
        const hasPlayers = item.players && item.players.length > 0;
        const allPlayers = hasPlayers ? item.players! : (item.player ? [{ id: '', full_name: item.player.full_name, avatar_url: item.player.avatar_url, plan_name: null, is_plan_exempt: false }] : []);

        const handleDeletePress = () => {
            setSessionToDelete(item.id);
            // Calculate if session is within 24 hours
            const now = new Date();
            const diffInMs = startTime.getTime() - now.getTime();
            const diffInHours = diffInMs / (1000 * 60 * 60);
            // >24h away → simple delete (hard delete, no trace)
            // ≤24h or past → cancellation with reason (soft delete, leaves history)
            setIsPastDelete(diffInHours <= 24);
            setCancellationReason('');
            setDeleteConfirmVisible(true);
        };

        const startTime = parseSupabaseDate(item.scheduled_at);
        const endTime = new Date(startTime.getTime() + item.duration_minutes * 60 * 1000);
        const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        return (
            <Card style={styles.sessionCard} padding="sm">
                {/* Group Name Header */}
                {item.class_group && (
                    <View style={{ marginBottom: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: theme.border.subtle }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="people" size={14} color={theme.text.secondary} style={{ marginRight: 4 }} />
                            <Text style={[typography.variants.labelSmall, { color: theme.text.secondary }]}>
                                {item.class_group.name}
                            </Text>
                        </View>
                    </View>
                )}

                <View style={styles.sessionRow}>
                    <View style={styles.timeContainer}>
                        <Text style={styles.timeText}>
                            {formatTime(startTime)} - {formatTime(endTime)}
                        </Text>
                    </View>

                    <View style={styles.divider} />

                    <View
                        style={styles.sessionInfo}
                    >
                        <View style={styles.playerInfo}>
                            {/* Avatar removed to save space */}
                            <View style={styles.playerTextContainer}>
                                {allPlayers.map((player, idx) => {
                                    // Find attendance record for this player
                                    const playerAttendance = item.attendance?.find(a => a.player_id === player.id);
                                    const currentStatus = playerAttendance?.status;
                                    const statusIcon = currentStatus === 'present' ? ' ✓' : currentStatus === 'absent' ? ' ✗' : '';
                                    const playerNote = playerAttendance?.notes;

                                    // Extract plan info
                                    // Extract plan info
                                    // @ts-ignore
                                    let planName = player.plan_name || 'Sin Plan';
                                    // @ts-ignore
                                    let hasPlan = !!player.plan_name;

                                    // @ts-ignore
                                    if (player.is_plan_exempt) {
                                        planName = 'Excluido del cobro';
                                        hasPlan = false; // Or true if we want neutral color, but 'alert' color might be better for visibility?
                                        // User said "unificar el mensaje". 
                                        // In group create it uses: color: colors.error[600] and icon: 'alert-circle-outline'
                                    }

                                    // Check if this session is today or past (can take attendance)
                                    const canTakeAttendance = toLocalDateString(startTime) <= toLocalDateString(new Date());

                                    // Toggle attendance handler (disabled in global view)
                                    const handleToggleAttendance = async () => {
                                        if (!canTakeAttendance || isGlobalView) return; // Disable in global view

                                        // Cycle: no status -> present -> absent -> present
                                        const newStatus: AttendanceStatus = currentStatus === 'present' ? 'absent' : 'present';

                                        await saveAttendance.mutateAsync({
                                            sessionId: item.id,
                                            records: [{ player_id: player.id, status: newStatus, notes: playerNote || undefined }]
                                        });
                                        refetch();
                                    };

                                    return (
                                        <View key={player.id || idx} style={{ marginBottom: 4 }}>
                                            <TouchableOpacity
                                                onPress={handleToggleAttendance}
                                                disabled={!canTakeAttendance || isGlobalView} // Disable touch in global view
                                                activeOpacity={canTakeAttendance && !isGlobalView ? 0.6 : 1}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                                                        <Text style={[styles.playerName, { color: theme.text.primary }]}>
                                                            {player.full_name}
                                                        </Text>
                                                        {(canTakeAttendance || isGlobalView) && (
                                                            <Ionicons
                                                                name={currentStatus === 'present' ? "checkmark-circle" :
                                                                    currentStatus === 'absent' ? "close-circle" :
                                                                        "ellipse-outline"}
                                                                size={currentStatus ? 16 : 12}
                                                                color={currentStatus === 'present' ? theme.status.success :
                                                                    currentStatus === 'absent' ? theme.status.error :
                                                                        theme.text.disabled}
                                                                style={{ fontWeight: 'bold', marginLeft: 4 }}
                                                            />
                                                        )}
                                                    </View>

                                                    {/* Plan details next to name or wrapped */}
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Ionicons
                                                            name={player.is_plan_exempt ? "alert-circle-outline" : (hasPlan ? "pricetag-outline" : "alert-circle-outline")}
                                                            size={10}
                                                            color={player.is_plan_exempt ? theme.status.error : (hasPlan ? theme.text.tertiary : theme.status.warning)}
                                                            style={{ marginRight: 2 }}
                                                        />
                                                        <Text style={[typography.variants.bodySmall, { fontSize: 10, color: player.is_plan_exempt ? theme.status.error : theme.text.secondary }]}>
                                                            {planName}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                                {allPlayers.length === 0 && (
                                    <Text style={styles.playerName}>?</Text>
                                )}
                                <View style={styles.metaRow}>
                                    {/* Line 1: Location + Court */}
                                    <View style={styles.locationContainer}>
                                        <Ionicons name="location-outline" size={12} color={theme.text.secondary} />
                                        <Text style={[styles.locationText, { color: theme.text.secondary }]}>
                                            {item.location || 'Ubicación'} - Cancha: {item.court || '?'}
                                        </Text>
                                    </View>
                                </View>
                                {/* Multi-academy: Academy name label */}
                                {item.academy?.name && (
                                    <View style={[styles.locationContainer, { marginTop: 2 }]}>
                                        <Ionicons name="business-outline" size={12} color={theme.components.button.primary.bg} />
                                        <Text style={[styles.locationText, { color: theme.components.button.primary.bg }]}>
                                            {item.academy.name}
                                        </Text>
                                    </View>
                                )}

                                {/* Plan Summary removed as per request (now detailed per player) */}

                                {/* Line 2: Coach (separate View for proper spacing) */}
                                <View style={[styles.locationContainer, { marginTop: 2 }]}>
                                    <Ionicons name="school-outline" size={12} color={theme.text.secondary} />
                                    <Text style={[styles.locationText, { color: theme.text.secondary }]}>
                                        {item.instructor?.full_name || item.coach?.full_name || t('you')}
                                    </Text>
                                </View>
                                {/* Line 3: Session Notes */}
                                {item.notes && (
                                    <View style={[styles.locationContainer, { marginTop: 2 }]}>
                                        <Ionicons name="document-text-outline" size={12} color={theme.text.secondary} />
                                        <Text style={[styles.locationText, { color: theme.text.secondary }]} numberOfLines={1}>
                                            {item.notes}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    <View style={styles.actionButtons}>
                        <View style={styles.iconRow}>
                            {/* Bulk attendance toggle - only for today or past sessions */}
                            {/* Disable Bulk Toggle in Global View */}
                            {toLocalDateString(startTime) <= toLocalDateString(new Date()) && allPlayers.length > 0 && !isGlobalView && (() => {
                                // Determine current bulk attendance status
                                const attendanceStatuses = allPlayers.map(p => {
                                    const attendance = item.attendance?.find(a => a.player_id === p.id);
                                    return attendance?.status;
                                });

                                // Count how many have each status
                                const hasAnyAttendance = attendanceStatuses.some(s => s !== undefined);
                                const allPresent = attendanceStatuses.every(s => s === 'present');
                                const allAbsent = attendanceStatuses.every(s => s === 'absent');

                                let bulkStatus: BulkAttendanceStatus;
                                if (!hasAnyAttendance) {
                                    // No attendance recorded for anyone
                                    bulkStatus = 'pending';
                                } else if (allPresent) {
                                    bulkStatus = 'present';
                                } else if (allAbsent) {
                                    bulkStatus = 'absent';
                                } else {
                                    // Mixed state (some present, some absent, or some without status)
                                    bulkStatus = 'mixed';
                                }

                                // Toggle handler: pending -> present -> absent -> present (mixed also goes to present)
                                const handleToggle = async () => {
                                    let newStatus: AttendanceStatus;
                                    if (bulkStatus === 'pending' || bulkStatus === 'mixed') {
                                        newStatus = 'present';
                                    } else if (bulkStatus === 'present') {
                                        newStatus = 'absent';
                                    } else {
                                        newStatus = 'present'; // From absent back to present
                                    }

                                    await saveAttendance.mutateAsync({
                                        sessionId: item.id,
                                        records: allPlayers.map(p => ({ player_id: p.id, status: newStatus }))
                                    });
                                    refetch();
                                };

                                return (
                                    <AttendanceToggleIcon
                                        playerCount={allPlayers.length}
                                        status={bulkStatus}
                                        onPress={handleToggle}
                                        size={22}
                                    />
                                );
                            })()}

                            {/* Hide Edit/Delete buttons in Global View */}
                            {!isGlobalView && (
                                <>
                                    <View
                                        // @ts-ignore - title attribute for web hover tooltip
                                        title={t('editSession')}
                                    >
                                        <TouchableOpacity
                                            style={styles.actionIconBtn}
                                            activeOpacity={0.5}
                                            onPress={() => router.push(`/calendar/${item.id}` as any)}
                                            accessibilityLabel={t('editSession')}
                                        >
                                            <Ionicons name="create-outline" size={20} color={theme.status.warning} />
                                        </TouchableOpacity>
                                    </View>
                                    <View
                                        // @ts-ignore - title attribute for web hover tooltip
                                        title={t('delete')}
                                    >
                                        <TouchableOpacity
                                            style={styles.actionIconBtn}
                                            activeOpacity={0.5}
                                            onPress={handleDeletePress}
                                            accessibilityLabel={t('delete')}
                                        >
                                            <Ionicons name="trash-outline" size={20} color={theme.status.error} />
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

    const handleConfirmDelete = async () => {
        if (sessionToDelete) {
            try {
                await deleteSession.mutateAsync({
                    id: sessionToDelete,
                    reason: isPastDelete ? cancellationReason : undefined
                });
                refetch(); // Force UI refresh after successful delete
            } catch (error) {
                console.error('[handleConfirmDelete] Error deleting session:', error);
            }
            setSessionToDelete(null);
        }
        setDeleteConfirmVisible(false);
    };

    const navigation = useNavigation();

    // Set header options
    // Removed headerRight options logic
    React.useLayoutEffect(() => {
        // Clear options just in case
        navigation.setOptions({
            headerRight: undefined
        });
    }, [navigation]);

    return (
        <View style={[styles.container, { backgroundColor: theme.background.default }]}>
            {/* Action Bar (Below Academy Scroll / Header) */}
            <View style={[styles.actionBar, { paddingHorizontal: spacing.md, gap: spacing.sm }]}>
                {/* Create Button */}
                <TouchableOpacity
                    style={[styles.pillButton, { backgroundColor: theme.components.button.primary.bg }]}
                    onPress={() => router.push(`/calendar/new?date=${selectedDate}` as any)}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add-circle-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.pillButtonText}>Crear Clases</Text>
                </TouchableOpacity>

                {/* Bulk Edit Button */}
                <TouchableOpacity
                    style={[styles.pillButton, { backgroundColor: theme.background.surface, borderWidth: 1, borderColor: theme.border.subtle }]}
                    onPress={() => router.push('/calendar/bulk')}
                    activeOpacity={0.8}
                >
                    <Ionicons name="list-outline" size={18} color={theme.text.secondary} style={{ marginRight: 6 }} />
                    <Text style={[styles.pillButtonText, { color: theme.text.secondary }]}>Edición Masiva</Text>
                </TouchableOpacity>
            </View>

            {calendarExpanded ? (
                <View style={[styles.calendarContainer, { backgroundColor: theme.background.surface, borderBottomColor: theme.border.subtle }]}>
                    <Calendar
                        current={visibleDate || selectedDate}
                        dayComponent={renderDay}
                        markedDates={markedDates}
                        onMonthChange={(date: any) => {
                            if (date?.dateString) {
                                setVisibleDate(date.dateString);
                            }
                        }}
                        renderArrow={(direction: 'left' | 'right') => (
                            <Ionicons
                                name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
                                size={24} // Intermediate size
                                color={theme.components.button.primary.bg}
                            />
                        )}
                        theme={{
                            calendarBackground: theme.background.surface,
                            todayTextColor: theme.components.button.primary.bg,
                            monthTextColor: theme.text.primary,
                            dayTextColor: theme.text.primary,
                            textSectionTitleColor: theme.text.secondary,
                            textDisabledColor: theme.text.disabled,
                            arrowColor: theme.components.button.primary.bg,
                            indicatorColor: theme.components.button.primary.bg,
                            textDayFontFamily: typography.family.sans,
                            textMonthFontFamily: typography.family.sans,
                            textDayHeaderFontFamily: typography.family.sans,
                            textDayFontSize: 12,
                            textMonthFontSize: 16,
                            textDayHeaderFontSize: 10,
                            // @ts-ignore
                            'stylesheet.calendar.header': {
                                week: {
                                    marginTop: 10,
                                    marginBottom: 10,
                                    flexDirection: 'row',
                                    justifyContent: 'space-around',
                                },
                                dayHeader: {
                                    width: 40,
                                    textAlign: 'center',
                                    fontSize: 10,
                                    fontFamily: typography.family.sans,
                                    color: theme.text.secondary,
                                },
                            },
                        }}
                    />
                </View>
            ) : (
                <View style={[styles.collapsedHeader, { backgroundColor: theme.background.surface, borderBottomColor: theme.border.subtle }]}>
                    <TouchableOpacity
                        style={styles.collapsedDateBtn}
                        onPress={() => setCalendarExpanded(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="calendar" size={20} color={theme.components.button.primary.bg} />
                        <Text style={[styles.collapsedHeaderText, { color: theme.text.primary }]}>
                            {selectedDate === toLocalDateString(new Date()) ? t('today') : selectedDate}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color={theme.text.disabled} />
                    </TouchableOpacity>

                    {/* History Button in Collapsed View - REMOVED */}
                </View>
            )}

            {!calendarExpanded && (
                <>
                    <View style={styles.agendaHeader}>
                        <View />
                    </View>

                    {/* Attendance hint - moved to own line */}
                    {selectedDate <= toLocalDateString(new Date()) && daySessions.length > 0 && !isGlobalView && (
                        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xs }}>
                            <Text style={styles.attendanceHint}>
                                {t('attendance.hint')}
                            </Text>
                        </View>
                    )}

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.listContent}
                    >
                        {daySessions.length > 0 ? (
                            <View style={styles.sessionsGrid}>
                                {daySessions.map(item => (
                                    <View key={item.id} style={styles.sessionWrapper}>
                                        {renderSessionItem({ item })}
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="calendar-outline" size={48} color={theme.text.disabled} />
                                <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
                                    {isLoading ? '...' : t('noSessionsToday')}
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </>
            )}

            {/* Modal de Confirmación / Motivo */}
            <StatusModal
                visible={deleteConfirmVisible && !isPastDelete}
                type="warning"
                title={t('delete')}
                message={t('deleteSessionConfirm')}
                buttonText={t('delete')}
                showCancel
                onClose={() => setDeleteConfirmVisible(false)}
                onConfirm={handleConfirmDelete}
            />

            {/* Custom Modal for PAST deletion with Reason */}
            <Modal visible={deleteConfirmVisible && isPastDelete} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.md }}>
                    <View style={{ backgroundColor: theme.background.surface, borderRadius: 12, padding: spacing.lg, width: '100%', maxWidth: 400 }}>
                        <Text style={[typography.variants.h3, { marginBottom: spacing.sm, color: theme.status.error }]}>
                            ¿Cancelar clase?
                        </Text>
                        <Text style={{ color: theme.text.secondary, marginBottom: spacing.md }}>
                            Indica el motivo de la cancelación. Esto la mantendrá en el historial como "Cancelada".
                        </Text>
                        <Input
                            placeholder="Ej: Suspendida por lluvia"
                            value={cancellationReason}
                            onChangeText={setCancellationReason}
                            autoFocus
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md }}>
                            <Button
                                label="Volver"
                                variant="ghost"
                                onPress={() => setDeleteConfirmVisible(false)}
                            />
                            <Button
                                label="Confirmar"
                                style={{ backgroundColor: theme.status.error }}
                                onPress={() => handleConfirmDelete()}
                                loading={deleteSession.isPending}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {attendanceSession && (
                <AttendanceModal
                    visible={!!attendanceSession}
                    onClose={() => setAttendanceSession(null)}
                    sessionId={attendanceSession.id}
                    sessionTime={`${parseSupabaseDate(attendanceSession.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`}
                    sessionLocation={attendanceSession.location || ''}
                    players={(attendanceSession.players || []).map(p => ({ id: p.id, full_name: p.full_name, avatar_url: p.avatar_url }))}
                    onSaved={() => refetch()}
                />
            )}


        </View>
    );
}

const getStatusColor = (status: string, theme: Theme) => {
    switch (status) {
        case 'completed': return theme.status.success + '20';
        case 'cancelled': return theme.status.error + '20';
        default: return theme.components.button.primary.bg + '15';
    }
};

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    calendarContainer: {
        backgroundColor: theme.background.surface,
        paddingBottom: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
        marginTop: 8,
        borderRadius: 12,
        marginHorizontal: spacing.md,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    collapsedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.background.surface,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
        position: 'relative',
    },
    collapsedDateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    collapsedHeaderText: {
        ...typography.variants.label,
        color: theme.text.primary,
    },
    dayContainer: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 3,
        overflow: 'hidden',
    },
    daySelected: {
        backgroundColor: theme.components.button.primary.bg,
        borderRadius: 8,
    },
    dayText: {
        ...typography.variants.bodySmall,
        color: theme.text.primary,
        lineHeight: 18,
    },
    dayTextSelected: {
        color: 'white',
        fontWeight: '700',
    },
    dayToday: {
        color: theme.components.button.primary.bg,
        fontWeight: '700',
    },
    dayDisabled: {
        color: theme.text.disabled,
    },
    sessionCountBadge: {
        backgroundColor: theme.components.button.primary.bg + '20',
        borderRadius: 6,
        paddingHorizontal: 3,
        paddingVertical: 0,
        marginTop: 1,
    },
    sessionCountText: {
        ...typography.variants.labelSmall,
        fontSize: 9,
        color: theme.components.button.primary.bg,
    },
    agendaHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    sectionTitle: {
        ...typography.variants.h3,
        color: theme.text.primary,
        marginBottom: spacing.xs,
    },
    attendanceHint: {
        ...typography.variants.bodySmall,
        color: theme.text.secondary,
        marginBottom: spacing.xs,
    },
    subheader: {
        ...typography.variants.bodyLarge,
        color: theme.text.secondary,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.md,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.components.button.primary.bg,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: theme.background.default,
        // No border bottom to blend with scrolling content or calendar? 
        // Or keep it distinct. User said "linea bajo el scroll".
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    pillButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: 20,
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    pillButtonText: {
        ...typography.variants.label,
        color: 'white',
        lineHeight: 18,
        includeFontPadding: false,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.components.button.primary.bg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 20,
        gap: 4,
        justifyContent: 'center',
    },
    addBtnText: {
        ...typography.variants.label,
        color: 'white',
        lineHeight: 14,
        includeFontPadding: false,
    },
    listContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xxl,
    },
    sessionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    sessionWrapper: {
        flex: 1,
        minWidth: 300, // Ensure readability on mobile
        maxWidth: '49%', // Cap width to ~50% (minus tiny gap) so single items don't stretch, but 2 items fit.
    },
    sessionCard: {
        // marginBottom: spacing.sm, // Removed to let grid gap handle spacing
        borderLeftWidth: 4,
        borderLeftColor: theme.components.button.primary.bg,
        flex: 1, // Ensure card fills wrapper
        backgroundColor: theme.background.surface,
    },
    sessionRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    timeContainer: {
        width: 48,
        alignItems: 'center',
    },
    timeText: {
        ...typography.variants.label,
        color: theme.text.primary,
    },
    durationText: {
        ...typography.variants.bodySmall,
        color: theme.text.tertiary,
        marginTop: 2,
    },
    divider: {
        width: 1,
        height: '80%',
        backgroundColor: theme.border.subtle,
        marginHorizontal: spacing.sm,
    },
    locationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.components.button.primary.bg + '20',
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
    },
    locationBadgeText: {
        ...typography.variants.labelSmall,
        color: theme.components.button.primary.bg,
        marginLeft: 2,
    },
    sessionInfo: {
        flex: 1,
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    playerTextContainer: {
        marginLeft: 0,
        flex: 1,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: 2,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    playerLabel: {
        fontSize: 10,
        color: theme.text.secondary,
        textTransform: 'uppercase',
    },
    playerName: {
        ...typography.variants.bodyLarge,
        fontWeight: '600',
        color: theme.text.primary,
    },
    playerNameSecondary: {
        ...typography.variants.bodyMedium,
        color: theme.text.secondary,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
    },
    locationText: {
        ...typography.variants.bodySmall,
        color: theme.text.secondary,
        marginLeft: 4,
        flexShrink: 1,
    },
    notesText: {
        ...typography.variants.bodySmall,
        color: theme.text.secondary,
        fontStyle: 'italic',
        marginTop: spacing.xs,
        flexShrink: 1,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: spacing.sm,
    },
    statusText: {
        ...typography.variants.labelSmall,
        color: theme.text.secondary,
    },
    actionButtons: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    iconRow: {
        flexDirection: 'row',
        marginTop: spacing.xs,
    },
    actionIconBtn: {
        padding: spacing.xs,
        marginLeft: spacing.xs,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xxl,
    },
    emptyText: {
        ...typography.variants.bodyLarge,
        color: theme.text.disabled,
        marginTop: spacing.md,
    },
    historyOverlayBtn: {
        position: 'absolute',
        top: 10,
        right: 16,
        padding: 6,
        backgroundColor: theme.background.surface,
        borderRadius: 20,
        // Shadow for visibility over calendar
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        zIndex: 10,
    },
    historyCollapsedBtn: {
        position: 'absolute',
        right: spacing.md,
        padding: 4,
    },
});
