import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { contract } from '@withme/contract';
import { getAccessToken } from './supabase.ts';

export type Api = ContractRouterClient<typeof contract>;

const link = new RPCLink({
  url: `${import.meta.env.VITE_API_URL}/rpc`,
  headers: async () => {
    const token = await getAccessToken();
    return token ? { authorization: `Bearer ${token}` } : {};
  },
});

/** The typed client for apps/api — the web app's only data path. */
export const api: Api = createORPCClient(link);
