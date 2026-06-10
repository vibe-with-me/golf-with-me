import { ORPCError } from '@orpc/server';
import type { ResolveOutput } from '@withme/contract';
import { throwFromDbError } from '../lib/errors.ts';
import { publicProcedure, requireUser } from '../lib/orpc.ts';

const resolve = publicProcedure.resolve.handler(async ({ input, context }) => {
  // Per-UID limiter: a tag's URL is public once printed — cap what one UID
  // can trigger. (The transient key never touches storage.)
  const { success } = await context.env.SCAN_RATE_LIMITER.limit({ key: `resolve:${input.uid}` });
  if (!success) {
    throw new ORPCError('TOO_MANY_REQUESTS', { message: 'Slow down' });
  }

  const { data, error } = await context.db.rpc('resolve_tag', { p_uid: input.uid });
  if (error) throwFromDbError(error, context.logger);
  return data as ResolveOutput;
});

const claim = publicProcedure.claim.handler(async ({ input, context }) => {
  requireUser(context);
  const { data, error } = await context.db.rpc('claim_tag', {
    p_uid: input.uid,
    p_destination: input.destination,
  });
  if (error) throwFromDbError(error, context.logger);
  const tag = data as { uid: string; status: 'claimed'; destination: { type: 'profile' } };
  context.logger.info('tag claimed', { uid: tag.uid });
  return { tag };
});

const logScan = publicProcedure.logScan.handler(async ({ input, context }) => {
  const { success } = await context.env.SCAN_RATE_LIMITER.limit({ key: `scan:${input.uid}` });
  if (!success) {
    throw new ORPCError('TOO_MANY_REQUESTS', { message: 'Slow down' });
  }

  const { error } = await context.db.rpc('log_scan', {
    p_uid: input.uid,
    p_user_agent: input.user_agent,
  });
  if (error) throwFromDbError(error, context.logger);
  return { ok: true as const };
});

export const publicRouter = { resolve, claim, logScan };
