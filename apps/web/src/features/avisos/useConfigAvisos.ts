import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiaReuniao } from '@contro/core';
import { supabase } from '../../lib/supabase';

const KEY = ['config-avisos'];

export type Para = 'todos' | 'gestores';

/** Dia e horário da reunião semanal e os avisos por push (linha única, só gestor grava). */
export interface ConfigAvisos {
  reuniaoDia: DiaReuniao;
  reuniaoHora: string;
  manhaAtivo: boolean;
  manhaHora: string;
  antesAtivo: boolean;
  antesMin: number;
  resumoAtivo: boolean;
  resumoHora: string;
  resumoPara: Para;
  tarefasAtivo: boolean;
  tarefasHora: string;
  providAtivo: boolean;
  providHora: string;
  providPara: Para;
}

/** Padrão do banco (migration): reunião segunda 16h, lembretes 08:00 e 1 hora antes. */
export const PADRAO_AVISOS: ConfigAvisos = {
  reuniaoDia: 1,
  reuniaoHora: '16:00',
  manhaAtivo: true,
  manhaHora: '08:00',
  antesAtivo: true,
  antesMin: 60,
  resumoAtivo: true,
  resumoHora: '07:30',
  resumoPara: 'todos',
  tarefasAtivo: true,
  tarefasHora: '08:00',
  providAtivo: false,
  providHora: '08:00',
  providPara: 'gestores',
};

const COLUNAS =
  'reuniao_dia, reuniao_hora, manha_ativo, manha_hora, antes_ativo, antes_min, resumo_ativo, ' +
  'resumo_hora, resumo_para, tarefas_ativo, tarefas_hora, provid_ativo, provid_hora, provid_para';

interface Row {
  reuniao_dia: number;
  reuniao_hora: string;
  manha_ativo: boolean;
  manha_hora: string;
  antes_ativo: boolean;
  antes_min: number;
  resumo_ativo: boolean;
  resumo_hora: string;
  resumo_para: Para;
  tarefas_ativo: boolean;
  tarefas_hora: string;
  provid_ativo: boolean;
  provid_hora: string;
  provid_para: Para;
}

const hhmm = (t: string) => t.slice(0, 5);

function fromDb(r: Row): ConfigAvisos {
  return {
    reuniaoDia: r.reuniao_dia as DiaReuniao,
    reuniaoHora: hhmm(r.reuniao_hora),
    manhaAtivo: r.manha_ativo,
    manhaHora: hhmm(r.manha_hora),
    antesAtivo: r.antes_ativo,
    antesMin: r.antes_min,
    resumoAtivo: r.resumo_ativo,
    resumoHora: hhmm(r.resumo_hora),
    resumoPara: r.resumo_para,
    tarefasAtivo: r.tarefas_ativo,
    tarefasHora: hhmm(r.tarefas_hora),
    providAtivo: r.provid_ativo,
    providHora: hhmm(r.provid_hora),
    providPara: r.provid_para,
  };
}

function toDb(c: ConfigAvisos): Row {
  return {
    reuniao_dia: c.reuniaoDia,
    reuniao_hora: c.reuniaoHora,
    manha_ativo: c.manhaAtivo,
    manha_hora: c.manhaHora,
    antes_ativo: c.antesAtivo,
    antes_min: c.antesMin,
    resumo_ativo: c.resumoAtivo,
    resumo_hora: c.resumoHora,
    resumo_para: c.resumoPara,
    tarefas_ativo: c.tarefasAtivo,
    tarefas_hora: c.tarefasHora,
    provid_ativo: c.providAtivo,
    provid_hora: c.providHora,
    provid_para: c.providPara,
  };
}

/** Lê (todos) e grava (gestor, pela RLS) a configuração da reunião e dos avisos. */
export function useConfigAvisos() {
  const qc = useQueryClient();
  const query = useQuery<ConfigAvisos>({
    queryKey: KEY,
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) return PADRAO_AVISOS;
      const { data, error } = await supabase
        .from('config_avisos')
        .select(COLUNAS)
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      return data ? fromDb(data as unknown as Row) : PADRAO_AVISOS;
    },
  });

  const mutation = useMutation<ConfigAvisos, Error, ConfigAvisos, { anterior?: ConfigAvisos }>({
    mutationFn: async (c) => {
      if (!supabase) throw new Error('Supabase não configurado.');
      const { error } = await supabase.from('config_avisos').update(toDb(c)).eq('id', true);
      if (error) throw error;
      return c;
    },
    onMutate: async (c) => {
      await qc.cancelQueries({ queryKey: KEY });
      const anterior = qc.getQueryData<ConfigAvisos>(KEY);
      qc.setQueryData(KEY, c);
      return { anterior };
    },
    onError: (_e, _c, ctx) => {
      if (ctx?.anterior) qc.setQueryData(KEY, ctx.anterior);
    },
    // A reunião da semana pode ter mudado de dia.
    onSettled: () => void qc.invalidateQueries({ queryKey: ['reuniao'] }),
  });

  return {
    /** Configuração atual (o padrão enquanto carrega). */
    config: query.data ?? PADRAO_AVISOS,
    query,
    salvar: (c: ConfigAvisos) => mutation.mutateAsync(c),
    salvando: mutation.isPending,
  };
}
