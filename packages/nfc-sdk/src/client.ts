import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { ContractOutputs, Destination, publicContract } from '@withme/contract';

type PublicOutputs = ContractOutputs['public'];
type PublicRpcClient = ContractRouterClient<typeof publicContract>;

export interface NfcClientOptions {
  /** Base URL of a withme-starter API Worker, e.g. `https://api.example.com`. */
  baseUrl: string;
  /** Supplies a Supabase access token for authed calls (claim). */
  getAuthToken?: () => string | null | Promise<string | null>;
  /** Custom fetch (for tests or non-global environments). */
  fetch?: typeof globalThis.fetch;
}

/**
 * Client mode: talk to a running withme-starter API over its typed ORPC
 * contract. For embedded mode (bring-your-own storage, no API), use the
 * NfcSdk core from the package root instead.
 */
export class NfcClient {
  readonly #client: PublicRpcClient;

  constructor(options: NfcClientOptions) {
    const link = new RPCLink({
      url: `${options.baseUrl.replace(/\/+$/, '')}/rpc/public`,
      headers: async () => {
        const token = await options.getAuthToken?.();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
      fetch: options.fetch,
    });
    this.#client = createORPCClient<PublicRpcClient>(link);
  }

  resolve(uid: string): Promise<PublicOutputs['resolve']> {
    return this.#client.resolve({ uid });
  }

  claim(
    uid: string,
    destination: Destination = { type: 'profile' },
  ): Promise<PublicOutputs['claim']> {
    return this.#client.claim({ uid, destination });
  }

  logScan(uid: string, userAgent?: string): Promise<PublicOutputs['logScan']> {
    return this.#client.logScan({ uid, user_agent: userAgent });
  }
}

export type { Destination };
export type ResolveResult = PublicOutputs['resolve'];
export type ClaimResult = PublicOutputs['claim'];
