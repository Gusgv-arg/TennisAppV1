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
    const { t } = useTranslation();
    const { data: stats, isLoading } = usePaymentStats();
    const { isSimplifiedMode } = usePaymentSettings();

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
        }).format(value);
    };

    if (isLoading) {
        return (
            <Card style={[styles.card, { backgroundColor: theme.background.default }]} padding="md">
                <Text style={{ color: theme.text.secondary }}>Cargando finanzas...</Text>
            </Card>
        );
    }

    return (
        <Card style={[styles.card, { backgroundColor: theme.background.default }]} padding="md">
            <View style={styles.header}>
                <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Cobros del Mes</Text>
            </View>

            <View style={styles.statsContainer}>
                {/* ITEM 1: COBRADO / AL DIA */}
                <View style={styles.statItem}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.status.successBackground }]}>
                        <Ionicons name="trending-up" size={24} color={theme.status.success} />
                    </View>
                    <Text style={[styles.statValue, { color: theme.text.primary }]}>
                        {isSimplifiedMode
                            ? ((stats?.totalPlayers || 0) - (stats?.debtorsCount || 0))
                            : formatCurrency(stats?.totalCollected || 0)
                        }
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                        {isSimplifiedMode ? 'Al día' : 'Cobrado'}
                    </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />

                {/* ITEM 2: PENDIENTE / DEUDA */}
                <View style={styles.statItem}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.status.errorBackground }]}>
                        <Ionicons name="alert-circle" size={24} color={theme.status.error} />
                    </View>
                    <Text style={[styles.statValue, { color: theme.status.error }]}>
                        {isSimplifiedMode
                            ? (stats?.debtorsCount || 0)
                            : formatCurrency(stats?.totalPending || 0)
                        }
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                        {isSimplifiedMode ? 'Deben' : 'Pendiente'}
                    </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />

                {/* ITEM 3: DEUDORES (COUNT) */}
                <View style={styles.statItem}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.status.warningBackground }]}>
                        <Ionicons name="people" size={24} color={theme.status.warning} />
                    </View>
                    <Text style={[styles.statValue, { color: theme.text.primary }]}>
                        {stats?.debtorsCount || 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                        Deudores
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
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    statValue: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        marginBottom: 2,
        textAlign: 'center',
    },
    statLabel: {
        fontSize: typography.size.xs,
        textAlign: 'center',
    },
    divider: {
        width: 1,
        height: '80%',
        alignSelf: 'center',
    }
});
