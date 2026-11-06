import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiaReuniao } from '@contro/core';
import { supabase } from '../../../lib/supabase';
import { PADRAO_AVISOS, type ConfigAvisos } from '../../avisos/useConfigAvisos';

/**
 * "Reunião e avisos" de uma obra geral (C13): os mesmos campos da Contorno, sem o "para
 * quem" das providências (as obras gerais não têm esse aviso separado).
 */
export type ConfigAvisosObra = Omit<ConfigAvisos, 'providPara'>;

const { providPara, ...padraoObra } = PADRAO_AVISOS;
void providPara;
export const PADRAO_AVISOS_OBRA: ConfigAvisosObra = padraoObra;

/** Linha de `config_avisos_da_obra` (horas como "16:00:00"). */
export interface LinhaConfigObra {
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
}

const hhmm = (t: string) => t.slice(0, 5);

export function configDaLinha(r: LinhaConfigObra): ConfigAvisosObra {
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
  };
}

/**
 * O que a tela grava. As providências ficam de fora: o aviso delas está oculto na obra
 * geral e o banco mantém o valor atual do que não vem.
 */
export function linhaParaSalvar(c: ConfigAvisosObra): Record<string, unknown> {
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
  };
}

export const chaveConfigObra = (obraId: string) => ['config-avisos-obra', obraId];

/** Lê (quem vê a obra) e grava (quem planeja, pela RPC) a reunião e os avisos da obra geral. */
export function useConfigAvisosObra(obraId: string | null) {
  const qc = useQueryClient();
  const key = chaveConfigObra(obraId ?? '');
  const query = useQuery<ConfigAvisosObra>({
    queryKey: key,
    enabled: Boolean(supabase) && Boolean(obraId),
    queryFn: async () => {
      if (!supabase || !obraId) return PADRAO_AVISOS_OBRA;
      const { data, error } = await supabase.rpc('config_avisos_da_obra', { p_obra_id: obraId });
      if (error) throw error;
      return data ? configDaLinha(data as LinhaConfigObra) : PADRAO_AVISOS_OBRA;
    },
  });

  const mutation = useMutation<
    ConfigAvisosObra,
    Error,
    ConfigAvisosObra,
    { anterior?: ConfigAvisosObra }
  >({
    mutationFn: async (c) => {
      if (!supabase || !obraId) throw new Error('Supabase não configurado.');
      const { error } = await supabase.rpc('salvar_config_avisos_obra', {
        p_obra_id: obraId,
        p_config: linhaParaSalvar(c),
      });
      if (error) throw error;
      return c;
    },
    onMutate: async (c) => {
      await qc.cancelQueries({ queryKey: key });
      const anterior = qc.getQueryData<ConfigAvisosObra>(key);
      qc.setQueryData(key, c);
      return { anterior };
    },
    onError: (_e, _c, ctx) => {
      if (ctx?.anterior) qc.setQueryData(key, ctx.anterior);
    },
    // A reunião da semana da obra pode ter mudado de dia ou de hora.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ['reuniao-geral', obraId] });
      void qc.invalidateQueries({ queryKey: ['agendas-obras-gerais'] });
    },
  });

  return {
    /** Configuração atual (o padrão enquanto carrega). */
    config: query.data ?? PADRAO_AVISOS_OBRA,
    query,
    salvar: (c: ConfigAvisosObra) => mutation.mutateAsync(c),
    salvando: mutation.isPending,
  };
}

export interface AgendaReuniaoObra {
  reuniaoDia: DiaReuniao;
  reuniaoHora: string;
}

/**
 * Dia e hora da reunião de várias obras gerais sem N+1: as linhas próprias numa consulta
 * e, para as obras sem linha (todas usam a global), uma leitura só da config efetiva.
 */
export function useAgendasObrasGerais(obraIds: string[]) {
  const ids = [...obraIds].sort();
  return useQuery<Map<string, AgendaReuniaoObra>>({
    queryKey: ['agendas-obras-gerais', ids],
    enabled: Boolean(supabase) && ids.length > 0,
    queryFn: async () => {
      const m = new Map<string, AgendaReuniaoObra>();
      if (!supabase) return m;
      const { data, error } = await supabase
        .from('config_avisos_obra')
        .select('obra_id,reuniao_dia,reuniao_hora')
        .in('obra_id', ids);
      if (error) throw error;
      for (const r of (data ?? []) as {
        obra_id: string;
        reuniao_dia: number;
        reuniao_hora: string;
      }[])
        m.set(r.obra_id, {
          reuniaoDia: r.reuniao_dia as DiaReuniao,
          reuniaoHora: hhmm(r.reuniao_hora),
        });
      const semLinha = ids.filter((id) => !m.has(id));
      if (semLinha.length > 0) {
        const { data: g, error: e2 } = await supabase.rpc('config_avisos_da_obra', {
          p_obra_id: semLinha[0],
        });
        if (e2) throw e2;
        const c = g ? configDaLinha(g as LinhaConfigObra) : PADRAO_AVISOS_OBRA;
        for (const id of semLinha)
          m.set(id, { reuniaoDia: c.reuniaoDia, reuniaoHora: c.reuniaoHora });
      }
      return m;
    },
  });
}
