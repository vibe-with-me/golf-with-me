import type { Logger } from '@logtape/logtape';
import { ORPCError, implement } from '@orpc/server';
import { contract } from '@withme/contract';
import type { Db } from '@withme/db';
import type { ApiEnv } from '../env.ts';

export interface ApiContext {
  env: ApiEnv;
  /** Per-request client carrying the caller's JWT — all queries run under RLS. */
  db: Db;
  userId: string | null;
  requestId: string;
  /** Rate-limit key dimension only. Never stored, never logged. */
  clientIp: string;
  logger: Logger;
}

const os = implement(contract).$context<ApiContext>();

export const publicProcedure = os.public;

/** Procedures that require a verified Supabase identity. */
export function requireUser(context: ApiContext): string {
  if (!context.userId) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Authentication required' });
  }
  return context.userId;
}

export const appProcedure = os.app;
