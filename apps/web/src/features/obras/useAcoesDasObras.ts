import { useMemo } from 'react';
import { PRAZOS_PENDENCIA_PADRAO, semTarefaAberta, semTarefaAbertaAtividade } from '@contro/core';
import { prazosDaConfig, useConfigAvisos } from '../avisos/useConfigAvisos';
import {
  atividadeParaAcao,
  pendenciaParaAcao,
  providenciaParaAcao,
  tarefaParaAcao,
  type AcaoObra,
} from './acoesObra';
import { useObras } from './useObras';
import { usePendenciasDasObras } from './useObraPendencias';
import { useTarefasDasObras } from './useObraTarefas';

/**
 * Junta tarefas, pendências, providências e atividades sem dono das obras; prazos de
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
    const doServidor = (obras ?? [])
      .filter((o) => ids.has(o.id))
      .flatMap((o) => o.providenciasSemDono);
    // A tarefa otimista (recém-atribuída) já representa a providência.
    return semTarefaAberta(doServidor, tarefas);
  }, [obras, chaveIds, tarefas]);
  const atividades = useMemo(() => {
    const ids = new Set(chaveIds ? chaveIds.split(',') : []);
    const doServidor = (obras ?? [])
      .filter((o) => ids.has(o.id))
      .flatMap((o) => o.atividadesSemDono);
    // A tarefa otimista (recém-atribuída) já representa a atividade.
    return semTarefaAbertaAtividade(doServidor, tarefas);
  }, [obras, chaveIds, tarefas]);
  const acoes = useMemo(
    () => [
      ...tarefas.map(tarefaParaAcao),
      ...pendencias.map((p) => pendenciaParaAcao(p, prazos)),
      ...providencias.map(providenciaParaAcao),
      ...atividades.map(atividadeParaAcao),
    ],
    [tarefas, pendencias, prazos, providencias, atividades],
  );
  return { acoes, carregando: carregandoT || carregandoP || obrasQuery.isLoading };
}
