import { HapticTab } from '@/components/haptic-tab';
import { Avatar } from '@/src/design/components/Avatar';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/store/useAuthStore';
import { supabase } from '@/src/services/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { LanguageToggle } from '@/src/design/components/LanguageToggle';
import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PlayerTabLayout() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { t, i18n } = useTranslation();
  const { signOut, profile } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [isConfirmingLogout, setIsConfirmingLogout] = useState(false);

  const handleOpenProfile = () => {
    setIsConfirmingLogout(false);
    setProfileModalVisible(true);
  };

  const CustomHeader = ({ title, icon }: { title: string, icon: any }) => {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    return (
      <View style={[styles.header, {
        backgroundColor: theme.background.surface,
        borderBottomColor: theme.border.default,
        paddingTop: (insets.top > 0 ? insets.top : (Platform.OS === 'android' ? 40 : 10)) + (isDesktop ? 10 : 10),
        paddingBottom: 4, 
        paddingHorizontal: isDesktop ? 24 : 16,
        minHeight: isDesktop ? 80 : 110,
        justifyContent: 'center',
      }]}>
        <View style={{ width: '100%' }}>
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            width: '100%',
            gap: 12
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('@/assets/images/canchero-logo.png')}
                  style={styles.headerLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={[styles.brandText, { color: theme.text.primary, fontSize: isDesktop ? 20 : 22 }]}>TenisLab</Text>
                <Text style={[styles.taglineText, { color: '#FFFFFF', fontSize: isDesktop ? 10 : 11 }]} numberOfLines={1}>{t('auth.tagline')}</Text>
              </View>
            </View>

            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 12,
            }}>
              <TouchableOpacity onPress={handleOpenProfile} style={styles.avatarButton}>
                {profile ? (
                  <Avatar name={profile.full_name || t('roles.player')} source={profile.avatar_url || undefined} size={isDesktop ? "md" : "sm"} />
                ) : (
                  <View style={[styles.genericAvatar, { backgroundColor: theme.components.tabBar.active, width: isDesktop ? 40 : 32, height: isDesktop ? 40 : 32, borderRadius: isDesktop ? 20 : 16 }]}>
                    <Ionicons name="person" size={isDesktop ? 20 : 16} color={theme.background.surface} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.tabInfoContainer, { marginTop: isDesktop ? 24 : 16 }]}>
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
            title: t('playerDashboard.tabVideos'),
            tabBarIcon: ({ color }) => <Ionicons name="videocam" size={24} color={color} />,
            header: () => <CustomHeader title={t('playerDashboard.tabVideos')} icon="videocam" />,
          }}
        />
        <Tabs.Screen
          name="my-analysis"
          options={{
            title: t('playerDashboard.tabAnalysis'),
            tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={24} color={color} />,
            header: () => <CustomHeader title={t('playerDashboard.tabAnalysis')} icon="bar-chart" />,
          }}
        />
      </Tabs>
      <Modal
        transparent
        visible={profileModalVisible}
        animationType="fade"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setProfileModalVisible(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: '#0f172a' }]}>
            <Text style={[styles.modalTitle, { color: theme.text.primary, marginBottom: 20 }]}>
              {isConfirmingLogout ? t('logout') : t('profileTitle')}
            </Text>
            
            {!isConfirmingLogout ? (
              <View style={{ gap: 12 }}>
                {/* Language Selection Row */}
                <View style={[styles.menuItem, { backgroundColor: theme.background.subtle }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="language" size={20} color={theme.text.secondary} />
                    <Text style={{ color: theme.text.primary, fontWeight: '600' }}>{t('changeLanguage')}</Text>
                  </View>
                  <LanguageToggle />
                </View>

                {/* Logout Option */}
                <TouchableOpacity 
                  style={[styles.menuItem, { backgroundColor: theme.background.subtle }]} 
                  onPress={() => setIsConfirmingLogout(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="log-out-outline" size={20} color={theme.status.error} />
                    <Text style={{ color: theme.status.error, fontWeight: '600' }}>{t('logout')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.text.secondary} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalButton, { marginTop: 8, backgroundColor: theme.background.neutral || theme.background.subtle }]} 
                  onPress={() => setProfileModalVisible(false)}
                >
                  <Text style={[styles.modalButtonText, { color: theme.text.primary }]}>{t('common.close')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={[styles.modalText, { color: theme.text.secondary, marginBottom: 24 }]}>
                  {t('playerDashboard.logoutConfirm')}
                </Text>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity 
                    style={[styles.modalButton, { flex: 1, backgroundColor: theme.components.button.secondary.bg }]} 
                    onPress={() => setIsConfirmingLogout(false)}
                  >
                    <Text style={[styles.modalButtonText, { color: theme.text.primary }]}>{t('back')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, { flex: 1, backgroundColor: theme.status.error }]} 
                    onPress={async () => { 
                      setProfileModalVisible(false);
                      await supabase.auth.signOut();
                      useAuthStore.getState().signOut();
                      router.replace('/login'); 
                    }}
                  >
                    <Text style={[styles.modalButtonText, { color: '#FFF' }]}>{t('logout')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerLogo: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.5 }],
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
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#A3E635',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.1)',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
  }
});
