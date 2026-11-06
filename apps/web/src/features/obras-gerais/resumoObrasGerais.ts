import {
  acoesDaObraGeral,
  agendaObraGeral,
  eficienciaObraGeral,
  type Acao,
  type AgendaObra,
  type AtividadeGeral,
  type DataISO,
  type EficienciaGeral,
  type PapelGeral,
} from '@contro/core';
import { supabase } from '../../lib/supabase';

export interface ResumoObraGeral {
  id: string;
  nome: string;
  cidade: string | null;
  papel: 'administrador' | 'coordenador' | 'membro';
  agenda: AgendaObra;
  acoes: Acao[];
  eficiencia: EficienciaGeral;
  pessoas: number;
}

interface PessoaLinha {
  id: string;
  nome: string;
  ativo: boolean;
  deleted_at: string | null;
}

type AtividadeLinha = AtividadeGeral & { obra_id: string };

/**
 * Resumo de todas as obras gerais que a pessoa vê (Hoje, ações e eficiência por obra), em uma
 * rodada de consultas, sem N+1. Erro de consulta lança.
 */
export async function carregarResumoObrasGerais(
  pessoa: { id: string; administrador: boolean; papelGeral: PapelGeral | null },
  hoje: DataISO,
): Promise<ResumoObraGeral[]> {
  if (!supabase) return [];
  const [oRes, aRes, partRes, admRes] = await Promise.all([
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
  ]);

  const falha = [oRes, aRes, partRes, admRes].find((r) => r.error)?.error;
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

  const papel = pessoa.administrador ? 'administrador' : (pessoa.papelGeral ?? 'membro');

  return obras.map((o) => {
    const ativs = atividadesPorObra.get(o.id) ?? [];
    return {
      id: o.id,
      nome: o.nome,
      cidade: o.cidade,
      papel,
      agenda: agendaObraGeral({ atividades: ativs, hoje, pessoaId: pessoa.id, nomes }),
      acoes: acoesDaObraGeral(ativs, o.id, o.nome, nomes),
      eficiencia: eficienciaObraGeral(ativs, hoje),
      pessoas: pessoasPorObra.get(o.id)?.size ?? 0,
    };
  });
}
