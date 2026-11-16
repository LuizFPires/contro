import { useQuery } from '@tanstack/react-query';
import {
  avancoFisicoDaObra,
  duInclusivo,
  type AvancoFisicoObra,
  type Medicao,
  type ProjecaoAtividade,
} from '@contro/core';
import { supabase } from '../../lib/supabase';
import { cronogramaDaObra, hojeISO, mapasDeDependencia, type LinhaDependencia } from '../obras/api';

export interface AtividadeRelatorio extends ProjecaoAtividade {
  nome: string;
  fase: string;
  prestador: string | null;
  unidade: string;
  total: number;
}

export interface ObraRelatorio extends Omit<AvancoFisicoObra, 'atividades'> {
  id: string;
  nome: string;
  atividades: AtividadeRelatorio[];
}

interface LinhaAtv {
  id: string;
  obra_id: string;
  nome: string;
  fase_id: string;
  duracao_du: number;
  pai_id: string | null;
  em_sequencia: boolean;
  inicio_manual: string | null;
  concluida_em: string | null;
  prestador: string | null;
  quant_total: number | null;
  quant_unidade: string | null;
}

interface LinhaMedicao extends Medicao {
  obra_id: string;
  atividade_id: string;
}

/**
 * Avanço físico das obras em andamento (Contorno) que têm alguma atividade com
 * quantitativo. Tudo numa ida (5 consultas em paralelo, sem N+1); os derivados
 * saem do core.
 */
export async function carregarAvancoFisico(hoje = hojeISO()): Promise<ObraRelatorio[]> {
  if (!supabase) return [];
  const sb = supabase;
  const emb = 'o:obra!inner(ambiente,status,deleted_at)';
  const daContorno = <Q extends { eq: (c: string, v: string) => Q; is: (c: string, v: null) => Q }>(
    q: Q,
  ): Q => q.eq('o.ambiente', 'contorno').eq('o.status', 'ativa').is('o.deleted_at', null);
  const [obrasRes, fasesRes, atvsRes, depsRes, medsRes] = await Promise.all([
    sb
      .from('obra')
      .select('id,nome,inicio,entrega_original')
      .eq('status', 'ativa')
      .eq('ambiente', 'contorno')
      .is('deleted_at', null),
    daContorno(sb.from('obra_fase').select(`id,obra_id,ordem,titulo,preliminar,${emb}`)),
    daContorno(
      sb
        .from('obra_atividade')
        .select(
          'id,obra_id,nome,fase_id,duracao_du,pai_id,em_sequencia,inicio_manual,concluida_em,' +
            `prestador,quant_total,quant_unidade,${emb}`,
        )
        .is('deleted_at', null),
    ),
    daContorno(
      sb
        .from('obra_dependencia')
        .select(`obra_id,atividade_id,predecessora_id,defasagem_du,${emb}`),
    ),
    daContorno(
      sb
        .from('obra_medicao')
        .select(`id,obra_id,atividade_id,tipo,de,ate,quantidade,pessoas,${emb}`)
        .is('deleted_at', null),
    ),
  ]);
  const erro = obrasRes.error ?? fasesRes.error ?? atvsRes.error ?? depsRes.error ?? medsRes.error;
  if (erro) throw erro;

  const obras = (obrasRes.data ?? []) as {
    id: string;
    nome: string;
    inicio: string;
    entrega_original: string | null;
  }[];
  const fases = (fasesRes.data ?? []) as unknown as {
    id: string;
    obra_id: string;
    ordem: number;
    titulo: string;
    preliminar: boolean;
  }[];
  const atvs = (atvsRes.data ?? []) as unknown as LinhaAtv[];
  const deps = (depsRes.data ?? []) as unknown as LinhaDependencia[];
  const meds = (medsRes.data ?? []) as unknown as LinhaMedicao[];

  const mapas = mapasDeDependencia(deps, new Set(atvs.map((a) => a.id)));
  const medsPorAtv = new Map<string, Medicao[]>();
  for (const m of meds)
    medsPorAtv.set(m.atividade_id, [
      ...(medsPorAtv.get(m.atividade_id) ?? []),
      {
        id: m.id,
        tipo: m.tipo,
        de: m.de,
        ate: m.ate,
        quantidade: Number(m.quantidade),
        pessoas: Number(m.pessoas),
      },
    ]);
  const tituloFase = new Map(fases.map((f) => [f.id, f.titulo]));

  const resultado: ObraRelatorio[] = [];
  for (const o of obras) {
    const { cron, entrada, minhasAtvs } = cronogramaDaObra(o, fases, atvs, mapas);
    // Só atividades da obra (sem pré-obra), de topo, com quantitativo.
    const comQuant = minhasAtvs.filter((a) => !a.pai_id && a.quant_total && a.quant_unidade);
    if (!comQuant.length) continue;
    let r: AvancoFisicoObra;
    try {
      r = avancoFisicoDaObra(
        {
          inicio: o.inicio,
          hoje,
          atividades: entrada,
          concluidas: new Set(
            minhasAtvs.filter((a) => !a.pai_id && a.concluida_em).map((a) => a.id),
          ),
          nomes: {},
          entregaOriginal: o.entrega_original,
        },
        comQuant.map((a) => {
          const c = cron.porId[a.id];
          const inicio = c?.inicio_previsto ?? o.inicio;
          const fim = c?.fim_previsto ?? inicio;
          return {
            id: a.id,
            q: {
              total: Number(a.quant_total),
              unidade: a.quant_unidade as string,
              pessoas: null,
              inicio,
              fim,
              du: Math.max(1, duInclusivo(inicio, fim)),
            },
            medicoes: medsPorAtv.get(a.id) ?? [],
            concluida: Boolean(a.concluida_em),
          };
        }),
      );
    } catch {
      continue; // cronograma inválido (ciclo): a obra fica fora do relatório
    }
    const porId = new Map(comQuant.map((a) => [a.id, a]));
    resultado.push({
      ...r,
      id: o.id,
      nome: o.nome,
      atividades: r.atividades.map((p) => {
        const a = porId.get(p.id) as LinhaAtv;
        return {
          ...p,
          nome: a.nome,
          fase: tituloFase.get(a.fase_id) ?? '',
          prestador: a.prestador,
          unidade: a.quant_unidade as string,
          total: Number(a.quant_total),
        };
      }),
    });
  }
  // Obras que mais atrasam a inauguração no ritmo atual primeiro.
  return resultado.sort(
    (a, b) =>
      b.impactoDu - a.impactoDu ||
      b.atrasoNoRitmoDu - a.atrasoNoRitmoDu ||
      a.nome.localeCompare(b.nome),
  );
}

export function useAvancoFisico() {
  return useQuery({
    queryKey: ['avanco-fisico'],
    queryFn: () => carregarAvancoFisico(),
    staleTime: 30_000,
  });
}
