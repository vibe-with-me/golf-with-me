import { Link } from '@tanstack/react-router';

/**
 * The resolver must be unbreakable: unknown routes, malformed UIDs, and
 * unexpected failures all land on the same calm card the rest of the app
 * speaks in — never a framework crash screen, never a stack trace.
 */
export function NotFoundCard() {
  return (
    <main className="page">
      <div className="card">
        <h1>Nothing here</h1>
        <p className="bio">This doesn't look like a live link. Give it another tap in a moment.</p>
        <Link className="btn btn--quiet" to="/">
          withme home
        </Link>
      </div>
    </main>
  );
}

export function ErrorCard() {
  return (
    <main className="page">
      <div className="card">
        <h1>Something didn't load</h1>
        <p className="bio">Give it another tap in a moment.</p>
        <button className="btn" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
        <Link className="btn btn--quiet" to="/">
          withme home
        </Link>
      </div>
    </main>
  );
}

/** The card arrives before its contents: an empty shell the settle fills. */
export function PendingCard() {
  return (
    <main className="page" aria-busy="true">
      <div className="card">
        <div className="avatar" aria-hidden="true" />
        <p className="hint">Loading…</p>
      </div>
    </main>
  );
}
