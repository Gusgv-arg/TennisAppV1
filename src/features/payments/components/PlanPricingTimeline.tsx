import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { PricingPlanPrice } from '@/src/types/payments';

interface PlanPricingTimelineProps {
    prices: PricingPlanPrice[];
    onDeletePrice: (id: string) => void;
    isDeleting: boolean;
}

export const PlanPricingTimeline = ({ prices, onDeletePrice, isDeleting }: PlanPricingTimelineProps) => {
    const sortedPrices = [...prices].sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime());
    const now = new Date();

    // Find current active price (first one in past/present)
    const currentPriceIndex = sortedPrices.findIndex(p => new Date(p.valid_from) <= now);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Historial de Precios</Text>

            <View style={styles.timeline}>
                {sortedPrices.map((price, index) => {
                    const priceDate = new Date(price.valid_from);
                    const isFuture = priceDate > now;
                    const isCurrent = index === currentPriceIndex;
                    const isPast = !isFuture && !isCurrent;

                    return (
                        <View key={price.id} style={styles.timelineItem}>
                            {/* Dot Indicator */}
                            <View style={styles.timelineLeft}>
                                <View style={[
                                    styles.dot,
                                    isCurrent && styles.dotCurrent,
                                    isFuture && styles.dotFuture,
                                    isPast && styles.dotPast
                                ]} />
                                {index !== sortedPrices.length - 1 && (
                                    <View style={styles.line} />
                                )}
                            </View>

                            {/* Content */}
                            <View style={[
                                styles.card,
                                isCurrent && styles.cardCurrent
                            ]}>
                                <View style={styles.cardHeader}>
                                    <View>
                                        <Text style={[styles.statusLabel, isCurrent && { color: colors.success[700] }]}>
                                            {isCurrent ? 'PRECIO ACTUAL' : isFuture ? 'PROGRAMADO' : 'ANTERIOR'}
                                        </Text>
                                        <Text style={styles.validDate}>
                                            Desde {priceDate.toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <Text style={styles.amount}>
                                        ${new Intl.NumberFormat('es-AR').format(price.amount)}
                                    </Text>
                                </View>

                                {isFuture && (
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => {
                                            Alert.alert(
                                                'Eliminar Cambio',
                                                '¿Estás seguro de que quieres eliminar este cambio de precio programado?',
                                                [
                                                    { text: 'Cancelar', style: 'cancel' },
                                                    { text: 'Eliminar', style: 'destructive', onPress: () => onDeletePrice(price.id) },
                                                ]
                                            );
                                        }}
                                        disabled={isDeleting}
                                    >
                                        <Ionicons name="trash-outline" size={16} color={colors.error[600]} />
                                        <Text style={styles.deleteText}>Cancelar Cambio</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: spacing.md,
    },
    title: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: spacing.md,
    },
    timeline: {
        paddingLeft: spacing.sm,
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: spacing.lg,
    },
    timelineLeft: {
        alignItems: 'center',
        marginRight: spacing.md,
        width: 20,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.neutral[300],
        zIndex: 1,
    },
    dotCurrent: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.success[500],
        borderWidth: 3,
        borderColor: colors.success[100],
    },
    dotFuture: {
        backgroundColor: colors.primary[500],
    },
    dotPast: {
        backgroundColor: colors.neutral[300],
    },
    line: {
        width: 2,
        flex: 1,
        backgroundColor: colors.neutral[200],
        marginTop: 4,
        marginBottom: -spacing.lg + 4, // Extend line to next dot
    },
    card: {
        flex: 1,
        backgroundColor: colors.common.white,
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    cardCurrent: {
        borderColor: colors.success[500],
        backgroundColor: colors.success[50],
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    statusLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.neutral[500],
        marginBottom: 2,
    },
    validDate: {
        fontSize: typography.size.sm,
        color: colors.neutral[700],
    },
    amount: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    deleteButton: {
        marginTop: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: colors.error[50],
        borderRadius: 4,
    },
    deleteText: {
        fontSize: typography.size.xs,
        color: colors.error[700],
        fontWeight: '600',
    },
});
