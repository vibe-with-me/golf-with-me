import type { Profile } from '@withme/contract';
import { useRouter } from '@tanstack/react-router';
import { useState, type ChangeEvent } from 'react';
import { api } from '../lib/api.ts';
import { squareAvatar } from '../lib/avatar.ts';
import { Avatar } from './ProfileCard.tsx';

type PhotoState = 'idle' | 'working' | 'done' | 'removed' | 'failed' | 'unreadable';

const MESSAGES: Record<Exclude<PhotoState, 'idle'>, string> = {
  working: 'Uploading…',
  done: 'Photo updated.',
  removed: 'Photo removed.',
  failed: 'That didn’t go through. Try again.',
  unreadable: "That photo couldn't be read. Try a different one.",
};

/**
 * The profile photo. The browser squares and shrinks it (512px, WebP or
 * JPEG); the API stores it in your own folder with your own JWT. The web app
 * never talks to Storage itself.
 */
export function AvatarField({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [state, setState] = useState<PhotoState>('idle');
  const working = state === 'working';

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    // Cleared so choosing the same file again still fires a change.
    event.target.value = '';
    if (!picked) return;
    setState('working');
    let file: File;
    try {
      file = await squareAvatar(picked);
    } catch {
      setState('unreadable');
      return;
    }
    try {
      await api.app.profile.uploadAvatar({ file });
      // Every card reads the shell's profile: wait for its re-fetch.
      await router.invalidate({ sync: true });
      setState('done');
    } catch {
      setState('failed');
    }
  }

  async function remove() {
    setState('working');
    try {
      await api.app.profile.removeAvatar();
      await router.invalidate({ sync: true });
      setState('removed');
    } catch {
      setState('failed');
    }
  }

  return (
    <div className="avatar-field">
      <Avatar profile={profile} />
      <div className="avatar-field__actions">
        <input
          id="avatar_file"
          className="visually-hidden"
          type="file"
          accept="image/*"
          disabled={working}
          onChange={choose}
        />
        <label htmlFor="avatar_file" className="btn btn--quiet">
          {profile.avatar_path ? 'Change photo' : 'Add a photo'}
        </label>
        {profile.avatar_path ? (
          <button type="button" className="btn btn--quiet" disabled={working} onClick={remove}>
            Remove photo
          </button>
        ) : null}
      </div>
      {state !== 'idle' ? (
        <p className="hint" role="status">
          {MESSAGES[state]}
        </p>
      ) : null}
    </div>
  );
}
