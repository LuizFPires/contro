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
  responsavel: { nome: string } | null;
}

export async function loadTarefas(obraId: string): Promise<TarefaObra[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('tarefa')
    .select(
      'id,obra_id,texto,responsavel_id,prazo,prazo_original,replanejamentos,status,vinculo_tipo,vinculo_id,origem_texto,observacao,responsavel_nome,' +
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
  }));
}
