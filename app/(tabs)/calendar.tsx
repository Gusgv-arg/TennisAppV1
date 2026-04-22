import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
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
import { useAuthStore } from '@/src/store/useAuthStore'; // Added import
import { useViewStore } from '@/src/store/useViewStore';
import { AttendanceStatus, Session } from '@/src/types/session';
import { showError } from '@/src/utils/toast';
import { HelpModal, HelpItem } from '@/src/components/HelpModal';
import { HelpIcon } from '@/src/design/components/HelpIcon';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { SelectorSheet } from '@/src/components/SelectorSheet';

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
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const [selectedDate, setSelectedDate] = useState(toLocalDateString(new Date()));
    const [visibleDate, setVisibleDate] = useState(toLocalDateString(new Date())); // New state for tracking viewed month
    const [calendarExpanded, setCalendarExpanded] = useState(true);
    const [cancellationReason, setCancellationReason] = useState('');
    const [isPastDelete, setIsPastDelete] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false); // Restored
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null); // Restored
    const [attendanceSession, setAttendanceSession] = useState<Session | null>(null); // Restored
    const { user, profile } = useAuthStore();
    const { isGlobalView } = useViewStore();
    const { theme } = useTheme();
    const [attendanceHelpVisible, setAttendanceHelpVisible] = useState(false);

    // Filter by student state
    const [filteringPlayerId, setFilteringPlayerId] = useState<string | null>(null);
    const [filteringPlayerName, setFilteringPlayerName] = useState<string | null>(null);
    const [playerSelectorVisible, setPlayerSelectorVisible] = useState(false);

    const styles = useMemo(() => createStyles(theme, isDesktop), [theme, isDesktop]);

    const { deleteSession } = useSessionMutations();
    const { saveAttendance } = useAttendanceMutations();
    const { data: collaborators } = useCollaborators('', false);
    const { data: playersList } = usePlayers('', 'active');

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

    // Refresh on focus to catch new sessions immediately AND reset filter if needed
    useFocusEffect(
        useCallback(() => {
            refetch();
            return () => {
                // Clear filter when leaving the screen
                setFilteringPlayerId(null);
                setFilteringPlayerName(null);
            };
        }, [refetch])
    );

    const markedDates = useMemo(() => {
        const marked: any = {};

        // Mark sessions with count
        sessions?.forEach(session => {
            // Skip cancelled sessions
            if (session.status === 'cancelled' || session.deleted_at) return;

            // Apply player filter if active
            if (filteringPlayerId) {
                const isPlayerIn = session.players?.some(p => p.id === filteringPlayerId);
                if (!isPlayerIn) return;
            }

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
    }, [sessions, selectedDate, theme, filteringPlayerId]);

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
                    setVisibleDate(dateString); 
                    setCalendarExpanded(false);
                }}
                style={styles.dayContainer}
            >
                <View style={[
                    styles.daySelectionCircle,
                    isSelected && { backgroundColor: theme.components.button.primary.bg }
                ]}>
                    <Text style={[
                        styles.dayText,
                        { color: theme.text.primary },
                        isToday && [styles.dayToday, { color: theme.components.button.primary.bg }],
                        isSelected && styles.dayTextSelected,
                        isDisabled && [styles.dayDisabled, { color: theme.text.disabled }],
                    ]}>
                        {date.day}
                    </Text>
                </View>
                {sessionCount > 0 && (
                    <View style={[
                        styles.sessionCountBadge, 
                        { 
                            backgroundColor: isSelected ? theme.status.warning : theme.components.button.primary.bg,
                            position: 'absolute',
                            bottom: 2
                        }
                    ]}>
                        <Text style={[
                            styles.sessionCountText, 
                            { color: isSelected ? 'white' : theme.components.button.primary.text }
                        ]}>{sessionCount}</Text>
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
            
            // Filter by player if selected
            if (filteringPlayerId) {
                const isPlayerIn = s.players?.some(p => p.id === filteringPlayerId);
                return matchesDate && isNotCancelled && isPlayerIn;
            }

            return matchesDate && isNotCancelled;
        }) || [];

        return filtered.sort((a, b) => parseSupabaseDate(a.scheduled_at).getTime() - parseSupabaseDate(b.scheduled_at).getTime());
    }, [sessions, selectedDate, filteringPlayerId]);

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

                    <View style={styles.sessionInfo}>
                        <View style={styles.playerInfo}>
                            <View style={styles.playerTextContainer}>
                                {isGlobalView && item.academy?.name && (
                                    <View style={[styles.locationContainer, { marginBottom: 4 }]}>
                                        <Ionicons name="school-outline" size={12} color={theme.components.button.primary.bg} />
                                        <Text style={[styles.locationText, { color: theme.components.button.primary.bg, fontWeight: '600' }]}>
                                            {item.academy.name}
                                        </Text>
                                    </View>
                                )}

                                {allPlayers.map((player, idx) => {
                                    const playerAttendance = item.attendance?.find(a => a.player_id === player.id);
                                    const currentStatus = playerAttendance?.status;
                                    const playerNote = playerAttendance?.notes;

                                    // @ts-ignore
                                    let planName = player.plan_name || t('calendar.labels.noPlan');
                                    // @ts-ignore
                                    let hasPlan = !!player.plan_name;

                                    // @ts-ignore
                                    if (player.is_plan_exempt) {
                                        planName = t('calendar.labels.planExempt');
                                        hasPlan = false; 
                                    }

                                    const canTakeAttendance = true;

                                    const handleToggleAttendance = async () => {
                                        if (!canTakeAttendance || isGlobalView) return;
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
                                                disabled={!canTakeAttendance || isGlobalView}
                                                activeOpacity={canTakeAttendance && !isGlobalView ? 0.6 : 1}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                                    <Text style={[styles.playerName, { color: theme.text.primary }]}>
                                                        {player.full_name}
                                                    </Text>

                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Ionicons
                                                            name={player.is_plan_exempt ? "alert-circle-outline" : (hasPlan ? "pricetag-outline" : "alert-circle-outline")}
                                                            size={12}
                                                            color={player.is_plan_exempt ? theme.status.error : (hasPlan ? theme.text.primary : theme.status.warning)}
                                                            style={{ marginRight: 2 }}
                                                        />
                                                        <Text style={[typography.variants.bodySmall, { fontSize: 11, color: player.is_plan_exempt ? theme.status.error : theme.text.secondary }]}>
                                                            {planName}
                                                        </Text>
                                                    </View>

                                                    {(canTakeAttendance || isGlobalView) && (
                                                        <Ionicons
                                                            name={currentStatus === 'present' ? "checkmark-circle" :
                                                                currentStatus === 'absent' ? "close-circle" :
                                                                    "ellipse-outline"}
                                                            size={currentStatus ? 16 : 12}
                                                            color={currentStatus === 'present' ? theme.status.success :
                                                                currentStatus === 'absent' ? theme.status.error :
                                                                    theme.text.secondary}
                                                        />
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}

                                <View style={styles.metaRow}>
                                    {(item.location || item.court) && (
                                        <View style={styles.locationContainer}>
                                            <Ionicons name="location-outline" size={12} color={theme.text.secondary} />
                                            <Text style={[styles.locationText, { color: theme.text.secondary }]}>
                                                {[
                                                    item.location,
                                                    item.court ? `${t('calendar.labels.court')}: ${item.court}` : null
                                                ].filter(Boolean).join(' - ')}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <View style={[styles.locationContainer, { marginTop: 2 }]}>
                                    <Ionicons name="school-outline" size={12} color={theme.text.secondary} />
                                    <Text style={[styles.locationText, { color: theme.text.secondary }]}>
                                        {item.instructor?.full_name || item.coach?.full_name || (item.coach_id === user?.id ? (profile?.full_name || t('you')) : '')}
                                    </Text>
                                </View>
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
                </View>

                {/* New Action Footer for better spacing on mobile */}
                <View style={[styles.actionFooter, { borderTopColor: theme.border.subtle }]}>
                    <View style={styles.actionFooterLeft}>
                        {allPlayers.length > 0 && (() => {
                            const attendanceStatuses = allPlayers.map(p => {
                                const attendance = item.attendance?.find(a => a.player_id === p.id);
                                return attendance?.status;
                            });

                            const hasAnyAttendance = attendanceStatuses.some(s => s !== undefined);
                            const allPresent = attendanceStatuses.every(s => s === 'present');
                            const allAbsent = attendanceStatuses.every(s => s === 'absent');

                            let bulkStatus: BulkAttendanceStatus;
                            if (!hasAnyAttendance) {
                                bulkStatus = 'pending';
                            } else if (allPresent) {
                                bulkStatus = 'present';
                            } else if (allAbsent) {
                                bulkStatus = 'absent';
                            } else {
                                bulkStatus = 'mixed';
                            }

                            const handleToggle = async () => {
                                let newStatus: AttendanceStatus;
                                if (bulkStatus === 'pending' || bulkStatus === 'mixed') {
                                    newStatus = 'present';
                                } else if (bulkStatus === 'present') {
                                    newStatus = 'absent';
                                } else {
                                    newStatus = 'present';
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
                                    size={20}
                                />
                            );
                        })()}
                    </View>

                    <View style={styles.actionFooterButtons}>
                        <TouchableOpacity
                            style={styles.actionIconBtn}
                            onPress={() => router.push(`/calendar/${item.id}` as any)}
                        >
                            <Ionicons name="create-outline" size={20} color={theme.status.warning} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionIconBtn}
                            onPress={handleDeletePress}
                        >
                            <Ionicons name="trash-outline" size={20} color={theme.status.error} />
                        </TouchableOpacity>
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
                showError(t('common.error'), t('team.errors.deleteSession')); // Reusing key if available or just localized
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
            {/* Action Bar Container */}
            <View style={{ zIndex: 50, backgroundColor: theme.background.default, width: '100%' }}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={[
                        styles.actionBar, 
                        { paddingVertical: isDesktop ? spacing.sm : spacing.xs },
                        isDesktop && { justifyContent: 'flex-end', flexGrow: 1 },
                        !isDesktop && { justifyContent: 'space-around', flexGrow: 1 }
                    ]}
                    style={[
                        { flexGrow: 0 },
                        { width: '100%' },
                        isDesktop ? { marginTop: spacing.sm, marginBottom: spacing.xs } : { marginTop: spacing.sm, paddingHorizontal: 4 }
                    ]}
                >
                    {/* Create Button */}
                    <TouchableOpacity
                        style={[styles.pillButton, { backgroundColor: theme.components.button.primary.bg }]}
                        onPress={() => router.push(`/calendar/new?date=${selectedDate}` as any)}
                        activeOpacity={0.8}
                        delayPressIn={100}
                    >
                        <Ionicons name="add-circle-outline" size={18} color={theme.components.button.primary.text} style={{ marginRight: 6 }} />
                        <Text style={styles.pillButtonText}>{t('calendar.createClasses')}</Text>
                    </TouchableOpacity>

                    {/* Bulk Edit Button */}
                    <TouchableOpacity
                        style={[styles.pillButton, { backgroundColor: theme.background.surface, borderWidth: 1, borderColor: theme.border.subtle }]}
                        onPress={() => router.push('/calendar/bulk')}
                        activeOpacity={0.8}
                        delayPressIn={100}
                    >
                        <Ionicons name="list-outline" size={18} color={theme.text.secondary} style={{ marginRight: 6 }} />
                        <Text style={[styles.pillButtonText, { color: theme.text.secondary }]}>{t('calendar.bulkEdit')}</Text>
                    </TouchableOpacity>

                    {/* Player Filter Button */}
                    <TouchableOpacity
                        style={[
                            styles.pillButton, 
                            { backgroundColor: filteringPlayerId ? theme.status.info : theme.background.surface, borderWidth: 1, borderColor: theme.border.subtle }
                        ]}
                        onPress={() => {
                            if (filteringPlayerId) {
                                setFilteringPlayerId(null);
                                setFilteringPlayerName(null);
                            } else {
                                setPlayerSelectorVisible(true);
                            }
                        }}
                        activeOpacity={0.8}
                    >
                        <Ionicons 
                            name={filteringPlayerId ? "person" : "person-outline"} 
                            size={18} 
                            color={filteringPlayerId ? "white" : theme.text.secondary} 
                            style={{ marginRight: 6 }} 
                        />
                        <Text style={[styles.pillButtonText, { color: filteringPlayerId ? "white" : theme.text.secondary }]}>
                            {filteringPlayerName ? filteringPlayerName : t('calendar.filterByStudent') || 'Alumno'}
                        </Text>
                        {filteringPlayerId && (
                            <View style={{ marginLeft: 8, padding: 2 }}>
                                <Ionicons name="close-circle" size={16} color="white" />
                            </View>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </View>


            {calendarExpanded ? (
                <View style={!isDesktop ? { paddingBottom: 5 } : undefined}>
                    <View style={[
                        styles.calendarContainer,
                        { backgroundColor: theme.background.surface, borderBottomColor: theme.border.subtle },
                        isDesktop && { marginTop: 0, paddingBottom: 0 },
                        !isDesktop && { marginTop: 0 }
                    ]}>
                        <Calendar
                            key={`${theme.mode}_${i18n.language}`}
                            style={{
                                borderRadius: 12,
                                backgroundColor: theme.background.surface
                            }}
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
                                    size={24}
                                    color={theme.components.button.primary.bg}
                                />
                            )}
                            theme={{
                                backgroundColor: theme.background.surface,
                                calendarBackground: theme.background.surface,
                                todayTextColor: theme.components.button.primary.bg,
                                monthTextColor: theme.text.primary,
                                dayTextColor: theme.text.primary,
                                selectedDayBackgroundColor: theme.components.button.primary.bg,
                                selectedDayTextColor: '#ffffff',
                                textSectionTitleColor: theme.text.secondary,
                                textDisabledColor: theme.text.disabled,
                                arrowColor: theme.components.button.primary.bg,
                                indicatorColor: theme.components.button.primary.bg,
                                textDayFontFamily: typography.family.sans,
                                textMonthFontFamily: typography.family.sans,
                                textDayHeaderFontFamily: typography.family.sans,
                                textDayFontSize: isDesktop ? 12 : 14,
                                textMonthFontSize: isDesktop ? 15 : 16,
                                textDayHeaderFontSize: isDesktop ? 12 : 14,
                                // @ts-ignore
                                'stylesheet.calendar.header': {
                                    week: {
                                        marginTop: isDesktop ? 4 : 2,
                                        marginBottom: isDesktop ? 4 : 2,
                                        flexDirection: 'row',
                                        justifyContent: 'space-around',
                                        backgroundColor: theme.background.surface,
                                    },
                                    dayHeader: {
                                        width: isDesktop ? 36 : 40,
                                        textAlign: 'center',
                                        fontSize: isDesktop ? 12 : 15,
                                        fontFamily: typography.family.sans,
                                        color: theme.text.secondary,
                                        fontWeight: '700',
                                    },
                                    monthText: {
                                        color: theme.text.primary,
                                        fontWeight: '700',
                                        fontSize: isDesktop ? 15 : 16,
                                        marginVertical: isDesktop ? 4 : 2,
                                    },
                                    header: {
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        paddingLeft: 10,
                                        paddingRight: 10,
                                        marginTop: 0,
                                        alignItems: 'center'
                                    }
                                },
                            }}
                        />
                    </View>
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
                </View>
            )}

            {!calendarExpanded && (
                <>
                    <View style={styles.agendaHeader}>
                        <View />
                    </View>

                    {/* Attendance hint - moved to own line */}
                    {daySessions.length > 0 && !isGlobalView && (
                        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.attendanceHint}>
                                {t('calendar.attendance.hint')}
                            </Text>
                            <HelpIcon 
                                onPress={() => setAttendanceHelpVisible(true)}
                                size={14}
                            />
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
                            {t('calendar.cancellation.title')}
                        </Text>
                        <Text style={{ color: theme.text.secondary, marginBottom: spacing.md }}>
                            {t('calendar.cancellation.subtitle')}
                        </Text>
                        <Input
                            placeholder={t('calendar.cancellation.reasonPlaceholder')}
                            value={cancellationReason}
                            onChangeText={setCancellationReason}
                            autoFocus
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md }}>
                            <Button
                                label={t('calendar.cancellation.back')}
                                variant="ghost"
                                onPress={() => setDeleteConfirmVisible(false)}
                            />
                            <Button
                                label={t('calendar.cancellation.confirm')}
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

            {/* Attendance Help Modal */}
            <HelpModal
                visible={attendanceHelpVisible}
                onClose={() => setAttendanceHelpVisible(false)}
                title="Ayuda de Asistencia"
                items={[
                    {
                        icon: 'checkmark-circle-outline',
                        title: 'Marcar Presente',
                        description: 'Toca el nombre del alumno o el botón gris de "Pendiente" para registrarlo como presente (icono verde).'
                    },
                    {
                        icon: 'close-circle-outline',
                        title: 'Marcar Ausente',
                        description: 'Toca el nombre nuevamente para cambiar el estado a ausente (icono rojo).'
                    },
                    {
                        icon: 'ellipse-outline',
                        title: 'Estado Pendiente',
                        description: 'El botón de "Pendiente" indica que la asistencia aún no ha sido registrada para esa clase.'
                    },
                    {
                        icon: 'checkmark-done-circle-outline',
                        title: 'Asistencia Grupal',
                        description: 'Podés usar el icono de la derecha en el pie de la tarjeta para marcar a todos los alumnos de la clase a la vez.'
                    }
                ]}
            />

            {/* Player Selector Sheet */}
            <SelectorSheet
                visible={playerSelectorVisible}
                onClose={() => setPlayerSelectorVisible(false)}
                title={t('calendar.selectStudent') || 'Seleccionar Alumno'}
                selectedValue={filteringPlayerId}
                options={playersList?.map((p: any) => ({
                    label: p.full_name,
                    value: p.id,
                    icon: 'person-outline'
                })) || []}
                onSelect={(val) => {
                    setFilteringPlayerId(val);
                    const p = playersList?.find((x: any) => x.id === val);
                    setFilteringPlayerName(p?.full_name || null);
                }}
            />
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

const createStyles = (theme: Theme, isDesktop: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    calendarContainer: {
        backgroundColor: theme.background.surface,
        paddingBottom: isDesktop ? 0 : spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
        marginTop: isDesktop ? 4 : 8,
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
        width: isDesktop ? 36 : 40,
        height: isDesktop ? 40 : 38, 
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: isDesktop ? 2 : 2,
    },
    daySelectionCircle: {
        width: isDesktop ? 30 : 32,
        height: isDesktop ? 30 : 32,
        borderRadius: isDesktop ? 15 : 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayText: {
        ...typography.variants.bodySmall,
        fontSize: isDesktop ? 12 : 15,
        color: theme.text.primary,
        lineHeight: isDesktop ? 18 : 22,
    },
    dayTextSelected: {
        color: theme.components.button.primary.text,
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
        borderRadius: 8,
        paddingHorizontal: 4,
        height: 16,
        minWidth: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sessionCountText: {
        ...typography.variants.labelSmall,
        fontSize: 10,
        fontWeight: '600',
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
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: theme.background.default,
        gap: spacing.sm,
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    pillButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm + 4, // Reduced from md (16) to 12
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
        color: theme.components.button.primary.text,
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
        color: theme.components.button.primary.text,
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
        width: isDesktop ? '31.8%' : '100%',
        minWidth: isDesktop ? 220 : 'auto',
        flexGrow: isDesktop ? 0 : 1,
    },
    sessionCard: {
        borderLeftWidth: 4,
        borderLeftColor: theme.components.button.primary.bg,
        flex: 1,
        backgroundColor: theme.background.surface,
        flexDirection: 'column',
        justifyContent: 'space-between', // Push footer to bottom
    },
    sessionRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flex: 1, // Stretch to take remaining space
    },
    timeContainer: {
        width: 85,
        alignItems: 'center',
        justifyContent: 'center',
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
        backgroundColor: theme.border.subtle,
        marginHorizontal: spacing.sm,
        marginVertical: 4,
        alignSelf: 'stretch',
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
    actionFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        gap: spacing.lg,
    },
    actionFooterLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionFooterButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    actionIconBtn: {
        padding: spacing.xs,
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
