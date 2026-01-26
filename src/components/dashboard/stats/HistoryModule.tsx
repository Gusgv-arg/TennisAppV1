import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { DatePickerModal } from '@/src/features/calendar/components/DatePickerModal';
import { useSessions } from '@/src/features/calendar/hooks/useSessions';
import { StatsSection } from '../StatsSection';

export const HistoryModule = () => {
    const { t } = useTranslation();
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 768;

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
            icon="time"
        >
            {/* Filter Row */}
            <View style={styles.filterRow}>
                <TouchableOpacity
                    style={styles.dateBtn}
                    onPress={() => setPickerTarget('start')}
                >
                    <Ionicons name="calendar-outline" size={16} color={colors.neutral[500]} />
                    <Text style={styles.dateBtnText}>{formatDate(startDate)}</Text>
                </TouchableOpacity>

                <Ionicons name="arrow-forward" size={14} color={colors.neutral[300]} />

                <TouchableOpacity
                    style={styles.dateBtn}
                    onPress={() => setPickerTarget('end')}
                >
                    <Ionicons name="calendar-outline" size={16} color={colors.neutral[500]} />
                    <Text style={styles.dateBtnText}>{formatDate(endDate)}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.summaryRow}>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.primary[600] }]}>{stats.completed}</Text>
                    <Text style={styles.statLabel}>Realizadas</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.error[600] }]}>{stats.cancelled}</Text>
                    <Text style={styles.statLabel}>Canceladas</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.neutral[600] }]}>{stats.total}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                </View>
            </View>

            {isLoading ? (
                <ActivityIndicator size="small" color={colors.primary[500]} style={{ marginTop: spacing.md }} />
            ) : (
                <View style={styles.listContainer}>
                    {(!sessions || sessions.length === 0) ? (
                        <Text style={styles.emptyText}>No hay clases registradas en este período.</Text>
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
                                        return <Text style={[styles.cardText, styles.cardTitle, isCancelled && styles.cancelledText]}>
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
                                                    statusIcon = <Ionicons name="checkmark-circle" size={14} color={colors.success[500]} />;
                                                } else if (!isCancelled && playerStatus === 'absent') {
                                                    statusIcon = <Ionicons name="close-circle" size={14} color={colors.error[500]} />;
                                                }

                                                return (
                                                    <View key={p.id} style={styles.playerItem}>
                                                        <Text style={[styles.cardText, styles.cardTitle, isCancelled && styles.cancelledText]} numberOfLines={1}>
                                                            {p.full_name}{index < session.players.length - 1 ? ',' : ''}
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
                                            isCancelled && styles.cardCancelled
                                        ]}
                                    >
                                        <View style={styles.cardHeader}>
                                            <View style={styles.dateTimeBadge}>
                                                <Text style={styles.dateLabel}>{dateLabel}</Text>
                                                <View style={styles.verticalDivider} />
                                                <Text style={styles.timeText}>
                                                    {dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </Text>
                                            </View>
                                            {headerStatus}
                                        </View>

                                        <View style={[styles.cardRow, { alignItems: 'flex-start' }]}>
                                            <Ionicons name="person-outline" size={14} color={colors.neutral[500]} style={[styles.icon, { marginTop: 2 }]} />
                                            {renderPlayers()}
                                        </View>

                                        <View style={styles.cardRow}>
                                            <Ionicons name="school-outline" size={14} color={colors.neutral[400]} style={styles.icon} />
                                            <Text style={[styles.cardText, styles.subText]} numberOfLines={1}>
                                                {session.coach?.full_name || 'Sin coach'}
                                            </Text>
                                        </View>

                                        <View style={styles.cardRow}>
                                            <Ionicons name="location-outline" size={14} color={colors.neutral[400]} style={styles.icon} />
                                            <Text style={[styles.cardText, styles.subText]} numberOfLines={1}>
                                                {session.location || 'Sin ubicación'}
                                            </Text>
                                        </View>

                                        {isCancelled && session.cancellation_reason && (
                                            <Text style={styles.reasonText} numberOfLines={2}>
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
                                <Text style={styles.dateHeader}>{dateLabel}</Text>
                                <View style={styles.sessionsGrid}>
                                    {daySessions.map(session => {
                                        const isCancelled = session.status === 'cancelled' || !!session.deleted_at;

                                        // Attendance Logic
                                        const attendance = session.attendance || [];
                                        let headerStatus = null;

                                        if (isCancelled) {
                                            headerStatus = (
                                                <View style={styles.statusBadgeError}>
                                                    <Text style={styles.statusTextError}>Cancelada</Text>
                                                </View>
                                            );
                                        }

                                        // Helper to render players with status
                                        const renderPlayers = () => {
                                            if (!session.players || session.players.length === 0) {
                                                return <Text style={[styles.cardText, styles.cardTitle, isCancelled && styles.cancelledText]}>
                                                    {session.class_group?.name || 'Clase Individual'}
                                                </Text>;
                                            }
                                            return (
                                                <View style={styles.playersContainer}>
                                                    {session.players.map((p: any, index: number) => {
                                                        const playerStatus = attendance.find(a => a.player_id === p.id)?.status;
                                                        let statusIcon = null;

                                                        if (!isCancelled && playerStatus === 'present') {
                                                            statusIcon = <Ionicons name="checkmark-circle" size={14} color={colors.success[500]} />;
                                                        } else if (!isCancelled && playerStatus === 'absent') {
                                                            statusIcon = <Ionicons name="close-circle" size={14} color={colors.error[500]} />;
                                                        }

                                                        return (
                                                            <View key={p.id} style={styles.playerItem}>
                                                                <Text style={[styles.cardText, styles.cardTitle, isCancelled && styles.cancelledText]} numberOfLines={1}>
                                                                    {p.full_name}{index < session.players.length - 1 ? ',' : ''}
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
                                                    isCancelled && styles.cardCancelled
                                                ]}
                                            >
                                                <View style={styles.cardHeader}>
                                                    <View style={styles.timeBadge}>
                                                        <Ionicons name="time-outline" size={12} color={colors.primary[700]} />
                                                        <Text style={styles.timeText}>
                                                            {new Date(session.scheduled_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                        </Text>
                                                    </View>
                                                    {headerStatus}
                                                </View>

                                                <View style={[styles.cardRow, { alignItems: 'flex-start' }]}>
                                                    <Ionicons name="person-outline" size={14} color={colors.neutral[500]} style={[styles.icon, { marginTop: 2 }]} />
                                                    {renderPlayers()}
                                                </View>

                                                <View style={styles.cardRow}>
                                                    <Ionicons name="school-outline" size={14} color={colors.neutral[400]} style={styles.icon} />
                                                    <Text style={[styles.cardText, styles.subText]} numberOfLines={1}>
                                                        {session.coach?.full_name || 'Sin coach'}
                                                    </Text>
                                                </View>

                                                <View style={styles.cardRow}>
                                                    <Ionicons name="location-outline" size={14} color={colors.neutral[400]} style={styles.icon} />
                                                    <Text style={[styles.cardText, styles.subText]} numberOfLines={1}>
                                                        {session.location || 'Sin ubicación'}
                                                    </Text>
                                                </View>

                                                {isCancelled && session.cancellation_reason && (
                                                    <Text style={styles.reasonText} numberOfLines={2}>
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
        backgroundColor: colors.common.white,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    dateBtnText: {
        fontSize: typography.size.sm,
        color: colors.neutral[700],
        fontWeight: '500',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        backgroundColor: colors.neutral[50],
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
        color: colors.neutral[500],
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: colors.neutral[200],
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
        color: colors.neutral[400],
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
        justifyContent: 'center', // Center grid items
    },
    sessionCard: {
        borderColor: colors.neutral[100],
        borderWidth: 1,
    },
    sessionCardLarge: {
        width: '24%', // ~4 per row
        // With gap, 24% * 4 = 96%, leaving space for gap. If gap pushes it, flexWrap handles it. 
        // For distinct separation, we can use slightly less %, or rely on flex-wrap behaviour.
        // Let's try 24% first as it usually fits with small gaps. 
        // If strict spacing is needed: calc((100% - 3 * gap) / 4) is better but calc not fully robust in RN styles without percent or flexBasis.
        // Let's settle on a safe approx.
        minWidth: 200,
    },
    cardCancelled: {
        backgroundColor: colors.neutral[50],
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
        backgroundColor: colors.primary[50],
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    dateTimeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[50],
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    dateLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: colors.primary[800],
        textTransform: 'capitalize',
    },
    verticalDivider: {
        width: 1,
        height: 10,
        backgroundColor: colors.primary[200],
    },
    timeText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.primary[700],
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
        gap: 6,
    },
    icon: {
        width: 16, // Fixed width for alignment
        textAlign: 'center',
    },
    cardText: {
        flex: 1,
        fontSize: typography.size.sm,
        color: colors.neutral[800],
    },
    cardTitle: {
        fontWeight: '600',
    },
    subText: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
    },
    cancelledText: {
        textDecorationLine: 'line-through',
        color: colors.neutral[500],
    },
    statusBadge: {
        // Kept for backward compat
    },
    statusText: {
        // Kept for backward compat
    },
    statusBadgeError: {
        backgroundColor: colors.error[50],
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.error[200],
    },
    statusTextError: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.error[600],
    },
    reasonText: {
        marginTop: 6,
        fontSize: 11,
        color: colors.error[600],
        fontStyle: 'italic',
        lineHeight: 14,
    },
    emptyText: {
        textAlign: 'center',
        color: colors.neutral[500],
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
