import type { ReactNode } from 'react';

export interface CardProfile {
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

export function Avatar({ profile, size }: { profile: CardProfile; size?: 'row' }) {
  if (profile.avatar_url) {
    return (
      <img
        className="avatar"
        src={profile.avatar_url}
        alt=""
        width={size === 'row' ? 44 : 76}
        height={size === 'row' ? 44 : 76}
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
  return (
    <article className={settle ? 'card card--settle' : 'card'}>
      <Avatar profile={profile} />
      <h1>{profile.display_name}</h1>
      {profile.bio ? <p className="bio">{profile.bio}</p> : null}
      {children}
    </article>
  );
}
