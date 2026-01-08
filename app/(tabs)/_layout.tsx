import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import FeedbackModal from '@/src/components/FeedbackModal';
import { colors } from '@/src/design';
import { Avatar } from '@/src/design/components/Avatar';
import { Badge } from '@/src/design/components/Badge';
import { TitleComponent } from '@/src/design/components/TitleComponent';
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

  /* Removed TabHeaderTitle component in favor of TitleComponent */


  /* Custom Header Component to achieve the specific layout: Beta on top, Title left, Avatar right */
  const CustomTabHeader = ({ title, icon, subtitle }: { title: string, icon: any, subtitle: string }) => (
    <View style={styles.customHeaderContainer}>
      {/* Row 1: Beta Badge */}
      <View style={styles.headerTopRow}>
        <Badge
          label="Beta"
          variant="primary"
        />
      </View>

      {/* Row 2: Title & Avatar */}
      <View style={styles.headerBottomRow}>
        <View style={styles.headerTitleWrapper}>
          <TitleComponent
            title={title}
            icon={icon}
            subtitle={subtitle}
            color={colors.neutral[900]}
          />
        </View>
        <HeaderAvatar />
      </View>
    </View>
  );

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: true,
          tabBarButton: HapticTab,
          header: ({ options, route }) => {
            // Extract props from the options we set below
            // We'll rely on our specific options structure or map route names
            let title = options.title || '';
            let icon: any = 'home';
            let subtitle = '';

            switch (route.name) {
              case 'index':
                title = 'Dashboard';
                icon = 'home';
                subtitle = 'Tu resumen diario';
                break;
              case 'players':
                title = t('tabPlayers');
                icon = 'people';
                subtitle = 'Gestioná tus alumnos';
                break;
              case 'calendar':
                title = 'Clases';
                icon = 'calendar';
                subtitle = 'Gestioná tus clases';
                break;
              case 'payments':
                title = t('tabPayments');
                icon = 'card';
                subtitle = 'Control de ingresos';
                break;
              case 'settings':
                title = 'Configuración';
                icon = 'settings';
                subtitle = 'Tus preferencias';
                break;
            }

            // For hidden tabs or others, fallback (though they usually have headerShown: false or null href)
            if (!['index', 'players', 'calendar', 'payments', 'settings'].includes(route.name)) {
              return null;
            }

            return <CustomTabHeader title={title} icon={icon} subtitle={subtitle} />;
          },
          tabBarStyle: {
            height: 60, // Standard tab bar height
          }
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <Ionicons size={28} name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="players"
          options={{
            title: t('tabPlayers'),
            tabBarIcon: ({ color }) => <Ionicons size={28} name="people" color={color} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Clases',
            tabBarIcon: ({ color }) => <Ionicons size={28} name="calendar" color={color} />,
          }}
        />
        <Tabs.Screen
          name="payments"
          options={{
            title: t('tabPayments'),
            tabBarIcon: ({ color }) => <Ionicons size={28} name="card" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Configuración',
            tabBarIcon: ({ color }) => <Ionicons size={28} name="settings" color={color} />,
          }}
        />
        {/* Hidden tabs - accessed via other routes */}
        <Tabs.Screen
          name="locations"
          options={{
            href: null, // Hide from tab bar
            title: t('tabLocations'),
            headerShown: true, // Let it use default header or handle inside? 
            // Locations usually has its own header stack or we leave default. 
            // The user asked for "paginas principales".
            header: undefined // Reset to default for non-main tabs
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null, // Hide from tab bar
            title: t('tabProfile'),
            header: undefined
          }}
        />
        <Tabs.Screen
          name="analysis"
          options={{
            href: null, // Hide - future feature
            title: 'Análisis',
            header: undefined
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
  customHeaderContainer: {
    paddingTop: 12, // Reduced to move Beta higher
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral[50],
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  headerTopRow: {
    alignItems: 'flex-start',
    marginBottom: 12, // Increased to separate Beta from Title
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
});
