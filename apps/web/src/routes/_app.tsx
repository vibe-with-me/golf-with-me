import { createFileRoute, Navigate, useLocation } from '@tanstack/react-router';
import { AppShell, ShellError, ShellPending } from '../components/AppShell.tsx';
import { NotFoundBody } from '../components/CalmStates.tsx';
import { asSignedInAccount } from '../lib/account-scope.ts';
import { api } from '../lib/api.ts';
import { requireSession } from '../lib/auth-guard.ts';

/**
 * The signed-in shell. Pathless: it owns no URL segment, only the guard and
 * the chrome. `ssr: false` cascades to every child (selective SSR can only
 * get more restrictive), so tab pages render on the client, where the
 * Supabase session lives.
 */
export const Route = createFileRoute('/_app')({
  ssr: false,
  beforeLoad: ({ location }) => requireSession(location.href),
  // One profile fetch for the whole shell (run again only if the account
  // changed under it); children read it with
  // useLoaderData({ from: '/_app' }). Re-fetched on invalidate() or, after 60s, in
  // the background on the next navigation. The Profile page invalidates after saving.
  loader: async () => {
    const { profile } = await asSignedInAccount(() => api.app.profile.get());
    return { profile };
  },
  staleTime: 60_000,
  component: ShellRoute,
  // The layout's own fallbacks replace its component, so they bring the
  // chrome with them: a slow or failed profile load keeps the tabs on screen.
  pendingComponent: ShellPending,
  errorComponent: ShellError,
  // A bad path under the shell renders in the shell's outlet (no second <main>).
  notFoundComponent: NotFoundBody,
});

/**
 * A session without a profile is sent to create one, carrying the intended
 * destination. Not a `throw redirect` from the loader above: its target,
 * /profile, sits under this same layout, so the router would reuse the
 * redirected `/_app` match for it, and with the pending shell already on
 * screen (a profile fetch slower than defaultPendingMs) the stale
 * "redirected" match re-renders after the re-load has dropped its load
 * promise and throws `undefined` past every error boundary: a blank page.
 */
function ShellRoute() {
  const { profile } = Route.useLoaderData();
  const { pathname, href } = useLocation();
  if (!profile && pathname !== '/profile') {
    return (
      <>
        <Navigate to="/profile" search={{ returnTo: href }} replace />
        <ShellPending />
      </>
    );
  }
  return <AppShell />;
}
