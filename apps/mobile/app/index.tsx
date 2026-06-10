import { Redirect } from 'expo-router';
import { useSession } from '../lib/use-session';

/**
 * Auth router and the always-available anchor route. Sends signed-in users
 * to the home tab and everyone else to sign-in; public routes (t/[uid],
 * scan) are reached directly by deep link and bypass this.
 */
export default function Index() {
  const { session, loading } = useSession();
  if (loading) return null;
  return <Redirect href={session ? '/home' : '/login'} />;
}
