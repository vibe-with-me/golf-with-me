import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { contract } from '@withme/contract';
import { getAccessToken } from './supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!apiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is not set — copy apps/mobile/.env.example to .env');
}

export type Api = ContractRouterClient<typeof contract>;

const link = new RPCLink({
  url: `${apiUrl}/rpc`,
  headers: async () => {
    const token = await getAccessToken();
    return token ? { authorization: `Bearer ${token}` } : {};
  },
});

/** The typed client for apps/api — the mobile app's only data path. */
export const api: Api = createORPCClient(link);
