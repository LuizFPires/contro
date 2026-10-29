import { useRef } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { enfileirar } from '../../lib/sync';
import { type EntradaTarefa } from './campo';
import { loadTarefas, type TarefaObra } from './tarefasObra';

const chave = (obraId: string) => ['tarefas', obraId];

/** Tarefas de uma obra (boletim). */
export function useObraTarefas(obraId: string) {
  const query = useQuery({
    queryKey: chave(obraId),
    enabled: Boolean(supabase) && Boolean(obraId),
    queryFn: () => loadTarefas(obraId),
  });
  return { query };
}

/** Tarefas de várias obras (tela Tarefas da equipe), no mesmo cache por obra. */
export function useTarefasDasObras(obraIds: string[]) {
  return useQueries({
    queries: obraIds.map((id) => ({
      queryKey: chave(id),
      enabled: Boolean(supabase),
      queryFn: () => loadTarefas(id),
    })),
    combine: (rs) => ({
      tarefas: rs.flatMap((r) => r.data ?? []),
      carregando: rs.some((r) => r.isLoading),
    }),
  });
}

interface Alvo {
  obraId: string;
  id: string;
}

/**
 * Ações de tarefa (criar/editar, concluir, reabrir, excluir, restaurar). Cada
 * chamada diz a obra; todas são otimistas, offline e idempotentes (fila).
 */
export function useTarefasAcoes() {
  const qc = useQueryClient();
  // Tarefas removidas, à espera do "Desfazer" (re-adicionar otimista offline).
  const removidas = useRef(new Map<string, TarefaObra>());

  const trocar = async (obraId: string, troca: (l: TarefaObra[]) => TarefaObra[]) => {
    await qc.cancelQueries({ queryKey: chave(obraId) });
    const prev = qc.getQueryData<TarefaObra[]>(chave(obraId));
    if (prev) qc.setQueryData<TarefaObra[]>(chave(obraId), troca(prev));
    return { obraId, prev };
  };
  const reverter = (ctx: { obraId: string; prev?: TarefaObra[] } | undefined) => {
    if (ctx?.prev) qc.setQueryData(chave(ctx.obraId), ctx.prev);
  };

  // Salvar (criar/editar). Para nova tarefa o id é gerado no cliente — o MESMO
  // no card otimista e na op (onMutate roda antes do mutationFn, com o mesmo
  // objeto). Edição faz patch dos campos.
  const salvar = useMutation({
    networkMode: 'always',
    mutationFn: async (v: { obraId: string; entrada: EntradaTarefa }) => {
      const id = v.entrada.id ?? crypto.randomUUID();
      await enfileirar('salvar_tarefa', { obraId: v.obraId, entrada: { ...v.entrada, id } });
      return id;
    },
    onMutate: ({ obraId, entrada: t }) => {
      const id = t.id ?? crypto.randomUUID();
      t.id = id;
      return trocar(obraId, (prev) =>
        prev.some((x) => x.id === id)
          ? prev.map((x) =>
              x.id === id
                ? { ...x, texto: t.texto, responsavel_id: t.responsavelId, prazo: t.prazo }
                : x,
            )
          : [
              ...prev,
              {
                id,
                obra_id: obraId,
                texto: t.texto,
                responsavel_id: t.responsavelId,
                responsavelNome: t.responsavelNome ?? null,
                observacao: t.observacao ?? null,
                prazo: t.prazo,
                prazo_original: null,
                replanejamentos: 0,
                status: 'aberta',
                vinculo_tipo: t.vinculoTipo ?? null,
                vinculo_id: t.vinculoId ?? null,
                origem_texto: t.origemTexto ?? null,
                avanco_pct: 0,
                comentario: null,
                avanco_em: null,
                feita_em: null,
              },
            ],
      );
    },
    onError: (_e, _v, ctx) => reverter(ctx),
  });

  const status = (s: 'aberta' | 'feita') => (v: Alvo) =>
    trocar(v.obraId, (prev) => prev.map((t) => (t.id === v.id ? { ...t, status: s } : t)));

  // Concluir/reabrir são ações de campo: otimistas, offline e idempotentes.
  const concluir = useMutation({
    networkMode: 'always',
    mutationFn: (v: Alvo) => enfileirar('concluir_tarefa', { obraId: v.obraId, id: v.id }),
    onMutate: status('feita'),
    onError: (_e, _v, ctx) => reverter(ctx),
  });
  const reabrir = useMutation({
    networkMode: 'always',
    mutationFn: (v: Alvo) => enfileirar('reabrir_tarefa', { obraId: v.obraId, id: v.id }),
    onMutate: status('aberta'),
    onError: (_e, _v, ctx) => reverter(ctx),
  });
  // Avanço e comentário da ação (Minhas ações): também é ação de campo.
  const avancar = useMutation({
    networkMode: 'always',
    mutationFn: (v: Alvo & { pct: number; comentario: string | null }) =>
      enfileirar('informar_avanco_tarefa', {
        obraId: v.obraId,
        id: v.id,
        pct: v.pct,
        comentario: v.comentario,
      }),
    onMutate: (v) =>
      trocar(v.obraId, (prev) =>
        prev.map((t) =>
          t.id === v.id
            ? {
                ...t,
                avanco_pct: v.pct,
                comentario: v.comentario,
                avanco_em: new Date().toISOString(),
              }
            : t,
        ),
      ),
    onError: (_e, _v, ctx) => reverter(ctx),
  });
  // Excluir/restaurar: guarda a tarefa removida para o "Desfazer" (regra 10)
  // re-adicionar na hora, mesmo offline.
  const excluir = useMutation({
    networkMode: 'always',
    mutationFn: (v: Alvo) => enfileirar('excluir_tarefa', { obraId: v.obraId, id: v.id }),
    onMutate: (v: Alvo) => {
      const alvo = qc.getQueryData<TarefaObra[]>(chave(v.obraId))?.find((t) => t.id === v.id);
      if (alvo) {
        removidas.current.set(v.id, alvo);
        // Passada a janela do "Desfazer", libera o stash (evita acúmulo).
        window.setTimeout(() => removidas.current.delete(v.id), 8000);
      }
      return trocar(v.obraId, (prev) => prev.filter((t) => t.id !== v.id));
    },
    onError: (_e, _v, ctx) => reverter(ctx),
  });
  const restaurar = useMutation({
    networkMode: 'always',
    mutationFn: (v: Alvo) => enfileirar('restaurar_tarefa', { obraId: v.obraId, id: v.id }),
    onMutate: (v: Alvo) => {
      const item = removidas.current.get(v.id);
      return trocar(v.obraId, (prev) =>
        item && !prev.some((t) => t.id === v.id) ? [...prev, item] : prev,
      );
    },
    // Só libera o stash quando o enfileiramento deu certo (onError pode reverter).
    onSuccess: (_d, v) => removidas.current.delete(v.id),
    onError: (_e, _v, ctx) => reverter(ctx),
  });

  return { salvar, concluir, reabrir, avancar, excluir, restaurar };
}
