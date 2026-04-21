import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
import { StatsSection } from '../StatsSection';
import { useRevenueStats } from '@/src/features/payments/hooks/usePayments';
import { Card } from '@/src/design/components/Card';

const SCREEN_WIDTH = Dimensions.get('window').width;
const isMobile = SCREEN_WIDTH < 768;

interface RevenueModuleProps {
    isExpanded?: boolean;
    onToggle?: (expanded: boolean) => void;
}

export const RevenueModule = ({ isExpanded, onToggle }: RevenueModuleProps) => {
    const { theme, isDark } = useTheme();
    const { t, i18n } = useTranslation();
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const { data: stats, isLoading } = useRevenueStats(selectedYear);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat(i18n.language === 'es' ? 'es-AR' : 'en-US', {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const formatK = (amount: number) => {
        const sign = amount < 0 ? '-' : '';
        return `${sign}$${Math.round(Math.abs(amount) / 1000)}k`;
    };

    const getMonthName = (monthIndex: number) => {
        const date = new Date(2024, monthIndex, 1);
        return date.toLocaleString(i18n.language, { month: 'short' });
    };

    const totalAccrued = stats?.reduce((acc, curr) => acc + curr.accrued, 0) || 0;
    const totalCollected = stats?.reduce((acc, curr) => acc + curr.collected, 0) || 0;
    const balance = totalAccrued - totalCollected;
    const efficiency = totalAccrued > 0 ? (totalCollected / totalAccrued) * 100 : 0;

    const maxAmount = Math.max(...(stats?.map(s => Math.max(s.accrued, s.collected)) || [1]));

    if (isLoading) {
        return (
            <StatsSection title={t('dashboard.sections.revenue')} icon="trending-up">
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.components.button.primary.bg} />
                </View>
            </StatsSection>
        );
    }

    return (
        <StatsSection
            title={t('dashboard.revenue.title')}
            icon="analytics-outline"
            headerRight={
                <View style={styles.yearNavigator}>
                    <TouchableOpacity onPress={() => setSelectedYear(y => y - 1)}>
                        <Ionicons name="chevron-back" size={18} color={theme.text.tertiary} />
                    </TouchableOpacity>
                    <Text style={[styles.yearText, { color: theme.text.primary }]}>{selectedYear}</Text>
                    <TouchableOpacity onPress={() => setSelectedYear(y => y + 1)}>
                        <Ionicons name="chevron-forward" size={18} color={theme.text.tertiary} />
                    </TouchableOpacity>
                </View>
            }
            isExpanded={isExpanded}
            onToggle={onToggle}
            contentPaddingHorizontal={0}
            hideContentBorder={true}
        >
            <View style={styles.container}>
                {/* Summary Row */}
                <View style={styles.summaryRow}>
                    <Card style={[styles.summaryCard, { backgroundColor: isDark ? theme.background.subtle : theme.background.default }]} padding="md">
                        <Text style={[styles.summaryLabel, { color: theme.text.primary }]}>{t('dashboard.revenue.accrued')}</Text>
                        <Text style={[styles.summaryValue, { color: theme.text.primary }]}>{formatCurrency(totalAccrued)}</Text>
                    </Card>
                    <Card style={[styles.summaryCard, { backgroundColor: isDark ? theme.background.subtle : theme.background.default }]} padding="md">
                        <Text style={[styles.summaryLabel, { color: theme.text.primary }]}>{t('dashboard.revenue.collected')}</Text>
                        <Text style={[styles.summaryValue, { color: theme.status.success }]}>{formatCurrency(totalCollected)}</Text>
                    </Card>
                    <Card style={[styles.summaryCard, { backgroundColor: isDark ? theme.background.subtle : theme.background.default }]} padding="md">
                        <Text style={[styles.summaryLabel, { color: theme.text.primary }]}>{t('dashboard.revenue.efficiency')}</Text>
                        <Text style={[styles.summaryValue, { color: theme.status.info }]}>{efficiency.toFixed(1)}%</Text>
                    </Card>
                </View>

                {/* Trend Chart */}
                <Card style={[styles.chartCard, { backgroundColor: isDark ? theme.background.subtle : theme.background.default }]} padding="md">
                    <View style={styles.chartHeader}>
                        <Text style={[styles.chartTitle, { color: theme.text.primary }]}>{t('dashboard.revenue.trend')}</Text>
                        <Text style={[styles.chartSubtitle, { color: theme.text.primary }]}>Valores en miles (k)</Text>
                    </View>
                    
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
                        <View style={styles.chartContainer}>
                            {stats?.map((m, index) => (
                                <View key={index} style={styles.chartColumn}>
                                    <View style={styles.barsRow}>
                                        <View style={styles.barWrapper}>
                                            {m.accrued > 0 && (
                                                <Text style={[styles.barValue, { color: theme.text.primary }]}>
                                                    {Math.round(m.accrued / 1000)}k
                                                </Text>
                                            )}
                                            <View style={[styles.bar, { 
                                                height: (m.accrued / maxAmount) * 80, 
                                                backgroundColor: isDark ? theme.text.primary : '#E2E8F0',
                                                borderTopLeftRadius: 4,
                                                borderTopRightRadius: 4
                                            }]} />
                                        </View>
                                        <View style={styles.barWrapper}>
                                            {m.collected > 0 && (
                                                <Text style={[styles.barValue, { color: theme.status.success }]}>
                                                    {Math.round(m.collected / 1000)}k
                                                </Text>
                                            )}
                                            <View style={[styles.bar, { 
                                                height: (m.collected / maxAmount) * 80, 
                                                backgroundColor: theme.status.success,
                                                borderTopLeftRadius: 4,
                                                borderTopRightRadius: 4,
                                            }]} />
                                        </View>
                                    </View>
                                    <Text style={[styles.monthLabel, { color: theme.text.primary }]}>{getMonthName(index)}</Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                    <View style={styles.chartLegend}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: isDark ? theme.text.primary : '#E2E8F0' }]} />
                            <Text style={[styles.legendText, { color: theme.text.primary }]}>{t('dashboard.revenue.accrued')}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: theme.status.success }]} />
                            <Text style={[styles.legendText, { color: theme.text.primary }]}>{t('dashboard.revenue.collected')}</Text>
                        </View>
                    </View>
                </Card>

                {/* Details Table */}
                <View style={[styles.tableContainer, { backgroundColor: isDark ? theme.background.subtle : theme.background.default, borderColor: theme.border.subtle }]}>
                    <View style={[styles.tableHeader, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.background.neutral }]}>
                        <Text style={[styles.headerCell, styles.monthCell, { color: theme.text.primary }]}>{t('dashboard.revenue.month')}</Text>
                        <Text style={[styles.headerCell, styles.countCell, { color: theme.text.primary }]}>{t(isMobile ? 'dashboard.revenue.count_short' : 'dashboard.revenue.count')}</Text>
                        <Text style={[styles.headerCell, { color: theme.text.primary }]}>{t(isMobile ? 'dashboard.revenue.accrued_short' : 'dashboard.revenue.accrued')}</Text>
                        <Text style={[styles.headerCell, { color: theme.text.primary }]}>{t(isMobile ? 'dashboard.revenue.collected_short' : 'dashboard.revenue.collected')}</Text>
                        <Text style={[styles.headerCell, { color: theme.text.primary }]}>{t(isMobile ? 'dashboard.revenue.difference_short' : 'dashboard.revenue.difference')}</Text>
                    </View>
                    {stats?.filter(m => m.accrued !== 0 || m.collected !== 0).map((m, index) => (
                        <View key={index} style={[styles.tableRow, { borderBottomColor: theme.border.subtle }]}>
                            <Text style={[styles.cell, styles.monthCell, { color: theme.text.primary, fontWeight: '600' }]}>{getMonthName(m.month)}</Text>
                            <Text style={[styles.cell, styles.countCell, { color: theme.text.primary }]}>{m.count}</Text>
                            <Text style={[styles.cell, { color: theme.text.primary }]}>{isMobile ? formatK(m.accrued) : formatCurrency(m.accrued)}</Text>
                            <Text style={[styles.cell, { color: theme.status.success, fontWeight: '500' }]}>{isMobile ? formatK(m.collected) : formatCurrency(m.collected)}</Text>
                            <Text style={[styles.cell, { color: m.difference > 0 ? theme.status.error : theme.text.primary }]}>
                                {m.difference > 0 ? `-${isMobile ? formatK(m.difference) : formatCurrency(m.difference)}` : (isMobile ? formatK(Math.abs(m.difference)) : formatCurrency(Math.abs(m.difference)))}
                            </Text>
                        </View>
                    ))}
                    
                    {/* Grand Totals Row */}
                    {stats && stats.length > 0 && (
                        <View style={[styles.tableRow, styles.totalRow, { borderTopWidth: 2, borderTopColor: theme.border.default }]}>
                            <Text style={[styles.cell, styles.monthCell, { color: theme.text.primary, fontWeight: '800' }]}>{t('dashboard.revenue.total')}</Text>
                            <Text style={[styles.cell, styles.countCell, { color: theme.text.primary, fontWeight: '800' }]}>
                                {stats.reduce((acc, curr) => acc + curr.count, 0)}
                            </Text>
                            <Text style={[styles.cell, { color: theme.text.primary, fontWeight: '800' }]}>
                                {isMobile ? formatK(stats.reduce((acc, curr) => acc + curr.accrued, 0)) : formatCurrency(stats.reduce((acc, curr) => acc + curr.accrued, 0))}
                            </Text>
                            <Text style={[styles.cell, { color: theme.status.success, fontWeight: '800' }]}>
                                {isMobile ? formatK(stats.reduce((acc, curr) => acc + curr.collected, 0)) : formatCurrency(stats.reduce((acc, curr) => acc + curr.collected, 0))}
                            </Text>
                            <Text style={[
                                styles.cell, 
                                { 
                                    fontWeight: '800',
                                    color: (() => {
                                        const diff = stats.reduce((acc, curr) => acc + curr.difference, 0);
                                        if (diff > 0) return theme.status.error;
                                        if (diff < 0) return theme.status.success;
                                        return theme.text.secondary;
                                    })()
                                }
                            ]}>
                                {(() => {
                                    const diff = stats.reduce((acc, curr) => acc + curr.difference, 0);
                                    if (diff > 0) return `-${isMobile ? formatK(diff) : formatCurrency(diff)}`;
                                    if (diff < 0) return isMobile ? formatK(Math.abs(diff)) : formatCurrency(Math.abs(diff));
                                    return isMobile ? formatK(0) : formatCurrency(0);
                                })()}
                            </Text>
                        </View>
                    )}
                    {(!stats || stats.filter(m => m.accrued > 0 || m.collected > 0).length === 0) && (
                        <View style={styles.emptyTable}>
                            <Text style={[styles.emptyText, { color: theme.text.tertiary }]}>{t('dashboard.revenue.noData')}</Text>
                        </View>
                    )}
                </View>
            </View>
        </StatsSection>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: spacing.sm,
    },
    loadingContainer: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    yearNavigator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    navButton: {
        padding: 4,
    },
    yearText: {
        fontSize: typography.size.md,
        fontWeight: '700',
        minWidth: 50,
        textAlign: 'center',
    },
    summaryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: isMobile ? 4 : spacing.xl,
        marginTop: 4,
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    summaryCard: {
        flex: 1,
        minWidth: 90,
        maxWidth: 140,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderRadius: 12,
    },
    summaryLabel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    summaryValue: {
        fontSize: 13,
        fontWeight: '800',
    },
    chartCard: {
        height: 250,
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: spacing.md,
    },
    chartTitle: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    chartSubtitle: {
        fontSize: 9,
        fontWeight: '600',
    },
    chartScroll: {
        paddingBottom: spacing.sm,
    },
    chartContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 150,
        gap: isMobile ? spacing.md : spacing.xl,
        paddingHorizontal: spacing.sm,
    },
    chartColumn: {
        alignItems: 'center',
        minWidth: isMobile ? 50 : 60,
    },
    barsRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: isMobile ? 4 : 8,
        height: '100%',
    },
    barWrapper: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: isMobile ? 24 : 18,
        height: '100%',
    },
    bar: {
        width: '100%',
        minHeight: 2,
    },
    barValue: {
        fontSize: isMobile ? 10 : 9,
        fontWeight: '700',
        marginBottom: 2,
    },
    monthLabel: {
        fontSize: 10,
        marginTop: spacing.xs,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    chartLegend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.lg,
        marginTop: spacing.md,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 10,
        fontWeight: '500',
    },
    tableContainer: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
    },
    headerCell: {
        flex: 3,
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        textAlign: 'right',
    },
    cell: {
        flex: 3,
        fontSize: 11,
        textAlign: 'right',
    },
    monthCell: {
        flex: 2,
        textAlign: 'left',
    },
    countCell: {
        flex: 1,
        textAlign: 'right',
    },
    totalRow: {
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
    },
    emptyTable: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.size.sm,
        fontStyle: 'italic',
    },
});
