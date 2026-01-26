import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { StatsSection } from '../StatsSection';

export const RevenueModule = () => {
    return (
        <StatsSection
            title="Ingresos"
            icon="cash-outline"
        >
            <View style={styles.container}>
                <View style={styles.iconContainer}>
                    <Ionicons name="stats-chart" size={40} color={colors.primary[300]} />
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>PRÓXIMAMENTE</Text>
                    </View>
                </View>
                <Text style={styles.title}>Estadísticas de Ingresos</Text>
                <Text style={styles.subtitle}>
                    Estamos trabajando en una nueva forma de visualizar tus finanzas con gráficos detallados y reportes automáticos.
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
        backgroundColor: colors.neutral[50],
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.neutral[100],
        borderStyle: 'dashed',
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    badge: {
        backgroundColor: colors.primary[50],
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: -10,
        borderWidth: 1,
        borderColor: colors.primary[100],
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.primary[600],
        letterSpacing: 1,
    },
    title: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[800],
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        textAlign: 'center',
        lineHeight: 20,
    },
});
