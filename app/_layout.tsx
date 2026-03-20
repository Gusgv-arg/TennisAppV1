import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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

const queryClient = new QueryClient();

function AppLayout() {
  const { isDark } = useTheme();
  // const colorScheme = useColorScheme(); // Replaced
  const { session, isLoading, profile, setProfile } = useAuthStore();
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
      if (profile?.role === 'player') {
         const inPlayerTabs = segments[0] === '(player-tabs)';
         const isProfileLegal = segments[0] === 'profile' && (segments[1] === 'terms' || segments[1] === 'privacy');
         
         // Si está en auth, root o tabs de coach, lo mandamos a sus tabs
         if ((inAuthGroup || inOnboarding || isRoot || segments[0] === '(tabs)') && !inPlayerTabs) {
            if (!shouldSkipTabRedirect.current) {
              console.log('[RootLayout] Player login -> Redirect to (player-tabs)');
              router.replace('/(player-tabs)' as any);
            }
         }

         if (!profile.terms_accepted_at && !isProfileLegal) {
           setShowTermsModal(true);
         } else {
           setShowTermsModal(false);
         }
         return; // Los players no administran academias
      }

      // Check academy status for ALL logged in users, regardless of where they are
      // This ensures that if they somehow get to (tabs) without an academy, we catch them
      if (profile) {
        if (!profile.current_academy_id) {
          // EXCEPTION: Don't redirect/auto-create if they are already in the process of creating
          // (onboarding) or accepting an invite. Also skip if they have an invite_token in metadata
          // (meaning they just signed up via invite and we should wait for that flow to complete)
          // EXCEPTION TO EXCEPTION: If we are in 'welcome', we DO want to auto-create
          const hasInviteToken = session?.user?.user_metadata?.invite_token;
          const inWelcome = segments[0] === 'onboarding' && segments[1] === 'welcome';

          if ((!inOnboarding || inWelcome) && !isInvite && !hasInviteToken && !showCreateAcademyModal) {
            // STRICT ORDER: Only create academy if terms are accepted
            if (profile.terms_accepted_at && !hasAttemptedAutoCreate.current) {
              console.log('[RootLayout] No academy detected & Terms Accepted -> Handle Auto Create');
              handleAutoCreateAcademy();
            }
          }
        } else {
          // Has academy
          // If they are in auth/onboarding/root, send them to tabs
          // EXCEPTION: Stay in 'welcome' screen to show the festive onboarding
          const inWelcome = segments[0] === 'onboarding' && segments[1] === 'welcome';

          // If we are actively navigating to welcome (e.g. just created academy), don't redirect to tabs
          // We can't easily check 'future' navigation, but we can rely on the fact that if we are NOT in welcome, 
          // we usually redirect. 
          // BUT, if we just finished auto-creation, we want to go to Welcome.
          // Let's add a condition: If the profile has an academy, we generally redirect to tabs.
          // Unless... we are in the specific moment of onboarding transition.
          // If I simply rely on the 'handleAutoCreateAcademy' doing the redirect, 
          // I need to stop this specific block from firing for that split second.

          if ((inAuthGroup || inOnboarding || isRoot) && !inWelcome) {
            // Block redirect if we are currently handling auto-creation success (which handles its own redirect)
            // We can check if `isConfiguring` was true? no.
            // We'll use a session property or just let the race happen but prioritize Welcome?
            // No, let's use a Ref for 'isNavigatingToWelcome'
            if (!shouldSkipTabRedirect.current) {
              console.log('[RootLayout] Has academy & in restricted zone -> Redirect to (tabs)');
              router.replace('/(tabs)');
            }
          }
        }
      }

      // Check for Terms and Conditions Acceptance
      // Don't show modal if user is strictly viewing the legal documents
      const isProfile = segments[0] === 'profile';
      const isLegalPage = isProfile && (segments[1] === 'terms' || segments[1] === 'privacy');

      if (profile && !profile.terms_accepted_at && !isLegalPage) {
        setShowTermsModal(true);
      } else {
        setShowTermsModal(false);
      }
    }
  }, [session, isLoading, segments, profile, isConfiguring, showCreateAcademyModal]);

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

        // 2. Force navigation to Welcome (Must be done BEFORE setIsConfiguring(false) so user doesn't see flash)
        console.log('[RootLayout] Academy Created -> Redirecting to Welcome');
        router.replace('/onboarding/welcome');

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

  if (isLoading || isConfiguring) {
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
