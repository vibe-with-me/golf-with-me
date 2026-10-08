import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

/** Card bodies for use INSIDE the shell: no second <main>, no viewport-height page. */
export function NotFoundBody({ children }: { children?: ReactNode } & Record<string, unknown>) {
  return (
    <div className="card">
      <h1>Nothing here</h1>
      <p className="bio">This doesn't look like a live link. Give it another tap in a moment.</p>
      {children}
    </div>
  );
}

export function PendingBody() {
  return (
    <div className="card" aria-busy="true">
      <div className="avatar" aria-hidden="true" />
      <p className="hint">Loading…</p>
    </div>
  );
}

export function ErrorBody({ children }: { children?: ReactNode }) {
  return (
    <div className="card">
      <h1>Something didn't load</h1>
      <p className="bio">Give it another tap in a moment.</p>
      <button className="btn" type="button" onClick={() => window.location.reload()}>
        Try again
      </button>
      {children}
    </div>
  );
}

/** Spread into every `_app.*` child route so its fallbacks stay inside the shell. */
export const shellStates = { pendingComponent: PendingBody, errorComponent: ErrorBody } as const;

/**
 * The resolver must be unbreakable: unknown routes, malformed UIDs, and
 * unexpected failures all land on the same calm card the rest of the app
 * speaks in — never a framework crash screen, never a stack trace.
 */
export function NotFoundCard() {
  return (
    <main className="page">
      <NotFoundBody>
        <Link className="btn btn--quiet" to="/">
          withme home
        </Link>
      </NotFoundBody>
    </main>
  );
}

export function ErrorCard() {
  return (
    <main className="page">
      <ErrorBody>
        <Link className="btn btn--quiet" to="/">
          withme home
        </Link>
      </ErrorBody>
    </main>
  );
}

/** The card arrives before its contents: an empty shell the settle fills. */
export function PendingCard() {
  return (
    <main className="page">
      <PendingBody />
    </main>
  );
}
