import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface TitleComponentProps {
    title: string;
    icon?: keyof typeof Ionicons.glyphMap;
    subtitle?: string;
    color?: string;
}

export const TitleComponent = ({
    title,
    icon,
    subtitle,
    color = colors.neutral[900]
}: TitleComponentProps) => {
    return (
        <View style={styles.container}>
            <View style={styles.titleRow}>
                {icon && (
                    <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                        <Ionicons name={icon} size={24} color={color} />
                    </View>
                )}
                <View style={styles.textContainer}>
                    <Text style={[styles.titleText, { color }]}>{title}</Text>
                    {subtitle && (
                        <Text style={styles.subtitleText}>{subtitle}</Text>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    iconContainer: {
        padding: 6,
        borderRadius: 8,
        // Background color is handled inline for opacity
    },
    textContainer: {
        flexDirection: 'column',
        justifyContent: 'center',
    },
    titleText: {
        fontSize: typography.size.lg,
        fontWeight: '700',
    },
    subtitleText: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginTop: 0,
        fontWeight: '500',
    }
});
