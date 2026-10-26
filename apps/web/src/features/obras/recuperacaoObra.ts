import type { EntradaRecuperacao } from '@contro/core';
import type { ObraCompleta } from './detalhe';

/** Monta a entrada do plano de recuperação a partir da obra carregada. */
export function entradaRecuperacao(obra: ObraCompleta, hoje: string): EntradaRecuperacao {
  return {
    inicio: obra.inicio,
    hoje,
    // O pré-obra (antes do dia 0) não entra no cronograma da obra.
    atividades: obra.atividades
      .filter((x) => !x.preObra)
      .map((x) => ({
        id: x.id,
        duracao_du: x.duracao_du,
        pai_id: x.pai_id,
        em_sequencia: x.em_sequencia,
        inicio_manual: x.inicio_manual,
        predecessoras: x.predecessoras,
        defasagens: x.defasagens,
      })),
    concluidas: new Set(
      obra.atividades.filter((a) => !a.pai_id && a.concluida_em).map((a) => a.id),
    ),
    nomes: Object.fromEntries(obra.atividades.map((a) => [a.id, a.nome])),
    entregaOriginal: obra.entrega_original,
  };
}
