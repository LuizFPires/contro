import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import {
  duplicarModelo,
  excluirModelo,
  listarModelos,
  renomearModelo,
  restaurarModelo,
} from './api';

const KEY = ['modelos'];

export function useModelos() {
  return useQuery({
    queryKey: KEY,
    enabled: Boolean(supabase),
    queryFn: listarModelos,
  });
}

export function useModelosMutations() {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: KEY });

  const duplicar = useMutation({
    mutationFn: ({
      origem,
      nome,
      subtitulo,
    }: {
      origem: string | null;
      nome: string;
      subtitulo: string | null;
    }) => duplicarModelo(origem, nome, subtitulo),
    onSuccess: invalidar,
  });

  const renomear = useMutation({
    mutationFn: ({ id, nome, subtitulo }: { id: string; nome: string; subtitulo: string | null }) =>
      renomearModelo(id, nome, subtitulo),
    onSuccess: invalidar,
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirModelo(id),
    onSuccess: invalidar,
  });

  const restaurar = useMutation({
    mutationFn: (id: string) => restaurarModelo(id),
    onSuccess: invalidar,
  });

  return { duplicar, renomear, excluir, restaurar };
}
