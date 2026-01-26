import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';



import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button'; // Import Button
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input'; // Import Input
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import AttendanceModal from '@/src/features/calendar/components/AttendanceModal';
import { AttendanceToggleIcon, BulkAttendanceStatus } from '@/src/features/calendar/components/AttendanceToggleIcon';
import { useAttendanceMutations } from '@/src/features/calendar/hooks/useAttendance';
import { useSessionMutations, useSessions } from '@/src/features/calendar/hooks/useSessions';
import { useCollaborators } from '@/src/features/collaborators/hooks/useCollaborators';
import { useViewStore } from '@/src/store/useViewStore';
import { AttendanceStatus, Session } from '@/src/types/session';

// Configure i18n for the calendar
LocaleConfig.locales['es'] = {
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    today: 'Hoy'
};

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

    const { deleteSession } = useSessionMutations();
    const { saveAttendance } = useAttendanceMutations();
    const { data: collaborators } = useCollaborators('', false);

    // Apply locale
    const calendarLocale = i18n.language.startsWith('es') ? 'es' : 'en';
    LocaleConfig.defaultLocale = calendarLocale;

    // Fetch sessions with a small buffer for timezones
    const startDate = useMemo(() => {
        const [y, m] = selectedDate.split('-').map(Number);
        const date = new Date(y, m - 1, 1);
        date.setHours(0, 0, 0, 0);
        // Go back 1 day to catch UTC overlap
        const buffer = new Date(date);
        buffer.setDate(buffer.getDate() - 1);
        return buffer.toISOString();
    }, [selectedDate]);

    const endDate = useMemo(() => {
        const [y, m] = selectedDate.split('-').map(Number);
        const date = new Date(y, m, 0); // Last day of month
        date.setHours(23, 59, 59, 999);
        // Go forward 1 day to catch UTC overlap
        const buffer = new Date(date);
        buffer.setDate(buffer.getDate() + 1);
        return buffer.toISOString();
    }, [selectedDate]);
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
            marked[selectedDate] = { ...marked[selectedDate], selected: true, selectedColor: colors.primary[500] };
        } else {
            marked[selectedDate] = { selected: true, selectedColor: colors.primary[500] };
        }

        return marked;
    }, [sessions, selectedDate]);

    const renderDay = ({ date, state }: { date?: any; state?: string }) => {
        if (!date) return null;
        const dateString = date.dateString;
        const isSelected = dateString === selectedDate;
        const isToday = dateString === toLocalDateString(new Date());
        const sessionCount = markedDates[dateString]?.sessionCount || 0;
        const isDisabled = state === 'disabled';

        return (
            <TouchableOpacity
                onPress={() => {
                    setSelectedDate(dateString);
                    setCalendarExpanded(false);
                }}
                style={[
                    styles.dayContainer,
                    isSelected && styles.daySelected,
                ]}
            >
                <Text style={[
                    styles.dayText,
                    isToday && styles.dayToday,
                    isSelected && styles.dayTextSelected,
                    isDisabled && styles.dayDisabled,
                ]}>
                    {date.day}
                </Text>
                {sessionCount > 0 && (
                    <View style={styles.sessionCountBadge}>
                        <Text style={styles.sessionCountText}>{sessionCount}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const daySessions = useMemo(() => {
        console.log('[Calendar] Filtering for date:', selectedDate);
        console.log('[Calendar] All sessions:', sessions?.length, sessions?.map(s => ({ id: s.id, scheduled_at: s.scheduled_at, local: toLocalDateString(parseSupabaseDate(s.scheduled_at)) })));
        const filtered = sessions?.filter(s => toLocalDateString(parseSupabaseDate(s.scheduled_at)) === selectedDate) || [];
        console.log('[Calendar] Filtered sessions for today:', filtered.length);
        return filtered.sort((a, b) => parseSupabaseDate(a.scheduled_at).getTime() - parseSupabaseDate(b.scheduled_at).getTime());
    }, [sessions, selectedDate]);

    const renderSessionItem = ({ item }: { item: Session }) => {
        const hasPlayers = item.players && item.players.length > 0;
        const allPlayers = hasPlayers ? item.players! : (item.player ? [{ id: '', full_name: item.player.full_name }] : []);

        const handleDeletePress = () => {
            setSessionToDelete(item.id);
            // Check if session is past or future
            const start = parseSupabaseDate(item.scheduled_at);
            const isPast = start < new Date();

            if (isPast) {
                setIsPastDelete(true);
                setCancellationReason('');
            } else {
                setIsPastDelete(false);
            }
            setDeleteConfirmVisible(true);
        };

        const startTime = parseSupabaseDate(item.scheduled_at);
        const endTime = new Date(startTime.getTime() + item.duration_minutes * 60 * 1000);
        const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        return (
            <Card style={styles.sessionCard} padding="sm">
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
                                        <View key={player.id || idx}>
                                            <TouchableOpacity
                                                onPress={handleToggleAttendance}
                                                disabled={!canTakeAttendance || isGlobalView} // Disable touch in global view
                                                activeOpacity={canTakeAttendance && !isGlobalView ? 0.6 : 1}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={styles.playerName}>
                                                        {player.full_name}
                                                    </Text>
                                                    {(canTakeAttendance || isGlobalView) && (
                                                        <Ionicons
                                                            name={currentStatus === 'present' ? "checkmark" :
                                                                currentStatus === 'absent' ? "close" :
                                                                    "ellipse-outline"}
                                                            size={currentStatus ? 14 : 12}
                                                            color={currentStatus === 'present' ? colors.success[600] :
                                                                currentStatus === 'absent' ? colors.error[600] :
                                                                    colors.neutral[500]}
                                                            style={{ fontWeight: 'bold' }}
                                                        />
                                                    )}
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
                                        <Ionicons name="location-outline" size={12} color={colors.neutral[500]} />
                                        <Text style={styles.locationText}>
                                            {item.location || 'Ubicación'} - Cancha: {item.court || '?'}
                                        </Text>
                                    </View>
                                </View>
                                {/* Multi-academy: Academy name label */}
                                {item.academy?.name && (
                                    <View style={[styles.locationContainer, { marginTop: 2 }]}>
                                        <Ionicons name="business-outline" size={12} color={colors.primary[500]} />
                                        <Text style={[styles.locationText, { color: colors.primary[600] }]}>
                                            {item.academy.name}
                                        </Text>
                                    </View>
                                )}
                                {/* Line 1.5: Plan Name */}
                                {(() => {
                                    // Extract unique plan names from players
                                    const plans = Array.from(new Set(allPlayers.map((p: any) => p.plan_name).filter(Boolean)));
                                    if (plans.length > 0) {
                                        return (
                                            <View style={[styles.locationContainer, { marginTop: 2 }]}>
                                                <Ionicons name="pricetag-outline" size={12} color={colors.neutral[500]} />
                                                <Text style={styles.locationText}>
                                                    {plans.join(', ')}
                                                </Text>
                                            </View>
                                        );
                                    }
                                    return null;
                                })()}
                                {/* Line 2: Coach (separate View for proper spacing) */}
                                <View style={[styles.locationContainer, { marginTop: 2 }]}>
                                    <Ionicons name="school-outline" size={12} color={colors.neutral[500]} />
                                    <Text style={styles.locationText}>
                                        {item.instructor?.full_name || item.coach?.full_name || t('you')}
                                    </Text>
                                </View>
                                {/* Line 3: Session Notes */}
                                {item.notes && (
                                    <View style={[styles.locationContainer, { marginTop: 2 }]}>
                                        <Ionicons name="document-text-outline" size={12} color={colors.neutral[500]} />
                                        <Text style={styles.locationText} numberOfLines={1}>
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
                                            <Ionicons name="create-outline" size={20} color={colors.warning[500]} />
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
                                            <Ionicons name="trash-outline" size={20} color={colors.error[500]} />
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
            await deleteSession.mutateAsync({
                id: sessionToDelete,
                reason: isPastDelete ? cancellationReason : undefined
            });
            setSessionToDelete(null);
        }
        setDeleteConfirmVisible(false);
    };

    return (
        <View style={styles.container}>
            {/* Removed Tabs.Screen headerRight injection */}

            {calendarExpanded ? (
                <View style={styles.calendarContainer}>
                    <Calendar
                        dayComponent={renderDay}
                        markedDates={markedDates}
                        theme={{
                            todayTextColor: colors.primary[500],
                            arrowColor: colors.primary[500],
                            indicatorColor: colors.primary[500],
                            textDayFontFamily: typography.family.sans,
                            textMonthFontFamily: typography.family.sans,
                            textDayHeaderFontFamily: typography.family.sans,
                            textDayFontSize: 12,
                            textMonthFontSize: 14,
                            textDayHeaderFontSize: 10,
                            // @ts-ignore
                            'stylesheet.calendar.header': {
                                week: {
                                    marginTop: 0,
                                    marginBottom: 2,
                                    flexDirection: 'row',
                                    justifyContent: 'space-around',
                                },
                                dayHeader: {
                                    width: 40,
                                    textAlign: 'center',
                                    fontSize: 10,
                                    fontFamily: typography.family.sans,
                                    color: colors.neutral[500],
                                },
                            },
                        }}
                    />
                </View>
            ) : (
                <View style={styles.collapsedHeader}>
                    <TouchableOpacity
                        style={styles.collapsedDateBtn}
                        onPress={() => setCalendarExpanded(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="calendar" size={20} color={colors.primary[500]} />
                        <Text style={styles.collapsedHeaderText}>
                            {selectedDate === toLocalDateString(new Date()) ? t('today') : selectedDate}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color={colors.neutral[400]} />
                    </TouchableOpacity>

                    {/* History Button in Collapsed View - REMOVED */}
                </View>
            )}

            {!calendarExpanded && (
                <>
                    <View style={styles.agendaHeader}>
                        <View />

                        {!isGlobalView && (
                            <TouchableOpacity
                                style={styles.addBtn}
                                activeOpacity={0.7}
                                onPress={() => router.push(`/calendar/new?date=${selectedDate}` as any)}
                            >
                                <Ionicons name="add" size={20} color={colors.common.white} />
                                <Text style={styles.addBtnText}>Nueva</Text>
                            </TouchableOpacity>
                        )}
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
                                <Ionicons name="calendar-outline" size={48} color={colors.neutral[200]} />
                                <Text style={styles.emptyText}>
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
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.md }}>
                    <View style={{ backgroundColor: 'white', borderRadius: 12, padding: spacing.lg }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: spacing.sm, color: colors.error[500] }}>
                            ¿Eliminar clase pasada?
                        </Text>
                        <Text style={{ color: colors.neutral[600], marginBottom: spacing.md }}>
                            Esta clase ya ocurrió. Para eliminarla, por favor indica el motivo (ej: Lluvia, etc).
                        </Text>
                        <Input
                            placeholder="Ej: Suspendida por lluvia"
                            value={cancellationReason}
                            onChangeText={setCancellationReason}
                            autoFocus
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md }}>
                            <Button
                                label="Cancelar"
                                variant="ghost"
                                onPress={() => setDeleteConfirmVisible(false)}
                            />
                            <Button
                                label="Eliminar"
                                style={{ backgroundColor: colors.error[500] }}
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

const getStatusColor = (status: string) => {
    switch (status) {
        case 'completed': return colors.success[100];
        case 'cancelled': return colors.error[100];
        default: return colors.primary[50];
    }
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    calendarContainer: {
        backgroundColor: colors.common.white,
        paddingBottom: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    collapsedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center', // Centered
        backgroundColor: colors.common.white,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
        position: 'relative', // For absolute child
    },
    collapsedDateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    collapsedHeaderText: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[800],
    },
    dayContainer: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 4,
    },
    daySelected: {
        backgroundColor: colors.primary[500],
        borderRadius: 8,
    },
    dayText: {
        fontSize: 12,
        color: colors.neutral[800],
    },
    dayTextSelected: {
        color: colors.common.white,
        fontWeight: '700',
    },
    dayToday: {
        color: colors.primary[500],
        fontWeight: '700',
    },
    dayDisabled: {
        color: colors.neutral[300],
    },
    sessionCountBadge: {
        backgroundColor: colors.primary[100],
        borderRadius: 8,
        paddingHorizontal: 4,
        paddingVertical: 1,
        marginTop: 2,
    },
    sessionCountText: {
        fontSize: 8,
        fontWeight: '700',
        color: colors.primary[700],
    },
    agendaHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    sectionTitle: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[700],
        marginBottom: spacing.xs,
    },
    attendanceHint: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginBottom: spacing.xs,
    },
    subheader: {
        fontSize: typography.size.md,
        color: colors.neutral[500],
        marginBottom: spacing.md,
        paddingHorizontal: spacing.md,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[500],
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 20,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[500],
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 20,
        gap: 4,
        justifyContent: 'center',
    },
    addBtnText: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.common.white,
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
        borderLeftColor: colors.primary[500],
        flex: 1, // Ensure card fills wrapper
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
        fontSize: 12,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    durationText: {
        fontSize: 10,
        color: colors.neutral[500],
        marginTop: 2,
    },
    divider: {
        width: 1,
        height: '80%',
        backgroundColor: colors.neutral[100],
        marginHorizontal: spacing.sm,
    },
    locationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[50],
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
    },
    locationBadgeText: {
        fontSize: 10,
        color: colors.primary[600],
        marginLeft: 2,
        fontWeight: '500',
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
        color: colors.neutral[500],
        textTransform: 'uppercase',
    },
    playerName: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[900],
    },
    playerNameSecondary: {
        fontSize: typography.size.sm,
        fontWeight: '500',
        color: colors.neutral[600],
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
    },
    locationText: {
        fontSize: 10,
        color: colors.neutral[500],
        marginLeft: 4,
        flexShrink: 1,
    },
    notesText: {
        fontSize: 11,
        color: colors.neutral[500],
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
        fontSize: 10,
        fontWeight: '700',
        color: colors.neutral[600],
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
        fontSize: typography.size.md,
        color: colors.neutral[400],
        marginTop: spacing.md,
    },
    historyOverlayBtn: {
        position: 'absolute',
        top: 10,
        right: 16,
        padding: 6,
        backgroundColor: colors.common.white,
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
