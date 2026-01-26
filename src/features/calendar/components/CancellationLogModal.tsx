import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCancelledSessions } from '../hooks/useCancelledSessions';

interface CancellationLogModalProps {
    visible: boolean;
    onClose: () => void;
    startDate: string;
    endDate: string;
}

export const CancellationLogModal: React.FC<CancellationLogModalProps> = ({
    visible,
    onClose,
    startDate,
    endDate
}) => {
    const { data: cancelledSessions, isLoading } = useCancelledSessions(startDate, endDate);

    const renderItem = ({ item }: { item: any }) => {
        const date = new Date(item.scheduled_at);
        const day = date.getDate();
        const month = date.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
            <View style={styles.card}>
                <View style={styles.dateBox}>
                    <Text style={styles.dayText}>{day}</Text>
                    <Text style={styles.monthText}>{month}</Text>
                </View>
                <View style={styles.infoBox}>
                    <View style={styles.row}>
                        <Text style={styles.timeText}>{time}</Text>
                        <Text style={styles.coachText}>• {item.instructor?.full_name || 'Sin Asignar'}</Text>
                    </View>
                    <View style={styles.reasonBox}>
                        <Ionicons name="document-text-outline" size={14} color={colors.error[500]} style={{ marginTop: 2 }} />
                        <Text style={styles.reasonText}>
                            {item.cancellation_reason || 'Sin motivo especificado'}
                        </Text>
                    </View>
                    <Text style={styles.locationText}>
                        {item.location} {item.court ? `(Cancha ${item.court})` : ''}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Historial Cancelaciones</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color={colors.neutral[900]} />
                    </TouchableOpacity>
                </View>

                <Text style={styles.subtitle}>
                    Mostrando cancelaciones del periodo seleccionado en calendario.
                </Text>

                {isLoading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.primary[500]} />
                    </View>
                ) : cancelledSessions && cancelledSessions.length > 0 ? (
                    <FlatList
                        data={cancelledSessions}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.list}
                    />
                ) : (
                    <View style={styles.center}>
                        <Ionicons name="calendar-outline" size={48} color={colors.neutral[300]} />
                        <Text style={styles.emptyText}>No hay cancelaciones en este periodo.</Text>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        backgroundColor: colors.common.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    closeBtn: {
        padding: spacing.xs,
    },
    subtitle: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        padding: spacing.md,
        textAlign: 'center',
    },
    list: {
        padding: spacing.md,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: colors.common.white,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    dateBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingRight: spacing.md,
        borderRightWidth: 1,
        borderRightColor: colors.neutral[100],
        minWidth: 50,
    },
    dayText: {
        fontSize: typography.size.xl,
        fontWeight: '800',
        color: colors.neutral[800],
    },
    monthText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.neutral[500],
    },
    infoBox: {
        flex: 1,
        paddingLeft: spacing.md,
        justifyContent: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    timeText: {
        fontSize: typography.size.sm,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    coachText: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
        marginLeft: spacing.xs,
    },
    reasonBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginBottom: 4,
    },
    reasonText: {
        fontSize: typography.size.sm,
        color: colors.error[600],
        fontWeight: '500',
        flex: 1,
    },
    locationText: {
        fontSize: 10,
        color: colors.neutral[400],
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xl,
    },
    emptyText: {
        marginTop: spacing.md,
        color: colors.neutral[500],
        fontSize: typography.size.md,
    },
});
