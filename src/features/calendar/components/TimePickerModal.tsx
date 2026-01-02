import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
    FlatList,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';

interface TimePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (hours: number, minutes: number) => void;
    selectedTime?: Date;
}

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
    visible,
    onClose,
    onSelect,
    selectedTime
}) => {
    // Generate time slots from 07:00 to 22:00 every 30 mins
    const slots = useMemo(() => {
        const items = [];
        for (let h = 7; h <= 22; h++) {
            items.push({ h, m: 0 });
            items.push({ h, m: 30 });
        }
        return items;
    }, []);

    const renderSlot = ({ item }: { item: { h: number, m: number } }) => {
        const isSelected = selectedTime?.getHours() === item.h && selectedTime?.getMinutes() === item.m;

        const timeString = `${item.h.toString().padStart(2, '0')}:${item.m.toString().padStart(2, '0')}`;

        return (
            <TouchableOpacity
                style={[
                    styles.slot,
                    isSelected && styles.slotSelected
                ]}
                onPress={() => {
                    onSelect(item.h, item.m);
                    onClose();
                }}
            >
                <Text style={[
                    styles.slotText,
                    isSelected && styles.slotTextSelected
                ]}>
                    {timeString}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Seleccionar Horario</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color={colors.neutral[900]} />
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={slots}
                    renderItem={renderSlot}
                    keyExtractor={(item) => `${item.h}-${item.m}`}
                    numColumns={3}
                    contentContainerStyle={styles.listContent}
                    columnWrapperStyle={styles.columnWrapper}
                />
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.common.white,
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
    listContent: {
        padding: spacing.md,
    },
    columnWrapper: {
        justifyContent: 'space-around',
        marginBottom: spacing.md,
    },
    slot: {
        flex: 1,
        margin: spacing.xs,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: colors.neutral[50],
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.neutral[100],
    },
    slotSelected: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[600],
    },
    slotText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[700],
    },
    slotTextSelected: {
        color: colors.common.white,
    },
});
