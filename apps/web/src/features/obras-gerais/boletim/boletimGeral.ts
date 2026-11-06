import type { AtividadeGeral, BoletimDados, DataISO } from '@contro/core';
import { montarBoletimGeral, PRAZOS_PENDENCIA_PADRAO } from '@contro/core';
import { quemFazOQueBoletim } from '../../obras/boletimAcoes';
import { pendenciaParaAcao, tarefaParaAcao } from '../../obras/acoesObra';
import type { PendenciaObra } from '../../obras/pendenciasObra';
import type { TarefaObra } from '../../obras/tarefasObra';

/**
 * Boletim da obra geral: o core calcula a semana pelas datas das atividades; o "quem faz o
 * quê" vem das tarefas e pendências abertas da obra (como na Contorno).
 */
export function boletimDaObraGeral(e: {
  obra: { nome: string; cidade: string | null };
  atividades: AtividadeGeral[];
  nomes: Record<string, string>;
  tarefas: TarefaObra[];
  pendencias: PendenciaObra[];
  prazosPendencia?: typeof PRAZOS_PENDENCIA_PADRAO;
  hoje: DataISO;
}): BoletimDados {
  const prazos = e.prazosPendencia ?? PRAZOS_PENDENCIA_PADRAO;
  const acoes = [
    ...e.tarefas.map(tarefaParaAcao),
    ...e.pendencias.map((p) => pendenciaParaAcao(p, prazos)),
  ];
  return montarBoletimGeral({
    obra: e.obra,
    atividades: e.atividades,
    nomes: e.nomes,
    hoje: e.hoje,
    quemFazOQue: quemFazOQueBoletim(acoes, e.hoje),
  });
}
