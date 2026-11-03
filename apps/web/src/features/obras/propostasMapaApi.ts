import { supabase } from '../../lib/supabase';

export interface PropostaMapa {
  id: string;
  obra_id: string;
  atividade_id: string;
  contratado: string;
  descricao: string;
  prazo: string | null;
  recebida: boolean;
  solucionada_por_contratacao?: boolean;
  mapa: { nome: string; deleted_at: string | null };
}

export async function carregarPropostas(obraIds: string[]): Promise<PropostaMapa[]> {
  if (!supabase || !obraIds.length) return [];
  const { data, error } = await supabase
    .from('mapa_proposta')
    .select(
      'id,obra_id,atividade_id,contratado,descricao,prazo,recebida,solucionada_por_contratacao,mapa:obra_atividade!atividade_id(nome,deleted_at)',
    )
    .in('obra_id', obraIds)
    .is('deleted_at', null)
    .order('created_at');
  if (error) throw error;
  return ((data ?? []) as unknown as PropostaMapa[]).filter((p) => p.mapa && !p.mapa.deleted_at);
}
