import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/src/store/useAuthStore';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const { profile } = useAuthStore();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: true,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabHome'),
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
        name="staff"
        options={{
          title: t('collaborators'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.3.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: t('tabAnalysis'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="videoprojector.fill" color={color} />,
        }}
      />
      {/* Admin tab - only visible for admin role */}
      {profile?.role === 'admin' && (
        <Tabs.Screen
          name="admin"
          options={{
            title: t('admin.dashboard'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="shield.checkmark.fill" color={color} />,
          }}
        />
      )}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabProfile'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
