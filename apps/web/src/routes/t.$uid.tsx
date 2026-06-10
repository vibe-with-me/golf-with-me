import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { ProfileCard } from '../components/ProfileCard.tsx';
import { api } from '../lib/api.ts';
import { getSessionUserId } from '../lib/supabase.ts';

// The tapper's user agent: from the SSR request on the server, from the
// navigator on the client. The server branch is stripped from the client bundle.
const currentUserAgent = createIsomorphicFn()
  .server(async (): Promise<string | undefined> => {
    const { getRequest } = await import('@tanstack/react-start/server');
    return getRequest().headers.get('user-agent') ?? undefined;
  })
  .client((): Promise<string | undefined> => Promise.resolve(navigator.userAgent));

/**
 * The resolver. This route is the product: a tap lands here, the API Worker
 * does the lookup, and a person appears. It must be fast and unbreakable —
 * unknown UIDs resolve as unclaimed and head to the claim flow.
 */
export const Route = createFileRoute('/t/$uid')({
  loader: async ({ params }) => {
    const [result] = await Promise.all([
      api.public.resolve({ uid: params.uid }),
      // Scan logging must never break or delay-fail the resolve.
      currentUserAgent()
        .then((ua) => api.public.logScan({ uid: params.uid, user_agent: ua }))
        .catch(() => undefined),
    ]);
    if (result.status === 'unclaimed') {
      throw redirect({ to: '/claim/$uid', params: { uid: result.uid } });
    }
    return result;
  },
  component: ResolvePage,
});

function ResolvePage() {
  const result = Route.useLoaderData();

  if (result.status === 'disabled') {
    return (
      <main className="page">
        <div className="card card--settle">
          <h1>This tag is inactive</h1>
          <p className="bio">There's nothing connected to it right now.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <ProfileCard profile={result.profile} settle>
        <ConnectAction profileId={result.profile.id} uid={result.uid} />
      </ProfileCard>
    </main>
  );
}

function ConnectAction({ profileId, uid }: { profileId: string; uid: string }) {
  const navigate = useNavigate();
  const [viewer, setViewer] = useState<'loading' | 'anon' | 'self' | 'other'>('loading');
  const [send, setSend] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  useEffect(() => {
    let cancelled = false;
    getSessionUserId().then((userId) => {
      if (cancelled) return;
      if (!userId) setViewer('anon');
      else if (userId === profileId) setViewer('self');
      else setViewer('other');
    });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (viewer === 'self') {
    return (
      <>
        <p className="hint">This is your tag.</p>
        <Link className="btn" to="/me">
          Edit profile
        </Link>
      </>
    );
  }

  if (viewer === 'anon') {
    return (
      <Link className="btn btn--connect" to="/login" search={{ returnTo: `/t/${uid}` }}>
        Connect
      </Link>
    );
  }

  if (send === 'sent') {
    return <p className="hint">Request sent. They'll see it when they check in.</p>;
  }

  return (
    <button
      type="button"
      className="btn btn--connect"
      disabled={viewer === 'loading' || send === 'sending'}
      onClick={async () => {
        setSend('sending');
        try {
          // Consent is mutual: the other side sees YOUR card, so a profile
          // must exist before a request can go out.
          const { profile } = await api.app.profile.get();
          if (!profile) {
            navigate({ to: '/me', search: { returnTo: `/t/${uid}` } });
            return;
          }
          await api.app.requests.send({ recipient_id: profileId });
          setSend('sent');
        } catch {
          setSend('failed');
        }
      }}
    >
      {send === 'sending' ? 'Connecting…' : send === 'failed' ? 'Try again' : 'Connect'}
    </button>
  );
}
