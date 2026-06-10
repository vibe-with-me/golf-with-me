import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { requireSession } from '../lib/auth-guard.ts';
import { getSupabase } from '../lib/supabase.ts';

export const Route = createFileRoute('/me')({
  ssr: false,
  beforeLoad: () => requireSession('/me'),
  loader: () => api.app.profile.get(),
  component: MePage,
});

function MePage() {
  const { profile } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await api.app.profile.update({
        display_name: displayName.trim(),
        bio: bio.trim() === '' ? null : bio.trim(),
        avatar_url: avatarUrl.trim() === '' ? null : avatarUrl.trim(),
      });
      await router.invalidate();
      setStatus('Saved.');
    } catch {
      setStatus('Could not save. Check the fields and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    navigate({ to: '/' });
  }

  return (
    <main className="page page--top">
      <nav className="nav">
        <Link to="/" className="wordmark">
          withme
        </Link>
        <Link to="/connections">Connections</Link>
      </nav>
      <form className="card" onSubmit={save}>
        <h1>{profile ? 'Your profile' : 'Create your profile'}</h1>
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
        <div className="field">
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            maxLength={280}
            placeholder="A line or two about you"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="avatar_url">Avatar URL</label>
          <input
            id="avatar_url"
            type="url"
            placeholder="https://…"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />
        </div>
        {status ? <p className="hint">{status}</p> : null}
        <button className="btn" type="submit" disabled={busy || !displayName.trim()}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button className="btn btn--quiet" type="button" onClick={signOut}>
          Sign out
        </button>
      </form>
    </main>
  );
}
