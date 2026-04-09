import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/design/components/Button';
import { Section } from '@/src/design/components/Section';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { usePlayerClassHistory } from '@/src/features/players/hooks/usePlayers';
import { useTheme } from '@/src/hooks/useTheme';
import { DatePickerModal } from '@/src/features/calendar/components/DatePickerModal';

interface ClassHistoryModalProps {
    visible: boolean;
    onClose: () => void;
    playerId: string;
    playerName: string;
}

export const ClassHistoryModal: React.FC<ClassHistoryModalProps> = ({
    visible,
    onClose,
    playerId,
    playerName
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = windowWidth >= 768;
    const styles = useMemo(() => createStyles(theme, isDesktop, insets), [theme, isDesktop, insets]);

    // Default range: current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const { data: history, isLoading } = usePlayerClassHistory(
        playerId,
        startDate.toISOString(),
        endDate.toISOString()
    );

    const formatDate = (date: string | Date) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return new Intl.DateTimeFormat('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(d);
    };

    const formatTime = (date: string) => {
        const d = new Date(date);
        return new Intl.DateTimeFormat('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(d);
    };

    const renderItem = ({ item }: { item: any }) => {
        const attendance = item.player_attendance;
        const statusColor = attendance?.status === 'present' 
            ? theme.status.success 
            : attendance?.status === 'absent' 
                ? theme.status.error 
                : attendance?.status === 'excused' 
                    ? theme.status.info 
                    : theme.text.tertiary;

        return (
            <View style={styles.classItem}>
                <View style={styles.classHeader}>
                    <View style={styles.dateContainer}>
                        <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.classDate}>{formatDate(item.scheduled_at)}</Text>
                    </View>
                    <View style={styles.statusBadge}>
                        <Ionicons 
                            name={
                                attendance?.status === 'present' ? 'checkmark-circle' :
                                attendance?.status === 'absent' ? 'close-circle' :
                                attendance?.status === 'excused' ? 'help-circle' : 'ellipse-outline'
                            } 
                            size={14} 
                            color={statusColor} 
                        />
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {attendance ? t(`attendance.${attendance.status}`) : t('attendance.notMarked')}
                        </Text>
                    </View>
                </View>

                <View style={styles.classDetails}>
                    <View style={styles.detailRow}>
                        <Ionicons name="time-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.detailText}>{formatTime(item.scheduled_at)} ({item.duration_minutes} min)</Text>
                    </View>
                    
                    {(item.location || item.court) && (
                        <View style={styles.detailRow}>
                            <Ionicons name="location-outline" size={14} color="#FFFFFF" />
                            <Text style={styles.detailText}>
                                {item.location}{item.court ? ` - ${item.court}` : ''}
                            </Text>
                        </View>
                    )}

                    {item.class_group?.name && (
                        <View style={styles.detailRow}>
                            <Ionicons name="people-outline" size={14} color="#FFFFFF" />
                            <Text style={styles.detailText}>{item.class_group.name}</Text>
                        </View>
                    )}

                    {item.coach?.full_name && (
                        <View style={styles.detailRow}>
                            <Ionicons name="school-outline" size={14} color="#FFFFFF" />
                            <Text style={styles.detailText}>{item.coach.full_name}</Text>
                        </View>
                    )}
                </View>

                {(item.notes || attendance?.notes) && (
                    <View style={styles.notesContainer}>
                        {item.notes && (
                            <Text style={styles.noteText}>
                                <Text style={styles.noteLabel}>{t('common.notes')}: </Text>
                                {item.notes}
                            </Text>
                        )}
                        {attendance?.notes && (
                            <Text style={styles.noteText}>
                                <Text style={styles.noteLabel}>{t('attendance.notes')}: </Text>
                                {attendance.notes}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTitleContainer}>
                            <Ionicons name="school-outline" size={24} color="#FFFFFF" />
                            <View>
                                <Text style={styles.title}>{t('players.modals.player.sections.classHistory') || 'Historial de Clases'}</Text>
                                <Text style={styles.subtitle}>{playerName}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Date Filters */}
                    <View style={styles.filtersContainer}>
                        <TouchableOpacity 
                            style={styles.filterButton} 
                            onPress={() => setShowStartPicker(true)}
                        >
                            <View style={styles.filterRow}>
                                <Text style={styles.filterLabel}>{t('common.from') || 'Desde'}</Text>
                                <View style={styles.filterValueContainer}>
                                    <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
                                    <Text style={styles.filterValue}>{formatDate(startDate)}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.filterButton} 
                            onPress={() => setShowEndPicker(true)}
                        >
                            <View style={styles.filterRow}>
                                <Text style={styles.filterLabel}>{t('common.to') || 'Hasta'}</Text>
                                <View style={styles.filterValueContainer}>
                                    <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
                                    <Text style={styles.filterValue}>{formatDate(endDate)}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Classes List */}
                    <View style={styles.listContainer}>
                        {isLoading ? (
                            <View style={styles.centerContainer}>
                                <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
                            </View>
                        ) : history && history.length > 0 ? (
                            <FlatList
                                data={history}
                                renderItem={renderItem}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={false}
                            />
                        ) : (
                            <View style={styles.centerContainer}>
                                <Ionicons name="calendar-outline" size={48} color="#FFFFFF" />
                                <Text style={styles.emptyText}>{t('players.modals.player.validation.noClassesFound') || 'No se encontraron clases en este rango'}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.footer}>
                        <Button
                            label={t('common.close') || 'Cerrar'}
                            variant="primary"
                            onPress={onClose}
                            style={styles.footerButton}
                        />
                    </View>
                </View>
            </View>

            <DatePickerModal
                visible={showStartPicker}
                onClose={() => setShowStartPicker(false)}
                onSelect={(date) => setStartDate(date)}
                selectedDate={startDate}
            />

            <DatePickerModal
                visible={showEndPicker}
                onClose={() => setShowEndPicker(false)}
                onSelect={(date) => setEndDate(date)}
                selectedDate={endDate}
            />
        </Modal>
    );
};

const createStyles = (theme: Theme, isDesktop: boolean, insets: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: theme.background.backdrop,
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: theme.background.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: isDesktop ? '90%' : '100%',
        width: isDesktop ? 600 : '100%',
        alignSelf: 'center',
        paddingTop: isDesktop ? 0 : insets.top,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    title: {
        ...typography.variants.h3,
        color: theme.text.primary,
    },
    subtitle: {
        ...typography.variants.bodySmall,
        color: theme.text.secondary,
    },
    closeButton: {
        padding: spacing.xs,
    },
    filtersContainer: {
        flexDirection: 'row',
        padding: spacing.md,
        gap: spacing.md,
        backgroundColor: theme.background.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
    },
    filterButton: {
        flex: 1,
        backgroundColor: theme.background.input,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border.default,
        justifyContent: 'center',
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.xs,
    },
    filterLabel: {
        ...typography.variants.labelSmall,
        fontSize: isDesktop ? 12 : 10,
        color: '#FFFFFF',
    },
    filterValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    filterValue: {
        ...typography.variants.bodyMedium,
        fontSize: isDesktop ? 14 : 12,
        color: theme.text.primary,
        fontWeight: '600',
    },
    listContainer: {
        flex: 1,
    },
    listContent: {
        padding: spacing.md,
        gap: spacing.md,
        paddingBottom: 40,
    },
    classItem: {
        backgroundColor: theme.background.surface,
        borderRadius: 16,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: theme.border.subtle,
        gap: spacing.sm,
    },
    classHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    classDate: {
        ...typography.variants.bodyMedium,
        fontWeight: '700',
        color: theme.text.primary,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: theme.background.input,
    },
    statusText: {
        ...typography.variants.labelSmall,
        fontWeight: '600',
        fontSize: 10,
        textTransform: 'uppercase',
    },
    classDetails: {
        gap: 6,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    detailText: {
        ...typography.variants.bodySmall,
        color: theme.text.secondary,
    },
    notesContainer: {
        marginTop: 4,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: theme.border.subtle,
        gap: 4,
    },
    noteText: {
        ...typography.variants.bodySmall,
        color: theme.text.tertiary,
        fontStyle: 'italic',
    },
    noteLabel: {
        fontWeight: '600',
        fontStyle: 'normal',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.xl,
    },
    emptyText: {
        ...typography.variants.bodyLarge,
        color: theme.text.tertiary,
        textAlign: 'center',
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: theme.border.subtle,
        backgroundColor: theme.background.surface,
        paddingBottom: isDesktop ? spacing.lg : Math.max(spacing.lg, insets.bottom),
    },
    footerButton: {
        width: '100%',
    },
});
