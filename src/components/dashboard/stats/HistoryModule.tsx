import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { Card } from '@/src/design/components/Card';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { DatePickerModal } from '@/src/features/calendar/components/DatePickerModal';
import { useSessions } from '@/src/features/calendar/hooks/useSessions';
import { useTheme } from '@/src/hooks/useTheme';
import { useViewStore } from '@/src/store/useViewStore';
import { StatsSection } from '../StatsSection';

export const HistoryModule = () => {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const { t } = useTranslation();
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 768;
    const { isGlobalView } = useViewStore();

    // Initial Date Range: Current Month
    const now = new Date();
    const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
    const [endDate, setEndDate] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));

    // Picker State
    const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

    // Format dates for display
    const formatDate = (date: Date) => date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

    // Ensure we send ISO string with time set correctly for queries
    const queryStartDate = useMemo(() => {
        const d = new Date(startDate);
        d.setHours(0, 0, 0, 0);
        return d.toISOString();
    }, [startDate]);

    const queryEndDate = useMemo(() => {
        const d = new Date(endDate);
        d.setHours(23, 59, 59, 999);
        return d.toISOString();
    }, [endDate]);

    const { data: sessions, isLoading, refetch } = useSessions(queryStartDate, queryEndDate);

    const handleDateSelect = (date: Date) => {
        if (pickerTarget === 'start') {
            setStartDate(date);
        } else if (pickerTarget === 'end') {
            setEndDate(date);
        }
        setPickerTarget(null);
    };

    // Group sessions by Date
    const groupedSessions = useMemo(() => {
        if (!sessions) return {};

        // Sort ascending (oldest first) as requested
        const sorted = [...sessions].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

        return sorted.reduce((acc, session) => {
            const date = new Date(session.scheduled_at);
            const key = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
            // Capitalize first letter
            const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);

            if (!acc[formattedKey]) {
                acc[formattedKey] = [];
            }
            acc[formattedKey].push(session);
            return acc;
        }, {} as Record<string, typeof sessions>);
    }, [sessions]);

    // Stats
    const stats = useMemo(() => {
        const total = sessions?.length || 0;
        const cancelled = sessions?.filter(s => s.status === 'cancelled' || !!s.deleted_at).length || 0;
        const completed = total - cancelled;
        return { total, cancelled, completed };
    }, [sessions]);

    return (
        <StatsSection
            title="Historial de Clases"
            icon="calendar-number-outline"
            actionLabel="Ver todas →"
            onAction={() => router.push('/calendar')}
        >
            {/* Filter Row */}
            <View style={styles.filterRow}>
                <TouchableOpacity
                    style={[styles.dateBtn, { backgroundColor: theme.background.surface, borderColor: theme.border.default }]}
                    onPress={() => setPickerTarget('start')}
                >
                    <Ionicons name="calendar-outline" size={16} color={theme.text.tertiary} />
                    <Text style={[styles.dateBtnText, { color: theme.text.primary }]}>{formatDate(startDate)}</Text>
                </TouchableOpacity>

                <Ionicons name="arrow-forward" size={14} color={theme.text.tertiary} />

                <TouchableOpacity
                    style={[styles.dateBtn, { backgroundColor: theme.background.surface, borderColor: theme.border.default }]}
                    onPress={() => setPickerTarget('end')}
                >
                    <Ionicons name="calendar-outline" size={16} color={theme.text.tertiary} />
                    <Text style={[styles.dateBtnText, { color: theme.text.primary }]}>{formatDate(endDate)}</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.summaryRow, { backgroundColor: theme.background.subtle }]}>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: theme.status.success }]}>{stats.completed}</Text>
                    <Text style={[styles.statLabel, { color: theme.text.secondary }]}>Realizadas</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border.default }]} />
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: theme.status.error }]}>{stats.cancelled}</Text>
                    <Text style={[styles.statLabel, { color: theme.text.secondary }]}>Canceladas</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border.default }]} />
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: theme.text.primary }]}>{stats.total}</Text>
                    <Text style={[styles.statLabel, { color: theme.text.secondary }]}>Total</Text>
                </View>
            </View>

            {isLoading ? (
                <ActivityIndicator size="small" color={theme.components.button.primary.bg} style={{ marginTop: spacing.md }} />
            ) : (
                <View style={styles.listContainer}>
                    {(!sessions || sessions.length === 0) ? (
                        <Text style={[styles.emptyText, { color: theme.text.tertiary }]}>No hay clases registradas en este período.</Text>
                    ) : isLargeScreen ? (
                        // LARGE SCREEN: Continuous Grid
                        <View style={styles.sessionsGridLarge}>
                            {[...sessions].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()).map(session => {
                                // Check for status OR deleted_at (soft delete)
                                const isCancelled = session.status === 'cancelled' || !!session.deleted_at;
                                const attendance = session.attendance || [];
                                let headerStatus = null;

                                // For header, ONLY show Cancelled badge. Attendance is now per-player.
                                if (isCancelled) {
                                    headerStatus = (
                                        <View style={styles.statusBadgeError}>
                                            <Text style={styles.statusTextError}>Cancelada</Text>
                                        </View>
                                    );
                                }

                                const dateObj = new Date(session.scheduled_at);
                                const dateLabel = dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
                                // Helper to render players with status
                                const renderPlayers = () => {
                                    if (!session.players || session.players.length === 0) {
                                        return <Text style={[styles.cardText, styles.cardTitle, { color: theme.text.primary }, isCancelled && [styles.cancelledText, { color: theme.text.tertiary }]]}>
                                            {session.class_group?.name || 'Clase Individual'}
                                        </Text>;
                                    }
                                    return (
                                        <View style={styles.playersContainer}>
                                            {session.players.map((p: any, index: number) => {
                                                // Find status for this player
                                                const playerStatus = attendance.find(a => a.player_id === p.id)?.status;
                                                let statusIcon = null;

                                                if (!isCancelled && playerStatus === 'present') {
                                                    statusIcon = <Ionicons name="checkmark-circle" size={14} color={theme.status.success} />;
                                                } else if (!isCancelled && playerStatus === 'absent') {
                                                    statusIcon = <Ionicons name="close-circle" size={14} color={theme.status.error} />;
                                                }

                                                return (
                                                    <View key={p.id} style={styles.playerItem}>
                                                        <Text style={[styles.cardText, styles.cardTitle, { color: theme.text.primary }, isCancelled && [styles.cancelledText, { color: theme.text.tertiary }]]} numberOfLines={1}>
                                                            {p.full_name}{index < (session.players?.length || 0) - 1 ? ',' : ''}
                                                        </Text>
                                                        {statusIcon}
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    );
                                };

                                return (
                                    <Card
                                        key={session.id}
                                        padding="sm"
                                        style={[
                                            styles.sessionCard,
                                            styles.sessionCardLarge,
                                            { backgroundColor: theme.background.surface, borderColor: theme.border.subtle },
                                            isCancelled && [styles.cardCancelled, { backgroundColor: theme.background.subtle }]
                                        ]}
                                    >
                                        <View style={styles.cardHeader}>
                                            <View style={[styles.dateTimeBadge, { backgroundColor: theme.components.button.primary.bg + '15' }]}>
                                                <Text style={[styles.dateLabel, { color: theme.components.button.primary.bg }]}>{dateLabel}</Text>
                                                <View style={[styles.verticalDivider, { backgroundColor: theme.components.button.primary.bg + '30' }]} />
                                                <Text style={[styles.timeText, { color: theme.components.button.primary.bg }]}>
                                                    {dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </Text>
                                            </View>
                                            {headerStatus}
                                        </View>

                                        <View style={[styles.cardRow, { alignItems: 'flex-start' }]}>
                                            <Ionicons name="person-outline" size={14} color={theme.text.tertiary} style={[styles.icon, { marginTop: 2 }]} />
                                            {renderPlayers()}
                                        </View>

                                        {isGlobalView && session.academy?.name && (
                                            <View style={styles.cardRow}>
                                                <Ionicons name="school-outline" size={14} color={theme.components.button.primary.bg} style={styles.icon} />
                                                <Text style={[styles.cardText, styles.subText, { color: theme.components.button.primary.bg, fontWeight: '500' }]} numberOfLines={1}>
                                                    {session.academy.name}
                                                </Text>
                                            </View>
                                        )}

                                        <View style={styles.cardRow}>
                                            <Ionicons name="school-outline" size={14} color={theme.text.tertiary} style={styles.icon} />
                                            <Text style={[styles.cardText, styles.subText, { color: theme.text.secondary }]} numberOfLines={1}>
                                                {session.coach?.full_name || 'Sin coach'}
                                            </Text>
                                        </View>

                                        <View style={styles.cardRow}>
                                            <Ionicons name="location-outline" size={14} color={theme.text.tertiary} style={styles.icon} />
                                            <Text style={[styles.cardText, styles.subText, { color: theme.text.secondary }]} numberOfLines={1}>
                                                {session.location || 'Sin ubicación'}
                                            </Text>
                                        </View>

                                        {isCancelled && session.cancellation_reason && (
                                            <Text style={[styles.reasonText, { color: theme.status.error }]} numberOfLines={2}>
                                                Motivo: {session.cancellation_reason}
                                            </Text>
                                        )}
                                    </Card>
                                );
                            })}
                        </View>
                    ) : (
                        // MOBILE: Grouped List
                        Object.entries(groupedSessions).map(([dateLabel, daySessions]) => (
                            <View key={dateLabel} style={styles.dayGroup}>
                                <Text style={[styles.dateHeader, { color: theme.text.tertiary }]}>{dateLabel}</Text>
                                <View style={styles.sessionsGrid}>
                                    {daySessions.map(session => {
                                        const isCancelled = session.status === 'cancelled' || !!session.deleted_at;

                                        // Attendance Logic
                                        const attendance = session.attendance || [];
                                        let headerStatus = null;

                                        if (isCancelled) {
                                            headerStatus = (
                                                <View style={[styles.statusBadgeError, { backgroundColor: theme.status.errorBackground, borderColor: theme.status.error + '40' }]}>
                                                    <Text style={[styles.statusTextError, { color: theme.status.errorText }]}>Cancelada</Text>
                                                </View>
                                            );
                                        }

                                        // Helper to render players with status
                                        const renderPlayers = () => {
                                            if (!session.players || session.players.length === 0) {
                                                return <Text style={[styles.cardText, styles.cardTitle, { color: theme.text.primary }, isCancelled && [styles.cancelledText, { color: theme.text.tertiary }]]}>
                                                    {session.class_group?.name || 'Clase Individual'}
                                                </Text>;
                                            }
                                            return (
                                                <View style={styles.playersContainer}>
                                                    {session.players.map((p: any, index: number) => {
                                                        const playerStatus = attendance.find(a => a.player_id === p.id)?.status;
                                                        let statusIcon = null;

                                                        if (!isCancelled && playerStatus === 'present') {
                                                            statusIcon = <Ionicons name="checkmark-circle" size={14} color={theme.status.success} />;
                                                        } else if (!isCancelled && playerStatus === 'absent') {
                                                            statusIcon = <Ionicons name="close-circle" size={14} color={theme.status.error} />;
                                                        }

                                                        return (
                                                            <View key={p.id} style={styles.playerItem}>
                                                                <Text style={[styles.cardText, styles.cardTitle, { color: theme.text.primary }, isCancelled && [styles.cancelledText, { color: theme.text.tertiary }]]} numberOfLines={1}>
                                                                    {p.full_name}{index < (session.players?.length || 0) - 1 ? ',' : ''}
                                                                </Text>
                                                                {statusIcon}
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            );
                                        };

                                        return (
                                            <Card
                                                key={session.id}
                                                padding="sm"
                                                style={[
                                                    styles.sessionCard,
                                                    { backgroundColor: theme.background.surface, borderColor: theme.border.subtle },
                                                    isCancelled && [styles.cardCancelled, { backgroundColor: theme.background.subtle }]
                                                ]}
                                            >
                                                <View style={styles.cardHeader}>
                                                    <View style={[styles.timeBadge, { backgroundColor: theme.components.button.primary.bg + '15' }]}>
                                                        <Ionicons name="time-outline" size={12} color={theme.components.button.primary.bg} />
                                                        <Text style={[styles.timeText, { color: theme.components.button.primary.bg }]}>
                                                            {new Date(session.scheduled_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                        </Text>
                                                    </View>
                                                    {headerStatus}
                                                </View>

                                                <View style={[styles.cardRow, { alignItems: 'flex-start' }]}>
                                                    <Ionicons name="person-outline" size={14} color={theme.text.tertiary} style={[styles.icon, { marginTop: 2 }]} />
                                                    {renderPlayers()}
                                                </View>

                                                {isGlobalView && session.academy?.name && (
                                                    <View style={styles.cardRow}>
                                                        <Ionicons name="business-outline" size={14} color={theme.components.button.primary.bg} style={styles.icon} />
                                                        <Text style={[styles.cardText, styles.subText, { color: theme.components.button.primary.bg, fontWeight: '500' }]} numberOfLines={1}>
                                                            {session.academy.name}
                                                        </Text>
                                                    </View>
                                                )}

                                                <View style={styles.cardRow}>
                                                    <Ionicons name="school-outline" size={14} color={theme.text.tertiary} style={styles.icon} />
                                                    <Text style={[styles.cardText, styles.subText, { color: theme.text.secondary }]} numberOfLines={1}>
                                                        {session.coach?.full_name || 'Sin coach'}
                                                    </Text>
                                                </View>

                                                <View style={styles.cardRow}>
                                                    <Ionicons name="location-outline" size={14} color={theme.text.tertiary} style={styles.icon} />
                                                    <Text style={[styles.cardText, styles.subText, { color: theme.text.secondary }]} numberOfLines={1}>
                                                        {session.location || 'Sin ubicación'}
                                                    </Text>
                                                </View>

                                                {isCancelled && session.cancellation_reason && (
                                                    <Text style={[styles.reasonText, { color: theme.status.error }]} numberOfLines={2}>
                                                        Motivo: {session.cancellation_reason}
                                                    </Text>
                                                )}
                                            </Card>
                                        );
                                    })}
                                </View>
                            </View>
                        ))
                    )}
                </View>
            )}

            <DatePickerModal
                visible={!!pickerTarget}
                onClose={() => setPickerTarget(null)}
                onSelect={handleDateSelect}
                selectedDate={pickerTarget === 'start' ? startDate : endDate}
            />
        </StatsSection>
    );
};

const styles = StyleSheet.create({
    filterRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    dateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    dateBtnText: {
        fontSize: typography.size.sm,
        fontWeight: '500',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderRadius: 8,
        marginBottom: spacing.md,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: typography.size.lg,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: typography.size.xs,
    },
    divider: {
        width: 1,
        height: 24,
    },
    listContainer: {
        gap: spacing.md,
    },
    dayGroup: {
        marginBottom: spacing.xs,
    },
    dateHeader: {
        fontSize: typography.size.xs,
        fontWeight: '700',
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sessionsGrid: {
        flexDirection: 'column',
        gap: spacing.sm,
    },
    sessionsGridLarge: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        justifyContent: 'center',
    },
    sessionCard: {
        borderWidth: 1,
    },
    sessionCardLarge: {
        width: '24%',
        minWidth: 200,
    },
    cardCancelled: {
        opacity: 0.8,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    dateTimeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    dateLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'capitalize',
    },
    verticalDivider: {
        width: 1,
        height: 10,
    },
    timeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
        gap: 6,
    },
    icon: {
        width: 16,
        textAlign: 'center',
    },
    cardText: {
        flex: 1,
        fontSize: typography.size.sm,
    },
    cardTitle: {
        fontWeight: '600',
    },
    subText: {
        fontSize: typography.size.xs,
    },
    cancelledText: {
        textDecorationLine: 'line-through',
    },
    statusBadgeError: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
    },
    statusTextError: {
        fontSize: 10,
        fontWeight: '700',
    },
    reasonText: {
        marginTop: 6,
        fontSize: 11,
        fontStyle: 'italic',
        lineHeight: 14,
    },
    emptyText: {
        textAlign: 'center',
        fontStyle: 'italic',
        padding: spacing.md,
    },
    playersContainer: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    playerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    }
});
