
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { usePaymentStats } from '@/src/features/payments/hooks/usePayments';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';

export const PaymentStatsCard = () => {
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
            <Card style={styles.card} padding="md">
                <Text>Cargando finanzas...</Text>
            </Card>
        );
    }

    return (
        <Card style={styles.card} padding="md">
            <View style={styles.header}>
                <Text style={styles.cardTitle}>Cobros del Mes</Text>
            </View>

            <View style={styles.statsContainer}>
                {/* ITEM 1: COBRADO / AL DIA */}
                <View style={styles.statItem}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.success[50] }]}>
                        <Ionicons name="trending-up" size={24} color={colors.success[600]} />
                    </View>
                    <Text style={styles.statValue}>
                        {isSimplifiedMode
                            ? ((stats?.totalPlayers || 0) - (stats?.debtorsCount || 0))
                            : formatCurrency(stats?.totalCollected || 0)
                        }
                    </Text>
                    <Text style={styles.statLabel}>
                        {isSimplifiedMode ? 'Al día' : 'Cobrado'}
                    </Text>
                </View>

                <View style={styles.divider} />

                {/* ITEM 2: PENDIENTE / DEUDA */}
                <View style={styles.statItem}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.error[50] }]}>
                        <Ionicons name="alert-circle" size={24} color={colors.error[600]} />
                    </View>
                    <Text style={[styles.statValue, { color: colors.error[600] }]}>
                        {isSimplifiedMode
                            ? (stats?.debtorsCount || 0)
                            : formatCurrency(stats?.totalPending || 0)
                        }
                    </Text>
                    <Text style={styles.statLabel}>
                        {isSimplifiedMode ? 'Deben' : 'Pendiente'}
                    </Text>
                </View>

                <View style={styles.divider} />

                {/* ITEM 3: DEUDORES (COUNT) */}
                <View style={styles.statItem}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.warning[50] }]}>
                        <Ionicons name="people" size={24} color={colors.warning[600]} />
                    </View>
                    <Text style={styles.statValue}>
                        {stats?.debtorsCount || 0}
                    </Text>
                    <Text style={styles.statLabel}>
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
        color: colors.neutral[700],
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
        color: colors.neutral[900],
        marginBottom: 2,
        textAlign: 'center',
    },
    statLabel: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        textAlign: 'center',
    },
    divider: {
        width: 1,
        height: '80%',
        backgroundColor: colors.neutral[200],
        alignSelf: 'center',
    }
});
