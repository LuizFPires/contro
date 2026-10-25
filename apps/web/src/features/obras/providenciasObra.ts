import { duEntre, providenciaAtrasada, providenciarAte } from '@obdc/core';
import type { ObraCompleta } from './detalhe';

const TIPO: Record<string, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};

export interface ItemProvidencia {
  id: string;
  rotulo: string;
  atividade: string;
  providenciarAte: string;
  atrasada: boolean;
}

export interface ProvidenciasClassificadas {
  atrasadas: ItemProvidencia[];
  aProvidenciar: ItemProvidencia[];
  feitas: number;
}

/** Classifica as providências da obra uma vez (usado pela aba e pelo badge). */
export function classificarProvidencias(
  obra: ObraCompleta,
  hoje: string,
): ProvidenciasClassificadas {
  const decorridos = duEntre(obra.inicio, hoje);
  const iniciada = hoje >= obra.inicio;
  const nomePorId = new Map(obra.atividades.map((a) => [a.id, a.nome]));

  const atrasadas: ItemProvidencia[] = [];
  const aProvidenciar: ItemProvidencia[] = [];
  let feitas = 0;

  for (const a of obra.atividades) {
    if (a.pai_id) continue;
    const es = obra.cron.porId[a.id]?.es ?? 0;
    for (const p of a.providencias) {
      if (p.status === 'feito') {
        feitas += 1;
        continue;
      }
      const atrasada = providenciaAtrasada({
        status: p.status,
        atividadeConcluida: Boolean(a.concluida_em),
        obraIniciada: iniciada,
        decorridos,
        esAtividade: es,
        antecedenciaDu: p.antecedencia_du,
      });
      const item: ItemProvidencia = {
        id: p.id,
        rotulo: `${TIPO[p.tipo]}: ${p.descricao}`,
        atividade: nomePorId.get(a.id) ?? '',
        providenciarAte: providenciarAte(obra.inicio, es, p.antecedencia_du),
        atrasada,
      };
      (atrasada ? atrasadas : aProvidenciar).push(item);
    }
  }
  return { atrasadas, aProvidenciar, feitas };
}
