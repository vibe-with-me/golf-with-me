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
 */
async function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (import.meta.env.PROD && typeof window === 'undefined') {
    try {
      const { env } = await import(/* @vite-ignore */ 'cloudflare:workers');
      const binding = (env as { API?: { fetch: typeof fetch } }).API;
      if (binding) return binding.fetch(input, init);
    } catch {
      // not running on Cloudflare — fall through to plain fetch
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
