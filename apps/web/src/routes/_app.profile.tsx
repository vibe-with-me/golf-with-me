import type { Profile } from '@withme/contract';
import { createFileRoute, useLoaderData, useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { AvatarField } from '../components/AvatarField.tsx';
import { shellStates } from '../components/CalmStates.tsx';
import { MyTags } from '../components/MyTags.tsx';
import { asSignedInAccount } from '../lib/account-scope.ts';
import { api } from '../lib/api.ts';
import { safeReturnTo } from '../lib/auth-guard.ts';
import { settled } from '../lib/loaded.ts';
import { getSupabase } from '../lib/supabase.ts';

/** Profile: identity (photo, name, bio), My tags, Account. */
export const Route = createFileRoute('/_app/profile')({
  ...shellStates,
  head: () => ({ meta: [{ title: 'Your profile — withme' }] }),
  validateSearch: (search): { returnTo?: string } => {
    const returnTo = safeReturnTo(search.returnTo);
    return returnTo ? { returnTo } : {};
  },
  loader: async () => {
    // Each settles alone: a failed gatherings list only loses the labels.
    const [tags, gatherings] = await asSignedInAccount(() =>
      Promise.all([
        settled(api.app.tags.listMine().then(({ tags: list }) => list)),
        settled(api.app.gatherings.listMine().then(({ gatherings: list }) => list)),
      ]),
    );
    return { tags, gatherings };
  },
  component: ProfilePage,
});

function ProfilePage() {
  // Fetched once by the layout; invalidated after a save or a photo change.
  const { profile } = useLoaderData({ from: '/_app' });
  const { tags, gatherings } = Route.useLoaderData();
  return (
    <div className="stack">
      <IdentityForm profile={profile} />
      {profile ? <MyTags tags={tags} gatherings={gatherings} /> : null}
    </div>
  );
}

function IdentityForm({ profile }: { profile: Profile | null }) {
  const { returnTo } = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
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
      });
      // The layout caches the profile until invalidated; wait for the re-fetch
      // (sync) before leaving so the shell never keeps a stale "no profile".
      await router.invalidate({ sync: true });
      if (returnTo) {
        navigate({ href: returnTo });
        return;
      }
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
    <form className="card" onSubmit={save}>
      <h1>{profile ? 'Your profile' : 'Create your profile'}</h1>
      {/* The photo lives on the profile row: it needs the row to exist first. */}
      {profile ? <AvatarField profile={profile} /> : null}
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
      {/* Always mounted: a live region created with its message is not announced. */}
      <p className="hint" role="status">
        {status}
      </p>
      <button className="btn" type="submit" disabled={busy || !displayName.trim()}>
        {busy ? 'Saving…' : 'Save'}
      </button>
      <button className="btn btn--quiet" type="button" onClick={signOut}>
        Sign out
      </button>
    </form>
  );
}
