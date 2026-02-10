import { ViewStyle } from 'react-native';
import { spacing } from './tokens/spacing';
import { typography } from './tokens/typography';

/**
 * Common style patterns used across the application to ensure consistency.
 * Use these instead of defining ad-hoc styles in individual components.
 */
export const commonStyles = {
    /**
     * Standard vertical spacing between major sections of a form or screen.
     */
    sectionContainer: {
        marginBottom: spacing.md,
    },
    /**
     * Standard style for section titles (e.g., "Full Name", "Payment Plan").
     */
    sectionTitle: {
        ...typography.variants.label,
        marginBottom: spacing.xs,
    },
    /**
     * Standard style for section descriptions or hints.
     */
    sectionDescription: {
        ...typography.variants.bodySmall,
        marginBottom: spacing.sm,
    },
    /**
     * Standard horizontal row layout with default spacing.
     */
    row: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: spacing.md,
    },
    /**
     * Standard screen padding.
     */
    screenContainer: {
        flex: 1,
        padding: spacing.md,
    },
    /**
     * Standard card shadow (light mode).
     */
    shadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    /**
     * Standard modal styles for consistent popup look across the app.
     */
    modal: {
        overlay: {
            flex: 1,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            padding: spacing.md,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', // Standard backdrop
        } as ViewStyle,
        content: {
            width: '100%',
            maxWidth: 500,
            maxHeight: '90%',
            overflow: 'hidden' as const,
            borderRadius: 20,
            // Background color should be applied based on theme in component: { backgroundColor: theme.background.surface }
        } as ViewStyle,
    }
};
