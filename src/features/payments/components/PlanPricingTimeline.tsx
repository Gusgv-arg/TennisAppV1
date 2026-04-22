import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
import { PricingPlanPrice } from '@/src/types/payments';

interface PlanPricingTimelineProps {
    prices: PricingPlanPrice[];
    onDeletePrice: (id: string) => void;
    isDeleting: boolean;
}

export const PlanPricingTimeline = ({ prices, onDeletePrice, isDeleting }: PlanPricingTimelineProps) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const sortedPrices = [...prices].sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime());
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Find current active price (first one in past/present)
    const currentPriceIndex = sortedPrices.findIndex(p => {
        const pDate = new Date(p.valid_from);
        pDate.setHours(0, 0, 0, 0);
        return pDate.getTime() <= now.getTime();
    });

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{t('pricingPlans.modals.priceTimeline.title')}</Text>

            <View style={styles.timeline}>
                {sortedPrices.map((price, index) => {
                    const priceDate = new Date(price.valid_from);
                    const compareDate = new Date(priceDate);
                    compareDate.setHours(0, 0, 0, 0);

                    const isFuture = compareDate.getTime() > now.getTime();
                    const isCurrent = index === currentPriceIndex;
                    const isPast = !isFuture && !isCurrent;

                    return (
                        <View key={price.id} style={styles.timelineItem}>
                            {/* Dot Indicator */}


                            {/* Content */}
                            <View style={[
                                styles.card,
                                isCurrent && styles.cardCurrent
                            ]}>
                                <View style={styles.cardHeader}>
                                    <View>
                                        <Text style={[styles.statusLabel, isCurrent && { color: theme.status.success }]}>
                                            {isCurrent 
                                                ? t('pricingPlans.modals.priceTimeline.currentPrice') 
                                                : isFuture 
                                                    ? t('pricingPlans.modals.priceTimeline.scheduled') 
                                                    : t('pricingPlans.modals.priceTimeline.previous')}
                                        </Text>
                                        <Text style={[styles.validDate, { color: theme.text.secondary }]}>
                                            {t('pricingPlans.modals.priceTimeline.since')} {priceDate.toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <Text style={[styles.amount, { color: theme.text.primary }]}>
                                        ${new Intl.NumberFormat('es-AR').format(price.amount)}
                                    </Text>
                                </View>

                                {isFuture && (
                                    <TouchableOpacity
                                        style={[styles.deleteButton, { backgroundColor: theme.status.error + '10' }]}
                                        onPress={() => onDeletePrice(price.id)}
                                        disabled={isDeleting}
                                    >
                                        <Ionicons name="trash-outline" size={16} color={theme.status.error} />
                                        <Text style={[styles.deleteText, { color: theme.status.error }]}>{t('pricingPlans.modals.priceTimeline.cancelChange')}</Text>
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

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        paddingTop: spacing.md,
    },
    title: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: theme.text.primary,
        marginBottom: spacing.md,
    },
    timeline: {
        paddingLeft: 0,
    },
    timelineItem: {
        marginBottom: spacing.lg,
    },
    card: {
        flex: 1,
        backgroundColor: theme.background.surface,
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: theme.border.default,
    },
    cardCurrent: {
        borderColor: theme.status.success,
        backgroundColor: theme.status.success + '05',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    statusLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: theme.text.secondary,
        marginBottom: 2,
    },
    validDate: {
        fontSize: typography.size.sm,
    },
    amount: {
        fontSize: typography.size.md,
        fontWeight: '700',
    },
    deleteButton: {
        marginTop: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    deleteText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
    },
});
