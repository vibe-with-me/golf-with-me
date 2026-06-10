import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { safeReturnTo } from '../lib/auth-guard.ts';
import { getSupabase } from '../lib/supabase.ts';

/** OAuth landing: exchanges the PKCE code for a session, then returns. */
export const Route = createFileRoute('/auth/callback')({
  ssr: false,
  validateSearch: (search) => ({
    returnTo: safeReturnTo(search.returnTo),
    error_description:
      typeof search.error_description === 'string' ? search.error_description : undefined,
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const { returnTo, error_description } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(error_description ?? null);

  useEffect(() => {
    if (error_description) return;
    let cancelled = false;
    getSupabase()
      .auth.exchangeCodeForSession(window.location.href)
      .then(({ error: exchangeError }) => {
        if (cancelled) return;
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        navigate({ to: returnTo ?? '/me', replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [error_description, navigate, returnTo]);

  return (
    <main className="page">
      <div className="card">
        {error ? (
          <>
            <h1>Sign-in failed</h1>
            <p className="form-error">{error}</p>
            <a className="btn" href="/login">
              Back to sign in
            </a>
          </>
        ) : (
          <p className="hint">Signing you in…</p>
        )}
      </div>
    </main>
  );
}
