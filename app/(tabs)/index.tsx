import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';




import { HistoryModule } from '@/src/components/dashboard/stats/HistoryModule';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAdminStats } from '@/src/features/admin/hooks/useAdminStats';
import { useClassGroups } from '@/src/features/calendar/hooks/useClassGroups';
import { useSessions } from '@/src/features/calendar/hooks/useSessions';
import { useCollaborators } from '@/src/features/collaborators/hooks/useCollaborators';
import { usePaymentStats } from '@/src/features/payments/hooks/usePayments';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
  const [activeTab, setActiveTab] = React.useState<'resumen' | 'estadisticas'>('resumen');

  // Payment stats
  const { data: paymentStats } = usePaymentStats();
  const { isSimplifiedMode } = usePaymentSettings();

  // Get today's date range
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

  console.log('[CoachDashboard] Rendering, range:', { startOfDay, endOfDay });

  const queryClient = useQueryClient();
  const { data: todaySessions, isLoading: loadingSessions, refetch: refetchSessions, isFetching: fetchingSessions } = useSessions(startOfDay, endOfDay);

  // Data Fetching for Stats
  const { data: activePlayers, isLoading: loadingActive, refetch: refetchActive } = usePlayers('', 'active');
  const { data: archivedPlayers, isLoading: loadingArchived, refetch: refetchArchived } = usePlayers('', 'archived');
  const { data: collaborators, isLoading: loadingCollaborators, refetch: refetchCollaborators } = useCollaborators();
  const { data: archivedCollaborators, isLoading: loadingArchivedCollaborators, refetch: refetchArchivedCollaborators } = useCollaborators('', true);
  const { data: activeGroups, isLoading: loadingGroups, refetch: refetchGroups } = useClassGroups('active');
  const { data: archivedGroups, isLoading: loadingArchivedGroups, refetch: refetchArchivedGroups } = useClassGroups('archived');

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('[CoachDashboard] Screen focused, refetching...');
      refetchSessions();
      refetchActive();
      refetchArchived();
      refetchCollaborators();
      refetchArchivedCollaborators();
      refetchGroups();
      refetchArchivedGroups();
    }, [refetchSessions, refetchActive, refetchArchived, refetchCollaborators, refetchArchivedCollaborators, refetchGroups, refetchArchivedGroups])
  );

  // Compute Stats
  const stats = React.useMemo(() => {
    const activeWithPlan = activePlayers?.filter(p => p.has_plan).length || 0;
    const activeNoPlan = activePlayers?.filter(p => !p.has_plan).length || 0;
    const archived = archivedPlayers?.length || 0;
    const totalPlayers = (activePlayers?.length || 0) + archived;
    // Group stats
    const groupsWithPlan = activeGroups?.filter(g => g.plan_id).length || 0;
    const groupsNoPlan = activeGroups?.filter(g => !g.plan_id).length || 0;
    const groupsArchived = archivedGroups?.length || 0;
    const totalGroups = (activeGroups?.length || 0) + groupsArchived;

    // Team stats
    const coaches = collaborators?.filter(c => c.role === 'coach' || c.role === 'owner').length || 0;
    const staff = collaborators?.filter(c => c.role !== 'coach' && c.role !== 'owner').length || 0;
    const archivedTeam = archivedCollaborators?.length || 0;
    const totalCollaborators = (collaborators?.length || 0) + archivedTeam;

    return {
      activeWithPlan,
      activeNoPlan,
      archived,
      totalPlayers,
      totalCollaborators,
      // Groups
      groupsWithPlan,
      groupsNoPlan,
      groupsArchived,
      totalGroups,
      // Team
      coaches,
      staff,
      archivedTeam
    };
  }, [activePlayers, archivedPlayers, collaborators, archivedCollaborators, activeGroups, archivedGroups]);

  const isLoading = loadingSessions || loadingActive || loadingArchived || loadingCollaborators || loadingArchivedCollaborators || loadingGroups || loadingArchivedGroups;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>


      {/* Tab Switcher */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'resumen' && styles.activeTab]}
          onPress={() => setActiveTab('resumen')}
        >
          <Text style={[styles.tabText, activeTab === 'resumen' && styles.activeTabText]}>
            Resumen
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'estadisticas' && styles.activeTab]}
          onPress={() => setActiveTab('estadisticas')}
        >
          <Text style={[styles.tabText, activeTab === 'estadisticas' && styles.activeTabText]}>
            Estadísticas
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'resumen' ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Today's Sessions */}
          <Card style={styles.section} padding="md">
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Clases de Hoy</Text>
              <TouchableOpacity onPress={() => router.push('/calendar')}>
                <Text style={styles.seeAllLink}>Ver todas →</Text>
              </TouchableOpacity>
            </View>

            {todaySessions && todaySessions.length > 0 ? (
              <View style={styles.sessionsList}>
                {todaySessions.map((session: any) => (
                  <TouchableOpacity
                    key={session.id}
                    style={styles.sessionCard}
                    onPress={() => router.push('/calendar')}
                  >
                    <View style={styles.sessionTime}>
                      <Ionicons name="time-outline" size={16} color={colors.primary[500]} />
                      <View>
                        <Text style={styles.sessionTimeText}>
                          {new Date(session.scheduled_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={styles.sessionEndTimeText}>
                          {new Date(new Date(session.scheduled_at).getTime() + (session.duration_minutes || 60) * 60000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.sessionDetails}>
                      {/* Row 1: Coach */}
                      <View style={styles.sessionRow}>
                        <Ionicons name="school-outline" size={14} color={colors.neutral[500]} />
                        <Text style={styles.sessionPlayers} numberOfLines={1}>
                          {session.instructor?.full_name || session.coach?.full_name || 'Coach'}
                        </Text>
                      </View>

                      {/* Row 1.5: Academy (Global View) */}
                      {session.academy?.name && (
                        <View style={styles.sessionRow}>
                          <Ionicons name="business-outline" size={14} color={colors.primary[500]} />
                          <Text style={[styles.sessionPlayers, { color: colors.primary[600], fontWeight: '500' }]} numberOfLines={1}>
                            {session.academy.name}
                          </Text>
                        </View>
                      )}

                      {/* Row 2: Students */}
                      <View style={styles.sessionRow}>
                        <Ionicons name="person-outline" size={14} color={colors.neutral[500]} />
                        <Text style={styles.sessionPlayers} numberOfLines={1}>
                          {session.players && session.players.length > 0
                            ? session.players.map((p: any) => p.full_name).join(', ')
                            : 'Sin alumnos'}
                        </Text>
                      </View>

                      {/* Row 2.5: Plans */}
                      {(() => {
                        const plans = Array.from(new Set(session.players?.map((p: any) => p.plan_name).filter(Boolean)));
                        if (plans.length > 0) {
                          return (
                            <View style={styles.sessionRow}>
                              <Ionicons name="pricetag-outline" size={14} color={colors.neutral[500]} />
                              <Text style={styles.sessionPlayers} numberOfLines={1}>
                                {plans.join(', ')}
                              </Text>
                            </View>
                          );
                        }
                        return null;
                      })()}

                      {/* Row 3: Location */}
                      <View style={styles.sessionRow}>
                        <Ionicons name="location-outline" size={14} color={colors.neutral[500]} />
                        <Text style={styles.sessionLocation} numberOfLines={1}>
                          {session.location || 'Sin ubicación'}
                          {session.court ? ` - Cancha ${session.court}` : ''}
                        </Text>
                      </View>
                      {/* Row 4: Notes (if exist) */}
                      {session.notes && (
                        <View style={styles.sessionRow}>
                          <Ionicons name="document-text-outline" size={14} color={colors.neutral[500]} />
                          <Text style={styles.sessionNotes} numberOfLines={2}>
                            {session.notes}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={32} color={colors.neutral[300]} />
                <Text style={styles.emptyStateText}>No tienes clases para hoy</Text>
              </View>
            )}
          </Card>

          {/* Debts Section (Real Data) */}
          <Card style={styles.section} padding="md">
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Estado de Cobranzas</Text>
              <TouchableOpacity onPress={() => router.push('/payments')}>
                <Text style={styles.seeAllLink}>Ver detalles →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.debtsSummary}>
              <View style={styles.debtBox}>
                <View style={[styles.debtIcon, { backgroundColor: colors.success[50] }]}>
                  <Ionicons name="trending-up" size={20} color={colors.success[500]} />
                </View>
                <View>
                  <Text style={styles.debtValue}>
                    {isSimplifiedMode
                      ? (paymentStats?.totalPlayers || 0) - (paymentStats?.debtorsCount || 0)
                      : `$ ${(paymentStats?.totalCollected || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`}
                  </Text>
                  <Text style={styles.debtLabel}>{isSimplifiedMode ? 'Al día' : 'Cobrado (mes)'}</Text>
                </View>
              </View>

              <View style={styles.debtDivider} />

              <View style={styles.debtBox}>
                <View style={[styles.debtIcon, { backgroundColor: colors.error[50] }]}>
                  <Ionicons name="alert-circle" size={20} color={colors.error[500]} />
                </View>
                <View>
                  <Text style={[styles.debtValue, { color: colors.error[600] }]}>
                    {isSimplifiedMode
                      ? (paymentStats?.debtorsCount || 0)
                      : `$ ${(paymentStats?.totalPending || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`}
                  </Text>
                  <Text style={styles.debtLabel}>{isSimplifiedMode ? 'Deben' : 'Pendiente'}</Text>
                </View>
              </View>

              <View style={styles.debtDivider} />

              <View style={styles.debtBox}>
                <View style={[styles.debtIcon, { backgroundColor: colors.warning[50] }]}>
                  <Ionicons name="people" size={20} color={colors.warning[500]} />
                </View>
                <View>
                  <Text style={styles.debtValue}>{paymentStats?.debtorsCount || 0}/{paymentStats?.totalPlayers || 0}</Text>
                  <Text style={styles.debtLabel}>Deben</Text>
                </View>
              </View>
            </View>
          </Card>

          {/* User Counts */}
          <Card style={styles.section} padding="md">
            <Text style={styles.sectionTitle}>Mis Usuarios</Text>

            <View style={styles.statsFlexContainer}>
              {/* ITEM 1: ALUMNOS */}
              <View style={[styles.userSectionContainer, styles.alumnosSection]}>
                {/* Left: Icon + Label */}
                <View style={styles.iconLabelGroup}>
                  <View style={[styles.summaryStatIcon, { backgroundColor: colors.success[50] }]}>
                    <Ionicons name="person" size={24} color={colors.success[600]} />
                  </View>
                  <Text style={styles.summaryStatLabel}>Alumnos</Text>
                </View>

                {/* Right: Numbers */}
                <View style={styles.numbersGroup}>
                  <View style={styles.totalStatItem}>
                    <Text style={styles.statValueBig}>{stats.totalPlayers}</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={[styles.detailStatValue, { color: colors.success[600] }]}>{stats.activeWithPlan}</Text>
                    <Text style={styles.detailStatLabel}>Activos</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={[styles.detailStatValue, { color: colors.warning[600] }]}>{stats.activeNoPlan}</Text>
                    <Text style={styles.detailStatLabel}>Sin Plan</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={[styles.detailStatValue, { color: colors.neutral[500] }]}>{stats.archived}</Text>
                    <Text style={styles.detailStatLabel}>Archivados</Text>
                  </View>
                </View>
              </View>

              {/* ITEM 2: GRUPOS */}
              <View style={[styles.userSectionContainer, styles.groupsSection]}>
                {/* Left: Icon + Label */}
                <View style={styles.iconLabelGroup}>
                  <View style={[styles.summaryStatIcon, { backgroundColor: colors.secondary[50] }]}>
                    <Ionicons name="people-circle" size={22} color={colors.secondary[600]} />
                  </View>
                  <Text style={styles.summaryStatLabel}>Grupos</Text>
                </View>

                {/* Right: Numbers */}
                <View style={styles.numbersGroup}>
                  <View style={styles.totalStatItem}>
                    <Text style={styles.statValueBig}>{stats.totalGroups}</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={[styles.detailStatValue, { color: colors.success[600] }]}>{stats.groupsWithPlan}</Text>
                    <Text style={styles.detailStatLabel}>Con Plan</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={[styles.detailStatValue, { color: colors.warning[600] }]}>{stats.groupsNoPlan}</Text>
                    <Text style={styles.detailStatLabel}>Sin Plan</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={[styles.detailStatValue, { color: colors.neutral[500] }]}>{stats.groupsArchived}</Text>
                    <Text style={styles.detailStatLabel}>Archivados</Text>
                  </View>
                </View>
              </View>

              {/* ITEM 3: EQUIPO */}
              <View style={[styles.userSectionContainer, styles.collaboratorSection]}>
                {/* Left: Icon + Label */}
                <View style={styles.iconLabelGroup}>
                  <View style={[styles.summaryStatIcon, { backgroundColor: colors.neutral[100] }]}>
                    <Ionicons name="school" size={24} color={colors.neutral[500]} />
                  </View>
                  <Text style={styles.summaryStatLabel}>Equipo</Text>
                </View>

                {/* Right: Numbers */}
                <View style={styles.numbersGroup}>
                  <View style={styles.totalStatItem}>
                    <Text style={styles.statValueBig}>{stats.totalCollaborators}</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={[styles.detailStatValue, { color: colors.success[600] }]}>{stats.coaches}</Text>
                    <Text style={styles.detailStatLabel}>Profesores</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={[styles.detailStatValue, { color: colors.warning[600] }]}>{stats.staff}</Text>
                    <Text style={styles.detailStatLabel}>Staff</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={[styles.detailStatValue, { color: colors.neutral[500] }]}>{stats.archivedTeam}</Text>
                    <Text style={styles.detailStatLabel}>Archivados</Text>
                  </View>
                </View>
              </View>
            </View>
          </Card>
        </ScrollView>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <HistoryModule />
          {/* Future modules will go here */}
          {/* <PaymentStatsModule /> */}
          {/* <AttendanceModule /> */}
        </ScrollView>
      )}
    </View>
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
  subheader: {
    fontSize: typography.size.md,
    color: colors.neutral[500],
    marginBottom: spacing.lg,
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
  // Coach Dashboard styles
  userCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
  },
  userCountItem: {
    alignItems: 'center',
    flex: 1,
  },
  userCountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  userCountValue: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  userCountLabel: {
    fontSize: typography.size.xs,
    color: colors.neutral[500],
    marginTop: 2,
  },
  sessionsList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sessionCard: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[50],
    borderRadius: 8,
    padding: spacing.sm,
    gap: spacing.md,
    flex: 1,
    minWidth: 300, // Responsive wrap
  },
  sessionTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 60,
  },
  sessionTimeText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: colors.primary[600],
  },
  sessionEndTimeText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: colors.primary[600],
  },
  sessionDetails: {
    flex: 1,
    gap: 4,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sessionLocation: {
    fontSize: typography.size.xs,
    color: colors.neutral[500],
    flex: 1,
  },
  sessionNotes: {
    fontSize: typography.size.xs,
    color: colors.neutral[600],
    flex: 1,
    fontStyle: 'italic',
  },
  sessionPlayers: {
    fontSize: typography.size.sm,
    color: colors.neutral[700],
    flex: 1,
  },
  instructorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: spacing.sm,
  },
  playersInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.size.sm,
    color: colors.neutral[400],
  },
  // Debts Styles
  debtsSummary: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    backgroundColor: colors.neutral[50],
    borderRadius: 8,
    padding: spacing.md,
  },
  debtBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  debtDivider: {
    width: 1,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing.sm,
  },
  debtIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  debtValue: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  debtLabel: {
    fontSize: typography.size.xs,
    color: colors.neutral[500],
  },
  statsFlexContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allow wrapping on small screens
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  userSectionContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm, // Compact padding
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start', // Keep items grouped closer together
    gap: spacing.md, // Moderate gap between title and numbers
  },
  alumnosSection: {
    flex: 1, // 50% width on large screens
    minWidth: 300, // Force wrap if less than this width
  },
  groupsSection: {
    flex: 1,
    minWidth: 300,
  },
  detailStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start', // Keep stats closer to the left/total
    gap: spacing.xs, // Reduced gap
    paddingLeft: spacing.xs, // Reduced padding
    borderLeftWidth: 1,
    borderLeftColor: colors.neutral[200],
    height: '60%', // Reduced height
  },
  collaboratorSection: {
    flex: 1, // 50% width on large screens
    minWidth: 180, // Force wrap if less than this width
  },
  iconLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryStatLabel: {
    fontSize: typography.size.sm,
    color: colors.neutral[600],
    fontWeight: '600',
  },
  numbersGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs, // Compact gap between numbers
    // flex: 1, // Removed to prevent pushing numbers to the right
    justifyContent: 'flex-start', // Keep next to title
    flexWrap: 'wrap', // Allow wrapping if needed
  },
  totalStatItem: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  statValueBig: {
    fontSize: typography.size.lg, // Match debtValue size for consistency
    fontWeight: '700',
    color: colors.neutral[900],
  },
  detailStatItem: {
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  detailStatValue: {
    fontSize: typography.size.md,
    fontWeight: '700',
    marginBottom: 0,
  },
  detailStatLabel: {
    fontSize: 10,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  detailStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.neutral[200],
  },
  // Tab styles
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.common.white,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary[500],
  },
  tabText: {
    fontSize: typography.size.md,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  activeTabText: {
    color: colors.primary[500],
    fontWeight: '700',
  },
  // Placeholder styles
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.neutral[50],
  },
  placeholderTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.neutral[700],
    marginTop: spacing.md,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    color: colors.neutral[500],
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: typography.size.sm,
    color: colors.neutral[400],
    marginTop: spacing.sm,
    textAlign: 'center',
    maxWidth: 300,
  },
});
