import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Browser Supabase client — auth only. The web app performs no data access;
 * everything goes through apps/api via the typed contract client.
 */
export function getSupabase(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set — copy apps/web/.env.example to .env',
    );
  }
  // PKCE with an explicit exchange in /auth/callback (no auto-detection).
  client ??= createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: false } });
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getSessionUserId(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}
