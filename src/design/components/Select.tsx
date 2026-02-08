import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
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
    const { theme } = useTheme();

    return (
        <View style={styles.container}>
            {label && <Text style={[styles.label, { color: theme.text.secondary }]}>{label}</Text>}
            <View style={[
                styles.inputContainer,
                {
                    backgroundColor: theme.background.input,
                    borderColor: theme.border.default,
                },
                error && { borderColor: theme.status.error }
            ]}>
                {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
                <Picker
                    selectedValue={value}
                    onValueChange={onChange}
                    style={[styles.picker, { color: theme.text.primary }]}
                    dropdownIconColor={theme.text.tertiary}
                    mode="dropdown"
                    {...(Platform.OS === 'web' ? {
                        itemStyle: {
                            fontSize: typography.size.md,
                            color: theme.text.primary,
                            backgroundColor: theme.background.surface, // Important for dropdown visibility
                        },
                    } : {})}
                >
                    {options.map((option) => (
                        <Picker.Item
                            key={option.value}
                            label={option.label}
                            value={option.value}
                            style={{
                                fontSize: typography.size.md,
                                color: theme.text.primary,
                                backgroundColor: theme.background.surface
                            }}
                            color={theme.text.primary} // For Android/iOS native picker items if supported
                        />
                    ))}
                </Picker>
                <View style={styles.chevronContainer} pointerEvents="none">
                    <Ionicons name="chevron-down" size={16} color={theme.text.tertiary} />
                </View>
            </View>
            {error && <Text style={[styles.errorText, { color: theme.status.error }]}>{error}</Text>}
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
        marginBottom: spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingLeft: spacing.sm,
        overflow: 'hidden',
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
    errorText: {
        fontSize: typography.size.xs,
        marginTop: spacing.xs,
    },
    chevronContainer: {
        position: 'absolute',
        right: spacing.sm,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
});

