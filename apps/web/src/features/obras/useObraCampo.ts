import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ajustarInicio,
  concluirComFoto,
  editarPrestador,
  marcarProvidencia,
  marcarSubitem,
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
    mutationFn: ({ id, status }: { id: string; status: 'pendente' | 'feito' }) =>
      marcarProvidencia(id, status),
    onSuccess: inval,
  });
  const inicio = useMutation({
    mutationFn: ({ id, data }: { id: string; data: string }) => ajustarInicio(id, data),
    onSuccess: inval,
  });
  const concluir = useMutation({
    mutationFn: ({ atividadeId, file }: { atividadeId: string; file: File }) =>
      concluirComFoto(obraId, atividadeId, file),
    onSuccess: inval,
  });

  return { subitem, prestador, providencia, inicio, concluir };
}
