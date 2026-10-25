import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adicionarPredecessora,
  adicionarProvidencia,
  ajustarInicio,
  concluirComFoto,
  editarDuracao,
  editarPrestador,
  marcarProvidencia,
  marcarSubitem,
  removerPredecessora,
  removerProvidencia,
} from './campo';

export function useObraCampo(obraId: string) {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['obra', obraId] });
    qc.invalidateQueries({ queryKey: ['obras'] });
  };

  const subitem = useMutation({
    mutationFn: ({ id, feito }: { id: string; feito: boolean }) => marcarSubitem(id, feito),
    onSuccess: inval,
  });
  const prestador = useMutation({
    mutationFn: ({ id, prestador }: { id: string; prestador: string | null }) =>
      editarPrestador(id, prestador),
    onSuccess: inval,
  });
  const providencia = useMutation({
    mutationFn: ({ id, feito }: { id: string; feito: boolean }) => marcarProvidencia(id, feito),
    onSuccess: inval,
  });
  const addProvidencia = useMutation({
    mutationFn: (p: {
      atividadeId: string;
      tipo: 'contratacao' | 'locacao' | 'compra';
      descricao: string;
    }) => adicionarProvidencia(obraId, p.atividadeId, p.tipo, p.descricao),
    onSuccess: inval,
  });
  const removerProv = useMutation({
    mutationFn: (id: string) => removerProvidencia(id),
    onSuccess: inval,
  });
  const inicio = useMutation({
    mutationFn: ({ id, data }: { id: string; data: string }) => ajustarInicio(id, data),
    onSuccess: inval,
  });
  const duracao = useMutation({
    mutationFn: ({ id, du }: { id: string; du: number }) => editarDuracao(id, du),
    onSuccess: inval,
  });
  const addPred = useMutation({
    mutationFn: (v: { atividadeId: string; predecessoraId: string }) =>
      adicionarPredecessora(obraId, v.atividadeId, v.predecessoraId),
    onSuccess: inval,
  });
  const removerPred = useMutation({
    mutationFn: (v: { atividadeId: string; predecessoraId: string }) =>
      removerPredecessora(obraId, v.atividadeId, v.predecessoraId),
    onSuccess: inval,
  });
  const concluir = useMutation({
    mutationFn: ({ atividadeId, file }: { atividadeId: string; file: File }) =>
      concluirComFoto(obraId, atividadeId, file),
    onSuccess: inval,
  });

  return {
    subitem,
    prestador,
    providencia,
    addProvidencia,
    removerProv,
    inicio,
    duracao,
    addPred,
    removerPred,
    concluir,
  };
}
