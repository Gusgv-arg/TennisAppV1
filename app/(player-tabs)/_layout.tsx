import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/hooks/useTheme';
import { HapticTab } from '@/components/haptic-tab';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, StyleSheet, View, Text, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/src/store/useAuthStore';
import { typography } from '@/src/design/tokens/typography';
import { Avatar } from '@/src/design/components/Avatar';

export default function PlayerTabLayout() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { signOut, profile } = useAuthStore();
  const router = useRouter();

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const CustomHeader = ({ title, icon }: { title: string, icon: any }) => (
    <View style={[styles.header, { backgroundColor: theme.background.surface, borderBottomColor: theme.border.subtle }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.components.button.primary.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 }}>
          <Ionicons name="tennisball" size={14} color="#FFF" />
          <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 11, letterSpacing: 0.5 }}>Tenis-Lab</Text>
        </View>
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
