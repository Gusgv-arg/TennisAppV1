import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    TouchableOpacityProps,
    View,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';

interface SelectorProps extends TouchableOpacityProps {
    label?: string;
    value?: string | null;
    placeholder?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    size?: 'md' | 'sm';
    valueStyle?: StyleProp<TextStyle>;
}

export const Selector: React.FC<SelectorProps> = ({
    label,
    value,
    placeholder,
    error,
    leftIcon,
    rightIcon,
    size = 'md',
    valueStyle,
    style,
    ...props
}) => {
    const { theme, isDark } = useTheme();

    return (
        <View style={styles.container}>
            {label && <Text style={[styles.label, { color: theme.text.secondary }]}>{label}</Text>}
            <TouchableOpacity
                activeOpacity={0.7}
                style={[
                    styles.selectorContainer,
                    {
                        backgroundColor: theme.background.input,
                        borderColor: value ? theme.border.active : theme.border.default,
                    },
                    size === 'sm' && styles.selectorContainerSm,
                    error && { borderColor: theme.status.error },
                    style,
                ]}
                {...props}
            >
                {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

                <Text
                    style={[
                        styles.value,
                        { color: value ? theme.text.primary : theme.text.tertiary },
                        valueStyle
                    ]}
                    numberOfLines={1}
                >
                    {value || placeholder}
                </Text>

                <View style={styles.iconRight}>
                    {rightIcon || <Ionicons name="chevron-down" size={20} color={theme.text.secondary} />}
                </View>
            </TouchableOpacity>
            {error && <Text style={[styles.errorText, { color: theme.status.error }]}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    label: {
        ...typography.variants.label,
        marginBottom: spacing.xs,
    },
    selectorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: 10,
        paddingHorizontal: spacing.sm,
        minHeight: 48,
    },
    selectorContainerSm: {
        minHeight: 40,
        borderRadius: 8,
    },
    value: {
        flex: 1,
        ...typography.variants.bodyLarge,
    },
    errorText: {
        ...typography.variants.bodySmall,
        marginTop: spacing.xs,
    },
    iconLeft: {
        marginRight: spacing.xs,
    },
    iconRight: {
        marginLeft: spacing.xs,
    },
});
