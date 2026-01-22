import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import '../src/global.css';
import { useAuth } from '../src/hooks/useAuth';
import '../src/i18n';
import { supabase } from '../src/services/supabaseClient';
import { useAuthStore } from '../src/store/useAuthStore';

const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { session, isLoading, profile, setProfile } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  const [isConfiguring, setIsConfiguring] = useState(false);

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

    const isRoot = (segments as string[]).length === 0;

    // Not logged in - redirect to login
    if (!session && !inAuthGroup && !isResetPassword && !isForgotPassword && !isInvite) {
      console.log('[RootLayout] Redirecting to login');
      router.replace('/login');
      return;
    }

    // Logged in
    // Logged in
    if (session) {
      // Check academy status for ALL logged in users, regardless of where they are
      // This ensures that if they somehow get to (tabs) without an academy, we catch them
      if (profile) {
        if (!profile.current_academy_id) {
          // EXCEPTION: Don't redirect/auto-create if they are already in the process of creating
          // (onboarding) or accepting an invite
          if (!inOnboarding && !isInvite) {
            console.log('[RootLayout] No academy detected (Global Check) -> Handle Auto Create');
            handleAutoCreateAcademy();
          }
        } else {
          // Has academy
          // If they are in auth/onboarding/root, send them to tabs
          if (inAuthGroup || inOnboarding || isRoot) {
            console.log('[RootLayout] Has academy & in restricted zone -> Redirect to (tabs)');
            router.replace('/(tabs)');
          }
        }
      }
    }
  }, [session, isLoading, segments, profile, isConfiguring]);

  const handleAutoCreateAcademy = async () => {
    if (!profile || isConfiguring) return;

    try {
      setIsConfiguring(true);
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
        // Artificial delay to show the celebratory message for at least 2 seconds
        const elapsed = Date.now() - startTime;
        if (elapsed < 2000) {
          await new Promise(resolve => setTimeout(resolve, 2000 - elapsed));
        }

        setProfile(newProfile);
        // The useEffect will pick up the new profile state and redirect to (tabs)
      }

    } catch (err) {
      console.error('Error auto-creating academy:', err);
      // Fallback: if auto-creation fails, send to manual creation
      router.replace('/onboarding/create-academy');
    } finally {
      setIsConfiguring(false);
    }
  };

  if (isLoading || isConfiguring) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        {isConfiguring && (
          <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
            <Text style={{ marginTop: 24, fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center' }}>
              ¡Creando tu Academia! 🎾
            </Text>
            <Text style={{ marginTop: 8, fontSize: 16, color: '#666', textAlign: 'center' }}>
              Todo listo para empezar...
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="invite" options={{ headerShown: false }} />
          <Stack.Screen name="team" options={{ title: 'Equipo', headerShown: true }} />
          <Stack.Screen name="plans" options={{ headerShown: false }} />
          <Stack.Screen name="locations" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

