import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/hooks/useTheme';
import { HapticTab } from '@/components/haptic-tab';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, StyleSheet, View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/src/store/useAuthStore';
import { typography } from '@/src/design/tokens/typography';
import { Avatar } from '@/src/design/components/Avatar';

export default function PlayerTabLayout() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { signOut, profile } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro que querés salir de la cuenta de Alumno?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Salir", style: "destructive", onPress: async () => {
            await signOut();
            router.replace('/login');
          }
        }
      ]
    );
  };

  const CustomHeader = ({ title, icon }: { title: string, icon: any }) => (
    <View style={[styles.header, { backgroundColor: theme.background.surface, borderBottomColor: theme.border.subtle }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={24} color={theme.text.primary} />
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>{title}</Text>
      </View>
      <TouchableOpacity onPress={handleLogout}>
        {profile ? (
          <Avatar name={profile.full_name || 'Alumno'} source={profile.avatar_url || undefined} size="sm" />
        ) : (
          <View style={[styles.genericAvatar, { backgroundColor: theme.components.button.secondary.bg }]}>
            <Ionicons name="person" size={16} color={theme.text.secondary} />
          </View>
        )}
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
  },
  genericAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
