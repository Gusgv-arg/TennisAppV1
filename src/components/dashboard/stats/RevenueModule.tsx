import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
import { StatsSection } from '../StatsSection';

export const RevenueModule = () => {
    const { theme, isDark } = useTheme();
    const { t } = useTranslation();

    return (
        <StatsSection
            title={t('dashboard.sections.revenue')}
            icon="trending-up"
        >
            <View style={[styles.container, {
                backgroundColor: isDark ? theme.background.subtle : theme.background.default,
                borderColor: theme.border.default
            }]}>
                <View style={styles.iconContainer}>
                    <Ionicons name="stats-chart" size={40} color={theme.components.button.primary.bg} />
                    <View style={[styles.badge, {
                        backgroundColor: theme.status.successBackground,
                        borderColor: theme.status.success
                    }]}>
                        <Text style={[styles.badgeText, { color: theme.status.successText }]}>{t('dashboard.revenue.soon')}</Text>
                    </View>
                </View>
                <Text style={[styles.title, { color: theme.text.primary }]}>{t('dashboard.revenue.title')}</Text>
                <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                    {t('dashboard.revenue.description')}
                </Text>
            </View>
        </StatsSection>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: -10,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    title: {
        fontSize: typography.size.md,
        fontWeight: '700',
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: typography.size.sm,
        textAlign: 'center',
        lineHeight: 20,
    },
});
