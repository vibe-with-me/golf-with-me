import { redirect } from '@tanstack/react-router';
import { getSupabase } from './supabase.ts';

/** beforeLoad guard for client-rendered authed routes. */
export async function requireSession(returnTo: string): Promise<void> {
  const { data } = await getSupabase().auth.getSession();
  if (!data.session) {
    throw redirect({ to: '/login', search: { returnTo } });
  }
}

/**
 * Only same-origin paths may be used as post-auth redirect targets.
 * Backslashes and control chars are rejected too: browsers normalize
 * '\' to '/' during URL resolution, so '/\evil.com' would escape.
 */
export function safeReturnTo(value: unknown): string | undefined {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    // oxlint-disable-next-line no-control-regex -- rejecting control chars is the point
    !/[\\\u0000-\u001f]/.test(value)
    ? value
    : undefined;
}
