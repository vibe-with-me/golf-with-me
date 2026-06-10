import { ORPCError } from '@orpc/server';
import type { ResolveOutput } from '@withme/contract';
import { throwFromDbError } from '../lib/errors.ts';
import type { ApiContext } from '../lib/orpc.ts';
import { publicProcedure, requireUser } from '../lib/orpc.ts';

/**
 * Edge rate limit keyed by UID + caller IP: a printed tag URL cannot be used
 * to exhaust its own budget by a third party, and one client cannot hammer a
 * tag. The IP is transient (rate-limit key only) — it is never stored,
 * matching the no-IP-at-rest rule. A missing binding fails open with a loud
 * log: the resolver staying unbreakable beats rate limiting in a
 * misconfigured deploy.
 */
async function enforceLimit(context: ApiContext, key: string): Promise<void> {
  const limiter = context.env.SCAN_RATE_LIMITER;
  if (!limiter) {
    context.logger.error('SCAN_RATE_LIMITER binding missing — rate limiting disabled');
    return;
  }
  const { success } = await limiter.limit({ key });
  if (!success) {
    throw new ORPCError('TOO_MANY_REQUESTS', { message: 'Slow down' });
  }
}

const resolve = publicProcedure.resolve.handler(async ({ input, context }) => {
  await enforceLimit(context, `resolve:${input.uid}:${context.clientIp}`);

  const { data, error } = await context.db.rpc('resolve_tag', { p_uid: input.uid });
  if (error) throwFromDbError(error, context.logger);
  return data as ResolveOutput;
});

const claim = publicProcedure.claim.handler(async ({ input, context }) => {
  const userId = requireUser(context);
  await enforceLimit(context, `claim:${userId}`);

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
  await enforceLimit(context, `scan:${input.uid}:${context.clientIp}`);

  const { error } = await context.db.rpc('log_scan', {
    p_uid: input.uid,
    p_user_agent: input.user_agent,
  });
  if (error) throwFromDbError(error, context.logger);
  return { ok: true as const };
});

export const publicRouter = { resolve, claim, logScan };
