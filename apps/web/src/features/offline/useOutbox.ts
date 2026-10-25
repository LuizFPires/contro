import { useEffect, useState } from 'react';
import { aguardando as contar, rejeitadas as filtrar } from '@contro/core';
import { liveQuery } from 'dexie';
import { db, type OpDB } from '../../lib/db';
import { supabase } from '../../lib/supabase';

/** Estado reativo da fila offline do USUÁRIO logado (indicador "x aguardando sinal"). */
export function useOutbox() {
  const [ops, setOps] = useState<OpDB[]>([]);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    void supabase?.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null));
    const sub = supabase?.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null));
    return () => sub?.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const sub = liveQuery(() => db.outbox.toArray()).subscribe({
      next: setOps,
      error: () => setOps([]),
    });
    return () => sub.unsubscribe();
  }, []);

  const minhas = uid ? ops.filter((o) => o.userId === uid) : [];
  return { aguardando: contar(minhas), rejeitadas: filtrar(minhas), ops: minhas };
}
