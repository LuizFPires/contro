// Prévia da atividade no assistente do modelo (protótipo · revisão): onde ela cai
// no cronograma do modelo e o efeito no prazo total. Usa o motor de cronograma.
import { calcularCronograma, type AtividadeEntrada } from './schedule';

const BASE = '2026-01-05'; // segunda qualquer: só os dias relativos importam

export interface RascunhoAtividade {
  /** Id da atividade quando é edição; ausente quando é nova. */
  id?: string;
  duracao_du: number;
  predecessoras: string[];
}

export interface PreviaAtividade {
  /** Dia de início e de fim (1-based, "D3 → D10"). */
  diaInicio: number;
  diaFim: number;
  totalAntes: number;
  totalDepois: number;
  folga: number;
  critico: boolean;
  /** "caminho crítico", "4 d de folga", "aumenta a obra em 3 d". */
  texto: string;
}

/**
 * Simula a atividade (nova ou editada) dentro do modelo. Subitens da própria
 * atividade em edição saem da simulação: o rascunho já traz a duração calculada.
 */
export function previaAtividadeModelo(
  atividades: AtividadeEntrada[],
  rascunho: RascunhoAtividade,
): PreviaAtividade {
  const id = rascunho.id ?? '__rascunho__';
  const antes = calcularCronograma({ inicio: BASE, atividades });
  const outras = atividades.filter((a) => a.id !== id && a.pai_id !== id);
  const depois = calcularCronograma({
    inicio: BASE,
    atividades: [
      ...outras,
      { id, duracao_du: rascunho.duracao_du, predecessoras: rascunho.predecessoras },
    ],
  });
  const it = depois.porId[id];
  const folga = it?.folga ?? 0;
  const aumento = depois.total - antes.total;
  const texto =
    aumento > 0
      ? `aumenta a obra em ${aumento} d`
      : folga === 0
        ? 'caminho crítico'
        : `${folga} d de folga`;
  return {
    diaInicio: (it?.es ?? 0) + 1,
    diaFim: it?.ef ?? 0,
    totalAntes: antes.total,
    totalDepois: depois.total,
    folga,
    critico: Boolean(it?.critico),
    texto,
  };
}
