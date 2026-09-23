import { Link, Outlet } from '@tanstack/react-router';
import { ShoppingBag, User, Users, type LucideIcon } from 'lucide-react';

interface NavItem {
  to: '/connections' | '/merch' | '/profile';
  label: string;
  icon: LucideIcon;
}

/**
 * The tabs. One array drives one <nav>; app.css puts it top-right on wide
 * screens and makes it a bottom bar under 720px — the DOM never changes.
 * Adding a top-level section = adding one entry here (see docs/the-slice.md
 * step 5). Merch exists only when a store is configured: the fulfillment
 * pointer is dormant by default.
 */
export const navItems: readonly [NavItem, ...NavItem[]] = [
  { to: '/connections', label: 'Connections', icon: Users },
  ...(import.meta.env.VITE_STORE_URL
    ? ([{ to: '/merch', label: 'Merch', icon: ShoppingBag }] as const)
    : []),
  { to: '/profile', label: 'Profile', icon: User },
];

/** The signed-in chrome. Rendered by the pathless `_app` layout route. */
export function AppShell() {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="shell-header">
        <Link to={navItems[0].to} className="wordmark">
          withme
        </Link>
      </header>
      <main id="main" className="shell-main">
        <Outlet />
      </main>
      <nav className="shell-nav" aria-label="Primary">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="shell-nav__item"
            /* TanStack sets aria-current itself; this only replaces its default className="active". */
            activeProps={{ 'aria-current': 'page' }}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
