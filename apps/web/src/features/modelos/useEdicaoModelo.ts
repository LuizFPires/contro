import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addDependencia,
  atualizarAtividade,
  excluirFase,
  type AtividadeEditada,
  criarFase,
  removeAtividade,
  removeDependencia,
  renomearFase,
  setDuracaoAtividade,
} from './edicao';

export function useEdicaoModelo(modeloId: string) {
  const qc = useQueryClient();
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['modelo', modeloId] });
    qc.invalidateQueries({ queryKey: ['modelos'] });
  };

  const duracao = useMutation({
    mutationFn: ({ id, dur }: { id: string; dur: number }) => setDuracaoAtividade(id, dur),
    onSuccess: invalidar,
  });
  const ligarDep = useMutation({
    mutationFn: ({ atividadeId, predId }: { atividadeId: string; predId: string }) =>
      addDependencia(modeloId, atividadeId, predId),
    onSuccess: invalidar,
  });
  const desligarDep = useMutation({
    mutationFn: ({ atividadeId, predId }: { atividadeId: string; predId: string }) =>
      removeDependencia(atividadeId, predId),
    onSuccess: invalidar,
  });
  const excluirAtv = useMutation({
    mutationFn: (id: string) => removeAtividade(id),
    onSuccess: invalidar,
  });
  const renomearFaseM = useMutation({
    mutationFn: ({ id, titulo }: { id: string; titulo: string }) => renomearFase(id, titulo),
    onSuccess: invalidar,
  });
  const criarFaseM = useMutation({
    mutationFn: ({ titulo, ordem }: { titulo: string; ordem: number }) =>
      criarFase(modeloId, titulo, ordem),
    onSuccess: invalidar,
  });

  const excluirFaseM = useMutation({
    mutationFn: (id: string) => excluirFase(id),
    onSuccess: invalidar,
  });
  const editarAtv = useMutation({
    mutationFn: (v: { atv: { id: string; fase_id: string }; dados: AtividadeEditada }) =>
      atualizarAtividade(modeloId, v.atv, v.dados),
    onSuccess: invalidar,
    onError: invalidar,
  });

  return {
    excluirFase: excluirFaseM,
    editarAtv,
    duracao,
    ligarDep,
    desligarDep,
    excluirAtv,
    renomearFase: renomearFaseM,
    criarFase: criarFaseM,
  };
}
