import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface SessionState {
  carregando: boolean;
  session: Session | null;
}

/** Acompanha a sessão do Supabase Auth. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    carregando: Boolean(supabase),
    session: null,
  });

  useEffect(() => {
    if (!supabase) {
      setState({ carregando: false, session: null });
      return;
    }
    let ativo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (ativo) setState({ carregando: false, session: data.session });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ carregando: false, session });
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
