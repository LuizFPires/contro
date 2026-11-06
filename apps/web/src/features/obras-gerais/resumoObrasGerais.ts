import {
  acoesCompletasObraGeral,
  agendaObraGeral,
  eficienciaObraGeral,
  PRAZOS_PENDENCIA_PADRAO,
  type AcaoGeral,
  type AgendaObra,
  type AtividadeGeral,
  type Criticidade,
  type DataISO,
  type EficienciaGeral,
  type PapelGeral,
  type PrazosPendencia,
  type ProvidenciaAcaoGeral,
} from '@contro/core';
import { supabase } from '../../lib/supabase';
import type { AcaoObra } from '../obras/acoesObra';
import type { PendenciaObra } from '../obras/pendenciasObra';
import { tarefaDaLinha, type LinhaTarefa, type TarefaObra } from '../obras/tarefasObra';

export interface ResumoObraGeral {
  id: string;
  nome: string;
  cidade: string | null;
  papel: 'administrador' | 'coordenador' | 'membro';
  agenda: AgendaObra;
  /** Atividades, tarefas e pendências abertas e providências pendentes (as ações do dia). */
  acoes: AcaoGeral[];
  eficiencia: EficienciaGeral;
  pessoas: number;
  /** Para a tela de ações refazer a conta com as tarefas e pendências do cache de cada obra. */
  atividades: AtividadeGeral[];
  providencias: ProvidenciaAcaoGeral[];
  prazosPendencia: PrazosPendencia;
  nomes: Record<string, string>;
}

interface PessoaLinha {
  id: string;
  nome: string;
  ativo: boolean;
  deleted_at: string | null;
}

type AtividadeLinha = AtividadeGeral & { obra_id: string };

interface PendenciaLinha {
  id: string;
  obra_id: string;
  titulo: string;
  criticidade: Criticidade;
  status: string;
  apontada_em: string;
  resolvida_em: string | null;
  responsavel_id: string | null;
}

type ProvidenciaLinha = ProvidenciaAcaoGeral & { obra_id: string };

interface PrazosLinha {
  obra_id?: string;
  pend_alta_du: number;
  pend_media_du: number;
  pend_baixa_du: number;
}

const prazosDaLinha = (l: PrazosLinha): PrazosPendencia => ({
  alta: l.pend_alta_du,
  media: l.pend_media_du,
  baixa: l.pend_baixa_du,
});

function agrupar<T extends { obra_id: string }>(linhas: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const l of linhas) {
    const lista = m.get(l.obra_id) ?? [];
    lista.push(l);
    m.set(l.obra_id, lista);
  }
  return m;
}

/**
 * Resumo de todas as obras gerais que a pessoa vê (Hoje, ações e eficiência por obra), em uma
 * rodada de consultas, sem N+1. As ações são as do dia (`acoesCompletasObraGeral`): atividades,
 * tarefas e pendências abertas (prazo pela config da obra) e providências pendentes. Erro de
 * consulta lança.
 */
