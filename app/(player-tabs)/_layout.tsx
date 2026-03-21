import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/hooks/useTheme';
import { HapticTab } from '@/components/haptic-tab';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/src/store/useAuthStore';
import { typography } from '@/src/design/tokens/typography';

export default function PlayerTabLayout() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { signOut } = useAuthStore();
  const router = useRouter();

  const CustomHeader = ({ title, icon }: { title: string, icon: any }) => (
    <View style={[styles.header, { backgroundColor: theme.background.surface, borderBottomColor: theme.border.subtle }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={24} color={theme.text.primary} />
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>{title}</Text>
      </View>
      <TouchableOpacity onPress={async () => { await signOut(); router.replace('/login'); }}>
         <Ionicons name="log-out-outline" size={24} color={theme.text.secondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.components.tabBar.active,
          tabBarInactiveTintColor: theme.components.tabBar.inactive,
          headerShown: true,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: theme.background.surface,
            borderTopColor: 'transparent',
          },
        }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mi Perfil',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
          header: () => <CustomHeader title="Mi Perfil" icon="person" />,
        }}
      />
      <Tabs.Screen
        name="my-videos"
        options={{
          title: 'Mis Videos',
          tabBarIcon: ({ color }) => <Ionicons name="videocam" size={24} color={color} />,
          header: () => <CustomHeader title="Mis Videos" icon="videocam" />,
        }}
      />
      <Tabs.Screen
        name="my-analysis"
        options={{
          title: 'Mis Análisis',
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={24} color={color} />,
          header: () => <CustomHeader title="Mis Análisis" icon="bar-chart" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  headerTitle: {
    ...typography.variants.h3,
    fontWeight: '600',
  }
});
