import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface DisparoPendente {
  id: string;
  obraId: string;
  obraNome: string;
  edicao: 'principal' | 'fechamento';
  semanaInicio: string; // YYYY-MM-DD (segunda)
  criadoEm: string;
}

interface Row {
  id: string;
  obra_id: string;
  edicao: 'principal' | 'fechamento';
  semana_inicio: string;
  criado_em: string;
  obra: { nome: string; status: string; deleted_at: string | null } | null;
}

const KEY = ['disparos-pendentes'];

/** Boletins "prontos para enviar": disparos ainda não marcados como enviados. */
export function useDisparosPendentes() {
  const qc = useQueryClient();

  const query = useQuery<DisparoPendente[]>({
    queryKey: KEY,
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('boletim_disparo')
        .select(
          'id, obra_id, edicao, semana_inicio, criado_em, obra:obra_id(nome, status, deleted_at)',
        )
        .is('enviado_em', null)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as Row[])
        .filter((r) => r.obra && !r.obra.deleted_at)
        .map((r) => ({
          id: r.id,
          obraId: r.obra_id,
          obraNome: r.obra?.nome ?? 'Obra',
          edicao: r.edicao,
          semanaInicio: r.semana_inicio,
          criadoEm: r.criado_em,
        }));
    },
  });

  const marcar = useMutation<
    void,
    Error,
    { id: string; enviado: boolean },
    { prev: DisparoPendente[] }
  >({
    mutationFn: async ({ id, enviado }) => {
      if (!supabase) throw new Error('Supabase não configurado.');
      const { error } = await supabase
        .from('boletim_disparo')
        .update({ enviado_em: enviado ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, enviado }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<DisparoPendente[]>(KEY) ?? [];
      if (enviado)
        qc.setQueryData(
          KEY,
          prev.filter((d) => d.id !== id),
        );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });

  return {
    query,
    marcarEnviado: (id: string) => marcar.mutateAsync({ id, enviado: true }),
    desfazerEnviado: (id: string) => marcar.mutateAsync({ id, enviado: false }),
  };
}
