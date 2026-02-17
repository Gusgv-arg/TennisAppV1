import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';

import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';

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
    const { theme, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

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
                    { color: isSelected ? 'white' : theme.text.secondary },
                    isSelected && styles.slotTextSelected
                ]}>
                    {timeString}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
            <View style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[
                    styles.dialog,
                    { backgroundColor: theme.background.surface, shadowColor: '#000' },
                    isDesktop && styles.dialogDesktop
                ]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.text.primary }]}>Seleccionar Horario</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={slots}
                        renderItem={renderSlot}
                        keyExtractor={(item) => `${item.h}-${item.m}`}
                        numColumns={3}
                        contentContainerStyle={styles.listContent}
                        columnWrapperStyle={styles.columnWrapper}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.surface,
    },
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dialog: {
        backgroundColor: theme.background.surface,
        width: '100%',
        height: '100%',
        borderColor: theme.border.subtle,
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
        borderBottomColor: theme.border.subtle,
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
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
        backgroundColor: theme.background.surface,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.border.default,
    },
    slotSelected: {
        backgroundColor: theme.components.button.primary.bg,
        borderColor: theme.components.button.primary.bg,
    },
    slotText: {
        fontSize: typography.size.md,
        fontWeight: '600',
    },
    slotTextSelected: {
        color: 'white',
    },
});
