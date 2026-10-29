import { nomeCurto } from '@contro/core';
import type { StatusTarefa } from '@contro/core';
import { supabase } from '../../lib/supabase';

export interface TarefaObra {
  id: string;
  obra_id: string;
  texto: string;
  responsavel_id: string | null;
  responsavelNome: string | null;
  observacao: string | null;
  prazo: string;
  prazo_original: string | null;
  replanejamentos: number;
  status: StatusTarefa;
  vinculo_tipo: 'providencia' | 'atividade' | null;
  vinculo_id: string | null;
  origem_texto: string | null;
  /** Avanço informado (0..99) e comentário de quem cuida. */
  avanco_pct: number;
  comentario: string | null;
  avanco_em: string | null;
  feita_em: string | null;
}

interface LinhaTarefa {
  id: string;
  obra_id: string;
  texto: string;
  responsavel_id: string | null;
  prazo: string;
  prazo_original: string | null;
  replanejamentos: number;
  status: StatusTarefa;
  vinculo_tipo: 'providencia' | 'atividade' | null;
  vinculo_id: string | null;
  origem_texto: string | null;
  observacao: string | null;
  responsavel_nome: string | null;
  avanco_pct: number | null;
  comentario: string | null;
  avanco_em: string | null;
  feita_em: string | null;
  responsavel: { nome: string } | null;
}

export async function loadTarefas(obraId: string): Promise<TarefaObra[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('tarefa')
    .select(
      'id,obra_id,texto,responsavel_id,prazo,prazo_original,replanejamentos,status,vinculo_tipo,vinculo_id,origem_texto,observacao,responsavel_nome,' +
        'avanco_pct,comentario,avanco_em,feita_em,' +
        'responsavel:pessoa!responsavel_id(nome)',
    )
    .eq('obra_id', obraId)
    .is('deleted_at', null);

  const linhas = (data ?? []) as unknown as LinhaTarefa[];
  return linhas.map((l) => ({
    id: l.id,
    obra_id: l.obra_id,
    texto: l.texto,
    responsavel_id: l.responsavel_id,
    responsavelNome: nomeCurto(l.responsavel?.nome ?? l.responsavel_nome) || null,
    observacao: l.observacao,
    prazo: l.prazo,
    prazo_original: l.prazo_original,
    replanejamentos: l.replanejamentos,
    status: l.status,
    vinculo_tipo: l.vinculo_tipo,
    vinculo_id: l.vinculo_id,
    origem_texto: l.origem_texto,
    avanco_pct: l.avanco_pct ?? 0,
    comentario: l.comentario,
    avanco_em: l.avanco_em,
    feita_em: l.feita_em,
  }));
}
