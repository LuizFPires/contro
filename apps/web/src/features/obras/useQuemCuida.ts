import { useMemo } from 'react';
import type { TarefaObra } from './tarefasObra';

/** Tarefa aberta vinculada a cada item (providência ou atividade), por id do item. */
export function useQuemCuida(
  tarefas: TarefaObra[] | undefined,
  tipo: 'providencia' | 'atividade',
): Map<string, TarefaObra> {
  return useMemo(() => {
    const m = new Map<string, TarefaObra>();
    for (const t of tarefas ?? [])
      if (t.vinculo_tipo === tipo && t.vinculo_id && t.status === 'aberta') m.set(t.vinculo_id, t);
    return m;
  }, [tarefas, tipo]);
}
