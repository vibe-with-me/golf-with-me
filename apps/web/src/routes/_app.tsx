import { createFileRoute, redirect } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell.tsx';
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
  // One profile fetch for the whole shell; children read it with
  // `useLoaderData({ from: '/_app' })`. A session without a profile is sent
  // to create one, carrying the intended destination.
  // The gate fires on shell entry, not on every tab switch; the Profile page
  // invalidates after saving.
  loader: async ({ location }) => {
    const { profile } = await api.app.profile.get();
    if (!profile && location.pathname !== '/profile') {
      throw redirect({ to: '/profile', search: { returnTo: location.href }, replace: true });
    }
    return { profile };
  },
  staleTime: 60_000,
  component: AppShell,
});
