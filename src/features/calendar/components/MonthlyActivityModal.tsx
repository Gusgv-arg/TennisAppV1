import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useMonthlyActivity } from '../hooks/useMonthlyActivity';

interface MonthlyActivityModalProps {
    visible: boolean;
    onClose: () => void;
    startDate: string;
    endDate: string;
}

export const MonthlyActivityModal: React.FC<MonthlyActivityModalProps> = ({
    visible,
    onClose,
    startDate,
    endDate
}) => {
    const { width } = useWindowDimensions();
    const { data: activity, isLoading } = useMonthlyActivity(startDate, endDate);

    // Dynamic columns for responsiveness
    const numColumns = width > 1200 ? 4 : (width > 800 ? 3 : 2);
    // Key change forces re-render when switching layouts
    const listKey = `grid-${numColumns}`;

    const sessions = useMemo(() => activity || [], [activity]);

    const stats = useMemo(() => {
        const total = sessions.length;
        const cancelled = sessions.filter((s: any) => s.deleted_at).length;
        const completed = sessions.filter((s: any) => s.status === 'completed' && !s.deleted_at).length;
        return { total, cancelled, completed };
    }, [sessions]);

    const renderItem = ({ item }: { item: any }) => {
        const date = new Date(item.scheduled_at);
        const day = date.getDate();
        const month = date.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const isCancelled = !!item.deleted_at;
        const isCompleted = item.status === 'completed' && !isCancelled;

        // Colors based on status
        const statusColor = isCancelled ? colors.error[500] : (isCompleted ? colors.success[600] : colors.primary[500]);
        const borderColor = isCancelled ? colors.error[100] : colors.neutral[100];

        const playersStr = item.players?.map((p: any) => p.full_name).join(', ');

        return (
            <View style={[styles.card, { borderLeftColor: statusColor, borderColor, width: `${(100 / numColumns) - 1}%` }]}>
                <View style={styles.cardHeader}>
                    <View style={styles.dateInfo}>
                        <Text style={[styles.dayText, { color: statusColor }]}>{day} {month}</Text>
                        <Text style={styles.timeText}>{time}</Text>
                    </View>
                    {isCancelled ? (
                        <Ionicons name="close-circle" size={14} color={colors.error[500]} />
                    ) : isCompleted ? (
                        <Ionicons name="checkmark-circle" size={14} color={colors.success[600]} />
                    ) : null}
                </View>

                <View style={styles.content}>
                    <Text style={styles.playerText} numberOfLines={1}>
                        {playersStr || (isCancelled ? 'Sin datos' : 'Sin alumnos')}
                    </Text>
                    <Text style={styles.instructorText} numberOfLines={1}>
                        {item.instructor?.full_name || 'Sin coach'}
                    </Text>

                    {isCancelled && item.cancellation_reason && (
                        <Text style={styles.reasonText} numberOfLines={1}>
                            {item.cancellation_reason}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.container}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Actividad Mensual</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color={colors.neutral[900]} />
                    </TouchableOpacity>
                </View>

                {/* Compact Stats Row */}
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statNum}>{stats.total}</Text>
                        <Text style={styles.statLab}>Total</Text>
                    </View>
                    <View style={styles.statSep} />
                    <View style={styles.statBox}>
                        <Text style={[styles.statNum, { color: colors.success[600] }]}>{stats.completed}</Text>
                        <Text style={styles.statLab}>Hechas</Text>
                    </View>
                    <View style={styles.statSep} />
                    <View style={styles.statBox}>
                        <Text style={[styles.statNum, { color: colors.error[500] }]}>{stats.cancelled}</Text>
                        <Text style={styles.statLab}>Canc.</Text>
                    </View>
                </View>

                {isLoading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.primary[500]} />
                    </View>
                ) : sessions.length > 0 ? (
                    <FlatList
                        key={listKey}
                        data={sessions}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContainer}
                        numColumns={numColumns}
                        columnWrapperStyle={styles.columnStyle}
                    />
                ) : (
                    <View style={styles.center}>
                        <Ionicons name="calendar-outline" size={48} color={colors.neutral[300]} />
                        <Text style={styles.emptyText}>Sin actividad registrada.</Text>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fdfdfd',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.common.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    modalTitle: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    closeBtn: {
        padding: 4,
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: colors.common.white,
        paddingVertical: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[50],
        marginBottom: spacing.xs,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statNum: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.neutral[800],
    },
    statLab: {
        fontSize: 9,
        color: colors.neutral[400],
        textTransform: 'uppercase',
    },
    statSep: {
        width: 1,
        height: '40%',
        backgroundColor: colors.neutral[100],
        alignSelf: 'center',
    },
    listContainer: {
        padding: spacing.xs,
    },
    columnStyle: {
        justifyContent: 'flex-start',
        gap: spacing.xs,
        marginBottom: spacing.xs,
    },
    card: {
        backgroundColor: colors.common.white,
        borderRadius: 4,
        padding: 6,
        borderLeftWidth: 3,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 1,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#f9f9f9',
        paddingBottom: 2,
        marginBottom: 3,
    },
    dateInfo: {
        flex: 1,
    },
    dayText: {
        fontSize: 10,
        fontWeight: '800',
    },
    timeText: {
        fontSize: 8,
        color: colors.neutral[400],
    },
    content: {
        gap: 1,
    },
    playerText: {
        fontSize: 9,
        fontWeight: '700',
        color: colors.neutral[800],
    },
    instructorText: {
        fontSize: 8,
        color: colors.neutral[400],
        fontStyle: 'italic',
    },
    reasonText: {
        fontSize: 7,
        color: colors.error[600],
        backgroundColor: colors.error[50],
        paddingHorizontal: 2,
        paddingVertical: 1,
        borderRadius: 2,
        marginTop: 1,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        marginTop: spacing.md,
        color: colors.neutral[400],
        fontSize: 14,
    },
});
