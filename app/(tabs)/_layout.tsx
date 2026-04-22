import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { AcademyHeaderTitle } from '@/src/components/AcademyHeaderTitle';
import FeedbackModal from '@/src/components/FeedbackModal';
import StatusModal from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Badge } from '@/src/design/components/Badge';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import { VideoActionModal } from '@/src/components/VideoActionModal';

export default function TabLayout() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);
  const [videoHubVisible, setVideoHubVisible] = useState(false);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const HeaderAvatar = () => (
    <TouchableOpacity
      onPress={() => router.push('/profile')}
      style={styles.headerAvatar}
    >
      <Avatar
        name={profile?.full_name || 'U'}
        source={profile?.avatar_url || undefined}
        size="md"
      />
    </TouchableOpacity>
  );

  const CustomTabHeader = ({ title, icon, subtitle, headerRight }: { title: string, icon: any, subtitle: string, headerRight?: any }) => (
    <View style={[styles.customHeaderContainer, {
      backgroundColor: theme.background.surface,
      borderBottomColor: theme.border.subtle,
      paddingTop: Platform.OS === 'web' ? 20 : (insets.top || 0) + 10,
    }]}>
      <View style={styles.headerBottomRow}>
        <View style={styles.headerTitleWrapper}>
          {isDesktop ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.headerTitleText, { color: theme.text.primary }]}>{title}</Text>
                  <Badge
                    label="Beta"
                    variant="warning"
                    size="sm"
                    style={{ marginLeft: 6, marginTop: 2 }}
                  />
                </View>
                <Text style={{ fontSize: typography.size.xs, color: theme.text.secondary, marginTop: 1 }}>
                  {subtitle}
                </Text>
              </View>
              <View style={{ marginLeft: 24 }}>
                <AcademyHeaderTitle />
              </View>
            </View>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.headerTitleText, { color: theme.text.primary }]}>{title}</Text>
                <Badge
                  label="Beta"
                  variant="primary"
                  size="sm"
                  style={{ marginLeft: 6, marginTop: 2 }}
                />
              </View>
              <Text style={[styles.headerSubtitleText, { color: theme.text.secondary }]}>
                {subtitle}
              </Text>
              <View style={{ marginTop: spacing.xs }}>
                <AcademyHeaderTitle />
              </View>
            </View>
          )}

        </View>
        <View style={styles.headerRightActions}>
          {headerRight && headerRight()}
          <TouchableOpacity
            onPress={() => setVideoHubVisible(true)}
            style={[styles.analysisFab, { backgroundColor: theme.components.button.secondary.bg }]}
            activeOpacity={0.8}
          >
            <Ionicons name="videocam" size={20} color={theme.components.button.secondary.text} />
          </TouchableOpacity>
          <HeaderAvatar />
        </View>
      </View>
    </View>
  );

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.components.tabBar.active,
          tabBarInactiveTintColor: theme.components.tabBar.inactive,
          headerShown: true,
          tabBarButton: HapticTab,
          header: ({ options, route }) => {
            let title = options.title || '';
            let icon: any = 'home';
            let subtitle = '';

            switch (route.name) {
              case 'index':
                title = 'Dashboard';
                icon = 'home';
                subtitle = t('system.tabs.dashboardSub');
                break;
              case 'players':
                title = t('tabPlayers');
                icon = 'people';
                subtitle = t('system.tabs.playersSub');
                break;
              case 'calendar':
                title = t('system.tabs.calendar');
                icon = 'calendar';
                subtitle = t('system.tabs.calendarSub');
                break;
              case 'payments':
                title = t('tabPayments');
                icon = 'card';
                subtitle = t('system.tabs.paymentsSub');
                break;
              case 'settings':
                title = t('system.tabs.settings');
                icon = 'settings';
                subtitle = t('system.tabs.settingsSub');
                break;
            }

            if (!['index', 'players', 'calendar', 'payments', 'settings'].includes(route.name)) {
              return null;
            }

            return <CustomTabHeader title={title} icon={icon} subtitle={subtitle} headerRight={options.headerRight} />;
          },
          tabBarStyle: {
            height: Platform.OS === 'ios' ? 92 : 72 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.xs,
            paddingTop: 12,
            backgroundColor: theme.components.tabBar.bg,
            borderTopColor: theme.components.tabBar.border,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: {
            fontSize: Math.round(11 * 1.15), // Tamaño intermedio para que entren palabras largas
            fontWeight: '600',
            marginTop: 0,
          }
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, focused }) => (
              <View style={[
                styles.iconContainer,
                focused && !isDark ? { backgroundColor: theme.components.button.primary.bg } : { backgroundColor: 'transparent' }
              ]}>
                <Ionicons size={18} name="home" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="players"
          options={{
            title: t('tabPlayers'),
            tabBarIcon: ({ color, focused }) => (
              <View style={[
                styles.iconContainer,
                focused && !isDark ? { backgroundColor: theme.components.button.primary.bg } : { backgroundColor: 'transparent' }
              ]}>
                <Ionicons size={18} name="people" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: t('system.tabs.calendar'),
            tabBarIcon: ({ color, focused }) => (
              <View style={[
                styles.iconContainer,
                focused && !isDark ? { backgroundColor: theme.components.button.primary.bg } : { backgroundColor: 'transparent' }
              ]}>
                <Ionicons size={18} name="calendar" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="payments"
          options={{
            title: t('tabPayments'),
            tabBarIcon: ({ color, focused }) => (
              <View style={[
                styles.iconContainer,
                focused && !isDark ? { backgroundColor: theme.components.button.primary.bg } : { backgroundColor: 'transparent' }
              ]}>
                <Ionicons size={18} name="card" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('system.tabs.settings'),
            tabBarIcon: ({ color, focused }) => (
              <View style={[
                styles.iconContainer,
                focused && !isDark ? { backgroundColor: theme.components.button.primary.bg } : { backgroundColor: 'transparent' }
              ]}>
                <Ionicons size={18} name="settings" color={color} />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="analysis"
          options={{
            href: null,
            title: 'Biblioteca General',
            headerShown: false,
            header: () => null,
          }}
        />

      </Tabs>

      <TouchableOpacity
        onPress={() => setFeedbackVisible(true)}
        style={[styles.fab, { 
          backgroundColor: theme.background.neutral,
          bottom: 80 + insets.bottom
        }]}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color={theme.text.secondary} />
      </TouchableOpacity>

      <VideoActionModal
        visible={videoHubVisible}
        onClose={() => setVideoHubVisible(false)}
        onRecordPress={() => router.push('/record-video')}
        onLibraryPress={() => router.push('/analysis')}
      />

      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
      />

      <StatusModal
        visible={analysisModalVisible}
        type="info"
        title={t('system.soonModal.title')}
        message={t('system.soonModal.message')}
        onClose={() => setAnalysisModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerAvatar: {
    marginRight: spacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  CustomHeader: {
    // Deprecated? Keeping cleaner styles below
  },
  headerTitleText: {
    fontSize: typography.size.lg,
    fontWeight: '700',
  },
  headerSubtitleText: {
    fontSize: typography.size.xs,
    fontWeight: '400',
  },
  customHeaderContainer: {
    paddingTop: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    display: 'none',
  },
  analysisFab: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    marginHorizontal: spacing.sm,
  },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  iconContainer: {
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
