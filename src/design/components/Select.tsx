import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
                >
                    {options.map((option) => (
                        <Picker.Item
                            key={option.value}
                            label={option.label}
                            value={option.value}
                        />
                    ))}
                </Picker>
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
        backgroundColor: colors.common.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.neutral[200],
        paddingHorizontal: spacing.sm,
    },
    inputContainerError: {
        borderColor: colors.error[500],
    },
    iconContainer: {
        marginRight: spacing.sm,
    },
    picker: {
        flex: 1,
        height: 48,
    },
    errorText: {
        fontSize: typography.size.xs,
        color: colors.error[500],
        marginTop: spacing.xs,
    },
});