export async function carregarResumoObrasGerais(
  pessoa: { id: string; administrador: boolean; papelGeral: PapelGeral | null },
  hoje: DataISO,
): Promise<ResumoObraGeral[]> {
  if (!supabase) return [];
  const [oRes, aRes, partRes, admRes, tRes, peRes, pvRes, cfgRes] = await Promise.all([
    supabase
      .from('obra')
      .select('id,nome,cidade')
      .eq('ambiente', 'geral')
      .eq('status', 'ativa')
      .is('deleted_at', null)
      .order('nome'),
    supabase
      .from('obra_atividade')
      .select(
        'obra_id,id,fase_id,pai_id,ordem,nome,data_prevista,data_prevista_original,replanejamentos,' +
          'responsavel_id,concluida_em,avanco_pct,foto_conclusao_id,prestador,obra!inner(ambiente)',
      )
      .eq('obra.ambiente', 'geral')
      .is('deleted_at', null)
      .order('ordem'),
    supabase.from('obra_participante').select('obra_id,pessoa(id,nome,ativo,deleted_at)'),
    supabase
      .from('pessoa')
      .select('id,nome')
      .eq('administrador', true)
      .eq('ativo', true)
      .is('deleted_at', null),
    // Só as abertas: o Hoje e o bloco contam as abertas (a tela de ações lê o cache da obra).
    supabase
      .from('tarefa')
      .select(
        'id,obra_id,texto,responsavel_id,prazo,prazo_original,replanejamentos,status,vinculo_tipo,vinculo_id,' +
          'origem_texto,observacao,responsavel_nome,avanco_pct,comentario,avanco_em,feita_em,' +
          'responsavel:pessoa!responsavel_id(nome),obra!inner(ambiente)',
      )
      .eq('obra.ambiente', 'geral')
      .eq('status', 'aberta')
      .is('deleted_at', null),
    supabase
      .from('pendencia')
      .select(
        'id,obra_id,titulo,criticidade,status,apontada_em,resolvida_em,responsavel_id,obra!inner(ambiente)',
      )
      .eq('obra.ambiente', 'geral')
      .eq('status', 'aberta')
      .is('deleted_at', null),
    supabase
      .from('obra_providencia')
      .select('id,obra_id,atividade_id,tipo,descricao,status,providenciar_ate,obra!inner(ambiente)')
      .eq('obra.ambiente', 'geral')
      .eq('status', 'pendente')
      .is('deleted_at', null),
    // Linhas próprias de config (as das obras que a pessoa vê, pela RLS).
    supabase.from('config_avisos_obra').select('obra_id,pend_alta_du,pend_media_du,pend_baixa_du'),
  ]);

  const falha = [oRes, aRes, partRes, admRes, tRes, peRes, pvRes, cfgRes].find(
    (r) => r.error,
  )?.error;
  if (falha) throw new Error(falha.message);

  const obras = (oRes.data ?? []) as unknown as {
    id: string;
    nome: string;
    cidade: string | null;
  }[];
  const atividades = (aRes.data ?? []) as unknown as AtividadeLinha[];
  const participantes = (partRes.data ?? []) as unknown as {
    obra_id: string;
    pessoa: PessoaLinha | null;
  }[];
  const admins = (admRes.data ?? []) as { id: string; nome: string }[];

  const prazosPorObra = new Map<string, PrazosPendencia>();
  for (const l of (cfgRes.data ?? []) as unknown as PrazosLinha[])
    if (l.obra_id) prazosPorObra.set(l.obra_id, prazosDaLinha(l));
  // Obra sem linha própria usa a config global: uma leitura só, pela primeira delas.
  const semLinha = obras.find((o) => !prazosPorObra.has(o.id));
  let prazosGlobais = PRAZOS_PENDENCIA_PADRAO;
  if (semLinha) {
    const { data, error } = await supabase.rpc('config_avisos_da_obra', {
      p_obra_id: semLinha.id,
    });
    if (error) throw new Error(error.message);
    if (data) prazosGlobais = prazosDaLinha(data as PrazosLinha);
  }

  const nomes: Record<string, string> = {};
  for (const a of admins) nomes[a.id] = a.nome;
  const pessoasPorObra = new Map<string, Set<string>>();
  for (const { obra_id, pessoa: p } of participantes) {
    if (!p || !p.ativo || p.deleted_at) continue;
    nomes[p.id] = p.nome;
    const conjunto = pessoasPorObra.get(obra_id) ?? new Set<string>();
    conjunto.add(p.id);
    pessoasPorObra.set(obra_id, conjunto);
  }

  const atividadesPorObra = new Map<string, AtividadeGeral[]>();
  for (const { obra_id, ...a } of atividades) {
    const lista = atividadesPorObra.get(obra_id) ?? [];
    lista.push(a as AtividadeGeral);
    atividadesPorObra.set(obra_id, lista);
  }
  const tarefasPorObra = agrupar(
    ((tRes.data ?? []) as unknown as LinhaTarefa[]).map(tarefaDaLinha),
  );
  const pendenciasPorObra = agrupar((peRes.data ?? []) as unknown as PendenciaLinha[]);
  const providenciasPorObra = agrupar((pvRes.data ?? []) as unknown as ProvidenciaLinha[]);

  const papel = pessoa.administrador ? 'administrador' : (pessoa.papelGeral ?? 'membro');

  return obras.map((o) => {
    const ativs = atividadesPorObra.get(o.id) ?? [];
    const providencias = providenciasPorObra.get(o.id) ?? [];
    const prazosPendencia = prazosPorObra.get(o.id) ?? prazosGlobais;
    const acoes = acoesCompletasObraGeral({
      obraId: o.id,
      atividades: ativs,
      tarefas: tarefasPorObra.get(o.id) ?? [],
      pendencias: pendenciasPorObra.get(o.id) ?? [],
      providencias,
      nomes,
      prazosPendencia,
    });
    return {
      id: o.id,
      nome: o.nome,
      cidade: o.cidade,
      papel,
      agenda: agendaObraGeral({ atividades: ativs, hoje, pessoaId: pessoa.id, nomes, acoes }),
      acoes,
      eficiencia: eficienciaObraGeral(ativs, hoje),
      pessoas: pessoasPorObra.get(o.id)?.size ?? 0,
      atividades: ativs,
      providencias,
      prazosPendencia,
      nomes,
    };
  });
}

