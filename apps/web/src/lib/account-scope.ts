import type { AnyRouter } from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';
import { getSupabase } from './supabase.ts';

/**
 * Loader data belongs to the signed-in account. The router keeps a route's
 * data after you leave it and reuses it on re-entry, and a page already on
 * screen keeps its data while it re-loads. Left alone, a second account on
 * the same browser would be shown the first account's profile and
 * connections. So on any account change (sign-out, sign-in, another tab):
 * the cache is dropped, the shell hides its content at once, and the content
 * comes back only when the new account's data has loaded.
 */

let switchesInFlight = 0;
const listeners = new Set<() => void>();

function setSwitchesInFlight(next: number): void {
  const was = switchesInFlight > 0;
  switchesInFlight = Math.max(0, next);
  if (was !== switchesInFlight > 0) for (const listener of listeners) listener();
}

// Module-level so useSyncExternalStore never re-subscribes on a re-render.
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return switchesInFlight > 0;
}

function getServerSnapshot(): boolean {
  return false;
}

/** True from the moment the account changes until its data has loaded. */
export function useAccountSwitching(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function scopeRouterToAccount(router: AnyRouter): void {
  if (typeof window === 'undefined') return;
  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    // No Supabase env: nothing signs in, so there is nothing to scope.
    return;
  }
  let accountId: string | null | undefined;
  supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.user.id ?? null;
    const changed = accountId !== undefined && next !== accountId;
    accountId = next;
    if (!changed) return;

    // Synchronous and Supabase-free, so the very next navigation cannot be
    // served the previous account's data.
    router.clearCache();

    // Nothing of the previous account is on screen (the login page, a tag):
    // the cleared cache is all that is needed.
    const shellOnScreen = router.state.matches.some((match) => match.routeId.startsWith('/_app'));
    if (!shellOnScreen) return;

    setSwitchesInFlight(switchesInFlight + 1);
    // Deferred: re-running loaders reads the session, which must not happen
    // inside this callback (Supabase holds its auth lock while it runs).
    // `sync` makes the promise settle when the loaders have, not before.
    setTimeout(() => {
      router
        .invalidate({ sync: true })
        .catch(() => undefined)
        .finally(() => setSwitchesInFlight(switchesInFlight - 1));
    }, 0);
  });
}
