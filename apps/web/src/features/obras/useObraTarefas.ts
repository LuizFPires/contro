import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { enfileirar } from '../../lib/sync';
import { excluirTarefa, restaurarTarefa, salvarTarefa, type EntradaTarefa } from './campo';
import { loadTarefas, type TarefaObra } from './tarefasObra';

export function useObraTarefas(obraId: string) {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['tarefas', obraId] });
    // efeitos de vínculo mexem na obra (providência/liberação)
    qc.invalidateQueries({ queryKey: ['obra', obraId] });
  };

  const query = useQuery({
    queryKey: ['tarefas', obraId],
    enabled: Boolean(supabase) && Boolean(obraId),
    queryFn: () => loadTarefas(obraId),
  });

  const salvar = useMutation({
    mutationFn: (t: EntradaTarefa) => salvarTarefa(obraId, t),
    onSuccess: inval,
  });
  // Patch otimista do status de uma tarefa no cache da lista.
  const patchStatus = async (id: string, status: 'aberta' | 'feita') => {
    await qc.cancelQueries({ queryKey: ['tarefas', obraId] });
    const prev = qc.getQueryData<TarefaObra[]>(['tarefas', obraId]);
    if (prev) {
      qc.setQueryData<TarefaObra[]>(
        ['tarefas', obraId],
        prev.map((t) => (t.id === id ? { ...t, status } : t)),
      );
    }
    return { prev };
  };
  const reverter = (ctx: { prev?: TarefaObra[] } | undefined) => {
    if (ctx?.prev) qc.setQueryData(['tarefas', obraId], ctx.prev);
  };

  // Concluir/reabrir são ações de campo: otimistas, offline e idempotentes.
  const concluir = useMutation({
    mutationFn: (id: string) => enfileirar('concluir_tarefa', { obraId, id }),
    onMutate: (id: string) => patchStatus(id, 'feita'),
    onError: (_e, _v, ctx) => reverter(ctx),
  });
  const reabrir = useMutation({
    mutationFn: (id: string) => enfileirar('reabrir_tarefa', { obraId, id }),
    onMutate: (id: string) => patchStatus(id, 'aberta'),
    onError: (_e, _v, ctx) => reverter(ctx),
  });
  const excluir = useMutation({ mutationFn: (id: string) => excluirTarefa(id), onSuccess: inval });
  const restaurar = useMutation({
    mutationFn: (id: string) => restaurarTarefa(id),
    onSuccess: inval,
  });

  return { query, salvar, concluir, reabrir, excluir, restaurar };
}