/** Ação da tela de ações: a da Contorno (com o original) e a atividade de topo a abrir. */
export type AcaoObraGeral = AcaoObra & { atividadeId?: string };

/**
 * Ações de uma obra geral para a tela de ações, com as tarefas e pendências do cache da obra
 * (atualizado na hora pelas ações otimistas): a mesma conta do resumo, cada ação com o
 * original para abrir a folha certa.
 */
export function acoesDaTelaGeral(
  o: Pick<
    ResumoObraGeral,
    'id' | 'nome' | 'atividades' | 'providencias' | 'prazosPendencia' | 'nomes'
  >,
  tarefas: TarefaObra[],
  pendencias: PendenciaObra[],
): AcaoObraGeral[] {
  const tarefaPorId = new Map(tarefas.map((t) => [t.id, t]));
  const pendenciaPorId = new Map(pendencias.map((p) => [p.id, p]));
  const provPorId = new Map(o.providencias.map((p) => [p.id, p]));
  const atvPorId = new Map(o.atividades.map((a) => [a.id, a]));
  const acoes = acoesCompletasObraGeral({
    obraId: o.id,
    atividades: o.atividades,
    tarefas,
    pendencias,
    providencias: o.providencias,
    nomes: o.nomes,
    prazosPendencia: o.prazosPendencia,
  });
  const out: AcaoObraGeral[] = [];
  for (const a of acoes) {
    if (a.origem === 'tarefa') {
      const tarefa = tarefaPorId.get(a.id);
      if (tarefa) out.push({ ...a, origem: 'tarefa', tarefa });
    } else if (a.origem === 'pendencia') {
      const pendencia = pendenciaPorId.get(a.id);
      if (pendencia) out.push({ ...a, origem: 'pendencia', pendencia });
    } else if (a.origem === 'providencia') {
      const p = provPorId.get(a.id);
      if (!p) continue;
      out.push({
        ...a,
        origem: 'providencia',
        providencia: {
          id: p.id,
          obraId: o.id,
          obraNome: o.nome,
          tipo: p.tipo,
          descricao: p.descricao,
          prazo: a.prazo,
          atividadeNome: atvPorId.get(a.atividadeId ?? '')?.nome ?? '',
        },
      });
    } else {
      out.push({
        ...a,
        origem: 'atividade',
        atividade: {
          id: a.id,
          obraId: o.id,
          obraNome: o.nome,
          nome: a.texto,
          faseNome: '',
          prestador: null,
          prazo: a.prazo,
        },
      });
    }
  }
  return out;
}
