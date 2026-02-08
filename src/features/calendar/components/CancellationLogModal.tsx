import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
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
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
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
                        <Ionicons name="document-text-outline" size={14} color={theme.status.error} style={{ marginTop: 2 }} />
                        <Text style={[styles.reasonText, { color: theme.status.error }]}>
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
                    <Text style={[styles.title, { color: theme.text.primary }]}>Historial Cancelaciones</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color={theme.text.secondary} />
                    </TouchableOpacity>
                </View>

                <Text style={styles.subtitle}>
                    Mostrando cancelaciones del periodo seleccionado en calendario.
                </Text>

                {isLoading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
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
                        <Ionicons name="calendar-outline" size={48} color={theme.text.disabled} />
                        <Text style={[styles.emptyText, { color: theme.text.secondary }]}>No hay cancelaciones en este periodo.</Text>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.surface,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        backgroundColor: theme.background.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
    },
    closeBtn: {
        padding: spacing.xs,
    },
    subtitle: {
        fontSize: typography.size.xs,
        color: theme.text.secondary,
        padding: spacing.md,
        textAlign: 'center',
    },
    list: {
        padding: spacing.md,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: theme.background.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: theme.border.subtle,
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
        borderRightColor: theme.border.subtle,
        minWidth: 50,
    },
    dayText: {
        fontSize: typography.size.xl,
        fontWeight: '800',
        color: theme.text.primary,
    },
    monthText: {
        fontSize: 10,
        fontWeight: '700',
        color: theme.text.tertiary,
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
        color: theme.text.primary,
    },
    coachText: {
        fontSize: typography.size.sm,
        color: theme.text.secondary,
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
        fontWeight: '500',
        flex: 1,
    },
    locationText: {
        fontSize: 10,
        color: theme.text.tertiary,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xl,
    },
    emptyText: {
        marginTop: spacing.md,
        fontSize: typography.size.md,
    },
});
