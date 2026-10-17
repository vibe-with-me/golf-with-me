import { golfLine } from '@withme/contract';
import { useState, type ReactNode } from 'react';
import { avatarSrc } from '../lib/avatar.ts';

export interface CardProfile {
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  handicap?: number | null;
  home_course?: string | null;
}

export function Avatar({ profile, size }: { profile: CardProfile; size?: 'row' }) {
  const src = avatarSrc(profile.avatar_path);
  // A photo that fails to load (deleted, storage down) falls back to the
  // initial; keyed by URL, so a new photo gets its own attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && src !== failedSrc) {
    return (
      <img
        className="avatar"
        src={src}
        alt=""
        // the storage host must not learn which tag page the viewer is on
        referrerPolicy="no-referrer"
        width={size === 'row' ? 44 : 76}
        height={size === 'row' ? 44 : 76}
        onError={() => setFailedSrc(src)}
      />
    );
  }
  return (
    <div className="avatar" aria-hidden="true">
      {profile.display_name.charAt(0).toUpperCase()}
    </div>
  );
}

/** The card: a physical tap produced a person on screen. 90% of the resolver page. */
export function ProfileCard({
  profile,
  children,
  settle = false,
}: {
  profile: CardProfile;
  children?: ReactNode;
  settle?: boolean;
}) {
  const line = golfLine(profile);
  return (
    <article className={settle ? 'card card--settle' : 'card'}>
      <Avatar profile={profile} />
      <h1>{profile.display_name}</h1>
      {line ? <p className="hint">{line}</p> : null}
      {profile.bio ? <p className="bio">{profile.bio}</p> : null}
      {children}
    </article>
  );
}
