import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';



import StatusModal from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useSessionMutations, useSessions } from '@/src/features/calendar/hooks/useSessions';
import { Session } from '@/src/types/session';

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
    const [calendarExpanded, setCalendarExpanded] = useState(true);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

    const { deleteSession } = useSessionMutations();

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

                    <TouchableOpacity
                        style={styles.sessionInfo}
                        activeOpacity={0.7}
                        onPress={() => router.push(`/calendar/${item.id}` as any)}
                    >
                        <View style={styles.playerInfo}>
                            <Avatar
                                name={allPlayers[0]?.full_name || '?'}
                                size="sm"
                            />
                            <View style={styles.playerTextContainer}>
                                {allPlayers.map((player, idx) => (
                                    <Text key={player.id || idx} style={idx === 0 ? styles.playerName : styles.playerNameSecondary}>
                                        {player.full_name}
                                    </Text>
                                ))}
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
                                {/* Line 2: Coach (separate View for proper spacing) */}
                                <View style={[styles.locationContainer, { marginTop: 2 }]}>
                                    <Ionicons name="school-outline" size={12} color={colors.neutral[500]} />
                                    <Text style={styles.locationText}>
                                        {item.instructor?.full_name || item.coach?.full_name || t('you')}
                                    </Text>
                                </View>
                            </View>
                        </View>
                        {/* Line 3: Notes - Outside playerInfo to prevent pushing content */}
                        {item.notes && (
                            <Text style={styles.notesText} numberOfLines={1} ellipsizeMode="tail">
                                {t('notes')}: {item.notes}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.actionButtons}>
                        <View style={styles.iconRow}>
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
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

    const handleConfirmDelete = async () => {
        if (sessionToDelete) {
            await deleteSession.mutateAsync(sessionToDelete);
            setSessionToDelete(null);
        }
        setDeleteConfirmVisible(false);
    };

    return (
        <View style={styles.container}>

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
                            textDayFontSize: 13,
                            textMonthFontSize: 14,
                            textDayHeaderFontSize: 11,
                            // @ts-ignore
                            'stylesheet.calendar.header': {
                                week: {
                                    marginTop: 2,
                                    flexDirection: 'row',
                                    justifyContent: 'space-around',
                                },
                                dayHeader: {
                                    width: 40,
                                    textAlign: 'center',
                                    fontSize: 11,
                                    fontFamily: typography.family.sans,
                                    color: colors.neutral[500],
                                },
                            },
                        }}
                    />
                </View>
            ) : (
                <TouchableOpacity
                    style={styles.collapsedHeader}
                    onPress={() => setCalendarExpanded(true)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="calendar" size={20} color={colors.primary[500]} />
                    <Text style={styles.collapsedHeaderText}>
                        {selectedDate === toLocalDateString(new Date()) ? t('today') : selectedDate}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.neutral[400]} />
                </TouchableOpacity>
            )}

            {!calendarExpanded && (
                <>
                    <View style={styles.agendaHeader}>
                        <Text style={styles.sectionTitle}>
                            {selectedDate === toLocalDateString(new Date()) ? t('today') : selectedDate}
                        </Text>
                        <TouchableOpacity
                            style={styles.addBtn}
                            activeOpacity={0.7}
                            onPress={() => router.push(`/calendar/new?date=${selectedDate}` as any)}
                        >
                            <Ionicons name="add" size={20} color={colors.common.white} />
                            <Text style={styles.addBtnText}>Nueva</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        style={{ flex: 1 }}
                        data={daySessions}
                        renderItem={renderSessionItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="calendar-outline" size={48} color={colors.neutral[200]} />
                                <Text style={styles.emptyText}>
                                    {isLoading ? '...' : t('noSessionsToday')}
                                </Text>
                            </View>
                        }
                    />
                </>
            )}

            <StatusModal
                visible={deleteConfirmVisible}
                type="warning"
                title={t('delete')}
                message={t('deleteSessionConfirm')}
                buttonText={t('delete')}
                showCancel
                onClose={() => setDeleteConfirmVisible(false)}
                onConfirm={handleConfirmDelete}
            />
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
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    collapsedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.common.white,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
        gap: spacing.sm,
    },
    collapsedHeaderText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[800],
    },
    dayContainer: {
        width: 40,
        height: 48,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 6,
    },
    daySelected: {
        backgroundColor: colors.primary[500],
        borderRadius: 8,
    },
    dayText: {
        fontSize: 13,
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
        fontSize: 9,
        fontWeight: '700',
        color: colors.primary[700],
    },
    agendaHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[700],
        marginBottom: spacing.sm,
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
    sessionCard: {
        marginBottom: spacing.sm,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary[500],
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
        marginLeft: spacing.sm,
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
});
