import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Get Supabase credentials from expo constants or environment variables
const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';

export const supabaseAnonKey =
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

// Create client with defensive checks to prevent top-level evaluation crashes
let supabaseInstance;
try {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Initializing with empty credentials. Expected if .env is missing in build.');
  }
  
  // Basic validation to avoid createClient from throwing internally if URL is garbage or empty
  const isValidUrl = supabaseUrl && (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'));
  
  if (isValidUrl && supabaseAnonKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: ExpoSecureStoreAdapter as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  } else {
    console.error('[Supabase] Invalid configuration. URL or Key is missing/invalid.');
    // Create a dummy client or just leave it undefined to avoid crash
    // Most supabase calls will fail later, but the app will at least boot
    const mockAuth = {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithOAuth: async () => ({ data: { url: null }, error: new Error('Supabase no configurado (URL/Key faltante)') }),
      signInWithOtp: async () => ({ data: { user: null, session: null }, error: new Error('Supabase no configurado (URL/Key faltante)') }),
      verifyOtp: async () => ({ data: { user: null, session: null }, error: new Error('Supabase no configurado (URL/Key faltante)') }),
      setSession: async () => ({ data: { user: null, session: null }, error: new Error('Supabase no configurado (URL/Key faltante)') }),
      signOut: async () => ({ error: null }),
    };

    supabaseInstance = {
      auth: mockAuth,
      from: () => ({ 
        select: () => ({ 
          eq: () => ({ 
            single: async () => ({ data: null, error: new Error('Supabase no configurado') }) 
          }),
          order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) })
        }) 
      }),
      rpc: async () => ({ data: null, error: new Error('Supabase no configurado') }),
    } as any;
  }
} catch (err) {
  console.error('[Supabase] Critical error during client creation:', err);
  const mockAuth = {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithOAuth: async () => ({ data: { url: null }, error: err as Error }),
    signInWithOtp: async () => ({ data: { user: null, session: null }, error: err as Error }),
    verifyOtp: async () => ({ data: { user: null, session: null }, error: err as Error }),
    setSession: async () => ({ data: { user: null, session: null }, error: err as Error }),
    signOut: async () => ({ error: null }),
  };
  supabaseInstance = {
    auth: mockAuth,
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: err }) }) }) }),
  } as any;
}

export const supabase = supabaseInstance;

