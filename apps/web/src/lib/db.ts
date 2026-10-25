import Dexie, { type Table } from 'dexie';
import type { OpStatus } from '@contro/core';

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

/** Foto guardada localmente para subir em 2º plano (com retomada). */
export interface FotoDB {
  localId: string; // referência na op
  obraId: string;
  blob: Blob; // já comprimida
  storagePath?: string; // preenchido após o upload (retomada)
  fotoId?: string; // preenchido após criar a linha `foto`
}

/** Banco local do CONTRO (fila offline das ações de campo + fotos). */
class ControDB extends Dexie {
  outbox!: Table<OpDB, string>;
  fotos!: Table<FotoDB, string>;

  constructor() {
    super('contro');
    this.version(1).stores({ outbox: 'id, status, criadoEm, userId' });
    this.version(2).stores({ fotos: 'localId' });
  }
}

export const db = new ControDB();
