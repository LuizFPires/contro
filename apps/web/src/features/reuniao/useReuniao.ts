import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import {
  concluirAtividade,
  concluirTarefa,
  reabrirTarefa,
  salvarTarefa,
  type EntradaTarefa,
} from '../obras/campo';
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

  /** Cria ou edita (remarca) uma providência da pauta. */
  const salvarProvidencia = useMutation({
    mutationFn: (v: { obraId: string; entrada: EntradaTarefa }) =>
      salvarTarefa(v.obraId, v.entrada),
    onSuccess: inval,
  });

  /** "Feito" numa atividade da semana passada: conclui sem foto. */
  const concluirAtv = useMutation({
    mutationFn: (atividadeId: string) => concluirAtividade(atividadeId, null),
    onSuccess: () => {
      void inval();
      void qc.invalidateQueries({ queryKey: ['obras'] });
    },
  });

  /** Providência da reunião anterior: "Feita" (e Desfazer). */
  const marcarFeita = useMutation({
    mutationFn: (v: { id: string; feita: boolean }) =>
      v.feita ? concluirTarefa(v.id) : reabrirTarefa(v.id),
    onSuccess: inval,
  });

  return { query, observacao, fechar, salvarProvidencia, concluirAtv, marcarFeita };
}
