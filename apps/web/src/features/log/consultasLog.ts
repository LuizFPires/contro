// Consultas do Log e do Score comuns aos dois ambientes: tarefas e pendências
// (abertas ou fechadas desde `desde`) e os eventos das três tabelas (`em >= desde`).
// Paginadas; filtradas pelos ids das obras quando a tabela tem obra_id.
import type { DataISO } from '@contro/core';
import { supabase } from '../../lib/supabase';
import { todasAsPaginas } from './paginas';
import type {
  LinhaEventoAtividade,
  LinhaEventoPendencia,
  LinhaEventoTarefa,
  LinhaPendenciaLog,
  LinhaTarefaLog,
} from './itensLog';

export type Sb = NonNullable<typeof supabase>;

const POR = 'por_pessoa:pessoa!por(nome)';

export function lerTarefasLog(sb: Sb, ids: string[], desde: DataISO): Promise<LinhaTarefaLog[]> {
  return todasAsPaginas<LinhaTarefaLog>((de, ate) =>
    sb
      .from('tarefa')
      .select(
        'id,obra_id,texto,status,prazo,prazo_original,replanejamentos,feita_em,responsavel_id,' +
          'responsavel_nome,vinculo_tipo,vinculo_id,created_at,responsavel:pessoa!responsavel_id(nome)',
      )
      .in('obra_id', ids)
      .is('deleted_at', null)
      .or(`status.eq.aberta,feita_em.gte.${desde}`)
      .order('id')
      .range(de, ate)
      .returns<LinhaTarefaLog[]>(),
  );
}

export function lerPendenciasLog(
  sb: Sb,
  ids: string[],
  desde: DataISO,
): Promise<LinhaPendenciaLog[]> {
  return todasAsPaginas<LinhaPendenciaLog>((de, ate) =>
    sb
      .from('pendencia')
      .select(
        'id,obra_id,titulo,criticidade,apontada_em,resolvida_em,status,responsavel_id,prazo,responsavel_nome,' +
          'responsavel:pessoa!responsavel_id(nome)',
      )
      .in('obra_id', ids)
      .is('deleted_at', null)
      .or(`status.eq.aberta,resolvida_em.gte.${desde}`)
      .order('id')
      .range(de, ate)
      .returns<LinhaPendenciaLog[]>(),
  );
}

/**
 * Eventos das três tabelas desde `desde` (data pura, meia-noite UTC; a borda de
 * 3 h do fuso é aceita). As tabelas de evento não têm obra_id: os de outras obras
 * são descartados nos adaptadores.
 */
export function lerEventosLog(
  sb: Sb,
  desde: DataISO,
): Promise<[LinhaEventoTarefa[], LinhaEventoPendencia[], LinhaEventoAtividade[]]> {
  return Promise.all([
    todasAsPaginas<LinhaEventoTarefa>((de, ate) =>
      sb
        .from('tarefa_evento')
        .select(`id,tarefa_id,tipo,por,em,antes,depois,${POR}`)
        .gte('em', desde)
        .order('em', { ascending: false })
        .order('id')
        .range(de, ate)
        .returns<LinhaEventoTarefa[]>(),
    ),
    todasAsPaginas<LinhaEventoPendencia>((de, ate) =>
      sb
        .from('pendencia_evento')
        .select(`id,pendencia_id,tipo,por,em,dados,${POR}`)
        .gte('em', desde)
        .order('em', { ascending: false })
        .order('id')
        .range(de, ate)
        .returns<LinhaEventoPendencia[]>(),
    ),
    todasAsPaginas<LinhaEventoAtividade>((de, ate) =>
      sb
        .from('obra_atividade_evento')
        .select(`id,atividade_id,tipo,por,em,antes,depois,${POR}`)
        .gte('em', desde)
        .order('em', { ascending: false })
        .order('id')
        .range(de, ate)
        .returns<LinhaEventoAtividade[]>(),
    ),
  ]);
}
