import { supabase } from '../../lib/supabase';

/** Comprime no aparelho: lado maior até 1600px, JPEG ~0,75 (CLAUDE.md). */
export async function comprimirImagem(file: File, maxLado = 1600, q = 0.75): Promise<Blob> {
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
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', q),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
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
