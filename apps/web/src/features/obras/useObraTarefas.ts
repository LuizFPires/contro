import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { enfileirar } from '../../lib/sync';
import { excluirTarefa, restaurarTarefa, type EntradaTarefa } from './campo';
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

  // Salvar (criar/editar): otimista, offline e idempotente. Para nova tarefa o
  // id é gerado no cliente — o MESMO no card otimista e na op (onMutate roda
  // antes do mutationFn, com o mesmo objeto). Edição faz patch dos campos.
  const salvar = useMutation({
    mutationFn: async (t: EntradaTarefa) => {
      const id = t.id ?? crypto.randomUUID();
      await enfileirar('salvar_tarefa', { obraId, entrada: { ...t, id } });
      return id;
    },
    onMutate: async (t: EntradaTarefa) => {
      const id = t.id ?? crypto.randomUUID();
      t.id = id;
      await qc.cancelQueries({ queryKey: ['tarefas', obraId] });
      const prev = qc.getQueryData<TarefaObra[]>(['tarefas', obraId]);
      if (prev) {
        const existe = prev.some((x) => x.id === id);
        if (existe) {
          qc.setQueryData<TarefaObra[]>(
            ['tarefas', obraId],
            prev.map((x) =>
              x.id === id
                ? { ...x, texto: t.texto, responsavel_id: t.responsavelId, prazo: t.prazo }
                : x,
            ),
          );
        } else {
          const nova: TarefaObra = {
            id,
            obra_id: obraId,
            texto: t.texto,
            responsavel_id: t.responsavelId,
            responsavelNome: null,
            prazo: t.prazo,
            prazo_original: null,
            replanejamentos: 0,
            status: 'aberta',
            vinculo_tipo: t.vinculoTipo ?? null,
            vinculo_id: t.vinculoId ?? null,
            origem_texto: t.origemTexto ?? null,
          };
          qc.setQueryData<TarefaObra[]>(['tarefas', obraId], [...prev, nova]);
        }
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => reverter(ctx),
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
