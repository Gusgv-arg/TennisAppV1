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
        fontSize: typography.size.sm,
        fontWeight: '700' as const,
        marginBottom: spacing.xs,
    },
    /**
     * Standard style for section descriptions or hints.
     */
    sectionDescription: {
        fontSize: typography.size.xs,
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
};
