import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { requireSession } from '../lib/auth-guard.ts';

/** Auth-gated claim flow: authenticate -> confirm -> claim binds tag to profile. */
export const Route = createFileRoute('/claim/$uid')({
  ssr: false,
  beforeLoad: ({ params }) => requireSession(`/claim/${params.uid}`),
  loader: () => api.app.profile.get(),
  component: ClaimPage,
});

function ClaimPage() {
  const { uid } = Route.useParams();
  const { profile } = Route.useLoaderData();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [hasProfile, setHasProfile] = useState(profile !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createProfile(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.app.profile.update({ display_name: displayName.trim() });
      setHasProfile(true);
    } catch {
      setError('Could not save your name. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      await api.public.claim({ uid });
      navigate({ to: '/t/$uid', params: { uid }, replace: true });
    } catch (claimError) {
      const code = (claimError as { code?: string }).code;
      setError(
        code === 'CONFLICT'
          ? 'This tag has already been claimed.'
          : code === 'NOT_FOUND'
            ? 'This tag is not registered.'
            : 'Something went wrong. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!hasProfile) {
    return (
      <main className="page">
        <form className="card" onSubmit={createProfile}>
          <h1>First, your name</h1>
          <p className="hint">This is what people see when they tap your tag.</p>
          <div className="field">
            <label htmlFor="display_name">Name</label>
            <input
              id="display_name"
              required
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn" type="submit" disabled={busy || !displayName.trim()}>
            Continue
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="card">
        <h1>Claim this tag</h1>
        <p className="bio">
          Tag <code>{uid}</code> will point to your profile. You can disable it any time.
        </p>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="btn btn--connect" type="button" onClick={claim} disabled={busy}>
          {busy ? 'Claiming…' : 'Claim tag'}
        </button>
        <Link className="btn btn--quiet" to="/t/$uid" params={{ uid }}>
          Cancel
        </Link>
      </div>
    </main>
  );
}
