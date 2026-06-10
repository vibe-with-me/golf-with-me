import { getLogger } from '@logtape/logtape';
import type { MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { HonoEnv } from '../env.ts';

const logger = getLogger(['api', 'auth']);

// JWKS fetch results are cached per Supabase URL for the Worker's lifetime —
// jose handles key rotation and conditional refetching internally.
const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(supabaseUrl: string) {
  let jwks = jwksByUrl.get(supabaseUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    jwksByUrl.set(supabaseUrl, jwks);
  }
  return jwks;
}

/**
 * Verifies the Supabase JWT when present. Identity comes from the verified
 * token only — client-supplied user IDs are never trusted. No token means
 * anonymous (fine for public procedures); an INVALID token is rejected
 * outright rather than silently downgraded.
 */
export function supabaseAuth(): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const authorization = c.req.header('authorization');
    if (!authorization?.toLowerCase().startsWith('bearer ')) {
      c.set('userId', null);
      c.set('accessToken', null);
      return next();
    }

    const token = authorization.slice('bearer '.length).trim();
    try {
      const { payload } = await jwtVerify(token, jwksFor(c.env.SUPABASE_URL));
      if (typeof payload.sub !== 'string') {
        return c.json({ error: 'invalid token' }, 401);
      }
      c.set('userId', payload.sub);
      c.set('accessToken', token);
      return next();
    } catch (error) {
      logger.warn('JWT verification failed', { requestId: c.get('requestId'), error: `${error}` });
      return c.json({ error: 'invalid token' }, 401);
    }
  };
}
