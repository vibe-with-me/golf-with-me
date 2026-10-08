import { createFileRoute, redirect } from '@tanstack/react-router';
import { navItems } from '../components/AppShell.tsx';
import { shellStates } from '../components/CalmStates.tsx';

const STORE_URL = import.meta.env.VITE_STORE_URL;

/**
 * The fulfillment pointer as a tab: one card, one link out to the configured
 * store. No commerce lives here. Dormant when VITE_STORE_URL is unset — the
 * nav hides the tab and this route bounces to the first one.
 */
export const Route = createFileRoute('/_app/merch')({
  ...shellStates,
  head: () => ({ meta: [{ title: 'Merch — withme' }] }),
  beforeLoad: () => {
    if (!STORE_URL) throw redirect({ to: navItems[0].to, replace: true });
  },
  component: MerchPage,
});

function MerchPage() {
  return (
    <div className="card">
      <h1>Merch</h1>
      <p className="bio">Tags and gear from the store.</p>
      <a className="btn" href={STORE_URL} target="_blank" rel="noopener noreferrer">
        Open store
      </a>
    </div>
  );
}
