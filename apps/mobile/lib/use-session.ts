import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface SessionState {
  session: Session | null;
  loading: boolean;
}

/** Live Supabase session state — drives the root auth gate. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    let settledByEvent = false;
    supabase.auth.getSession().then(({ data }) => {
      // an auth event may have fired first; never clobber it with stale data
      if (!settledByEvent) setState({ session: data.session, loading: false });
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      settledByEvent = true;
      setState({ session, loading: false });
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  return state;
}
