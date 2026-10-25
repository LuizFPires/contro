import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { salvarTarefa, type EntradaTarefa } from '../obras/campo';
import { fecharReuniao, loadReuniao, salvarObservacao, type SnapshotObra } from './reuniaoApi';

/** data no formato ISO (segunda da semana). */
export function useReuniao(data: string) {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['reuniao', data] });

  const query = useQuery({
    queryKey: ['reuniao', data],
    enabled: Boolean(supabase) && Boolean(data),
    queryFn: () => loadReuniao(data),
  });

  const observacao = useMutation({
    mutationFn: (v: { reuniaoId: string; obraId: string; texto: string }) =>
      salvarObservacao(v.reuniaoId, v.obraId, v.texto),
    onSuccess: inval,
  });

  const fechar = useMutation({
    mutationFn: (v: { id: string; snapshots: SnapshotObra[] }) => fecharReuniao(v.id, v.snapshots),
    onSuccess: inval,
  });

  const criarAcao = useMutation({
    mutationFn: (v: { obraId: string; entrada: EntradaTarefa }) =>
      salvarTarefa(v.obraId, v.entrada),
    onSuccess: inval,
  });

  return { query, observacao, fechar, criarAcao };
}
