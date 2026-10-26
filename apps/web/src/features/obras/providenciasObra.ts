import { duEntre, naObraEm, providenciaAtrasada, providenciarAte } from '@contro/core';
import type { ObraCompleta } from './detalhe';

const TIPO: Record<string, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};

export interface ItemProvidencia {
  id: string;
  tipo: 'contratacao' | 'locacao' | 'compra';
  tipoTxt: string;
  descricao: string;
  rotulo: string;
  atividade: string;
  providenciarAte: string;
  /** Data em que precisa estar na obra (início previsto da atividade ou ajuste manual). */
  naObra: string;
  antecedenciaDu: number;
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
  const feitas: ItemProvidenciado[] = [];

  for (const a of obra.atividades) {
    if (a.pai_id) continue;
    const es = obra.cron.porId[a.id]?.es ?? 0;
    for (const p of a.providencias) {
      if (p.status === 'feito') {
        feitas.push({
          id: p.id,
          tipoTxt: TIPO[p.tipo],
          descricao: p.descricao,
          atividade: nomePorId.get(a.id) ?? '',
          feitoEm: p.feito_em,
          feitoPor: p.feito_por_nome,
        });
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
        tipo: p.tipo,
        tipoTxt: TIPO[p.tipo],
        descricao: p.descricao,
        rotulo: `${TIPO[p.tipo]}: ${p.descricao}`,
        atividade: nomePorId.get(a.id) ?? '',
        providenciarAte: providenciarAte(obra.inicio, es, p.antecedencia_du),
        naObra: naObraEm(obra.inicio, es, p.na_obra_em),
        antecedenciaDu: p.antecedencia_du,
        atrasada,
      };
      (atrasada ? atrasadas : aProvidenciar).push(item);
    }
  }
  feitas.sort((x, y) => (y.feitoEm ?? '').localeCompare(x.feitoEm ?? ''));
  return { atrasadas, aProvidenciar, feitas };
}
