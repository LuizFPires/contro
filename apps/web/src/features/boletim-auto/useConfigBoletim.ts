import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConfigBoletim, DiaSemana } from '@contro/core';
import { supabase } from '../../lib/supabase';

const KEY = ['config-boletim'];

interface Row {
  ativo: boolean;
  dia_semana: number;
  hora: string;
  fechamento_ativo: boolean;
  fechamento_dia: number;
  fechamento_hora: string;
}

function fromDb(r: Row): ConfigBoletim {
  return {
    ativo: r.ativo,
    diaSemana: r.dia_semana as DiaSemana,
    hora: r.hora.slice(0, 5),
    fechamentoAtivo: r.fechamento_ativo,
    fechamentoDia: r.fechamento_dia as DiaSemana,
    fechamentoHora: r.fechamento_hora.slice(0, 5),
  };
}

function toDb(c: ConfigBoletim): Row {
  return {
    ativo: c.ativo,
    dia_semana: c.diaSemana,
    hora: c.hora,
    fechamento_ativo: c.fechamentoAtivo,
    fechamento_dia: c.fechamentoDia,
    fechamento_hora: c.fechamentoHora,
  };
}

/** Lê e grava a configuração global do boletim automático (só gestor grava; RLS). */
export function useConfigBoletim() {
  const qc = useQueryClient();

  const query = useQuery<ConfigBoletim | null>({
    queryKey: KEY,
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('config_boletim')
        .select('ativo, dia_semana, hora, fechamento_ativo, fechamento_dia, fechamento_hora')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      return data ? fromDb(data as Row) : null;
    },
  });

  const mutation = useMutation<
    ConfigBoletim,
    Error,
    ConfigBoletim,
    { anterior: ConfigBoletim | null }
  >({
    mutationFn: async (c) => {
      if (!supabase) throw new Error('Supabase não configurado.');
      const { error } = await supabase.from('config_boletim').update(toDb(c)).eq('id', true);
      if (error) throw error;
      return c;
    },
    onMutate: async (c) => {
      await qc.cancelQueries({ queryKey: KEY });
      const anterior = qc.getQueryData<ConfigBoletim | null>(KEY) ?? null;
      qc.setQueryData(KEY, c);
      return { anterior };
    },
    onError: (_e, _c, ctx) => {
      if (ctx) qc.setQueryData(KEY, ctx.anterior);
    },
  });

  return {
    query,
    salvar: (c: ConfigBoletim) => mutation.mutateAsync(c),
    salvando: mutation.isPending,
  };
}
