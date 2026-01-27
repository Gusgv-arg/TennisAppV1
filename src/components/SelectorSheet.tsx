import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

import { colors } from '@/src/design/tokens/colors';
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
                                    <Ionicons name="close" size={24} color={colors.neutral[400]} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.optionsList} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
                                {options.map((option, index) => {
                                    const isSelected = selectedValue === option.value;
                                    const itemColor = option.isDestructive ? colors.error[500] : (option.color || colors.neutral[900]);

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
                                                        color={isSelected ? colors.primary[600] : (option.color || colors.neutral[500])}
                                                    />
                                                ) : isSelected ? (
                                                    <Ionicons name="checkmark-circle" size={22} color={colors.primary[600]} />
                                                ) : (
                                                    <Ionicons name="ellipse-outline" size={22} color={colors.neutral[300]} />
                                                )}
                                            </View>

                                            <View style={styles.optionTextContainer}>
                                                <Text style={[
                                                    styles.optionLabel,
                                                    { color: isSelected ? colors.primary[700] : itemColor },
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

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', // Centered instead of bottom
        padding: spacing.md,
    },
    sheetContainer: {
        backgroundColor: colors.common.white,
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
        backgroundColor: colors.neutral[300],
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
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
        borderBottomColor: colors.neutral[50],
    },
    optionItemSelected: {
        backgroundColor: colors.primary[50],
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
        color: colors.neutral[900],
    },
    optionSubLabel: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginTop: 2,
    },
});
