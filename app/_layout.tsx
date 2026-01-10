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
  const { session, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize auth listener
  useAuth();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isResetPassword = (segments as string[]).includes('reset-password');
    const isForgotPassword = (segments as string[]).includes('forgot-password');

    const isRoot = (segments as string[]).length === 0;

    if (!session && !inAuthGroup && !isResetPassword && !isForgotPassword) {
      // Redirect to login if not logged in and not on an auth-related page
      router.replace('/login');
    } else if (session && (inAuthGroup || isRoot) && !isResetPassword) {
      // Redirect to tabs if logged in and on login/register or root path
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments]);

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
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
