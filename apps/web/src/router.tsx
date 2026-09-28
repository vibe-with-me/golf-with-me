import { createRouter } from '@tanstack/react-router';
import { ErrorCard, NotFoundCard, PendingCard } from './components/CalmStates.tsx';
import { getSupabase } from './lib/supabase.ts';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    // The resolver is the product and must be unbreakable: every failure
    // mode resolves to a calm card, and slow resolves show the card shell
    // instead of a blank page (taps happen on venue Wi-Fi).
    defaultNotFoundComponent: NotFoundCard,
    defaultErrorComponent: ErrorCard,
    defaultPendingComponent: PendingCard,
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
  });
  scopeCacheToAccount(router);
  return router;
}

/**
 * Loader data belongs to the signed-in account. The router keeps a route's
 * data after you leave it and reuses it on re-entry, so without this a second
 * account signing in on the same tab would be shown the first account's
 * profile and connections. On any account change (sign-out, sign-in, another
 * tab) the cache is dropped and whatever is on screen is re-loaded.
 */
function scopeCacheToAccount(router: {
  clearCache: () => void;
  invalidate: () => Promise<void>;
}): void {
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
    // Deferred: re-running loaders reads the session, which must not happen
    // inside this callback (Supabase holds its auth lock while it runs).
    setTimeout(() => {
      router.invalidate().catch(() => undefined);
    }, 0);
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
