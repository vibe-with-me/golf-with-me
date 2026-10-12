import type { ReactNode } from 'react';
import type { Loaded } from '../lib/loaded.ts';

/** The typed empty state: what this list will hold, said plainly. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/**
 * The ladder every list climbs: loading → error with retry → typed empty →
 * content. The first load is the route's pendingComponent (inside the
 * shell); `retrying` covers the reload a "Try again" starts.
 */
export function ListLadder<T>({
  state,
  what,
  empty,
  retrying,
  onRetry,
  children,
}: {
  state: Loaded<T[]>;
  /** Completes "Couldn't load …". */
  what: string;
  empty: ReactNode;
  retrying: boolean;
  onRetry: () => void;
  children: (items: T[]) => ReactNode;
}) {
  if (retrying) {
    return (
      <p className="empty" aria-busy="true">
        Loading…
      </p>
    );
  }
  if (!state.ok) {
    return (
      <div className="list-error" role="alert">
        <p>{`Couldn't load ${what}.`}</p>
        <button type="button" className="btn btn--quiet" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  if (state.data.length === 0) return <EmptyState>{empty}</EmptyState>;
  return <>{children(state.data)}</>;
}
