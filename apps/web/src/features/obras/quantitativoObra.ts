import { useQuery } from '@tanstack/react-query';
import { duInclusivo, type Ambiente, type Medicao, type Quantitativo } from '@contro/core';
import { supabase } from '../../lib/supabase';
import type { ObraAtv, ObraCompleta } from './detalhe';

/** Quantitativo da atividade com as datas do cronograma vigente (null sem quantitativo). */
export function quantDe(obra: ObraCompleta, a: ObraAtv): Quantitativo | null {
  if (!a.quant_total || !a.quant_unidade) return null;
  return {
    total: a.quant_total,
    unidade: a.quant_unidade,
    pessoas: a.quant_pessoas ?? 1,
    ...datasDe(obra, a),
  };
}

/** Início, fim e dias úteis previstos da atividade (cronograma vigente). */
export function datasDe(
  obra: ObraCompleta,
  a: ObraAtv,
): { inicio: string; fim: string; du: number } {
  const c = obra.cron.porId[a.id] ?? obra.pre[a.id];
  const inicio = c?.inicio_previsto ?? obra.inicio;
  const fim = c?.fim_previsto ?? inicio;
  return { inicio, fim, du: Math.max(1, duInclusivo(inicio, fim)) };
}

export interface MedicaoOutraObra {
  obraId: string;
  obra: string;
  prestador: string | null;
  m: Medicao;
}

/**
 * Medições da MESMA atividade (mesmo nome e unidade) em todas as obras que a
 * pessoa vê no ambiente (RLS), para o comparativo e o histórico do prestador.
 */
export function useMedicoesDaAtividade(
  nome: string | null,
  unidade: string | null,
  ambiente: Ambiente,
) {
  return useQuery({
    queryKey: ['medicoes-atividade', ambiente, nome?.trim().toLowerCase(), unidade],
    enabled: Boolean(supabase) && Boolean(nome) && Boolean(unidade),
    staleTime: 60_000,
    queryFn: async (): Promise<MedicaoOutraObra[]> => {
      if (!supabase || !nome || !unidade) return [];
      // ilike sem curingas: o nome inteiro, sem diferenciar maiúsculas.
      const exato = nome.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
      const { data, error } = await supabase
        .from('obra_medicao')
        .select(
          'id,tipo,de,ate,quantidade,pessoas,prestador,obra_id,' +
            'atv:obra_atividade!inner(nome,quant_unidade),o:obra!inner(nome,ambiente,deleted_at)',
        )
        .is('deleted_at', null)
        .ilike('atv.nome', exato)
        .eq('atv.quant_unidade', unidade)
        .eq('o.ambiente', ambiente)
        .is('o.deleted_at', null);
      if (error) throw error;
      return (
        (data ?? []) as unknown as {
          id: string;
          tipo: 'dia' | 'periodo';
          de: string;
          ate: string;
          quantidade: number;
          pessoas: number;
          prestador: string | null;
          obra_id: string;
          o: { nome: string };
        }[]
      ).map((r) => ({
        obraId: r.obra_id,
        obra: r.o.nome,
        prestador: r.prestador,
        m: {
          id: r.id,
          tipo: r.tipo,
          de: r.de,
          ate: r.ate,
          quantidade: Number(r.quantidade),
          pessoas: Number(r.pessoas),
        },
      }));
    },
  });
}

/** Baixa um arquivo gerado no aparelho. */
export function baixarArquivo(conteudo: Blob, nome: string) {
  const url = URL.createObjectURL(conteudo);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = nome.replace(/[/\\?%*:|"<>]/g, '-');
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Planilha (CSV com ";" e BOM, abre direto no Excel com acentos). */
export function planilhaCsv(linhas: string[][]): Blob {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const corpo = linhas.map((l) => l.map(esc).join(';')).join('\r\n');
  return new Blob(['﻿', corpo], { type: 'text/csv;charset=utf-8' });
}

/** PDF simples (título, subtítulo e tabela), gerado no aparelho, sem emoji. */
export async function pdfTabela(args: {
  titulo: string;
  subtitulo: string[];
  linhas: string[][];
  larguras: number[];
}): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const limpa = (t: string) => t.replace(/→/g, '-').replace(/−/g, '-');
  let y = 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(limpa(args.titulo), 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const s of args.subtitulo) {
    doc.text(limpa(s), 14, y);
    y += 5;
  }
  y += 3;
  const linhaTabela = (cols: string[], negrito: boolean) => {
    if (y > 282) {
      doc.addPage();
      y = 18;
    }
    doc.setFont('helvetica', negrito ? 'bold' : 'normal');
    let x = 14;
    cols.forEach((c, i) => {
      doc.text(limpa(c), x, y, { maxWidth: args.larguras[i] - 2 });
      x += args.larguras[i];
    });
    y += 6;
  };
  args.linhas.forEach((l, i) => linhaTabela(l, i === 0));
  return doc.output('blob');
}
