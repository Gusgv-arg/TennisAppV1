import { Ionicons } from '@expo/vector-icons';
import React, { ComponentProps } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { commonStyles } from '../common';
import { iconSize as iconSizes } from '../tokens/icons';
import { spacing } from '../tokens/spacing';

interface SectionProps {
    /**
     * Title of the section (e.g., "Personal Information").
     */
    title?: string;
    /**
     * Optional description text displayed below the title.
     */
    description?: string;
    /**
     * Content of the section.
     */
    children: React.ReactNode;
    /**
     * Optional component to render in the top-right of the section header (e.g., Edit button).
     */
    rightAction?: React.ReactNode;
    /**
     * Custom style for the container.
     */
    style?: StyleProp<ViewStyle>;
    /**
     * Custom style for the title.
     */
    titleStyle?: StyleProp<TextStyle>;
    /**
     * Optional footer text displayed below the children (e.g., disclaimer).
     */
    footer?: string;
    /**
     * Optional icon to display to the left of the title.
     */
    icon?: ComponentProps<typeof Ionicons>['name'];
    /**
     * Optional size for the icon (defaults to 'md').
     */
    iconSize?: 'sm' | 'md' | 'lg';
    /**
     * Whether to remove the bottom margin (defaults to false).
     */
    noMargin?: boolean;
}

export const Section: React.FC<SectionProps> = ({
    title,
    description,
    children,
    rightAction,
    style,
    titleStyle,
    footer,
    icon,
    iconSize = 'md',
    noMargin = false,
}) => {
    const { theme } = useTheme();

    return (
        <View style={[!noMargin && commonStyles.sectionContainer, style]}>
            {(title || rightAction) && (
                <View style={styles.header}>
                    <View style={styles.titleContainer}>
                        <View style={styles.titleRow}>
                            {icon && (
                                <Ionicons
                                    name={icon}
                                    size={iconSizes[iconSize]}
                                    color={theme.text.secondary}
                                    style={styles.sectionIcon}
                                />
                            )}
                            {title && (
                                <Text
                                    style={[
                                        commonStyles.sectionTitle,
                                        { color: theme.text.secondary },
                                        titleStyle,
                                        { marginBottom: 0 }, // Reset margin when in row
                                    ]}
                                >
                                    {title}
                                </Text>
                            )}
                        </View>
                        {description && (
                            <Text
                                style={[
                                    commonStyles.sectionDescription,
                                    { color: theme.text.tertiary },
                                ]}
                            >
                                {description}
                            </Text>
                        )}
                    </View>
                    {rightAction && <View style={styles.actionContainer}>{rightAction}</View>}
                </View>
            )}
            {children}
            {footer && (
                <Text
                    style={[
                        commonStyles.sectionDescription,
                        styles.footerText,
                        { color: theme.text.tertiary },
                    ]}
                >
                    {footer}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.xs,
    },
    titleContainer: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    sectionIcon: {
        marginRight: spacing.sm,
    },
    actionContainer: {
        marginLeft: spacing.md,
    },
    footerText: {
        marginTop: 6, // Reduced standard spacing from content to footer hint
        marginBottom: 0,
        marginLeft: 4,
    },
});


