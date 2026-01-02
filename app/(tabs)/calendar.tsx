import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

import { Avatar } from '@/src/design/components/Avatar';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useSessions } from '@/src/features/calendar/hooks/useSessions';
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

    const renderSessionItem = ({ item }: { item: Session }) => (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/calendar/${item.id}` as any)}
        >
            <Card style={styles.sessionCard} padding="md">
                <View style={styles.sessionRow}>
                    <View style={styles.timeContainer}>
                        <Text style={styles.timeText}>
                            {parseSupabaseDate(item.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </Text>
                        <Text style={styles.durationText}>{item.duration_minutes} {t('minutes')}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.sessionInfo}>
                        <View style={styles.playerInfo}>
                            <Avatar
                                name={item.player?.full_name || '?'}
                                source={item.player?.avatar_url || undefined}
                                size="sm"
                            />
                            <View style={styles.playerTextContainer}>
                                <Text style={styles.playerLabel}>{t('individual')}</Text>
                                <Text style={styles.playerName}>{item.player?.full_name || t('selectPlayer')}</Text>
                            </View>
                        </View>

                        {item.location && (
                            <View style={styles.locationContainer}>
                                <Ionicons name="location-outline" size={14} color={colors.neutral[500]} />
                                <Text style={styles.locationText}>{item.location}</Text>
                            </View>
                        )}
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                        <Text style={styles.statusText}>{t(`session.${item.status}`)}</Text>
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );

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
                                    justifyContent: 'space-between'
                                }
                            }
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
                        <Text style={styles.agendaTitle}>
                            {selectedDate === toLocalDateString(new Date()) ? t('today') : selectedDate}
                        </Text>
                        <TouchableOpacity
                            style={styles.addBtn}
                            activeOpacity={0.7}
                            onPress={() => router.push(`/calendar/new?date=${selectedDate}` as any)}
                        >
                            <Ionicons name="add-circle" size={32} color={colors.primary[500]} />
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
    agendaTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    addBtn: {
        padding: spacing.xs,
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
        alignItems: 'center',
    },
    timeContainer: {
        width: 60,
        alignItems: 'center',
    },
    timeText: {
        fontSize: typography.size.md,
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
        marginHorizontal: spacing.md,
    },
    sessionInfo: {
        flex: 1,
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    playerTextContainer: {
        marginLeft: spacing.sm,
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
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    locationText: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        marginLeft: 4,
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
