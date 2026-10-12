// The local stack itself. PostgREST before 14.18 and 16.0–16.2 cached its
// clock in a way that could stall for minutes after an idle spell, so a token
// minted after the stall read as "issued at future" (401 PGRST303) and the
// API answered a fresh sign-up's first calls with 500s (PostgREST #5196).
// Fixed in 14.18 and 16.3, which Supabase CLI 2.118+ ships.
import { beforeAll, describe, expect, it } from 'bun:test';
import { ANON_KEY, SUPABASE_URL, assertStackRunning } from '../src/test-utils/index.ts';

beforeAll(assertStackRunning);

function hasLiveJwtClock(version: string): boolean {
  const [major = 0, minor = 0] = version.split('.').map(Number);
  return major === 14 ? minor >= 18 : major > 16 || (major === 16 && minor >= 3);
}

describe('local stack', () => {
  it('runs a PostgREST whose JWT clock cannot stall (14.18+ or 16.3+)', async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: ANON_KEY } });
    const version = res.headers.get('server')?.match(/^postgrest\/([\d.]+)/)?.[1];
    expect(version).toBeDefined();
    expect(
      hasLiveJwtClock(version ?? ''),
      `PostgREST ${version} predates the fix for sporadic PGRST303 on fresh sign-ins. Upgrade the Supabase CLI to 2.118 or newer, then restart the stack.`,
    ).toBe(true);
  });
});
