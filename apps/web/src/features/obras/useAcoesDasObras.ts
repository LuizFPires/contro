import { useMemo } from 'react';
import { PRAZOS_PENDENCIA_PADRAO } from '@contro/core';
import { prazosDaConfig, useConfigAvisos } from '../avisos/useConfigAvisos';
import { pendenciaParaAcao, tarefaParaAcao, type AcaoObra } from './acoesObra';
import { usePendenciasDasObras } from './useObraPendencias';
import { useTarefasDasObras } from './useObraTarefas';

/** Junta tarefas e pendências das obras; prazos vêm de useConfigAvisos (padrão se ainda carregando). */
export function useAcoesDasObras(obraIds: string[]): { acoes: AcaoObra[]; carregando: boolean } {
  const { tarefas, carregando: carregandoT } = useTarefasDasObras(obraIds);
  const { pendencias, carregando: carregandoP } = usePendenciasDasObras(obraIds);
  const { query: configQuery } = useConfigAvisos();
  const cfg = configQuery.data;
  const prazos = useMemo(() => (cfg ? prazosDaConfig(cfg) : PRAZOS_PENDENCIA_PADRAO), [cfg]);
  const acoes = useMemo(
    () => [...tarefas.map(tarefaParaAcao), ...pendencias.map((p) => pendenciaParaAcao(p, prazos))],
    [tarefas, pendencias, prazos],
  );
  return { acoes, carregando: carregandoT || carregandoP };
}
