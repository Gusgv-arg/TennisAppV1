import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAdminStats } from '@/src/features/admin/hooks/useAdminStats';

export default function AdminScreen() {
    const { t } = useTranslation();
    const {
        useCoachesCount,
        useTotalPlayers,
        useSessionsThisMonth,
        useActiveLocations,
        useGeographicDistribution,
    } = useAdminStats();

    const { data: coachesCount, isLoading: loadingCoaches } = useCoachesCount();
    const { data: playersCount, isLoading: loadingPlayers } = useTotalPlayers();
    const { data: sessionsCount, isLoading: loadingSessions } = useSessionsThisMonth();
    const { data: locationsCount, isLoading: loadingLocations } = useActiveLocations();
    const { data: geoDistribution, isLoading: loadingGeo } = useGeographicDistribution();

    const isLoading = loadingCoaches || loadingPlayers || loadingSessions || loadingLocations || loadingGeo;

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            {/* KPIs Grid */}
            <View style={styles.kpisGrid}>
                <KPICard
                    icon="people"
                    label={t('admin.activeCoaches')}
                    value={coachesCount || 0}
                    color={colors.primary[500]}
                />
                <KPICard
                    icon="tennisball"
                    label={t('admin.totalPlayers')}
                    value={playersCount || 0}
                    color={colors.success[500]}
                />
                <KPICard
                    icon="calendar"
                    label={t('admin.sessionsThisMonth')}
                    value={sessionsCount || 0}
                    color={colors.warning[500]}
                />
                <KPICard
                    icon="location"
                    label={t('admin.activeLocations')}
                    value={locationsCount || 0}
                    color={colors.secondary[500]}
                />
            </View>

            {/* Geographic Distribution */}
            <Card style={styles.section} padding="md">
                <Text style={styles.sectionTitle}>{t('admin.geographicDistribution')}</Text>
                {geoDistribution && geoDistribution.length > 0 ? (
                    <View style={styles.table}>
                        {geoDistribution.map((item, index) => (
                            <View key={index} style={styles.tableRow}>
                                <View style={styles.locationInfo}>
                                    <Ionicons name="location" size={16} color={colors.neutral[500]} />
                                    <View style={styles.locationText}>
                                        <Text style={styles.locationName}>
                                            {[item.city, item.state_name, item.country_name]
                                                .filter(Boolean)
                                                .join(', ')}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.countBadge}>
                                    <Text style={styles.countText}>{item.coach_count}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <Text style={styles.noData}>{t('admin.noData')}</Text>
                )}
            </Card>
        </ScrollView>
    );
}

const KPICard = ({
    icon,
    label,
    value,
    color,
}: {
    icon: any;
    label: string;
    value: number;
    color: string;
}) => (
    <Card style={styles.kpiCard} padding="md">
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon} size={24} color={color} />
        </View>
        <Text style={styles.kpiValue}>{value.toLocaleString()}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
    </Card>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.neutral[50],
    },
    scrollContent: {
        padding: spacing.md,
        paddingBottom: spacing.xxl,
    },
    kpisGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    kpiCard: {
        flex: 1,
        minWidth: '45%',
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    kpiValue: {
        fontSize: typography.size.xxl,
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: spacing.xs,
    },
    kpiLabel: {
        fontSize: typography.size.xs,
        color: colors.neutral[600],
        textAlign: 'center',
        fontWeight: '500',
    },
    section: {
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[700],
        marginBottom: spacing.md,
    },
    table: {
        gap: spacing.xs,
    },
    tableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: spacing.sm,
    },
    locationText: {
        flex: 1,
    },
    locationName: {
        fontSize: typography.size.sm,
        color: colors.neutral[800],
        fontWeight: '500',
    },
    countBadge: {
        backgroundColor: colors.primary[100],
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 12,
        minWidth: 40,
        alignItems: 'center',
    },
    countText: {
        fontSize: typography.size.sm,
        fontWeight: '700',
        color: colors.primary[700],
    },
    noData: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        textAlign: 'center',
        paddingVertical: spacing.lg,
        fontStyle: 'italic',
    },
});
