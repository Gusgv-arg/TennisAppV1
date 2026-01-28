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
import { Calendar, LocaleConfig } from 'react-native-calendars';

import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';

// Configure calendar locale (already done in some places but good to ensure)
LocaleConfig.locales['es'] = {
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    today: 'Hoy'
};

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
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const markedDate = selectedDate.toISOString().split('T')[0];

    return (
        <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
            <View style={[styles.overlay, isDesktop && styles.overlay]}>
                <View style={[styles.dialog, isDesktop && styles.dialogDesktop]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Seleccionar Fecha</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={colors.neutral[900]} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        <Calendar
                            initialDate={markedDate}
                            markedDates={{
                                [markedDate]: { selected: true, selectedColor: colors.primary[500] }
                            }}
                            onDayPress={(day) => {
                                const date = new Date(day.timestamp);
                                // Adjust for timezone offset to get the correct local date
                                const adjustedDate = new Date(day.year, day.month - 1, day.day);
                                onSelect(adjustedDate);
                                onClose();
                            }}
                            theme={{
                                todayTextColor: colors.primary[500],
                                arrowColor: colors.primary[500],
                                selectedDayBackgroundColor: colors.primary[500],
                                selectedDayTextColor: colors.common.white,
                                textDayFontFamily: typography.family.sans,
                                textMonthFontFamily: typography.family.sans,
                                textDayHeaderFontFamily: typography.family.sans,
                                textDayFontSize: 14,
                                textMonthFontSize: 16,
                                textDayHeaderFontSize: 12,
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
        backgroundColor: colors.common.white,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dialog: {
        backgroundColor: colors.common.white,
        width: '100%',
        height: '100%',
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
        borderBottomColor: colors.neutral[100],
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    closeBtn: {
        padding: spacing.xs,
    },
    content: {
        padding: spacing.md,
    },
});
