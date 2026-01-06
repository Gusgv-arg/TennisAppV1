import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Avatar } from '@/src/design/components/Avatar';
import { spacing } from '@/src/design/tokens/spacing';
import { Badge } from '@/src/design/components/Badge';
import { useAuthStore } from '@/src/store/useAuthStore';


export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const router = useRouter();

  const HeaderAvatar = () => (
    <TouchableOpacity
      onPress={() => router.push('/profile')}
      style={styles.headerAvatar}
    >
      <Avatar
        name={profile?.full_name || 'U'}
        source={profile?.avatar_url || undefined}
        size="sm"
      />
    </TouchableOpacity>
  );

  return (
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
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: t('tabPlayers'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t('tabCalendar'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="locations"
        options={{
          title: t('tabLocations'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="mappin.and.ellipse" color={color} />,
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: t('tabAnalysis'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="videoprojector.fill" color={color} />,
        }}
      />
      {/* Hide profile from tabs - accessed via header avatar */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null, // Hide from tab bar
          title: t('tabProfile'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerAvatar: {
    marginRight: spacing.md,
  },
});
