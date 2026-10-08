import type { Gathering } from '@withme/contract';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { shellStates } from '../components/CalmStates.tsx';
import { asSignedInAccount } from '../lib/account-scope.ts';
import { api } from '../lib/api.ts';
import { tomorrowEvening, whenAndWhere } from '../lib/format-time.ts';

/**
 * The Events tab: the gatherings you host or have joined, and a form to
 * create one. There is deliberately no browse surface — the only way into
 * someone else's gathering is tapping their tag (docs/the-slice.md).
 */
export const Route = createFileRoute('/_app/gatherings')({
  ...shellStates,
  head: () => ({ meta: [{ title: 'Events — withme' }] }),
  loader: async () => {
    const { gatherings } = await asSignedInAccount(() => api.app.gatherings.listMine());
    return { gatherings };
  },
  component: GatheringsPage,
});

function GatheringsPage() {
  const { gatherings } = Route.useLoaderData();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(tomorrowEvening);
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = Date.now();
  const upcoming = gatherings.filter((g) => Date.parse(g.starts_at) >= now);
  // most recent first
  const past = gatherings.filter((g) => Date.parse(g.starts_at) < now).toReversed();

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.app.gatherings.create({
        title: title.trim(),
        starts_at: new Date(startsAt).toISOString(),
        location: location.trim() === '' ? null : location.trim(),
      });
      setTitle('');
      setLocation('');
      setStartsAt(tomorrowEvening());
      // Wait for the re-fetch (sync) so the list never shows a stale set of gatherings.
      await router.invalidate({ sync: true });
    } catch {
      setError('Could not create the gathering. Check the fields and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <form className="card" onSubmit={create}>
        <h1>Create a gathering</h1>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            required
            maxLength={120}
            placeholder="e.g. Rooftop listening session"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="starts_at">Starts</label>
          <input
            id="starts_at"
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="location">Location (optional)</label>
          <input
            id="location"
            maxLength={160}
            placeholder="Where to find it"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn" type="submit" disabled={busy || !title.trim() || !startsAt}>
          {busy ? 'Creating…' : 'Create gathering'}
        </button>
      </form>

      <h2 className="section-title">Your gatherings</h2>
      {gatherings.length === 0 ? (
        <p className="empty">Tap a host's tag to join one, or create your own.</p>
      ) : upcoming.length === 0 ? (
        <p className="empty">Nothing coming up.</p>
      ) : (
        upcoming.map((g) => <GatheringRow key={g.id} gathering={g} />)
      )}
      {past.length > 0 ? (
        <>
          <h2 className="section-title">Past</h2>
          {past.map((g) => <GatheringRow key={g.id} gathering={g} />)}
        </>
      ) : null}
    </div>
  );
}

function GatheringRow({ gathering }: { gathering: Gathering }) {
  return (
    <div className="row">
      <div className="row-body">
        <span className="name">{gathering.title}</span>
        <span className="sub">{whenAndWhere(gathering)}</span>
      </div>
      <div className="row-actions">
        <Link className="btn btn--quiet" to="/gatherings/$id" params={{ id: gathering.id }}>
          Open
        </Link>
      </div>
    </div>
  );
}
