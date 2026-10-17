import {
  formatHandicap,
  isProfileComplete,
  parseHandicap,
  type Profile,
} from '@withme/contract';
import { createFileRoute, useLoaderData, useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { AccountSection } from '../components/AccountSection.tsx';
import { AvatarField } from '../components/AvatarField.tsx';
import { shellStates } from '../components/CalmStates.tsx';
import { LinksEditor } from '../components/Links.tsx';
import { MyTags } from '../components/MyTags.tsx';
import { asSignedInAccount } from '../lib/account-scope.ts';
import { api } from '../lib/api.ts';
import { safeReturnTo } from '../lib/auth-guard.ts';
import { settled } from '../lib/loaded.ts';

/** Profile: identity (photo, name, bio), Links, My tags, Account. */
export const Route = createFileRoute('/_app/profile')({
  ...shellStates,
  head: () => ({ meta: [{ title: 'Your profile — golfwithme' }] }),
  validateSearch: (search): { returnTo?: string } => {
    const returnTo = safeReturnTo(search.returnTo);
    return returnTo ? { returnTo } : {};
  },
  loader: async () => {
    // Each settles alone: a failed gatherings list only loses the labels.
    const [links, tags, gatherings] = await asSignedInAccount(() =>
      Promise.all([
        settled(api.app.links.listMine().then(({ links: list }) => list)),
        settled(api.app.tags.listMine().then(({ tags: list }) => list)),
        settled(api.app.gatherings.listMine().then(({ gatherings: list }) => list)),
      ]),
    );
    return { links, tags, gatherings };
  },
  component: ProfilePage,
});

function ProfilePage() {
  // Fetched once by the layout; invalidated after a save or a photo change.
  const { profile } = useLoaderData({ from: '/_app' });
  const { links, tags, gatherings } = Route.useLoaderData();
  return (
    <div className="stack">
      <IdentityForm profile={profile} />
      {/* Links hang off the profile row: it needs the row to exist first. */}
      {profile ? <LinksEditor links={links} /> : null}
      {profile ? <MyTags tags={tags} gatherings={gatherings} /> : null}
      {/* For every visitor: a session without a profile can still sign out or delete. */}
      <AccountSection />
    </div>
  );
}

function IdentityForm({ profile }: { profile: Profile | null }) {
  const { returnTo } = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [handicap, setHandicap] = useState(
    profile?.handicap === null || profile?.handicap === undefined
      ? ''
      : formatHandicap(profile.handicap),
  );
  const [handicapError, setHandicapError] = useState(false);
  const [homeCourse, setHomeCourse] = useState(profile?.home_course ?? '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    // Parse first: an undefined key would be dropped by the input schema and
    // the form would say "Saved." over a handicap it threw away.
    const parsedHandicap = parseHandicap(handicap);
    if (parsedHandicap === undefined) {
      setHandicapError(true);
      setStatus(null);
      return;
    }
    setHandicapError(false);
    setBusy(true);
    setStatus(null);
    try {
      const saved = await api.app.profile.update({
        display_name: displayName.trim(),
        bio: bio.trim() === '' ? null : bio.trim(),
        handicap: parsedHandicap,
        home_course: homeCourse.trim() === '' ? null : homeCourse.trim(),
      });
      setHandicap(saved.profile.handicap === null ? '' : formatHandicap(saved.profile.handicap));
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

  return (
    <form className="card" onSubmit={save}>
      <h1>
        {!profile
          ? 'Create your profile'
          : isProfileComplete(profile)
            ? 'Your profile'
            : 'Finish your profile'}
      </h1>
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
      <div className="field">
        <label htmlFor="handicap">Handicap</label>
        <input
          id="handicap"
          maxLength={5}
          placeholder="e.g. 14.2, or +2.4"
          aria-invalid={handicapError}
          aria-describedby={handicapError ? 'handicap-error' : undefined}
          value={handicap}
          onChange={(e) => setHandicap(e.target.value)}
        />
        {handicapError ? (
          <p className="field-error" id="handicap-error">
            A handicap index from +10.0 to 54.0, one decimal at most.
          </p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="home_course">Home course</label>
        <input
          id="home_course"
          maxLength={80}
          placeholder="e.g. Riverside Muni"
          value={homeCourse}
          onChange={(e) => setHomeCourse(e.target.value)}
        />
      </div>
      {/* Always mounted: a live region created with its message is not announced. */}
      <p className="hint" role="status">
        {status}
      </p>
      <button className="btn" type="submit" disabled={busy || !displayName.trim()}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
