/** One list's outcome inside a loader that loads several. */
export type Loaded<T> = { ok: true; data: T } | { ok: false };

/**
 * Settles a load into its own outcome, so one failed list renders its own
 * retry instead of failing the page (the route's errorComponent is for the
 * page itself). Used inside asSignedInAccount, which still re-runs the
 * whole load if the account changed while it was in flight.
 */
export function settled<T>(load: Promise<T>): Promise<Loaded<T>> {
  return load.then(
    (data) => ({ ok: true as const, data }),
    (error: unknown) => {
      // The session, not the list: rethrown so an expired session reaches the
      // auth redirect instead of reading as every list failing at once.
      if (isUnauthorized(error)) throw error;
      return { ok: false as const };
    },
  );
}

function isUnauthorized(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'UNAUTHORIZED'
  );
}
