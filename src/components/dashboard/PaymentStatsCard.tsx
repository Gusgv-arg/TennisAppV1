import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/src/design/components/Card';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { usePaymentStats } from '@/src/features/payments/hooks/usePayments';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';
import { useTheme } from '@/src/hooks/useTheme';

export const PaymentStatsCard = () => {
    const { theme, isDark } = useTheme();
    const { t, i18n } = useTranslation();
    const { data: stats, isLoading } = usePaymentStats();
    const { isSimplifiedMode } = usePaymentSettings();

    const formatNumber = (value: number) => {
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const formatCurrency = (value: number) => {
        return `$ ${formatNumber(value)}`;
    };

    if (isLoading) {
        return (
            <Card style={[styles.card, { backgroundColor: theme.background.default }]} padding="md">
                <Text style={{ color: theme.text.secondary }}>{t('payments.loading')}</Text>
            </Card>
        );
    }

    return (
        <Card style={[styles.card, { backgroundColor: theme.background.default }]} padding="md">
            <View style={styles.header}>
                <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{t('dashboard.sections.payments')}</Text>
            </View>

            <View style={styles.statsContainer}>
                {/* ITEM 1: COBRADO / AL DIA */}
                <View style={styles.statItem}>
                    <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(22, 101, 52, 0.1)' }]}>
                        <Ionicons name="trending-up" size={24} color={isDark ? theme.text.primary : '#166534'} />
                    </View>
                    <Text style={[styles.statValue, { color: theme.text.primary }]}>
                        {isSimplifiedMode
                            ? formatNumber((stats?.totalPlayers || 0) - (stats?.debtorsCount || 0))
                            : formatCurrency(stats?.totalCollected || 0)
                        }
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.text.primary }]}>
                        {isSimplifiedMode ? t('payments.onTime') : t('payments.collected')}
                    </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />

                {/* ITEM 2: PENDIENTE / DEUDA */}
                <View style={styles.statItem}>
                    <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(255, 0, 0, 0.1)' : 'rgba(185, 28, 28, 0.1)' }]}>
                        <Ionicons name="alert-circle" size={24} color={isDark ? '#ff4d4d' : '#b91c1c'} />
                    </View>
                    <Text style={[styles.statValue, { color: theme.status.error }]}>
                        {isSimplifiedMode
                            ? formatNumber(stats?.debtorsCount || 0)
                            : formatCurrency(stats?.totalPending || 0)
                        }
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.text.primary }]}>
                        {isSimplifiedMode ? t('payments.owes') : t('payments.pending')}
                    </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />

                {/* ITEM 3: DEUDORES (COUNT) */}
                <View style={styles.statItem}>
                    <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(255, 165, 0, 0.15)' : 'rgba(180, 83, 9, 0.1)' }]}>
                        <Ionicons name="people" size={24} color={isDark ? '#fbbf24' : '#b45309'} />
                    </View>
                    <Text style={[styles.statValue, { color: theme.text.primary }]}>
                        {formatNumber(stats?.debtorsCount || 0)}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.text.primary }]}>
                        {t('payments.debtors')}
                    </Text>
                </View>
            </View>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        marginBottom: spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    cardTitle: {
        fontSize: typography.size.md,
        fontWeight: '700',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    },
    statValue: {
        fontSize: typography.size.sm,
        fontWeight: '700',
        marginBottom: 0,
        textAlign: 'center',
    },
    statLabel: {
        fontSize: typography.size.xs,
        textAlign: 'center',
        opacity: 0.8,
    },
    divider: {
        width: 1,
        height: '50%',
        alignSelf: 'center',
        opacity: 0.3,
    }
});
