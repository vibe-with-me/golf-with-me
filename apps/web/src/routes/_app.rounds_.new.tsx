import type { GatheringVisibility } from '@withme/contract';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { shellStates } from '../components/CalmStates.tsx';
import { GatheringControls } from '../components/GatheringControls.tsx';
import { api } from '../lib/api.ts';
import { tomorrowEvening } from '../lib/format-time.ts';
import { parseSpots } from '../lib/going.ts';

/**
 * Create a round, linked from the Rounds tab. A created round replaces this
 * page with its own (replace, so Back from there returns to Rounds rather
 * than to an emptied form). A static segment, so the router matches it
 * ahead of /rounds/$id.
 */
export const Route = createFileRoute('/_app/rounds_/new')({
  ...shellStates,
  head: () => ({ meta: [{ title: 'New round — golfwithme' }] }),
  component: NewRoundPage,
});

function NewRoundPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(tomorrowEvening);
  const [location, setLocation] = useState('');
  const [course, setCourse] = useState('');
  const [visibility, setVisibility] = useState<GatheringVisibility>('everyone');
  const [spots, setSpots] = useState('4'); // a foursome unless the host says fewer
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { gathering } = await api.app.gatherings.create({
        title: title.trim(),
        starts_at: new Date(startsAt).toISOString(),
        course_name: course.trim(),
        location: location.trim() === '' ? null : location.trim(),
        visibility,
        capacity: parseSpots(spots) ?? null,
      });
      await navigate({ to: '/rounds/$id', params: { id: gathering.id }, replace: true });
    } catch {
      setError('Could not create the round. Check the fields and try again.');
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <form className="card" onSubmit={create}>
        <h1>Create a round</h1>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            required
            maxLength={120}
            placeholder="e.g. Saturday dawn nine"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="course_name">Course</label>
          <input
            id="course_name"
            required
            maxLength={80}
            placeholder="e.g. Riverside Muni"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="starts_at">Tee time</label>
          <input
            id="starts_at"
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="location">Meet at (optional)</label>
          <input
            id="location"
            maxLength={160}
            placeholder="e.g. the first tee"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <GatheringControls
          visibility={visibility}
          onVisibility={setVisibility}
          spots={spots}
          onSpots={setSpots}
        />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="btn"
          type="submit"
          disabled={busy || !title.trim() || !course.trim() || !startsAt || parseSpots(spots) === undefined}
        >
          {busy ? 'Creating…' : 'Create round'}
        </button>
        <Link className="btn btn--quiet" to="/rounds">
          Cancel
        </Link>
      </form>
    </div>
  );
}
