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
  const [mode, setMode] = useState<'install' | 'open-safari'>('install');
  const slideAnim = React.useRef(new Animated.Value(450)).current;

  useEffect(() => {
    const checkPWAStatus = () => {
      if (Platform.OS !== 'web') return;

      const ua = navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/i.test(ua);
      const isStandalone = 
        (window.matchMedia('(display-mode: standalone)').matches) || 
        ((navigator as any).standalone === true);
      
      // Detect if it's the actual system Safari (not Chrome, not a WebView like WhatsApp/Instagram)
      // On iOS, Chrome identifies itself as 'crios'. 
      // In-app browsers (WebViews) often lack the word 'safari' or contain strings like 'fbios' or 'instagram'.
      const isSafari = /safari/i.test(ua) && !/crios/i.test(ua) && !/chromium/i.test(ua) && !/android/i.test(ua);
      const isInAppBrowser = isIOS && !isStandalone && (/fbios|instagram|fban|messenger|whatsapp|wv/i.test(ua) || !isSafari);

      if (isIOS && !isStandalone) {
        try {
          const lastSeenStr = localStorage.getItem(STORAGE_KEY);
          if (lastSeenStr) {
            const lastSeen = new Date(lastSeenStr);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - lastSeen.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < PROMPT_COOLDOWN_DAYS) return;
          }

          // Decide what message to show
          if (isInAppBrowser) {
            setMode('open-safari');
          } else {
            setMode('install');
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

    const timer = setTimeout(checkPWAStatus, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      Animated.timing(slideAnim, {
        toValue: 450,
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
        bottom: 24 + (insets.bottom || 0)
      }
    ]}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {mode === 'install' ? `📲 ${t('pwa.installTitle', 'Instalar Tenis-Lab')}` : `🌐 ${t('pwa.openSafariTitle', 'Abrir en Safari')}`}
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close-circle" size={26} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.description}>
          {mode === 'install' 
            ? t('pwa.installDescription', 'Para una mejor experiencia, instalá la app en tu iPhone:') 
            : t('pwa.openSafariDescription', 'Estás en un navegador limitado. Para instalar la app, primero debés abrir este link en Safari:')}
        </Text>

        <View style={styles.steps}>
          {mode === 'install' ? (
            <>
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
            </>
          ) : (
            <>
              <View style={styles.step}>
                <View style={styles.iconCircle}>
                  <Ionicons name="ellipsis-horizontal" size={18} color="#3B82F6" />
                </View>
                <Text style={styles.stepText}>
                  1. Toca los <Text style={styles.bold}>tres puntos</Text> o el icono de menú de esta app.
                </Text>
              </View>
              <View style={styles.step}>
                <View style={styles.iconCircle}>
                  <Ionicons name="compass-outline" size={18} color="#3B82F6" />
                </View>
                <Text style={styles.stepText}>
                  2. Seleccioná <Text style={styles.bold}>"Abrir en Safari"</Text> o el navegador del sistema.
                </Text>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity 
          style={[styles.button, mode === 'open-safari' && styles.buttonSecondary]} 
          onPress={handleClose} 
          activeOpacity={0.8}
        >
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
    zIndex: 10001,
  },
  card: {
    backgroundColor: '#1F2937',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 15,
    borderWidth: 1,
    borderColor: '#374151',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  closeButton: {
    padding: 2,
  },
  description: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  steps: {
    marginBottom: 24,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepText: {
    color: '#F3F4F6',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  bold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  buttonSecondary: {
    backgroundColor: '#4B5563',
    shadowColor: '#000',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
