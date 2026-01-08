import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import FeedbackModal from '@/src/components/FeedbackModal';
import { colors } from '@/src/design';
import { Avatar } from '@/src/design/components/Avatar';
import { Badge } from '@/src/design/components/Badge';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAuthStore } from '@/src/store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';


export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const router = useRouter();
  const [feedbackVisible, setFeedbackVisible] = useState(false);

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

  const TabHeaderTitle = ({ title, iconName, color }: { title: string; iconName: keyof typeof Ionicons.glyphMap; color: string }) => (
    <View style={styles.headerTitleContainer}>
      <View style={[styles.headerIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={iconName} size={24} color={color} />
      </View>
      <Text style={styles.headerTitleText}>{title}</Text>
    </View>
  );

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: true,
          tabBarButton: HapticTab,
          headerRight: () => <HeaderAvatar />,
          headerLeft: () => (
            <Badge
              label="Beta"
              variant="primary"
              style={{ marginLeft: spacing.md }}
            />
          ),
          headerStyle: {
            height: 110,
            elevation: 0,
            shadowOpacity: 0,
            backgroundColor: colors.neutral[50], // Check if neutral[50] matches your bg
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            headerTitle: () => <TabHeaderTitle title="Dashboard" iconName="home" color={colors.neutral[900]} />,
            headerShadowVisible: false,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="players"
          options={{
            title: t('tabPlayers'),
            headerTitle: () => <TabHeaderTitle title={t('tabPlayers')} iconName="people" color={colors.neutral[900]} />,
            headerShadowVisible: false,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Clases',
            headerTitle: () => <TabHeaderTitle title="Clases" iconName="calendar" color={colors.neutral[900]} />,
            headerShadowVisible: false,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
          }}
        />
        <Tabs.Screen
          name="payments"
          options={{
            title: t('tabPayments'),
            headerTitle: () => <TabHeaderTitle title={t('tabPayments')} iconName="card" color={colors.neutral[900]} />,
            headerShadowVisible: false,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="creditcard.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Configuración',
            headerTitle: () => <TabHeaderTitle title="Configuración" iconName="settings" color={colors.neutral[900]} />,
            headerShadowVisible: false,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
          }}
        />
        {/* Hidden tabs - accessed via other routes */}
        <Tabs.Screen
          name="locations"
          options={{
            href: null, // Hide from tab bar
            title: t('tabLocations'),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null, // Hide from tab bar
            title: t('tabProfile'),
          }}
        />
        <Tabs.Screen
          name="analysis"
          options={{
            href: null, // Hide - future feature
            title: 'Análisis',
          }}
        />
        <Tabs.Screen
          name="collaborators"
          options={{
            href: null, // Hide - accessed from settings
            title: 'Colaboradores',
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="plans"
          options={{
            href: null, // Hide - accessed from settings
            title: 'Planes',
            headerShown: false,
          }}
        />
      </Tabs>

      {/* Floating Feedback Button */}
      <TouchableOpacity
        onPress={() => setFeedbackVisible(true)}
        style={styles.fab}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color={colors.common.white} />
      </TouchableOpacity>

      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
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
    bottom: 90, // Above tab bar
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconContainer: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
  },
  headerTitleText: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.neutral[900],
  },
});
