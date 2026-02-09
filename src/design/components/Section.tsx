import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { commonStyles } from '../common';
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
     * Whether to remove the bottom margin (defaults to false).
     */
    noMargin?: boolean;
}

/**
 * A standardized section wrapper for forms and content blocks.
 * Enforces consistent vertical spacing and typography for section headers.
 */
export const Section: React.FC<SectionProps> = ({
    title,
    description,
    children,
    rightAction,
    style,
    titleStyle,
    noMargin = false,
}) => {
    const { theme } = useTheme();

    return (
        <View style={[!noMargin && commonStyles.sectionContainer, style]}>
            {(title || rightAction) && (
                <View style={styles.header}>
                    <View style={styles.titleContainer}>
                        {title && (
                            <Text
                                style={[
                                    commonStyles.sectionTitle,
                                    { color: theme.text.secondary },
                                    titleStyle,
                                ]}
                            >
                                {title}
                            </Text>
                        )}
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
    actionContainer: {
        marginLeft: spacing.md,
    },
});
