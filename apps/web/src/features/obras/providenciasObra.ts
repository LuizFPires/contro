import {
  comecarProvidencia,
  deslocarDU,
  duEntre,
  naObraEm,
  prazoVigenteProvidencia,
  providenciaAtrasada,
  providenciarAte,
  textoProvidencia,
  VERBO_PROVIDENCIA,
} from '@contro/core';
import type { ObraCompleta } from './detalhe';

export interface ItemProvidencia {
  id: string;
  tipo: 'contratacao' | 'locacao' | 'compra';
  tipoTxt: string;
  descricao: string;
  rotulo: string;
  atividade: string;
  /** Prazo vigente: o da tarefa aberta vinculada (replanejado) ou o do cronograma. */
  providenciarAte: string;
  /** Prazo do cronograma quando a tarefa o replanejou (null se não mudou). */
  prazoOriginal: string | null;
  /** Data em que precisa estar na obra (início previsto da atividade ou ajuste manual). */
  naObra: string;
  antecedenciaDu: number;
  /** Quantos dias úteis leva para providenciar (0: só o prazo). */
  duracaoDu: number;
  /** Quando começar a providenciar (prazo − duração). */
  comecar: string;
  atrasada: boolean;
}

export interface ItemProvidenciado {
  id: string;
  tipoTxt: string;
  descricao: string;
  atividade: string;
  /** Instante em que foi marcado (ISO com hora). */
  feitoEm: string | null;
  feitoPor: string | null;
}

export interface ProvidenciasClassificadas {
  atrasadas: ItemProvidencia[];
  aProvidenciar: ItemProvidencia[];
  /** Já providenciadas, da mais recente para a mais antiga. */
  feitas: ItemProvidenciado[];
}

/**
 * Classifica as providências da obra uma vez (usado pela aba e pelo badge).
 * `prazosTarefa`: prazo da tarefa aberta vinculada a cada providência, que vale no
 * lugar do cronograma (replanejar tira do atraso).
 */
export function classificarProvidencias(
  obra: ObraCompleta,
  hoje: string,
  prazosTarefa: ReadonlyMap<string, string> = new Map(),
): ProvidenciasClassificadas {
  const decorridos = duEntre(obra.inicio, hoje);
  const iniciada = hoje >= obra.inicio;
  const nomePorId = new Map(obra.atividades.map((a) => [a.id, a.nome]));

  const atrasadas: ItemProvidencia[] = [];
  const aProvidenciar: ItemProvidencia[] = [];
  const feitas: ItemProvidenciado[] = [];

  for (const a of obra.atividades) {
    if (a.pai_id) continue;
    const es = obra.cron.porId[a.id]?.es ?? 0;
    for (const p of a.providencias) {
      if (p.status === 'feito') {
        feitas.push({
          id: p.id,
          tipoTxt: VERBO_PROVIDENCIA[p.tipo],
          descricao: p.descricao,
          atividade: nomePorId.get(a.id) ?? '',
          feitoEm: p.feito_em,
          feitoPor: p.feito_por_nome,
        });
        continue;
      }
      const prazoTarefa = prazosTarefa.get(p.id);
      const atrasada = providenciaAtrasada({
        status: p.status,
        atividadeConcluida: Boolean(a.concluida_em),
        obraIniciada: iniciada,
        decorridos,
        esAtividade: es,
        antecedenciaDu: p.antecedencia_du,
        replanejada: prazoTarefa ? { prazo: prazoTarefa, hoje } : null,
      });
      const vigente = prazoVigenteProvidencia(
        providenciarAte(obra.inicio, es, p.antecedencia_du),
        prazoTarefa,
      );
      const duracaoDu = p.duracao_du ?? 0;
      const item: ItemProvidencia = {
        id: p.id,
        tipo: p.tipo,
        tipoTxt: VERBO_PROVIDENCIA[p.tipo],
        descricao: p.descricao,
        rotulo: textoProvidencia(p.tipo, p.descricao),
        atividade: nomePorId.get(a.id) ?? '',
        providenciarAte: vigente.ate,
        prazoOriginal: vigente.original,
        naObra: naObraEm(obra.inicio, es, p.na_obra_em),
        antecedenciaDu: p.antecedencia_du,
        duracaoDu,
        comecar: vigente.original
          ? deslocarDU(vigente.ate, -Math.max(duracaoDu, 0))
          : comecarProvidencia(obra.inicio, es, p.antecedencia_du, duracaoDu),
        atrasada,
      };
      (atrasada ? atrasadas : aProvidenciar).push(item);
    }
  }
  feitas.sort((x, y) => (y.feitoEm ?? '').localeCompare(x.feitoEm ?? ''));
  return { atrasadas, aProvidenciar, feitas };
}
