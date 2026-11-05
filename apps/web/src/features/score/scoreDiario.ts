// Score diário: grava o score de hoje de cada nome (o último cálculo do dia vence)
// e lê o histórico para o gráfico de evolução do detalhe. O cálculo é do core.
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Janela, LinhaScore, RegistroScoreDia } from '@contro/core';
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

/**
 * Grava as linhas de hoje quando o Score termina de calcular. Não grava de novo
 * o mesmo conteúdo; falha (sem conexão) fica para a próxima abertura.
 */
export function useGravarScoreDiario(linhas: LinhaGravar[] | null, hoje: string): void {
  const ultimo = useRef<string>('');
  useEffect(() => {
    if (!supabase || !linhas || linhas.length === 0) return;
    const assinatura = `${hoje}|${JSON.stringify(linhas)}`;
    if (assinatura === ultimo.current) return;
    ultimo.current = assinatura;
    void supabase.rpc('gravar_score_diario', { p_linhas: linhas }).then(({ error }) => {
      if (error) ultimo.current = '';
    });
  }, [linhas, hoje]);
}

/** Histórico de um nome (até 90 dias), para o gráfico. */
export function useScoreHistorico(aba: AbaScore, chave: string, hoje: string) {
  return useQuery({
    queryKey: ['score-diario', aba, chave, hoje],
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
        .eq('aba', aba)
        .eq('chave', chave)
        .gte('dia', desde)
        .order('dia');
      if (error) throw error;
      return (data ?? []) as RegistroScoreDia[];
    },
  });
}
