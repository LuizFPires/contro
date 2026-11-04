// Ajudas de exibição do Score (lista e detalhe).
import {
  nomeCurto,
  type Faixa,
  type IndicadoresEquipe,
  type IndicadoresPrestador,
  type LinhaScore,
} from '@contro/core';

export type AbaScore = 'equipe' | 'prestadores';
export type LinhaQualquer = LinhaScore<IndicadoresEquipe> | LinhaScore<IndicadoresPrestador>;

/** Classe de cor da faixa: ok (turquesa escuro), regular (âmbar), atenção (vermelho). */
export function corFaixa(f: Faixa): 'ok' | 'regular' | 'atencao' | 'sem' {
  if (f === 'resolutivo' || f === 'em_dia') return 'ok';
  if (f === 'regular' || f === 'atencao') return f;
  return 'sem';
}

/** Nome exibido: pessoa da equipe pelo nome curto; prestador como digitado. */
export function nomeExibido(l: LinhaQualquer, aba: AbaScore): string {
  return aba === 'equipe' ? nomeCurto(l.nome) || l.nome : l.nome;
}

/** "1 ação" / "5 ações" (equipe) ou "1 atividade" / "5 atividades" (prestadores). */
export function contagem(n: number, aba: AbaScore): string {
  if (aba === 'equipe') return n === 1 ? '1 ação' : `${n} ações`;
  return n === 1 ? '1 atividade' : `${n} atividades`;
}
