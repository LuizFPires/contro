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

/**
 * Foto de um lote de "Nova pendência" ainda não apontada (relato de campo,
 * 10/11/2026): fica no aparelho desde que é tirada, para não se perder se o app
 * recarregar ou o celular fechá-lo em segundo plano. Some ao apontar ou descartar.
 */
export interface FotoLoteDB {
  id: string;
  obraId: string;
  dono: string; // pessoa que tirou (aparelho compartilhado)
  file: File;
  titulo: string;
  local: string;
  criticidade: 'alta' | 'media' | 'baixa';
  atividadeId: string | null;
  prazo: string | null;
  ordem: number;
}

/** Banco local do CONTRO (fila offline das ações de campo + fotos). */
class ControDB extends Dexie {
  outbox!: Table<OpDB, string>;
  fotos!: Table<FotoDB, string>;
  loteFotos!: Table<FotoLoteDB, string>;

  constructor() {
    super('contro');
    this.version(1).stores({ outbox: 'id, status, criadoEm, userId' });
    this.version(2).stores({ fotos: 'localId' });
    this.version(3).stores({ loteFotos: 'id, [obraId+dono]' });
  }
}

export const db = new ControDB();
