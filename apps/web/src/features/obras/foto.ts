import { supabase } from '../../lib/supabase';
import { db } from '../../lib/db';

/** Comprime no aparelho: lado maior até 1600px, JPEG ~0,75 (CLAUDE.md). */
export async function comprimirImagem(
  file: File,
  maxLado = 1600,
  q = 0.75,
  /** Carimbo gravado na foto (check-in): linhas no rodapé, sobre uma faixa escura. */
  carimbo?: string[],
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * escala));
    const h = Math.max(1, Math.round(img.height * escala));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, 0, 0, w, h);
    if (carimbo?.length) desenharCarimbo(ctx, w, h, carimbo);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', q),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function desenharCarimbo(ctx: CanvasRenderingContext2D, w: number, h: number, linhas: string[]) {
  const tam = Math.max(14, Math.round(Math.min(w, h) * 0.034));
  const pad = Math.round(tam * 0.7);
  const alturaLinha = Math.round(tam * 1.3);
  const altura = pad * 2 + alturaLinha * linhas.length;
  ctx.fillStyle = 'rgba(24, 24, 24, 0.72)';
  ctx.fillRect(0, h - altura, w, altura);
  ctx.fillStyle = '#54B4B0';
  ctx.fillRect(0, h - altura, Math.max(4, Math.round(tam * 0.3)), altura);
  ctx.textBaseline = 'top';
  linhas.forEach((l, i) => {
    ctx.font = `${i === 0 ? 800 : 600} ${tam}px "Nunito Sans", system-ui, sans-serif`;
    ctx.fillStyle = i === 0 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(l, pad * 1.4, h - altura + pad + i * alturaLinha, w - pad * 2.4);
  });
}

/** Guarda no Dexie a foto do check-in, comprimida e com o carimbo gravado. */
export async function guardarFotoCarimbada(
  obraId: string,
  file: File,
  carimbo: string[],
): Promise<{ localId: string; blob: Blob }> {
  const blob = await comprimirImagem(file, 1600, 0.75, carimbo);
  const localId = crypto.randomUUID();
  await db.fotos.add({ localId, obraId, blob });
  return { localId, blob };
}

/** Comprime, envia ao bucket privado e grava a linha foto. Retorna foto_id. */
export async function enviarFoto(obraId: string, file: File): Promise<string> {
  if (!supabase) throw new Error('Sem conexão');
  const blob = await comprimirImagem(file);
  const caminho = `${obraId}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from('fotos').upload(caminho, blob, {
    contentType: 'image/jpeg',
  });
  if (up.error) throw up.error;

  const { data: userData } = await supabase.auth.getUser();
  const pessoaRes = await supabase
    .from('pessoa')
    .select('id')
    .eq('user_id', userData.user?.id ?? '')
    .maybeSingle();
  const pessoaId = (pessoaRes.data as { id: string } | null)?.id ?? null;

  const { data, error } = await supabase
    .from('foto')
    .insert({ obra_id: obraId, storage_path: caminho, tirada_por: pessoaId })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Guarda a foto comprimida no Dexie (para subir em 2º plano). Retorna o localId. */
export async function guardarFotoLocal(obraId: string, file: File): Promise<string> {
  const blob = await comprimirImagem(file);
  const localId = crypto.randomUUID();
  await db.fotos.add({ localId, obraId, blob });
  return localId;
}

/**
 * Sobe a foto local ao Storage e cria a linha `foto`, com RETOMADA: pula o que
 * já foi feito (storagePath/fotoId). Retorna o foto_id.
 */
export async function subirFotoLocal(localId: string): Promise<string> {
  if (!supabase) throw new Error('Sem conexão');
  const f = await db.fotos.get(localId);
  if (!f) {
    // Foto sumiu do dispositivo: falha terminal (não adianta repetir).
    throw Object.assign(new Error('Foto local não encontrada'), { code: 'FOTO0' });
  }
  if (f.fotoId) return f.fotoId;

  let caminho = f.storagePath;
  if (!caminho) {
    caminho = `${f.obraId}/${crypto.randomUUID()}.jpg`;
    const up = await supabase.storage
      .from('fotos')
      .upload(caminho, f.blob, { contentType: 'image/jpeg', upsert: true });
    if (up.error) throw up.error;
    await db.fotos.update(localId, { storagePath: caminho });
  }

  const { data: userData } = await supabase.auth.getUser();
  const pessoaRes = await supabase
    .from('pessoa')
    .select('id')
    .eq('user_id', userData.user?.id ?? '')
    .maybeSingle();
  const pessoaId = (pessoaRes.data as { id: string } | null)?.id ?? null;

  const { data, error } = await supabase
    .from('foto')
    .insert({ obra_id: f.obraId, storage_path: caminho, tirada_por: pessoaId })
    .select('id')
    .single();
  if (error) throw error;
  const fotoId = (data as { id: string }).id;
  await db.fotos.update(localId, { fotoId });
  return fotoId;
}

/** Limpa a foto local após a conclusão sincronizar. */
export async function removerFotoLocal(localId: string): Promise<void> {
  await db.fotos.delete(localId);
}
