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

const link = new RPCLink({
  url: `${apiUrl}/rpc`,
  headers: async () => {
    const token = await getAccessToken();
    return token ? { authorization: `Bearer ${token}` } : {};
  },
});

/** The typed client for apps/api — the web app's only data path. */
export const api: Api = createORPCClient(link);
