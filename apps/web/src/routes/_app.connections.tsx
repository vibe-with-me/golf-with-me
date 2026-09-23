import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { Avatar } from '../components/ProfileCard.tsx';
import { shellStates } from '../components/CalmStates.tsx';
import { api } from '../lib/api.ts';

export const Route = createFileRoute('/_app/connections')({
  ...shellStates,
  head: () => ({ meta: [{ title: 'Connections — withme' }] }),
  loader: async () => {
    const [pending, connections, blocks] = await Promise.all([
      api.app.requests.listPending(),
      api.app.connections.list(),
      api.app.blocks.list(),
    ]);
    return { pending: pending.requests, connections: connections.connections, blocks: blocks.blocks };
  },
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const { pending, connections, blocks } = Route.useLoaderData();
  const router = useRouter();
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const busyId = (id: string) => busyIds.has(id);

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

  return (
    <div className="stack">
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {pending.length > 0 ? (
        <>
          <h2 className="section-title">Requests</h2>
          {pending.map((request) => (
            <div className="row" key={request.id}>
              <Avatar profile={request.requester} size="row" />
              <div className="row-body">
                <span className="name">{request.requester.display_name}</span>
                {request.requester.bio ? (
                  <span className="sub">{request.requester.bio}</span>
                ) : null}
              </div>
              <div className="row-actions">
                {/* Accepting completes the handshake — the accent's job. */}
                <button
                  type="button"
                  className="btn btn--connect"
                  disabled={busyId(request.id)}
                  onClick={() => act(request.id, () => api.app.requests.accept({ id: request.id }))}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="btn btn--quiet"
                  disabled={busyId(request.id)}
                  onClick={() =>
                    act(request.id, () => api.app.requests.decline({ id: request.id }))
                  }
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </>
      ) : null}

      <h2 className="section-title">Connections</h2>
      {connections.length === 0 ? (
        <p className="empty">No connections yet. Tap someone's tag to start.</p>
      ) : (
        connections.map((connection) => (
          <div className="row" key={connection.id}>
            <Avatar profile={connection.profile} size="row" />
            <div className="row-body">
              <span className="name">{connection.profile.display_name}</span>
              {connection.profile.bio ? (
                <span className="sub">{connection.profile.bio}</span>
              ) : null}
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn--quiet"
                disabled={busyId(connection.id)}
                onClick={() =>
                  act(connection.id, () => api.app.connections.remove({ id: connection.id }))
                }
              >
                Remove
              </button>
              <button
                type="button"
                className="btn btn--quiet"
                disabled={busyId(connection.id)}
                onClick={() =>
                  act(connection.id, () =>
                    api.app.blocks.block({ user_id: connection.profile.id }),
                  )
                }
              >
                Block
              </button>
            </div>
          </div>
        ))
      )}

      {blocks.length > 0 ? (
        <>
          <h2 className="section-title">Blocked</h2>
          {blocks.map((block) => (
            <div className="row" key={block.user.id}>
              <Avatar profile={block.user} size="row" />
              <div className="row-body">
                <span className="name">{block.user.display_name}</span>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn--quiet"
                  disabled={busyId(block.user.id)}
                  onClick={() =>
                    act(block.user.id, () => api.app.blocks.unblock({ user_id: block.user.id }))
                  }
                >
                  Unblock
                </button>
              </div>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
