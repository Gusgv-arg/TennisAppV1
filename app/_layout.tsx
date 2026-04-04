import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
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
import { Button } from '../src/design';

const queryClient = new QueryClient();

function AppLayout() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  // const colorScheme = useColorScheme(); // Replaced
  const { session, isLoading, profile, setProfile, pendingInviteToken, setPendingInviteToken, initializeToken } = useAuthStore();
  const versionCheck = useVersionCheck();
  const segments = useSegments();
  const router = useRouter();
  const shouldSkipTabRedirect = React.useRef(false);
  const hasAttemptedAutoCreate = React.useRef(false);

  const [isConfiguring, setIsConfiguring] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showCreateAcademyModal, setShowCreateAcademyModal] = useState(false);

  // Initialize store and auth listener
  useEffect(() => {
    initializeToken().catch(console.error);
  }, []);

  useAuth();

  // "Claim" invitation token from route or raw URL if present
  useEffect(() => {
    let detectedToken: string | null = null;

    // 1. Try to capture from raw URL (most reliable for real values)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const path = window.location.pathname;
      const inviteMatch = path.match(/\/invite\/([^/?#]+)/);
      if (inviteMatch && inviteMatch[1] && inviteMatch[1] !== '[token]') {
        detectedToken = inviteMatch[1];
      }
    }

    // 2. Fallback to segments if not found yet
    if (!detectedToken && segments[0] === 'invite' && segments[1]) {
      const segmentToken = segments[1] as string;
      if (segmentToken && segmentToken !== '[token]') {
        detectedToken = segmentToken;
      }
    }

    // 3. Update store only if we have a REAL new token
    if (detectedToken && detectedToken !== pendingInviteToken) {
      console.log('[RootLayout] Unified capture: Saving invitation token:', detectedToken);
      setPendingInviteToken(detectedToken);
    }
  }, [segments, pendingInviteToken]);

  // Handle incoming deep links (e.g. from Google OAuth)
  useEffect(() => {
    const handleUrl = (url: string) => {
      // Only process URLs with auth tokens; ignore plain navigation URLs
      if (!url || (!url.includes('google-auth') && !url.includes('access_token='))) return;

      console.log('[AppLayout] Deep link with auth tokens received');

      // On web, Supabase JS auto-detects tokens from the URL hash.
      // Calling setSession manually would trigger a duplicate SIGNED_IN event.
      if (Platform.OS === 'web') return;

      const parsed = Linking.parse(url);
      if (!parsed) return;
      
      const qp = parsed.queryParams || {};
      const access_token = (qp.access_token || url.match(/access_token=([^&#]+)/)?.[1]) as string | undefined;
      const refresh_token = (qp.refresh_token || url.match(/refresh_token=([^&#]+)/)?.[1]) as string | undefined;

      if (access_token && refresh_token) {
        console.log('[AppLayout] Tokens found in deep link, setting session...');
        supabase.auth.setSession({ access_token, refresh_token }).catch((err: any) => {
          console.error('[AppLayout] Error setting session from deep link:', err);
        });
      }
    };

    // Subscribe to events while the app is open
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    // Check if the app was opened by a link (boot/restart)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const isResetPassword = (segments as string[]).includes('reset-password');
    const isForgotPassword = (segments as string[]).includes('forgot-password');
    const isInviteRoute = segments[0] === 'invite';
    const hasInviteMetadata = session?.user?.user_metadata?.invite_token || session?.user?.user_metadata?.inviteId;
    
    // REINFORCED GUARD: Check for route, metadata, or persistent pending token
    const isActuallyInvite = isInviteRoute || hasInviteMetadata || !!pendingInviteToken;

    console.log('[RootLayout] IRON DOME Checking Shield:', {
      isActuallyInvite,
      isInviteRoute,
      pendingToken: !!pendingInviteToken,
      hasMetadata: !!hasInviteMetadata,
      isLoading,
      isConfiguring,
      currentSegment: segments[0],
      profileRole: profile?.role,
      hasAcademy: !!profile?.current_academy_id
    });

    // ABSOLUTE GUARD: If we are in an invitation flow, DO NOT proceed with any logic
    if (isActuallyInvite) {
      console.log('[RootLayout] IRON DOME PROTECTED - Invitation detected. Blocking all global actions.');
      setShowTermsModal(false); // Force hide terms
      return;
    }

    if (isLoading || isConfiguring) return;

    const isVideoShare = segments[0] === 'v';
    const isRoot = (segments as string[]).length === 0;
    const isLegalPage = segments[0] === 'profile' && (segments[1] === 'terms' || segments[1] === 'privacy');

    // Not logged in - redirect to login
    if (!session && !inAuthGroup && !isResetPassword && !isForgotPassword && !isInviteRoute && !isVideoShare && !isLegalPage) {
      console.log('[RootLayout] Redirecting to login - Unauthenticated access attempt');
      router.replace('/login');
      return;
    }

    // Logged in
    if (session) {
      const isPlayer = profile?.role === 'player';
      const inPlayerTabs = segments[0] === '(player-tabs)';

      if (isPlayer) {
        // Redirección para Alumnos
        if ((inAuthGroup || inOnboarding || isRoot || segments[0] === '(tabs)') && !inPlayerTabs) {
          if (!shouldSkipTabRedirect.current) {
            console.log('[RootLayout] IRON DOME ACTION -> Player detected. Redirecting to (player-tabs)');
            router.replace('/(player-tabs)' as any);
          }
        }
      } else if (profile) {
        // Lógica para Coaches (Academia)
        if (!profile.current_academy_id) {
          const inWelcome = segments[0] === 'onboarding' && segments[1] === 'welcome';
          
          if ((!inOnboarding || inWelcome) && !isActuallyInvite && !showCreateAcademyModal) {
            if (profile.terms_accepted_at && !hasAttemptedAutoCreate.current) {
              console.log('[RootLayout] No academy, no invitation -> Auto-Onboarding Coach');
              handleAutoCreateAcademy();
            }
          }
        } else {
          const inWelcome = segments[0] === 'onboarding' && segments[1] === 'welcome';
          if ((inAuthGroup || inOnboarding || isRoot || inPlayerTabs) && !inWelcome && !isInviteRoute) {
            if (!shouldSkipTabRedirect.current) {
              console.log('[RootLayout] IRON DOME ACTION -> Coach detected in inappropriate tab. Redirecting to (tabs)');
              router.replace('/(tabs)');
            }
          }
        }
      }
    }
  }, [session, isLoading, segments, profile, isConfiguring, showCreateAcademyModal]);

  // Hide splash screen when initial loading is done
  useEffect(() => {
    if (!isLoading && !versionCheck.isChecking && !isConfiguring) {
      console.log('[AppLayout] Ready to hide splash.');
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, versionCheck.isChecking, isConfiguring]);

  const handleTermsAccepted = () => {
    setShowTermsModal(false);
    // Refresh profile to get the updated timestamp
    if (session?.user?.id) {
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }: { data: any }) => {
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
    // DOUBLE GUARD: Never auto-create academy if user is accepting an invitation
    const hasInviteMetadata = session?.user?.user_metadata?.invite_token || session?.user?.user_metadata?.inviteId;
    const isInviteRoute = segments[0] === 'invite';
    
    if (isInviteRoute || hasInviteMetadata) {
      console.log('[RootLayout] ABORTING Academy creation - Invitation flow detected via Route/Metadata');
      return;
    }

    if (!profile || isConfiguring) return;

    // Check if we are already in the welcome flow to avoid interference
    // We ALLOW creation to happen in background (showing loading screen)
    // const inWelcome = segments[0] === 'onboarding' && segments[1] === 'welcome';
    // if (inWelcome) return;

    try {
      setIsConfiguring(true);
      
      // Safety timeout for Academy Creation (10s)
      const creationTimeout = setTimeout(() => {
        if (isConfiguring) {
          console.warn('[Academy] Auto-creation timed out. Proceeding...');
          setIsConfiguring(false);
          setShowCreateAcademyModal(true); // Fallback to manual
        }
      }, 10000);

      hasAttemptedAutoCreate.current = true;
      shouldSkipTabRedirect.current = true; // Prevent useEffect from hijacking navigation
      const startTime = Date.now();
      console.log('Detected user without academy. Auto-creating...');

      // Default name: "Academia de [Nombre]"
      const academyName = t('system.academyNameFormat', { name: profile.full_name || 'Tenis' });
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
      // Clear safety timeout if we finished naturally
      // But we can't easily clear the timeout from here if we don't store its ID
      // So we use the flag in the timeout itself
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

  const [loaderTime, setLoaderTime] = useState(0);

  useEffect(() => {
    if (isLoading || isConfiguring || versionCheck.isChecking) {
      const interval = setInterval(() => setLoaderTime(prev => prev + 1), 1000);
      return () => clearInterval(interval);
    } else {
      setLoaderTime(0);
    }
  }, [isLoading, isConfiguring, versionCheck.isChecking]);

  if (isLoading || isConfiguring || versionCheck.isChecking) {
    const isStuck = loaderTime > 15;
    const currentStep = versionCheck.isChecking ? t('system.verifyingVersion') : 
                       isLoading ? t('system.loadingSession') : 
                       isConfiguring ? t('system.configuringAcademy') : t('system.starting');

    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#1a1a1a' : '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <View style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={{ color: isDark ? '#fff' : '#1a1a1a', fontSize: 16 }}>{currentStep}</Text>
          {loaderTime > 3 && (
            <Text style={{ color: isDark ? '#666' : '#999', fontSize: 12, marginTop: 8 }}>
              {t('system.elapsedTime', { seconds: loaderTime })}
            </Text>
          )}
          
          {isStuck && (
            <View style={{ marginTop: 30, paddingHorizontal: 40 }}>
              <Text style={{ color: '#ff4444', textAlign: 'center', marginBottom: 20 }}>
                {t('system.stuckMessage')}
              </Text>
              <Button 
                label={t('system.retryButton')} 
                onPress={() => {
                  setIsConfiguring(false); // Force break the lock
                  // Note: versionCheck and isLoading are hooks, we can't easily force them here
                  // but at least this might unblock academy creation hang
                }}
              />
            </View>
          )}
        </View>
        {isConfiguring && (
          <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
            <Text style={{ marginTop: 24, fontSize: 18, fontWeight: 'bold', color: isDark ? '#fff' : '#1a1a1a', textAlign: 'center' }}>
              {t('system.creatingAcademy')}
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

// 1. Prevent auto-hide immediately at the module level
// This runs as soon as the JS bundle is parsed, even before any component renders.
SplashScreen.preventAutoHideAsync().catch(() => { });

// 2. Global Safety Timeout (10s)
// If for ANY reason (JS error, missing assets, etc) the app fails to reach 
// the component-level hideAsync, we force it here to avoid a permanent hang on the logo.
setTimeout(() => {
  console.warn('[Global] STARTUP SAFETY TIMEOUT. Forcing splash hide.');
  SplashScreen.hideAsync().catch(() => { });
}, 10000);

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppLayoutWrapper />
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]} pointerEvents="box-none">
          <Toast config={toastConfig} topOffset={60} />
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppLayoutWrapper() {
  const { isDark } = useTheme();
  const { isLoading } = useAuthStore();
  const versionCheck = useVersionCheck();

  // Component-level hide (if everything loads fast)
  useEffect(() => {
    if (!isLoading && !versionCheck.isChecking) {
      console.log('[RootLayout] All checks complete. Hiding splash via AppLayoutWrapper.');
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, versionCheck.isChecking]);

  return <AppLayout />;
}

/**
 * ErrorBoundary — Catches runtime errors on native (crashes during navigation,
 * undefined params, rendering errors, etc.) and shows a recovery UI.
 * This is the native equivalent of +not-found.tsx (which only works on web).
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  return (
    <View style={errorStyles.container}>
      <View style={errorStyles.card}>
        <Text style={errorStyles.icon}>⚠️</Text>
        <Text style={errorStyles.title}>{t('system.errorTitle')}</Text>
        <Text style={errorStyles.message}>
          {t('system.errorMessage')}
        </Text>
        <View style={errorStyles.debugBox}>
          <Text style={errorStyles.debugText}>{error.message}</Text>
        </View>
        <Text style={errorStyles.retryButton} onPress={retry}>
          🔄 {t('system.retry')}
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
