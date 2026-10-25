import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import {
  concluirTarefa,
  excluirTarefa,
  reabrirTarefa,
  restaurarTarefa,
  salvarTarefa,
  type EntradaTarefa,
} from './campo';
import { loadTarefas } from './tarefasObra';

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
  const concluir = useMutation({
    mutationFn: (id: string) => concluirTarefa(id),
    onSuccess: inval,
  });
  const reabrir = useMutation({ mutationFn: (id: string) => reabrirTarefa(id), onSuccess: inval });
  const excluir = useMutation({ mutationFn: (id: string) => excluirTarefa(id), onSuccess: inval });
  const restaurar = useMutation({
    mutationFn: (id: string) => restaurarTarefa(id),
    onSuccess: inval,
  });

  return { query, salvar, concluir, reabrir, excluir, restaurar };
}
