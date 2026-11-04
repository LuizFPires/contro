import { useMemo } from 'react';
import { PRAZOS_PENDENCIA_PADRAO } from '@contro/core';
import { prazosDaConfig, useConfigAvisos } from '../avisos/useConfigAvisos';
import { pendenciaParaAcao, providenciaParaAcao, tarefaParaAcao, type AcaoObra } from './acoesObra';
import { useObras } from './useObras';
import { usePendenciasDasObras } from './useObraPendencias';
import { useTarefasDasObras } from './useObraTarefas';

/**
 * Junta tarefas, pendências e providências sem dono das obras; prazos de
 * pendência vêm de useConfigAvisos (padrão se ainda carregando).
 */
export function useAcoesDasObras(obraIds: string[]): { acoes: AcaoObra[]; carregando: boolean } {
  const { tarefas, carregando: carregandoT } = useTarefasDasObras(obraIds);
  const { pendencias, carregando: carregandoP } = usePendenciasDasObras(obraIds);
  const obrasQuery = useObras();
  const obras = obrasQuery.data;
  const { query: configQuery } = useConfigAvisos();
  const cfg = configQuery.data;
  const prazos = useMemo(() => (cfg ? prazosDaConfig(cfg) : PRAZOS_PENDENCIA_PADRAO), [cfg]);
  const chaveIds = obraIds.join(',');
  const providencias = useMemo(() => {
    const ids = new Set(chaveIds ? chaveIds.split(',') : []);
    return (obras ?? []).filter((o) => ids.has(o.id)).flatMap((o) => o.providenciasSemDono);
  }, [obras, chaveIds]);
  const acoes = useMemo(
    () => [
      ...tarefas.map(tarefaParaAcao),
      ...pendencias.map((p) => pendenciaParaAcao(p, prazos)),
      ...providencias.map(providenciaParaAcao),
    ],
    [tarefas, pendencias, prazos, providencias],
  );
  return { acoes, carregando: carregandoT || carregandoP || obrasQuery.isLoading };
}
