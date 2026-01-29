import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';

interface SelectOption {
    label: string;
    value: string;
}

interface SelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    error?: string;
    leftIcon?: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
    label,
    value,
    onChange,
    options,
    error,
    leftIcon,
}) => {
    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={[styles.inputContainer, error && styles.inputContainerError]}>
                {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
                <Picker
                    selectedValue={value}
                    onValueChange={onChange}
                    style={styles.picker}
                    dropdownIconColor={colors.neutral[400]}
                    mode="dropdown"
                    {...(Platform.OS === 'web' ? {
                        itemStyle: styles.pickerItem,
                    } : {})}
                >
                    {options.map((option) => (
                        <Picker.Item
                            key={option.value}
                            label={option.label}
                            value={option.value}
                            style={styles.pickerItem}
                        />
                    ))}
                </Picker>
                <View style={styles.chevronContainer} pointerEvents="none">
                    <Ionicons name="chevron-down" size={16} color={colors.neutral[500]} />
                </View>
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.sm,
    },
    label: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[700],
        marginBottom: spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.neutral[50],
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.neutral[200],
        paddingLeft: spacing.sm,
        overflow: 'hidden',
    },
    inputContainerError: {
        borderColor: colors.error[500],
    },
    iconContainer: {
        marginRight: spacing.xs,
    },
    picker: {
        flex: 1,
        height: 48,
        backgroundColor: 'transparent',
        borderWidth: 0,
        // Web-specific: remove default styling
        ...(Platform.OS === 'web' ? {
            outline: 'none',
            border: 'none',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
        } : {}),
    } as any,
    pickerItem: {
        fontSize: typography.size.md,
        color: colors.neutral[900],
    },
    errorText: {
        fontSize: typography.size.xs,
        color: colors.error[500],
        marginTop: spacing.xs,
    },
    chevronContainer: {
        position: 'absolute',
        right: spacing.sm,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1, // On top of picker visually but needs pointerEvents="none"
    },
});

