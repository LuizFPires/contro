import { trilhaDeFases, type FaseTrilha } from '@contro/core';
import type { ObraCompleta } from './detalhe';
import { numeracaoObra } from './numeracaoObra';

/** Trilha de fases da obra (core) a partir da obra carregada. */
export function montarTrilha(obra: ObraCompleta): FaseTrilha[] {
  const topo = obra.atividades.filter((a) => !a.pai_id);
  const num = numeracaoObra(obra);
  const pre = new Set(obra.fases.filter((f) => f.preliminar).map((f) => f.id));
  const trilha = trilhaDeFases({
    fases: obra.fases,
    atividades: topo.map((a) => ({
      id: a.id,
      fase_id: a.fase_id,
      // Pré-obra com o número (#1, #2…) para achar fácil nas ligações.
      nome: a.preObra ? `#${num.get(a.id)} ${a.nome}` : a.nome,
      predecessoras: a.predecessoras,
      prestador: a.prestador,
      temFoto: Boolean(a.foto_conclusao_id),
      providenciasPendentes: a.providencias
        .filter((p) => p.status === 'pendente')
        .map((p) => ({ tipo: p.tipo, descricao: p.descricao })),
    })),
    estados: obra.estados,
    datas: {
      ...Object.fromEntries(
        Object.entries(obra.pre).map(([id, d]) => [
          id,
          { inicio: d.inicio_previsto, fim: d.fim_previsto },
        ]),
      ),
      ...Object.fromEntries(
        obra.cron.itens.map((it) => [it.id, { inicio: it.inicio_previsto, fim: it.fim_previsto }]),
      ),
    },
  });
  // Pré-obra (antes do dia 0) vem marcado na etiqueta da fase.
  return trilha.map((f) => (pre.has(f.id) ? { ...f, rotulo: `pré-obra · ${f.rotulo}` } : f));
}
