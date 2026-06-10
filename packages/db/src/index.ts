import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/supabase.ts';

/**
 * The fixed default tenant for V1 single-tenant deployments.
 * Every table carries tenant_id with this value as its default — a dormant
 * seam so a future config layer can bolt on multi-tenancy without migration
 * pain. V1 never varies it and builds no tenant management around it.
 */
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export type Db = SupabaseClient<Database>;
export type { Database } from './types/supabase.ts';
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export interface CreateDbClientOptions {
  url: string;
  /** Publishable (anon) key. The API never holds the service-role key. */
  key: string;
  /**
   * Verified Supabase JWT from the request's Authorization header.
   * When set, every query runs under that user's RLS identity — the API
   * never bypasses row-level security for authed requests.
   */
  accessToken?: string;
}

export function createDbClient(opts: CreateDbClientOptions): Db {
  return createClient<Database>(opts.url, opts.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: opts.accessToken
      ? { headers: { Authorization: `Bearer ${opts.accessToken}` } }
      : undefined,
  });
}
