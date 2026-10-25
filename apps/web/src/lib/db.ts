import Dexie, { type Table } from 'dexie';
import type { OpStatus } from '@obdc/core';

export interface OpDB {
  id: string; // client_op_id (uuid) — chave e idempotência no servidor
  userId: string; // dono da op (auth.uid) — só é enviada pela mesma sessão
  tipo: string; // ex.: 'marcar_providencia'
  payload: unknown; // argumentos serializáveis da ação
  status: OpStatus;
  tentativas: number;
  criadoEm: number;
  proximaEm: number;
  erro?: string;
}

/** Banco local do CONTRO (fila offline das ações de campo). */
class ControDB extends Dexie {
  outbox!: Table<OpDB, string>;

  constructor() {
    super('contro');
    this.version(1).stores({ outbox: 'id, status, criadoEm, userId' });
  }
}

export const db = new ControDB();
