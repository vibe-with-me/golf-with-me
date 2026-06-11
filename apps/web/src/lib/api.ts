import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { contract } from '@withme/contract';
import { getAccessToken } from './supabase.ts';

export type Api = ContractRouterClient<typeof contract>;

const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl) {
  throw new Error('VITE_API_URL is not set — copy apps/web/.env.example to .env');
}

/**
 * In production SSR on Cloudflare, route API calls through the service
 * binding: same-account worker-to-worker fetches over workers.dev URLs are
 * blocked by the platform. Browsers and local dev use plain fetch.
 *
 * The import is memoized; it resolves to null off-Cloudflare (plain-fetch
 * fallback for self-hosters). On Cloudflare with the binding MISSING we fail
 * fast instead — falling through would hit the platform block and surface as
 * an unrelated-looking fetch error on the resolver.
 */
let workersEnvPromise: Promise<Record<string, unknown> | null> | undefined;

function workersEnv(): Promise<Record<string, unknown> | null> {
  workersEnvPromise ??= import(/* @vite-ignore */ 'cloudflare:workers').then(
    (mod: { env: Record<string, unknown> }) => mod.env,
    () => null,
  );
  return workersEnvPromise;
}

async function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (import.meta.env.PROD && typeof window === 'undefined') {
    const env = await workersEnv();
    if (env) {
      const binding = env.API as { fetch: typeof fetch } | undefined;
      if (!binding) {
        throw new Error(
          'API service binding missing — check the "services" entry in apps/web/wrangler.jsonc',
        );
      }
      return binding.fetch(input, init);
    }
  }
  return fetch(input, init);
}

const link = new RPCLink({
  url: `${apiUrl}/rpc`,
  fetch: apiFetch,
  headers: async () => {
    const token = await getAccessToken();
    return token ? { authorization: `Bearer ${token}` } : {};
  },
});

/** The typed client for apps/api — the web app's only data path. */
export const api: Api = createORPCClient(link);
