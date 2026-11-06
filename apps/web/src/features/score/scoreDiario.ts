// Score diário: grava o score de hoje de cada nome (o último cálculo do dia vence)
// e lê o histórico para o gráfico de evolução do detalhe. O cálculo é do core.
// Por ambiente: em Obras gerais só o Administrador grava (visão de todas as obras
// gerais), para o histórico não oscilar conforme quem abre; todos leem.
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Ambiente, Janela, LinhaScore, RegistroScoreDia } from '@contro/core';
import { supabase } from '../../lib/supabase';
import type { AbaScore } from './scoreTela';

export interface LinhaGravar {
  aba: AbaScore;
  chave: string;
  nome: string;
  score30: number | null;
  score90: number | null;
}

type PorJanela = Record<Janela, LinhaScore<unknown>[]>;

/** Junta as janelas 30 e 90 de uma aba numa linha por nome. */
export function linhasDaAba(aba: AbaScore, porJanela: PorJanela): LinhaGravar[] {
  const m = new Map<string, LinhaGravar>();
  for (const j of [30, 90] as const) {
    for (const l of porJanela[j]) {
      const g = m.get(l.chave) ?? {
        aba,
        chave: l.chave,
        nome: l.nome,
        score30: null,
        score90: null,
      };
      if (j === 30) g.score30 = l.score;
      else g.score90 = l.score;
      m.set(l.chave, g);
    }
  }
  return [...m.values()].filter((g) => g.chave && g.nome);
}

/** Quem grava o histórico do ambiente: Contorno, todos; Obras gerais, só o Administrador. */
export function gravaScoreDiario(ambiente: Ambiente, administrador: boolean): boolean {
  return ambiente === 'contorno' || administrador;
}

/** Argumentos de gravar_score_diario (Contorno: os de sempre, sem o ambiente). */
export function argsGravarScore(
  linhas: LinhaGravar[],
  ambiente: Ambiente,
): { p_linhas: LinhaGravar[]; p_ambiente?: Ambiente } {
  return ambiente === 'contorno'
    ? { p_linhas: linhas }
    : { p_linhas: linhas, p_ambiente: ambiente };
}

/**
 * Grava as linhas de hoje quando o Score termina de calcular. Não grava de novo
 * o mesmo conteúdo; falha (sem conexão) fica para a próxima abertura. Obras
 * gerais: só grava quando `administrador` (decisão 4 da etapa 5).
 */
export function useGravarScoreDiario(
  linhas: LinhaGravar[] | null,
  hoje: string,
  ambiente: Ambiente = 'contorno',
  administrador = false,
): void {
  const ultimo = useRef<string>('');
  const seq = useRef(0);
  const grava = gravaScoreDiario(ambiente, administrador);
  useEffect(() => {
    if (!supabase || !grava || !linhas || linhas.length === 0) return;
    const assinatura = `${ambiente}|${hoje}|${JSON.stringify(linhas)}`;
    if (assinatura === ultimo.current) return;
    ultimo.current = assinatura;
    const minha = ++seq.current;
    void supabase
      .rpc('gravar_score_diario', argsGravarScore(linhas, ambiente))
      .then(({ error }) => {
        // Só a gravação mais recente decide: se falhou, a próxima abertura tenta de novo.
        if (error && minha === seq.current) ultimo.current = '';
      });
  }, [linhas, hoje, ambiente, grava]);
}

/** Histórico de um nome (até 90 dias) no ambiente, para o gráfico. */
export function useScoreHistorico(
  aba: AbaScore,
  chave: string,
  hoje: string,
  ambiente: Ambiente = 'contorno',
) {
  return useQuery({
    queryKey: ['score-diario', ambiente, aba, chave, hoje],
    enabled: !!supabase,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RegistroScoreDia[]> => {
      if (!supabase) return [];
      const desde = new Date(Date.parse(`${hoje}T00:00:00Z`) - 95 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const { data, error } = await supabase
        .from('score_diario')
        .select('dia, score30, score90')
        .eq('ambiente', ambiente)
        .eq('aba', aba)
        .eq('chave', chave)
        .gte('dia', desde)
        .order('dia');
      if (error) throw error;
      return (data ?? []) as RegistroScoreDia[];
    },
  });
}
