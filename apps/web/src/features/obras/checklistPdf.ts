import { classificarPendencias } from '@contro/core';
import type { PendenciaObra } from './pendenciasObra';

export function pendenciasParaPdf(
  lista: PendenciaObra[],
  responsavel: string,
  atividadeId?: string,
) {
  return classificarPendencias(
    lista.filter(
      (p) =>
        (!atividadeId || p.atividade_id === atividadeId) &&
        (responsavel === 'todos' || (p.responsavel_id ?? '') === responsavel),
    ),
  ).pendentes;
}

export interface FotoPdf {
  data: string;
  largura: number;
  altura: number;
}
export async function fotoParaPdf(url: string): Promise<FotoPdf> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error('Falha ao carregar foto');
  const blobUrl = URL.createObjectURL(await resp.blob());
  try {
    const img = new Image();
    img.src = blobUrl;
    await img.decode();
    const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar a foto');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return {
      data: canvas.toDataURL('image/jpeg', 0.85),
      largura: canvas.width,
      altura: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/** A4 retrato, texto selecionável e fotos incorporadas; nunca omite uma foto silenciosamente. */
export async function gerarChecklistPdf(
  obra: string,
  filtro: string,
  pendencias: PendenciaObra[],
  carregarFoto = fotoParaPdf,
): Promise<Blob> {
  if (!pendencias.length) throw new Error('Não há pendências abertas para este responsável.');
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const crit = { alta: 'ALTA', media: 'MÉDIA', baixa: 'BAIXA' };
  let y = 15;
  const linha = (texto: string, bold = false, size = 10) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const linhas = doc.splitTextToSize(texto, 180) as string[];
    for (const t of linhas) {
      if (y > 275) {
        doc.addPage();
        y = 15;
      }
      doc.text(t, 15, y);
      y += size * 0.45 + 1;
    }
    y += 2;
  };
  const data = (v: string) =>
    v.length === 10 ? v.split('-').reverse().join('/') : new Date(v).toLocaleString('pt-BR');
  for (const [i, p] of pendencias.entries()) {
    if (i) doc.addPage();
    y = 15;
    linha('CONTRO · Check list de pendências', true, 16);
    linha(`Obra: ${obra}`, true);
    linha(
      `Filtro: ${filtro} · ${pendencias.length} pendência(s) · Gerado em ${data(new Date().toISOString())}`,
      false,
      9,
    );
    linha(`${i + 1}. Criticidade ${crit[p.criticidade]} · PENDENTE`, true, 12);
    linha(p.titulo, true, 13);
    linha(`Responsável: ${p.responsavelNome || 'Sem responsável'}`);
    linha(`Atividade: ${p.atividadeNome || 'Geral'} · Local: ${p.local || 'Não informado'}`);
    linha(`Apontada por: ${p.apontouNome || 'Não informado'} · Em: ${data(p.apontada_em)}`);
    if (p.adiada_ate)
      linha(`Adiada até: ${data(p.adiada_ate)} · Motivo: ${p.motivo_adiamento || 'Não informado'}`);
    if (p.resolvida_em)
      linha(`Resolução anterior: ${data(p.resolvida_em)} · ${p.resolveuNome || 'Não informado'}`);
    linha(`Registro: ${p.id}`, false, 8);
    if (!p.fotoAntesUrl)
      throw new Error(
        `A foto de "${p.titulo}" ainda não está disponível. Aguarde a sincronização e tente novamente.`,
      );
    for (const f of [
      { titulo: 'Foto do apontamento', url: p.fotoAntesUrl },
      ...(p.fotoDepoisUrl
        ? [{ titulo: 'Foto posterior mantida no registro reaberto', url: p.fotoDepoisUrl }]
        : []),
    ]) {
      let foto: FotoPdf;
      try {
        foto = await carregarFoto(f.url);
      } catch {
        throw new Error(
          `Não foi possível carregar a foto de "${p.titulo}". Confira a conexão e tente novamente.`,
        );
      }
      const escala = Math.min(180 / foto.largura, 125 / foto.altura);
      const w = foto.largura * escala,
        h = foto.altura * escala;
      if (y + h + 12 > 278) {
        doc.addPage();
        y = 15;
        linha(`Pendência ${i + 1} · foto (continuação)`, true);
      }
      linha(f.titulo, true, 9);
      doc.addImage(foto.data, 'JPEG', 15 + (180 - w) / 2, y, w, h);
      y += h + 8;
    }
  }
  const total = doc.getNumberOfPages();
  for (let n = 1; n <= total; n++) {
    doc.setPage(n);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`CONTRO · ${n} / ${total}`, 195, 289, { align: 'right' });
  }
  return doc.output('blob');
}
