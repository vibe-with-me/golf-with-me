import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { safeReturnTo } from '../lib/auth-guard.ts';
import { getSupabase } from '../lib/supabase.ts';

export const Route = createFileRoute('/login')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Sign in — withme' }] }),
  validateSearch: (search): { returnTo?: string } => {
    const returnTo = safeReturnTo(search.returnTo);
    return returnTo ? { returnTo } : {};
  },
  component: LoginPage,
});

function LoginPage() {
  const { returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destination = returnTo ?? '/gatherings';
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const auth = getSupabase().auth;
    const { data, error: authError } =
      mode === 'signin'
        ? await auth.signInWithPassword({ email, password })
        : await auth.signUp({
            email,
            password,
            options: {
              // The confirmation link must lead back to where the tap left
              // off — same contract as the OAuth path.
              emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(destination)}`,
            },
          });
    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    // Signup with email confirmations enabled returns no session yet.
    if (mode === 'signup' && !data.session) {
      setAwaitingConfirmation(true);
      return;
    }
    navigate({ href: destination });
  }

  async function google() {
    setError(null);
    const { error: authError } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(destination)}`,
      },
    });
    if (authError) setError(authError.message);
  }

  if (awaitingConfirmation) {
    return (
      <main className="page">
        <div className="card">
          <h1>Check your email</h1>
          <p className="bio" role="status">
            We sent a confirmation link to {email}. Come back here after clicking it.
          </p>
        </div>
      </main>
    );
  }

  // The tapper arrives here mid-handshake; keep the thread visible.
  const context = returnTo?.startsWith('/t/')
    ? 'to connect with the person whose tag you tapped'
    : returnTo?.startsWith('/gatherings/')
      ? 'to join the gathering you were invited to'
      : null;

  return (
    <main className="page">
      <form className="card" onSubmit={submit}>
        <p className="hint">withme</p>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        {context ? <p className="bio">{context}</p> : null}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
        <button className="btn" type="button" onClick={google}>
          Continue with Google
        </button>
        <button
          className="btn btn--quiet"
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </form>
    </main>
  );
}
