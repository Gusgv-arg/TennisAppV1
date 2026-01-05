import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAdminStats } from '@/src/features/admin/hooks/useAdminStats';
import { useAuthStore } from '@/src/store/useAuthStore';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin';

  // DEBUG: Check profile role
  console.log('=== HOME SCREEN DEBUG ===');
  console.log('Profile:', profile);
  console.log('Role:', profile?.role);
  console.log('isAdmin:', isAdmin);

  if (isAdmin) {
    return <AdminDashboard />;
  } else {
    return <CoachDashboard />;
  }
}

// Dashboard para Admin (KPIs globales)
function AdminDashboard() {
  const { t } = useTranslation();
  const {
    useUsersByRole,
    useGeographicDistribution,
  } = useAdminStats();

  const { data: usersByRole, isLoading: loadingUsers } = useUsersByRole();
  const { data: geoDistribution, isLoading: loadingGeo } = useGeographicDistribution();

  const isLoading = loadingUsers || loadingGeo;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.welcomeSubtitle}>Información General de la Aplicación</Text>

      {/* User Counts by Role */}
      <View style={styles.kpisGrid}>
        <KPICard
          icon="people"
          label="Total Usuarios"
          value={usersByRole?.total || 0}
          color={colors.neutral[700]}
        />
        <KPICard
          icon="school"
          label="Coaches"
          value={usersByRole?.coach || 0}
          color={colors.primary[500]}
        />
        <KPICard
          icon="people-circle"
          label="Colaboradores"
          value={usersByRole?.collaborator || 0}
          color={colors.warning[500]}
        />
        <KPICard
          icon="tennisball"
          label="Jugadores"
          value={usersByRole?.player || 0}
          color={colors.success[500]}
        />
      </View>

      {/* Geographic Distribution */}
      <Card style={styles.section} padding="md">
        <Text style={styles.sectionTitle}>{t('admin.geographicDistribution')}</Text>
        {geoDistribution && geoDistribution.length > 0 ? (
          <View style={styles.table}>
            {/* Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Ubicación</Text>
              <Text style={[styles.tableHeaderText, styles.countCell]}>🎓</Text>
              <Text style={[styles.tableHeaderText, styles.countCell]}>👥</Text>
              <Text style={[styles.tableHeaderText, styles.countCell]}>🎾</Text>
              <Text style={[styles.tableHeaderText, styles.countCell]}>Total</Text>
            </View>
            {geoDistribution.slice(0, 5).map((item: any, index: number) => (
              <View key={index} style={styles.tableRow}>
                <View style={[styles.locationInfo, { flex: 2 }]}>
                  <Ionicons name="location" size={14} color={colors.neutral[500]} />
                  <Text style={styles.locationName} numberOfLines={2}>
                    {[item.city, item.state_name, item.country_name]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </View>
                <Text style={[styles.countCell, styles.countText]}>{item.coach_count || 0}</Text>
                <Text style={[styles.countCell, styles.countText]}>{item.collaborator_count || 0}</Text>
                <Text style={[styles.countCell, styles.countText]}>{item.player_count || 0}</Text>
                <View style={styles.totalBadge}>
                  <Text style={styles.totalText}>{item.total_count || 0}</Text>
                </View>
              </View>
            ))}
            {/* Legend */}
            <View style={styles.legendRow}>
              <Text style={styles.legendText}>🎓 Coaches · 👥 Colaboradores · 🎾 Jugadores</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.noData}>{t('admin.noData')}</Text>
        )}
      </Card>
    </ScrollView>
  );
}

// Dashboard para Coach (resumen personal del día)
function CoachDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useAuthStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.welcomeTitle}>
        {t('welcome')}, {profile?.full_name?.split(' ')[0] || 'Coach'}!
      </Text>
      <Text style={styles.welcomeSubtitle}>Aquí está tu resumen del día</Text>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <QuickActionCard
          icon="people"
          label="Mis Jugadores"
          color={colors.primary[500]}
          onPress={() => router.push('/players')}
        />
        <QuickActionCard
          icon="calendar"
          label="Calendario"
          color={colors.secondary[500]}
          onPress={() => router.push('/calendar')}
        />
        <QuickActionCard
          icon="location"
          label="Ubicaciones"
          color={colors.success[500]}
          onPress={() => router.push('/locations')}
        />
      </View>

      {/* Today's Schedule Preview */}
      <Card style={styles.section} padding="md">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Sesiones de Hoy</Text>
          <TouchableOpacity onPress={() => router.push('/calendar')}>
            <Text style={styles.seeAllLink}>Ver todas →</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.comingSoon}>Próximamente: Vista de sesiones del día</Text>
      </Card>

      {/* Stats Overview */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="people"
          label="Total Jugadores"
          value="0"
          color={colors.primary[500]}
        />
        <StatCard
          icon="calendar-outline"
          label="Sesiones Este Mes"
          value="0"
          color={colors.secondary[500]}
        />
      </View>
    </ScrollView>
  );
}

const KPICard = ({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) => (
  <Card style={styles.kpiCard} padding="md">
    <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.kpiValue}>{value.toLocaleString()}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </Card>
);

const QuickActionCard = ({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
    <Card style={styles.quickActionCard} padding="md">
      <View style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Card>
  </TouchableOpacity>
);

const StatCard = ({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) => (
  <Card style={styles.statCard} padding="sm">
    <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
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
  welcomeTitle: {
    fontSize: typography.size.xxl,
    fontWeight: '700',
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  welcomeSubtitle: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: colors.neutral[700],
    marginBottom: spacing.lg,
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
  quickActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  quickActionCard: {
    flex: 1,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickActionLabel: {
    fontSize: typography.size.sm,
    color: colors.neutral[800],
    fontWeight: '600',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.neutral[900],
    marginBottom: 2,
  },
  statLabel: {
    fontSize: typography.size.xs,
    color: colors.neutral[600],
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  seeAllLink: {
    fontSize: typography.size.sm,
    color: colors.primary[500],
    fontWeight: '600',
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
    fontSize: typography.size.xs,
    fontWeight: '600',
    color: colors.neutral[700],
    textAlign: 'center',
  },
  tableHeader: {
    backgroundColor: colors.neutral[100],
    borderRadius: 4,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 0,
  },
  tableHeaderText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    color: colors.neutral[600],
    textAlign: 'center',
  },
  countCell: {
    width: 36,
    textAlign: 'center',
  },
  totalBadge: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 36,
    alignItems: 'center',
  },
  totalText: {
    fontSize: typography.size.xs,
    fontWeight: '700',
    color: colors.common.white,
  },
  legendRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    alignItems: 'center',
  },
  legendText: {
    fontSize: typography.size.xs,
    color: colors.neutral[500],
  },
  noData: {
    fontSize: typography.size.sm,
    color: colors.neutral[500],
    textAlign: 'center',
    paddingVertical: spacing.lg,
    fontStyle: 'italic',
  },
  comingSoon: {
    fontSize: typography.size.sm,
    color: colors.neutral[500],
    textAlign: 'center',
    paddingVertical: spacing.lg,
    fontStyle: 'italic',
  },
});
