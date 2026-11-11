import { db, type FotoLoteDB } from '../../lib/db';

// Lote de "Nova pendência" guardado no aparelho (relato de campo, 10/11/2026).
// Toda falha de armazenamento (modo privado, cota) é ignorada: o lote segue só
// na memória, como antes.

export type CamposLote = Pick<
  FotoLoteDB,
  'titulo' | 'local' | 'criticidade' | 'atividadeId' | 'prazo'
>;

/** Fotos não apontadas desta obra e desta pessoa, na ordem em que foram tiradas. */
export async function lerLote(obraId: string, dono: string): Promise<FotoLoteDB[]> {
  try {
    const lista = await db.loteFotos.where({ obraId, dono }).toArray();
    return lista.sort((a, b) => a.ordem - b.ordem);
  } catch {
    return [];
  }
}

export async function contarLote(obraId: string, dono: string): Promise<number> {
  try {
    return await db.loteFotos.where({ obraId, dono }).count();
  } catch {
    return 0;
  }
}

export async function guardarNoLote(fotos: FotoLoteDB[]): Promise<void> {
  try {
    await db.loteFotos.bulkPut(fotos);
  } catch {
    // sem armazenamento: segue só na memória
  }
}

export async function atualizarNoLote(id: string, campos: CamposLote): Promise<void> {
  try {
    await db.loteFotos.update(id, campos);
  } catch {
    // idem
  }
}

/** Descartar: apaga tudo desta obra e desta pessoa (inclusive o que ainda não voltou à tela). */
export async function limparLote(obraId: string, dono: string): Promise<void> {
  try {
    await db.loteFotos.where({ obraId, dono }).delete();
  } catch {
    // idem
  }
}

export async function tirarDoLote(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    await db.loteFotos.bulkDelete(ids);
  } catch {
    // idem
  }
}
