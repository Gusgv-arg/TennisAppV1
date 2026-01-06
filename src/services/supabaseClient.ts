import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Get Supabase credentials from expo constants or environment variables
const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';

const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials! Check your .env file or app.config.js');
}


// Custom storage for Expo SecureStore with Web/SSR fallback
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web' || typeof window === 'undefined') {
      return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    }
    // Only call SecureStore if it's available and we're on native
    return SecureStore.getItemAsync ? SecureStore.getItemAsync(key) : null;
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web' || typeof window === 'undefined') {
      if (typeof window !== 'undefined') localStorage.setItem(key, value);
    } else if (SecureStore.setItemAsync) {
      SecureStore.setItemAsync(key, value);
    }
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web' || typeof window === 'undefined') {
      if (typeof window !== 'undefined') localStorage.removeItem(key);
    } else if (SecureStore.deleteItemAsync) {
      SecureStore.deleteItemAsync(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

