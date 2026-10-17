import { useNavigate } from '@tanstack/react-router';
import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { api } from '../lib/api.ts';
import { getSupabase } from '../lib/supabase.ts';

const DELETE_COPY =
  "Your profile, connections, requests, blocks, and the rounds you host are deleted, and your photo with them. Your tags are released so anyone can claim them. This can't be undone.";

/**
 * Profile → Account: sign out, and delete the account behind a second,
 * explicit step. Deletion goes through the API (photo cleared, its files
 * swept, then delete_my_account()); afterwards the session is dropped locally only,
 * because the server no longer has it.
 */
export function AccountSection() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'idle' | 'confirm' | 'deleting' | 'failed'>('idle');
  const titleId = useId();
  const bodyId = useId();
  // Each step unmounts the control that opened it; focus follows to the
  // matching control instead of falling to <body>. Flushed first, so the
  // control exists (and is no longer disabled) when it is focused.
  const trigger = useRef<HTMLButtonElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const signOutButton = useRef<HTMLButtonElement>(null);
  const [signOutFailed, setSignOutFailed] = useState(false);

  async function signOut() {
    // Cleared first, so a second failure is announced again.
    flushSync(() => setSignOutFailed(false));
    let failed: boolean;
    try {
      // auth-js reports a network failure as { error } and keeps the session.
      const { error } = await getSupabase().auth.signOut();
      failed = error !== null;
    } catch {
      failed = true;
    }
    if (failed) {
      // Still signed in: stay here rather than leave a session on the landing page.
      setSignOutFailed(true);
      signOutButton.current?.focus();
      return;
    }
    navigate({ to: '/' });
  }

  function askToConfirm() {
    // Lands on the safe choice; the group's name and description are read with it.
    flushSync(() => {
      setSignOutFailed(false);
      setMode('confirm');
    });
    keep.current?.focus();
  }

  function keepAccount() {
    flushSync(() => setMode('idle'));
    trigger.current?.focus();
  }

  async function deleteAccount() {
    setMode('deleting');
    try {
      await api.app.profile.deleteAccount();
    } catch {
      flushSync(() => setMode('failed'));
      confirmButton.current?.focus();
      return;
    }
    // The auth change clears the router cache and blanks the shell at once
    // (account-scope.ts), so the deleted account's data never shows again.
    // The account is gone server-side either way: leave even if dropping the
    // local copy fails, rather than stick on "Deleting…".
    try {
      await getSupabase().auth.signOut({ scope: 'local' });
    } catch {
      // Nothing to recover: the session it held no longer exists.
    } finally {
      navigate({ to: '/', replace: true });
    }
  }

  return (
    <>
      <h2 className="section-title">Account</h2>
      <div className="card">
        <button
          ref={signOutButton}
          className="btn btn--quiet"
          type="button"
          disabled={mode === 'deleting'}
          onClick={signOut}
        >
          Sign out
        </button>
        {mode === 'idle' ? (
          <button ref={trigger} className="btn btn--quiet" type="button" onClick={askToConfirm}>
            Delete account
          </button>
        ) : (
          <>
            <p className="bio">
              <strong id={titleId}>Delete your account?</strong>{' '}
              <span id={bodyId}>{DELETE_COPY}</span>
            </p>
            {/* Named by the question, so focus landing here reads it first. */}
            <div
              className="row-actions"
              role="group"
              aria-labelledby={titleId}
              aria-describedby={bodyId}
            >
              <button
                ref={confirmButton}
                className="btn"
                type="button"
                disabled={mode === 'deleting'}
                onClick={deleteAccount}
              >
                {mode === 'deleting' ? 'Deleting…' : 'Delete my account'}
              </button>
              <button
                ref={keep}
                className="btn btn--quiet"
                type="button"
                disabled={mode === 'deleting'}
                onClick={keepAccount}
              >
                Keep my account
              </button>
            </div>
          </>
        )}
        {/* Always mounted: a live region created with its message is not announced. */}
        <div role="alert">
          {mode === 'failed' || signOutFailed ? (
            <p className="form-error">That didn’t go through. Try again.</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
