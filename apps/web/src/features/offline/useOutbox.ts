import { useEffect, useState } from 'react';
import { aguardando as contar, rejeitadas as filtrar } from '@obdc/core';
import { liveQuery } from 'dexie';
import { db, type OpDB } from '../../lib/db';

/** Estado reativo da fila offline (para o indicador "x aguardando sinal"). */
export function useOutbox() {
  const [ops, setOps] = useState<OpDB[]>([]);
  useEffect(() => {
    const sub = liveQuery(() => db.outbox.toArray()).subscribe({
      next: setOps,
      error: () => setOps([]),
    });
    return () => sub.unsubscribe();
  }, []);
  return { aguardando: contar(ops), rejeitadas: filtrar(ops), ops };
}
