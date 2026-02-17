import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { Calendar } from 'react-native-calendars';

import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';

// Configure calendar locale - Moved to src/i18n/index.ts

interface DatePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (date: Date) => void;
    selectedDate: Date;
}

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
    visible,
    onClose,
    onSelect,
    selectedDate
}) => {
    const { theme, isDark } = useTheme();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const markedDate = selectedDate.toISOString().split('T')[0];

    return (
        <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
            <View style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[
                    styles.dialog,
                    { backgroundColor: theme.background.surface, borderColor: theme.border.subtle, borderWidth: 1 },
                    isDesktop && styles.dialogDesktop
                ]}>
                    <View style={[styles.header, { borderBottomColor: theme.border.default }]}>
                        <Text style={[styles.title, { color: theme.text.primary }]}>Seleccionar Fecha</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={theme.text.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.modalContent, { backgroundColor: theme.background.surface, shadowColor: '#000' }]}>
                        <Calendar
                            key={theme.mode}
                            initialDate={markedDate}
                            markedDates={{
                                [markedDate]: { selected: true, selectedColor: theme.components.button.primary.bg }
                            }}
                            onDayPress={(day) => {
                                const date = new Date(day.timestamp);
                                // Adjust for timezone offset to get the correct local date
                                const adjustedDate = new Date(day.year, day.month - 1, day.day);
                                onSelect(adjustedDate);
                                onClose();
                            }}
                            theme={{
                                todayTextColor: theme.components.button.primary.bg,
                                arrowColor: theme.components.button.primary.bg,
                                selectedDayBackgroundColor: theme.components.button.primary.bg,
                                selectedDayTextColor: theme.text.inverse,
                                textDayFontFamily: typography.family.sans,
                                textMonthFontFamily: typography.family.sans,
                                textDayHeaderFontFamily: typography.family.sans,
                                textDayFontSize: 14,
                                textMonthFontSize: 16,
                                textDayHeaderFontSize: 12,
                                calendarBackground: theme.background.surface,
                                textSectionTitleColor: theme.text.secondary,
                                dayTextColor: theme.text.primary,
                                monthTextColor: theme.text.primary,
                                textDisabledColor: theme.text.disabled,
                            }}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,

    },
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    dialog: {
        width: '100%',
        height: '100%',
        // Border color applied inline due to theme dependency
    },
    dialogDesktop: {
        width: '100%',
        maxWidth: 500,
        height: 'auto',
        maxHeight: '80%',
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,

    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',

    },
    closeBtn: {
        padding: spacing.xs,
    },
    modalContent: {
        padding: spacing.md,
    },
});
