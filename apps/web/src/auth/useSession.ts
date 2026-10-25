import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface SessionState {
  carregando: boolean;
  session: Session | null;
  /** true quando o usuário chegou por um link de recuperação de senha. */
  recovery: boolean;
}

export interface UseSession extends SessionState {
  fecharRecovery: () => void;
}

/** Acompanha a sessão do Supabase Auth (inclui o fluxo de recuperação de senha). */
export function useSession(): UseSession {
  const [state, setState] = useState<SessionState>({
    carregando: Boolean(supabase),
    session: null,
    recovery: false,
  });

  useEffect(() => {
    if (!supabase) {
      setState({ carregando: false, session: null, recovery: false });
      return;
    }
    let ativo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (ativo) setState((s) => ({ ...s, carregando: false, session: data.session }));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState((s) => ({
        carregando: false,
        session,
        recovery: event === 'PASSWORD_RECOVERY' ? true : s.recovery,
      }));
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { ...state, fecharRecovery: () => setState((s) => ({ ...s, recovery: false })) };
}
