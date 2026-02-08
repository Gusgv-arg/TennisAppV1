import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

import { Theme } from '@/src/design/theme';
import { useTheme } from '@/src/hooks/useTheme';

import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';

export interface SelectorOption {
    label: string;
    value: string;
    subLabel?: string;
    color?: string; // Hex color for icon/text
    icon?: keyof typeof Ionicons.glyphMap;
    isDestructive?: boolean;
}

interface SelectorSheetProps {
    visible: boolean;
    title: string;
    options: SelectorOption[];
    onSelect: (value: string) => void;
    onClose: () => void;
    selectedValue?: string | null;
}

export const SelectorSheet: React.FC<SelectorSheetProps> = ({
    visible,
    title,
    options,
    onSelect,
    onClose,
    selectedValue
}) => {
    const { theme, isDark } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.sheetContainer}>
                            {/* Handle Bar */}
                            <View style={styles.handleContainer}>
                                <View style={styles.handle} />
                            </View>

                            <View style={styles.header}>
                                <Text style={styles.title}>{title}</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                    <Ionicons name="close" size={24} color={theme.text.secondary} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.optionsList} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
                                {options.map((option, index) => {
                                    const isSelected = selectedValue === option.value;
                                    const itemColor = option.isDestructive ? theme.text.error : (option.color || theme.text.primary);

                                    return (
                                        <TouchableOpacity
                                            key={`${option.value}-${index}`}
                                            style={[
                                                styles.optionItem,
                                                isSelected && styles.optionItemSelected
                                            ]}
                                            onPress={() => {
                                                onSelect(option.value);
                                                onClose();
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.optionIconContainer}>
                                                {option.icon ? (
                                                    <Ionicons
                                                        name={option.icon}
                                                        size={22}
                                                        color={isSelected ? theme.components.button.primary.bg : (option.color || theme.text.secondary)}
                                                    />
                                                ) : isSelected ? (
                                                    <Ionicons name="checkmark-circle" size={22} color={theme.components.button.primary.bg} />
                                                ) : (
                                                    <Ionicons name="ellipse-outline" size={22} color={theme.text.tertiary} />
                                                )}
                                            </View>

                                            <View style={styles.optionTextContainer}>
                                                <Text style={[
                                                    styles.optionLabel,
                                                    { color: isSelected ? theme.components.button.primary.bg : itemColor },
                                                    isSelected && { fontWeight: '600' }
                                                ]}>
                                                    {option.label}
                                                </Text>
                                                {option.subLabel && (
                                                    <Text style={styles.optionSubLabel}>
                                                        {option.subLabel}
                                                    </Text>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const createStyles = (theme: Theme) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', // Centered instead of bottom
        padding: spacing.md,
    },
    sheetContainer: {
        backgroundColor: theme.background.surface,
        borderRadius: 24, // All corners
        maxHeight: '75%',
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
        overflow: 'hidden', // Ensure content respects border radius
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.border.subtle,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: theme.text.primary,
    },
    closeButton: {
        padding: spacing.xs,
    },
    optionsList: {
        marginTop: spacing.sm,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
    },
    optionItemSelected: {
        backgroundColor: theme.background.subtle,
    },
    optionIconContainer: {
        width: 32,
        alignItems: 'flex-start',
    },
    optionTextContainer: {
        flex: 1,
    },
    optionLabel: {
        fontSize: typography.size.md,
        color: theme.text.primary,
    },
    optionSubLabel: {
        fontSize: typography.size.xs,
        color: theme.text.secondary,
        marginTop: 2,
    },
});
