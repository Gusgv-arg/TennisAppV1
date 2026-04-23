import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STORAGE_KEY = 'pwa_install_prompt_last_seen';
const PROMPT_COOLDOWN_DAYS = 7;

export const PWAInstallPrompt = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(400)).current;

  useEffect(() => {
    const checkPWAStatus = () => {
      if (Platform.OS !== 'web') return;

      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const isStandalone = 
        (window.matchMedia('(display-mode: standalone)').matches) || 
        ((navigator as any).standalone === true);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

      if (isIOS && isSafari && !isStandalone) {
        try {
          const lastSeenStr = localStorage.getItem(STORAGE_KEY);
          if (lastSeenStr) {
            const lastSeen = new Date(lastSeenStr);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - lastSeen.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < PROMPT_COOLDOWN_DAYS) return;
          }

          setVisible(true);
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: false,
            tension: 20,
            friction: 8
          }).start();
        } catch (e) {
          console.warn('[PWA] Error checking localStorage:', e);
        }
      }
    };

    // Small delay to let the app load smoothly
    const timer = setTimeout(checkPWAStatus, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 300,
        useNativeDriver: false
      }).start(() => setVisible(false));
    } catch (e) {
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <Animated.View style={[
      styles.container, 
      { 
        transform: [{ translateY: slideAnim }],
        bottom: 24 + (insets.bottom || 0) // Dynamic offset for iOS Home Indicator
      }
    ]}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>📲 {t('pwa.installTitle', 'Instalar Tenis-Lab')}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close-circle" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.description}>
          {t('pwa.installDescription', 'Para una experiencia más rápida y pantalla completa, instalá la app en tu iPhone:')}
        </Text>

        <View style={styles.steps}>
          <View style={styles.step}>
            <View style={styles.iconCircle}>
              <Ionicons name="share-outline" size={18} color="#3B82F6" />
            </View>
            <Text style={styles.stepText}>
              1. Toca el botón <Text style={styles.bold}>"Compartir"</Text> en la barra inferior.
            </Text>
          </View>
          
          <View style={styles.step}>
            <View style={styles.iconCircle}>
              <Ionicons name="add-outline" size={18} color="#3B82F6" />
            </View>
            <Text style={styles.stepText}>
              2. Busca y elegí <Text style={styles.bold}>"Añadir a pantalla de inicio"</Text>.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleClose} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{t('common.understood', 'Entendido')}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10001, // Above everything
  },
  card: {
    backgroundColor: '#1F2937', // Match neutral-800
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#374151', // Match neutral-700
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 2,
  },
  description: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  steps: {
    marginBottom: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepText: {
    color: '#F3F4F6',
    fontSize: 14,
    flex: 1,
  },
  bold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#3B82F6', // Primary Blue
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
