import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiaReuniao, PrazosPendencia } from '@contro/core';
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
  acoesAtivo: boolean;
  acoesHora: string;
  pendAltaDu: number;
  pendMediaDu: number;
  pendBaixaDu: number;
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
  acoesAtivo: true,
  acoesHora: '07:30',
  pendAltaDu: 2,
  pendMediaDu: 4,
  pendBaixaDu: 6,
  providAtivo: false,
  providHora: '08:00',
  providPara: 'gestores',
};

const COLUNAS =
  'reuniao_dia, reuniao_hora, manha_ativo, manha_hora, antes_ativo, antes_min, acoes_ativo, ' +
  'acoes_hora, pend_alta_du, pend_media_du, pend_baixa_du, provid_ativo, provid_hora, provid_para';

interface Row {
  reuniao_dia: number;
  reuniao_hora: string;
  manha_ativo: boolean;
  manha_hora: string;
  antes_ativo: boolean;
  antes_min: number;
  acoes_ativo: boolean;
  acoes_hora: string;
  pend_alta_du: number;
  pend_media_du: number;
  pend_baixa_du: number;
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
    acoesAtivo: r.acoes_ativo,
    acoesHora: hhmm(r.acoes_hora),
    pendAltaDu: r.pend_alta_du,
    pendMediaDu: r.pend_media_du,
    pendBaixaDu: r.pend_baixa_du,
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
    acoes_ativo: c.acoesAtivo,
    acoes_hora: c.acoesHora,
    pend_alta_du: c.pendAltaDu,
    pend_media_du: c.pendMediaDu,
    pend_baixa_du: c.pendBaixaDu,
    provid_ativo: c.providAtivo,
    provid_hora: c.providHora,
    provid_para: c.providPara,
  };
}

/** Prazos da pendência (dias úteis por criticidade) no formato do core. */
export function prazosDaConfig(cfg: ConfigAvisos): PrazosPendencia {
  return { alta: cfg.pendAltaDu, media: cfg.pendMediaDu, baixa: cfg.pendBaixaDu };
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
