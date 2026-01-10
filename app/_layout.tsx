import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import '../src/global.css';
import { useAuth } from '../src/hooks/useAuth';
import '../src/i18n';
import { useAuthStore } from '../src/store/useAuthStore';

const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { session, isLoading, profile } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize auth listener
  useAuth();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const isResetPassword = (segments as string[]).includes('reset-password');
    const isForgotPassword = (segments as string[]).includes('forgot-password');
    const isInvite = segments[0] === 'invite';

    const isRoot = (segments as string[]).length === 0;

    // Not logged in - redirect to login
    if (!session && !inAuthGroup && !isResetPassword && !isForgotPassword && !isInvite) {
      router.replace('/login');
      return;
    }

    // Logged in
    if (session) {
      // On auth pages or root - check academy status
      if (inAuthGroup || isRoot) {
        // Check if user has an academy
        if (profile && !profile.current_academy_id) {
          // No academy - redirect to onboarding
          router.replace('/onboarding/create-academy');
        } else if (profile?.current_academy_id) {
          // Has academy - go to main app
          router.replace('/(tabs)');
        }
        // If profile not loaded yet, we wait
      }

      // Already in onboarding - stay there unless they have an academy now
      if (inOnboarding && profile?.current_academy_id) {
        router.replace('/(tabs)');
      }
    }
  }, [session, isLoading, segments, profile]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
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
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

