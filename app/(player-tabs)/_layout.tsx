import { HapticTab } from '@/components/haptic-tab';
import { Avatar } from '@/src/design/components/Avatar';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PlayerTabLayout() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { t } = useTranslation();
  const { signOut, profile } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const CustomHeader = ({ title, icon }: { title: string, icon: any }) => {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    return (
      <View style={[styles.header, { 
        backgroundColor: theme.background.surface, 
        borderBottomColor: theme.border.default,
        paddingTop: (insets.top > 0 ? insets.top : (Platform.OS === 'android' ? 40 : 10)) + (isDesktop ? 15 : 15),
        paddingBottom: isDesktop ? 20 : 10,
        paddingHorizontal: isDesktop ? 24 : 16,
        minHeight: isDesktop ? 100 : 125,
      }]}>
        <View style={{ width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('@/assets/images/canchero-logo.png')} 
                  style={styles.headerLogo}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={[styles.brandText, { color: theme.text.primary, fontSize: isDesktop ? 20 : 22 }]}>TenisLab</Text>
                <Text style={[styles.taglineText, { color: '#FFFFFF', fontSize: isDesktop ? 10 : 12 }]} numberOfLines={1}>la app para profesores y alumnos</Text>
              </View>
            </View>

            <TouchableOpacity onPress={handleLogout} style={styles.avatarButton}>
              {profile ? (
                <Avatar name={profile.full_name || 'Alumno'} source={profile.avatar_url || undefined} size={isDesktop ? "md" : "sm"} />
              ) : (
                <View style={[styles.genericAvatar, { backgroundColor: theme.background.subtle, width: isDesktop ? 40 : 32, height: isDesktop ? 40 : 32, borderRadius: isDesktop ? 20 : 16 }]}>
                  <Ionicons name="person" size={isDesktop ? 20 : 16} color={theme.text.secondary} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.tabInfoContainer, { marginTop: isDesktop ? 20 : 20 }]}>
            <View style={[styles.iconBox, { backgroundColor: theme.background.subtle, width: isDesktop ? 36 : 32, height: isDesktop ? 36 : 32 }]}>
              {icon && <Ionicons name={icon} size={isDesktop ? 20 : 18} color="#FFFFFF" />}
            </View>
            <Text style={[styles.headerTitle, { color: theme.text.primary, fontSize: isDesktop ? 22 : 20 }]}>{title}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.components.tabBar.active,
          tabBarInactiveTintColor: theme.components.tabBar.inactive,
          headerShown: true,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: theme.background.surface,
            borderTopColor: 'transparent',
            height: Platform.OS === 'ios' ? 88 : 65 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 0,
            paddingHorizontal: Platform.OS === 'web' && isDesktop ? (width - 400) / 2 : 0,
          },
          tabBarItemStyle: {
            // No strict flex boundaries here so they distribute equally in the available 400px
          }
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
      <Modal
        transparent
        visible={logoutModalVisible}
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLogoutModalVisible(false)}>
          <View style={[styles.modalContainer, { backgroundColor: theme.background.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Cerrar Sesión</Text>
            <Text style={[styles.modalText, { color: theme.text.secondary }]}>¿Estás seguro que querés salir de la cuenta de Alumno?</Text>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity style={[styles.modalButton, { flex: 1, backgroundColor: theme.components.button.secondary.bg }]} onPress={() => setLogoutModalVisible(false)}>
                <Text style={[styles.modalButtonText, { color: theme.text.primary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { flex: 1, backgroundColor: theme.status.error }]} onPress={async () => { await signOut(); router.replace('/login'); }}>
                <Text style={[styles.modalButtonText, { color: '#FFF' }]}>Salir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
  },
  logoContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerLogo: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.4 }],
  },
  brandText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  taglineText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: -2,
  },
  avatarButton: {
    // Standard margin fix if needed
  },
  tabInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  genericAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  }
});
