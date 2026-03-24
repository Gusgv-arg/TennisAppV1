import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { ThemeProvider } from '../src/context/ThemeContext';
import { useTheme } from '../src/hooks/useTheme';
// import { useColorScheme } from '@/hooks/use-color-scheme'; // Replaced by useTheme
import Toast from 'react-native-toast-message';
import TermsAcceptanceModal from '../src/components/TermsAcceptanceModal';
import { toastConfig } from '../src/components/ToastConfig';
import { AcademyModal } from '../src/features/academy/components/AcademyModal';
import '../src/global.css';
import { useAuth } from '../src/hooks/useAuth';
import '../src/i18n';
import { supabase } from '../src/services/supabaseClient';
import { useAuthStore } from '../src/store/useAuthStore';
import { useVersionCheck } from '../src/hooks/useVersionCheck';
import { ForceUpdateScreen } from '../src/components/ForceUpdateScreen';

const queryClient = new QueryClient();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* we don't care if this fails sparingly */
});

function AppLayout() {
  const { isDark } = useTheme();
  // const colorScheme = useColorScheme(); // Replaced
  const { session, isLoading, profile, setProfile } = useAuthStore();
  const versionCheck = useVersionCheck();
  const segments = useSegments();
  const router = useRouter();
  const shouldSkipTabRedirect = React.useRef(false);
  const hasAttemptedAutoCreate = React.useRef(false);

  const [isConfiguring, setIsConfiguring] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showCreateAcademyModal, setShowCreateAcademyModal] = useState(false);

  // Initialize auth listener
  useAuth();

  useEffect(() => {
    console.log('[RootLayout] Effect triggered', {
      isLoading,
      isConfiguring,
      hasSession: !!session,
      hasProfile: !!profile,
      academyId: profile?.current_academy_id
    });

    if (isLoading || isConfiguring) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const isResetPassword = (segments as string[]).includes('reset-password');
    const isForgotPassword = (segments as string[]).includes('forgot-password');
    const isInvite = segments[0] === 'invite';

    const isVideoShare = segments[0] === 'v';
    const isRoot = (segments as string[]).length === 0;

    // Not logged in - redirect to login
    if (!session && !inAuthGroup && !isResetPassword && !isForgotPassword && !isInvite && !isVideoShare) {
      console.log('[RootLayout] Redirecting to login');
      router.replace('/login');
      return;
    }

    // Logged in
    if (session) {
      const isPlayer = profile?.role === 'player';
      const inPlayerTabs = segments[0] === '(player-tabs)';
      const isLegalPage = segments[0] === 'profile' && (segments[1] === 'terms' || segments[1] === 'privacy');
      const isVideoShare = segments[0] === 'v';

      if (isPlayer) {
        // Redirección para Alumnos
        if ((inAuthGroup || inOnboarding || isRoot || segments[0] === '(tabs)') && !inPlayerTabs) {
          if (!shouldSkipTabRedirect.current) {
            console.log('[RootLayout] Player login -> Redirect to (player-tabs)');
            router.replace('/(player-tabs)' as any);
          }
        }
      } else if (profile) {
        // Lógica para Coaches (Academia)
        if (!profile.current_academy_id) {
          const hasInviteToken = session?.user?.user_metadata?.invite_token;
          const inWelcome = segments[0] === 'onboarding' && segments[1] === 'welcome';
          if ((!inOnboarding || inWelcome) && !isInvite && !hasInviteToken && !showCreateAcademyModal) {
            if (profile.terms_accepted_at && !hasAttemptedAutoCreate.current) {
              handleAutoCreateAcademy();
            }
          }
        } else {
          const inWelcome = segments[0] === 'onboarding' && segments[1] === 'welcome';
          if ((inAuthGroup || inOnboarding || isRoot || inPlayerTabs) && !inWelcome) {
            if (!shouldSkipTabRedirect.current) {
              console.log('[RootLayout] Coach login detected in inappropriate tab -> Redirect to (tabs)');
              router.replace('/(tabs)');
            }
          }
        }
      }

      // Lógica de Términos (Unificada)
      // No mostrar en páginas legales o compartiendo video
      const needsTerms = profile && !profile.terms_accepted_at && !isLegalPage && !isVideoShare;
      if (needsTerms) {
        setShowTermsModal(true);
      } else {
        setShowTermsModal(false);
      }
    }
  }, [session, isLoading, segments, profile, isConfiguring, showCreateAcademyModal]);

  // Hide splash screen when initial loading is done
  useEffect(() => {
    if (!isLoading && !versionCheck.isChecking && !isConfiguring) {
      SplashScreen.hideAsync().catch(() => {
        /* fail silently */
      });
    }
  }, [isLoading, versionCheck.isChecking, isConfiguring]);

  const handleTermsAccepted = () => {
    setShowTermsModal(false);
    // Refresh profile to get the updated timestamp
    if (session?.user?.id) {
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => {
          if (data) {
            setProfile(data);
            // We DO NOT redirect here anymore. 
            // The useEffect will detect 'terms_accepted' and trigger 'handleAutoCreateAcademy'.
            // 'handleAutoCreateAcademy' will handle the redirect to 'welcome' after creation.
          }
        });
    }
  };

  const handleAutoCreateAcademy = async () => {
    if (!profile || isConfiguring) return;

    // Check if we are already in the welcome flow to avoid interference
    // We ALLOW creation to happen in background (showing loading screen)
    // const inWelcome = segments[0] === 'onboarding' && segments[1] === 'welcome';
    // if (inWelcome) return;

    try {
      setIsConfiguring(true);
      hasAttemptedAutoCreate.current = true;
      shouldSkipTabRedirect.current = true; // Prevent useEffect from hijacking navigation
      const startTime = Date.now();
      console.log('Detected user without academy. Auto-creating...');

      // Default name: "Academia de [Nombre]"
      const academyName = `Academia de ${profile.full_name || 'Tenis'}`;
      const slug = academyName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);

      const { data, error } = await supabase.rpc('create_academy_with_owner', {
        p_name: academyName,
        p_slug: slug,
        p_logo_url: null
      });

      if (error) throw error;

      console.log('Academy auto-created:', data);

      // Refresh profile to get the new current_academy_id
      const { data: newProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single();

      if (newProfile) {
        // Artificial delay to show the celebratory message for at least 4 seconds
        const elapsed = Date.now() - startTime;
        if (elapsed < 4000) {
          await new Promise(resolve => setTimeout(resolve, 4000 - elapsed));
        }

        // 1. Update Profile (this will trigger useEffect, but we must blocking it from redirecting to tabs)
        setProfile(newProfile);

        // 2. Force navigation to Dashboard (Must be done BEFORE setIsConfiguring(false) so user doesn't see flash)
        console.log('[RootLayout] Academy Created -> Redirecting to Dashboard');
        router.replace('/(tabs)');

        // 3. Hide loading screen (remounts Stack showing Welcome)
        // We use a small timeout to ensure transition completes behind the loader
        setTimeout(() => {
          setIsConfiguring(false);
        }, 500);
      }

    } catch (err) {
      console.error('Error auto-creating academy:', err);
      // Fallback: if auto-creation fails, show modal for manual creation
      setShowCreateAcademyModal(true);
    } finally {
      setIsConfiguring(false);
    }
  };

  if (versionCheck.needsForceUpdate) {
    return (
      <ForceUpdateScreen 
        downloadUrl={versionCheck.downloadUrl}
        releaseNotes={versionCheck.releaseNotes}
        latestVersion={versionCheck.latestVersion}
      />
    );
  }

  if (isLoading || isConfiguring || versionCheck.isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#1a1a1a' : '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        {isConfiguring && (
          <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
            <Text style={{ marginTop: 24, fontSize: 20, fontWeight: 'bold', color: isDark ? '#fff' : '#1a1a1a', textAlign: 'center' }}>
              Estamos creando tu academia... 🎾
            </Text>

          </View>
        )}
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(player-tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="invite" options={{ headerShown: false }} />
          <Stack.Screen name="team" options={{ title: 'Equipo', headerShown: true }} />
          <Stack.Screen name="plans" options={{ headerShown: false }} />
          <Stack.Screen name="locations" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen
            name="calendar/[id]"
            options={{
              headerShown: false,
              presentation: 'transparentModal',
              animation: 'fade',
              contentStyle: { backgroundColor: 'transparent' }
            }}
          />
          <Stack.Screen
            name="calendar/new"
            options={{
              headerShown: false,
              presentation: 'transparentModal',
              animation: 'fade',
              contentStyle: { backgroundColor: 'transparent' }
            }}
          />
          <Stack.Screen
            name="calendar/bulk"
            options={{
              headerShown: false,
              presentation: 'transparentModal',
              animation: 'fade',
              contentStyle: { backgroundColor: 'transparent' }
            }}
          />
          <Stack.Screen name="academy" options={{ headerShown: false }} />
          <Stack.Screen name="record-video" options={{ title: 'Grabar Video', headerShown: true }} />
          <Stack.Screen name="v/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style={isDark ? "light" : "dark"} />
        <TermsAcceptanceModal
          visible={showTermsModal}
          userId={session?.user?.id || ''}
          onAccept={handleTermsAccepted}
        />
        <AcademyModal
          visible={showCreateAcademyModal}
          academy={null}
          onClose={() => setShowCreateAcademyModal(false)}
          onCreateSuccess={async () => {
            setShowCreateAcademyModal(false);
            // Refresh profile to pick up the new academy
            if (session?.user?.id) {
              const { data: newProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              if (newProfile) {
                setProfile(newProfile);
              }
            }
            router.replace('/(tabs)');
          }}
        />
      </NavigationThemeProvider>
    </QueryClientProvider >
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppLayout />
      <Toast config={toastConfig} topOffset={60} />
    </ThemeProvider>
  );
}

/**
 * ErrorBoundary — Catches runtime errors on native (crashes during navigation,
 * undefined params, rendering errors, etc.) and shows a recovery UI.
 * This is the native equivalent of +not-found.tsx (which only works on web).
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={errorStyles.container}>
      <View style={errorStyles.card}>
        <Text style={errorStyles.icon}>⚠️</Text>
        <Text style={errorStyles.title}>Algo salió mal</Text>
        <Text style={errorStyles.message}>
          Ocurrió un error inesperado. Podés volver a intentarlo o ir al inicio.
        </Text>
        <View style={errorStyles.debugBox}>
          <Text style={errorStyles.debugText}>{error.message}</Text>
        </View>
        <Text style={errorStyles.retryButton} onPress={retry}>
          🔄 Reintentar
        </Text>
      </View>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  debugBox: {
    backgroundColor: '#fff3f3',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  debugText: {
    fontSize: 12,
    color: '#cc0000',
    fontFamily: 'monospace',
  },
  retryButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    padding: 12,
  },
});
