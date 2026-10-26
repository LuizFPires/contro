import { trilhaDeFases, type FaseTrilha } from '@contro/core';
import type { ObraCompleta } from './detalhe';

/** Trilha de fases da obra (core) a partir da obra carregada. */
export function montarTrilha(obra: ObraCompleta): FaseTrilha[] {
  const topo = obra.atividades.filter((a) => !a.pai_id);
  return trilhaDeFases({
    fases: obra.fases,
    atividades: topo.map((a) => ({
      id: a.id,
      fase_id: a.fase_id,
      nome: a.nome,
      predecessoras: a.predecessoras,
      prestador: a.prestador,
      providenciasPendentes: a.providencias
        .filter((p) => p.status === 'pendente')
        .map((p) => ({ tipo: p.tipo, descricao: p.descricao })),
    })),
    estados: obra.estados,
    datas: Object.fromEntries(
      obra.cron.itens.map((it) => [it.id, { inicio: it.inicio_previsto, fim: it.fim_previsto }]),
    ),
  });
}
