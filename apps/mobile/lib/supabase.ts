import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set — copy apps/mobile/.env.example to .env',
  );
}

// Tokens live in the device keychain/keystore, never in plain storage, and
// never migrate to another device via backups.
const secureStorage = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: async (k: string, value: string) => {
    await SecureStore.setItemAsync(k, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  removeItem: async (k: string) => {
    await SecureStore.deleteItemAsync(k);
  },
};

export const supabase: SupabaseClient = createClient(url, key, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// Refresh tokens while the app is foregrounded; stop when backgrounded so a
// stale timer can't fire mid-suspend. processLock serializes the refreshes.
supabase.auth.startAutoRefresh();
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
