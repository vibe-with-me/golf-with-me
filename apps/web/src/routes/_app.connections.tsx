import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { shellStates } from '../components/CalmStates.tsx';
import { ListLadder } from '../components/ListStates.tsx';
import { Avatar, type CardProfile } from '../components/ProfileCard.tsx';
import { asSignedInAccount } from '../lib/account-scope.ts';
import { api } from '../lib/api.ts';
import { settled } from '../lib/loaded.ts';

type Tab = 'requests' | 'blocked';

/**
 * Connections: three lists behind in-page segments (Connections, Requests,
 * Blocked). The segment is a search param, so each list is a URL that a
 * reload or a link keeps; switching replaces the history entry rather than
 * stacking one per tap. Each list settles on its own and climbs its own
 * ladder.
 */
export const Route = createFileRoute('/_app/connections')({
  ...shellStates,
  head: () => ({ meta: [{ title: 'Connections — withme' }] }),
  validateSearch: (search): { tab?: Tab } =>
    search.tab === 'requests' || search.tab === 'blocked' ? { tab: search.tab } : {},
  loader: async () => {
    const [pending, connections, blocks] = await asSignedInAccount(() =>
      Promise.all([
        settled(api.app.requests.listPending().then(({ requests }) => requests)),
        settled(api.app.connections.list().then(({ connections: list }) => list)),
        settled(api.app.blocks.list().then(({ blocks: list }) => list)),
      ]),
    );
    return { pending, connections, blocks };
  },
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const { pending, connections, blocks } = Route.useLoaderData();
  const { tab } = Route.useSearch();
  const router = useRouter();
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const busy = (id: string) => busyIds.has(id);
  // Your own inbox, counted for you alone: the one number on this page.
  const requestCount = pending.ok ? pending.data.length : 0;

  async function act(id: string, work: () => Promise<unknown>) {
    setBusyIds((prev) => new Set(prev).add(id));
    setActionError(null);
    try {
      await work();
      await router.invalidate();
    } catch {
      setActionError('That didn’t go through. Try again.');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function retry() {
    setRetrying(true);
    try {
      await router.invalidate({ sync: true });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="stack">
      <h1 className="section-title">Connections</h1>
      <nav className="segments" aria-label="Connections lists">
        <SegmentLink label="Connections" />
        <SegmentLink tab="requests" label="Requests" count={requestCount} />
        <SegmentLink tab="blocked" label="Blocked" />
      </nav>
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}

      {tab === 'requests' ? (
        <ListLadder
          state={pending}
          what="your requests"
          empty="No requests right now."
          retrying={retrying}
          onRetry={retry}
        >
          {(requests) =>
            requests.map((request) => (
              <PersonRow key={request.id} profile={request.requester} sub={request.requester.bio}>
                {/* Accepting completes the handshake — the accent's job. */}
                <button
                  type="button"
                  className="btn btn--connect"
                  disabled={busy(request.id)}
                  onClick={() => act(request.id, () => api.app.requests.accept({ id: request.id }))}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="btn btn--quiet"
                  disabled={busy(request.id)}
                  onClick={() => act(request.id, () => api.app.requests.decline({ id: request.id }))}
                >
                  Decline
                </button>
              </PersonRow>
            ))
          }
        </ListLadder>
      ) : tab === 'blocked' ? (
        <ListLadder
          state={blocks}
          what="your block list"
          empty="No one is blocked."
          retrying={retrying}
          onRetry={retry}
        >
          {(list) =>
            list.map((block) => (
              <PersonRow key={block.user.id} profile={block.user}>
                <button
                  type="button"
                  className="btn btn--quiet"
                  disabled={busy(block.user.id)}
                  onClick={() =>
                    act(block.user.id, () => api.app.blocks.unblock({ user_id: block.user.id }))
                  }
                >
                  Unblock
                </button>
              </PersonRow>
            ))
          }
        </ListLadder>
      ) : (
        <ListLadder
          state={connections}
          what="your connections"
          empty="No connections yet. Tap someone's tag to start."
          retrying={retrying}
          onRetry={retry}
        >
          {(list) =>
            list.map((connection) => (
              <PersonRow
                key={connection.id}
                profile={connection.profile}
                sub={connection.profile.bio}
              >
                <button
                  type="button"
                  className="btn btn--quiet"
                  disabled={busy(connection.id)}
                  onClick={() =>
                    act(connection.id, () => api.app.connections.remove({ id: connection.id }))
                  }
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="btn btn--quiet"
                  disabled={busy(connection.id)}
                  onClick={() =>
                    act(connection.id, () =>
                      api.app.blocks.block({ user_id: connection.profile.id }),
                    )
                  }
                >
                  Block
                </button>
              </PersonRow>
            ))
          }
        </ListLadder>
      )}
    </div>
  );
}

/** One segment. Active = ink weight and a 2px ink underline, never the accent. */
function SegmentLink({ tab, label, count = 0 }: { tab?: Tab; label: string; count?: number }) {
  return (
    <Link
      to="/connections"
      search={tab ? { tab } : {}}
      replace
      className="segments__item"
      // exact: "Connections" (no search) must not match ?tab=requests
      activeOptions={{ exact: true }}
      activeProps={{ 'aria-current': 'page' }}
      // Named outright: a hidden ", N pending" span inside this flex link is
      // blockified, and the computed name would read "Requests , N pending".
      aria-label={count > 0 ? `${label}, ${count} pending` : undefined}
    >
      {label}
      {count > 0 ? (
        <span className="badge" aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}

function PersonRow({
  profile,
  sub,
  children,
}: {
  profile: CardProfile;
  sub?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="row">
      <Avatar profile={profile} size="row" />
      <div className="row-body">
        <span className="name">{profile.display_name}</span>
        {sub ? <span className="sub">{sub}</span> : null}
      </div>
      <div className="row-actions">{children}</div>
    </div>
  );
}
