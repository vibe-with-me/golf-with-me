import { createFileRoute, redirect } from '@tanstack/react-router';
import { safeReturnTo } from '../lib/auth-guard.ts';

/** `/me` moved to `/profile`. Old links and in-flight auth emails still land. */
export const Route = createFileRoute('/me')({
  validateSearch: (search): { returnTo?: string } => {
    const returnTo = safeReturnTo(search.returnTo);
    return returnTo ? { returnTo } : {};
  },
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/profile', search, replace: true });
  },
});
