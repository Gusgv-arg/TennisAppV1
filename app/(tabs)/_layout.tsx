import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import FeedbackModal from '@/src/components/FeedbackModal';
import { colors } from '@/src/design';
import { Avatar } from '@/src/design/components/Avatar';
import { Badge } from '@/src/design/components/Badge';
import { spacing } from '@/src/design/tokens/spacing';
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
        size="sm"
      />
    </TouchableOpacity>
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
            title: 'Clases',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
          }}
        />
        <Tabs.Screen
          name="payments"
          options={{
            title: t('tabPayments'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="creditcard.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Configuración',
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
});
