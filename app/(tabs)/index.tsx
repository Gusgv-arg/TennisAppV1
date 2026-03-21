import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';




import { PaymentStatsCard } from '@/src/components/dashboard/PaymentStatsCard';
import { HistoryModule } from '@/src/components/dashboard/stats/HistoryModule';
import { RevenueModule } from '@/src/components/dashboard/stats/RevenueModule';
import OnboardingCarousel from '@/src/components/OnboardingCarousel';
import { Card } from '@/src/design/components/Card';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useClassGroups } from '@/src/features/calendar/hooks/useClassGroups';
import { useSessions } from '@/src/features/calendar/hooks/useSessions';
import { useCollaborators } from '@/src/features/collaborators/hooks/useCollaborators';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useViewStore } from '@/src/store/useViewStore';



export default function HomeScreen() {
  return <CoachDashboard />;
}

// Dashboard para Coach (resumen personal del día)
function CoachDashboard() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useAuthStore();
  const { isGlobalView } = useViewStore();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [activeTab, setActiveTab] = React.useState<'resumen' | 'estadisticas' | 'tutorial'>('resumen');

  const styles = React.useMemo(() => createStyles(theme, isDesktop), [theme, isDesktop]);

  // ... (keeping date logic same)
  // Get today's date range
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

  console.log('[CoachDashboard] Rendering, range:', { startOfDay, endOfDay });

  const queryClient = useQueryClient();
  const { data: todaySessions, isLoading: loadingSessions, refetch: refetchSessions, isFetching: fetchingSessions } = useSessions(startOfDay, endOfDay);

  // Filter out cancelled sessions for the dashboard view
  const activeSessions = React.useMemo(() => {
    return todaySessions?.filter(s => s.status !== 'cancelled') || [];
  }, [todaySessions]);

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
      <View style={[styles.loadingContainer, { backgroundColor: theme.background.default }]}>
        <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background.default }]}>


      {/* Tab Switcher */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'resumen' && { borderBottomColor: theme.components.button.primary.bg }, activeTab === 'resumen' && styles.activeTab]}
          onPress={() => setActiveTab('resumen')}
        >
          <Text style={[styles.tabText, { color: theme.text.primary, opacity: 0.7 }, activeTab === 'resumen' && { color: theme.components.button.primary.bg, fontWeight: '700', opacity: 1 }]}>
            Resumen
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'estadisticas' && { borderBottomColor: theme.components.button.primary.bg }, activeTab === 'estadisticas' && styles.activeTab]}
          onPress={() => setActiveTab('estadisticas')}
        >
          <Text style={[styles.tabText, { color: theme.text.primary, opacity: 0.7 }, activeTab === 'estadisticas' && { color: theme.components.button.primary.bg, fontWeight: '700', opacity: 1 }]}>
            Estadísticas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tutorial' && { borderBottomColor: theme.components.button.primary.bg }, activeTab === 'tutorial' && styles.activeTab]}
          onPress={() => setActiveTab('tutorial')}
        >
          <Text style={[styles.tabText, { color: theme.text.primary, opacity: 0.7 }, activeTab === 'tutorial' && { color: theme.components.button.primary.bg, fontWeight: '700', opacity: 1 }]}>
            Tutorial
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'resumen' ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Today's Sessions */}
          <Card style={styles.section} padding="md">
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Clases de Hoy</Text>
              <TouchableOpacity onPress={() => router.push('/calendar')}>
                <Text style={[styles.seeAllLink, { color: theme.components.button.primary.bg }]}>Ver todas →</Text>
              </TouchableOpacity>
            </View>

            {activeSessions && activeSessions.length > 0 ? (
              <View style={styles.sessionsList}>
                {activeSessions.map((session: any) => (
                  <TouchableOpacity
                    key={session.id}
                    style={[styles.sessionCard, { backgroundColor: theme.background.default }]}
                    onPress={() => router.push('/calendar')}
                  >
                    <View style={styles.sessionTime}>
                      <Ionicons name="time-outline" size={16} color={theme.components.button.primary.bg} />
                      <View>
                        <Text style={[styles.sessionTimeText, { color: theme.text.primary }]}>
                          {new Date(session.scheduled_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </Text>
                        <Text style={[styles.sessionEndTimeText, { color: theme.text.secondary }]}>
                          {new Date(new Date(session.scheduled_at).getTime() + (session.duration_minutes || 60) * 60000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.sessionDetails}>
                      {/* Row 1: Academy (Global View) - FIRST */}
                      {isGlobalView && session.academy?.name && (
                        <View style={styles.sessionRow}>
                          <Ionicons name="school-outline" size={14} color={theme.components.button.primary.bg} />
                          <Text style={[styles.sessionPlayers, { color: theme.components.button.primary.bg, fontWeight: '600' }]} numberOfLines={1}>
                            {session.academy.name}
                          </Text>
                        </View>
                      )}

                      {/* Row 1.5: Coach */}
                      <View style={styles.sessionRow}>
                        <Ionicons name="person-circle-outline" size={14} color={theme.text.secondary} />
                        <Text style={[styles.sessionPlayers, { color: theme.text.secondary }]} numberOfLines={1}>
                          {session.instructor?.full_name || session.coach?.full_name || 'Coach'}
                        </Text>
                      </View>

                      {/* Row 1.6: Class Group (if exists) */}
                      {session.class_group?.name && (
                        <View style={styles.sessionRow}>
                          <Ionicons name="people-circle-outline" size={14} color={theme.components.button.secondary.bg} />
                          <Text style={[styles.sessionPlayers, { color: theme.components.button.secondary.bg, fontWeight: '500' }]} numberOfLines={1}>
                            {session.class_group.name}
                          </Text>
                        </View>
                      )}

                      {/* Row 2: Students List (Standard Format) */}
                      <View style={{ gap: 2 }}>
                        {session.players && session.players.length > 0 ? (
                          session.players.map((p: any, index: number) => (
                            <View key={index} style={[styles.sessionRow, { gap: 4 }]}>
                              {/* Person Icon + Name */}
                              <Ionicons name="person-outline" size={14} color={theme.text.tertiary} />
                              <Text style={[styles.sessionPlayers, { color: theme.text.primary }]} numberOfLines={1}>
                                {p.full_name}
                              </Text>

                              {/* Plan Icon + Name (if exists) */}
                              {p.plan_name && (
                                <>
                                  <View style={{ width: 4 }} />
                                  <Ionicons name="pricetag-outline" size={14} color={theme.text.tertiary} />
                                  <Text style={[styles.sessionPlayers, { color: theme.text.tertiary }]} numberOfLines={1}>
                                    {p.plan_name}
                                  </Text>
                                </>
                              )}
                            </View>
                          ))
                        ) : (
                          <View style={styles.sessionRow}>
                            <Ionicons name="person-outline" size={14} color={theme.text.tertiary} />
                            <Text style={[styles.sessionPlayers, { color: theme.text.tertiary }]}>Sin alumnos</Text>
                          </View>
                        )}
                      </View>

                      {/* Row 3: Location */}
                      <View style={styles.sessionRow}>
                        <Ionicons name="location-outline" size={14} color={theme.text.tertiary} />
                        <Text style={[styles.sessionLocation, { color: theme.text.tertiary }]} numberOfLines={1}>
                          {session.location || 'Sin ubicación'}
                          {session.court ? ` - Cancha ${session.court}` : ''}
                        </Text>
                      </View>
                      {/* Row 4: Notes (if exist) */}
                      {session.notes && (
                        <View style={styles.sessionRow}>
                          <Ionicons name="document-text-outline" size={14} color={theme.text.tertiary} />
                          <Text style={[styles.sessionNotes, { color: theme.text.tertiary }]} numberOfLines={2}>
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
                <Ionicons name="calendar-outline" size={32} color={theme.text.tertiary} />
                <Text style={[styles.emptyStateText, { color: theme.text.tertiary }]}>No tienes clases para hoy</Text>
              </View>
            )}
          </Card>

          {/* Payment Stats */}
          <PaymentStatsCard />




          {/* User Counts */}
          <Card style={styles.section} padding="md">
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Mis Usuarios</Text>

            <View style={styles.statsFlexContainer}>
              {[
                { label: 'Alumnos', icon: 'person', color: theme.status.success, total: stats.totalPlayers, details: [{ val: stats.activeWithPlan, lbl: 'Activos', color: theme.status.success }, { val: stats.activeNoPlan, lbl: 'Sin Plan', color: theme.status.warning }, { val: stats.archived, lbl: 'Archivados', color: theme.text.tertiary }] },
                { label: 'Grupos', icon: 'people-circle', color: theme.components.button.secondary.bg, total: stats.totalGroups, details: [{ val: stats.groupsWithPlan, lbl: 'Con Plan', color: theme.status.success }, { val: stats.groupsNoPlan, lbl: 'Sin Plan', color: theme.status.warning }, { val: stats.groupsArchived, lbl: 'Archivados', color: theme.text.tertiary }] },
                { label: 'Equipo', icon: 'school', color: theme.text.tertiary, total: stats.totalCollaborators, details: [{ val: stats.coaches, lbl: 'Profesores', color: theme.status.success }, { val: stats.staff, lbl: 'Staff', color: theme.status.warning }, { val: stats.archivedTeam, lbl: 'Archivados', color: theme.text.tertiary }] }
              ].map((item, idx) => (
                <View key={idx} style={[styles.userSectionContainer, { backgroundColor: isDark ? theme.background.subtle : theme.background.default, borderColor: theme.border.subtle, borderWidth: 1 }]}>
                  {/* Left Group: Icon + Label + Main Total */}
                  <View style={styles.leftGroup}>
                    <View style={styles.iconLabelGroup}>
                      <View style={[styles.summaryStatIcon, { backgroundColor: item.color + '15' }]}>
                        <Ionicons name={item.icon as any} size={isDesktop ? 24 : 20} color={item.color} />
                      </View>
                      <Text style={[styles.summaryStatLabel, { color: theme.text.primary }]} numberOfLines={1}>{item.label}</Text>
                    </View>

                    <View style={styles.totalStatWrapper}>
                      <Text style={[styles.statValueBig, { color: theme.text.primary }]}>{item.total}</Text>
                    </View>
                  </View>

                  {/* Right: Breakdown */}
                  <View style={styles.detailsGrid}>
                    {item.details.map((detail, dIdx) => (
                      <View key={dIdx} style={styles.detailItemVertical}>
                        <Text style={[styles.detailValueSmall, { color: detail.color }]}>{detail.val}</Text>
                        <Text style={[styles.detailLabelSmall, { color: theme.text.secondary }]}>{detail.lbl}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </ScrollView>
      ) : activeTab === 'estadisticas' ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <HistoryModule />
          <RevenueModule />
          {/* Future modules will go here */}
          {/* <PaymentStatsModule /> */}
          {/* <AttendanceModule /> */}
        </ScrollView>
      ) : (
        <View style={styles.container}>
          <OnboardingCarousel onFinish={() => setActiveTab('resumen')} />
        </View>
      )}
    </View>
  );
}

const KPICard = ({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <Card style={styles.kpiCard} padding="md">
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color: theme.text.primary }]}>{value.toLocaleString()}</Text>
      <Text style={[styles.kpiLabel, { color: theme.text.secondary }]}>{label}</Text>
    </Card>
  );
};

const QuickActionCard = ({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.quickActionCard} padding="md">
        <View style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={28} color={color} />
        </View>
        <Text style={[styles.quickActionLabel, { color: theme.text.primary }]}>{label}</Text>
      </Card>
    </TouchableOpacity>
  );
};

const StatCard = ({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <Card style={styles.statCard} padding="sm">
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
};

const createStyles = (theme: Theme, isDesktop: boolean = false) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background.default,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background.default,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  welcomeTitle: {
    fontSize: typography.size.xxl,
    fontWeight: '700',
    color: theme.text.primary,
    marginBottom: spacing.xs,
  },
  subheader: {
    fontSize: typography.size.md,
    color: theme.text.secondary,
    marginBottom: spacing.lg,
  },
  welcomeSubtitle: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: theme.text.primary,
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
    backgroundColor: theme.background.default,
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
    color: theme.text.primary,
    marginBottom: spacing.xs,
  },
  kpiLabel: {
    fontSize: typography.size.xs,
    color: theme.text.secondary,
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
    backgroundColor: theme.background.default,
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
    color: theme.text.primary,
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
    backgroundColor: theme.background.default,
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
    color: theme.text.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: typography.size.xs,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.md,
    backgroundColor: theme.background.default,
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
    color: theme.text.primary,
  },
  seeAllLink: {
    fontSize: typography.size.sm,
    color: theme.components.button.primary.bg,
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
    borderBottomColor: theme.border.subtle,
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
    color: theme.text.primary,
    fontWeight: '500',
  },
  countBadge: {
    backgroundColor: theme.components.button.primary.bg + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  countText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    color: theme.text.primary,
    textAlign: 'center',
  },
  tableHeader: {
    backgroundColor: theme.background.subtle,
    borderRadius: 4,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 0,
  },
  tableHeaderText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    color: theme.text.secondary,
    textAlign: 'center',
  },
  countCell: {
    width: 36,
    textAlign: 'center',
  },
  totalBadge: {
    backgroundColor: theme.components.button.primary.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 36,
    alignItems: 'center',
  },
  totalText: {
    fontSize: typography.size.xs,
    fontWeight: '700',
    color: 'white',
  },
  legendRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.border.subtle,
    alignItems: 'center',
  },
  legendText: {
    fontSize: typography.size.xs,
    color: theme.text.tertiary,
  },
  noData: {
    fontSize: typography.size.sm,
    color: theme.text.tertiary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
    fontStyle: 'italic',
  },
  comingSoon: {
    fontSize: typography.size.sm,
    color: theme.text.tertiary,
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
    color: theme.text.primary,
  },
  userCountLabel: {
    fontSize: typography.size.xs,
    color: theme.text.secondary,
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
    backgroundColor: theme.background.subtle,
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
    color: theme.components.button.primary.bg,
  },
  sessionEndTimeText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: theme.components.button.primary.bg,
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
    color: theme.text.tertiary,
    flex: 1,
  },
  sessionNotes: {
    fontSize: typography.size.xs,
    color: theme.text.secondary,
    flex: 1,
    fontStyle: 'italic',
  },
  sessionPlayers: {
    fontSize: typography.size.sm,
    color: theme.text.primary,
    // flex: 1, // Removed flex: 1 to prevent expansion
    flexShrink: 1, // Allow shrinking if text is too long
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
    color: theme.text.tertiary,
  },
  // Debts Styles
  debtsSummary: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    backgroundColor: theme.background.subtle,
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
    backgroundColor: theme.border.subtle,
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
    color: theme.text.primary,
  },
  debtLabel: {
    fontSize: typography.size.xs,
    color: theme.text.secondary,
  },
  statsFlexContainer: {
    flexDirection: isDesktop ? 'row' : 'column',
    flexWrap: isDesktop ? 'wrap' : 'nowrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  userSectionContainer: {
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: isDesktop ? 1 : undefined,
    minWidth: isDesktop ? 300 : undefined,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    width: isDesktop ? 120 : 100, // Slightly wider for desktop
  },
  totalStatWrapper: {
    width: 30, // Fixed width for total number
    alignItems: 'center',
  },
  detailsGrid: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: theme.border.subtle,
  },
  detailItemVertical: {
    alignItems: 'center',
    flex: 1,
  },
  detailValueSmall: {
    fontSize: typography.size.md,
    fontWeight: '700',
  },
  detailLabelSmall: {
    fontSize: 10,
    marginTop: 2,
  },
  detailStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start', // Keep stats closer to the left/total
    gap: spacing.xs, // Reduced gap
    paddingLeft: spacing.xs, // Reduced padding
    borderLeftWidth: 1,
    borderLeftColor: theme.border.subtle,
    height: '60%', // Reduced height
  },

  summaryStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValueBig: {
    fontSize: isDesktop ? typography.size.xl : typography.size.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  summaryStatLabel: {
    fontSize: typography.size.sm,
    color: theme.text.secondary,
    fontWeight: '600',
  },

  // Tab styles
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.background.default,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.subtle,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: theme.components.button.primary.bg,
  },
  tabText: {
    fontSize: typography.size.md,
    color: theme.text.secondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: theme.components.button.primary.bg,
    fontWeight: '700',
  },
  // Placeholder styles
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: theme.background.default,
  },
  placeholderTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: theme.text.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    color: theme.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: typography.size.sm,
    color: theme.text.tertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
    maxWidth: 300,
  },
});
