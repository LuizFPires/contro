import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Rascunho de formulário com botão próprio de salvar (Nova obra, Nova
 * atividade, Novo lembrete, Tarefa): o que foi digitado fica guardado neste
 * aparelho e volta ao reabrir, mesmo se o app fechar no meio. Some ao salvar
 * ou ao tocar em "Descartar rascunho". Por pessoa (aparelho compartilhado).
 * `chave` null = desligado (ex.: formulário fechado).
 */
export function useRascunho<T>(chave: string | null) {
  const qc = useQueryClient();
  const dono = qc.getQueryData<{ id: string } | null>(['perfil'])?.id ?? 'anon';
  const k = chave ? `contro:rascunho:${dono}:${chave}` : null;

  const lido = useMemo<T | null>(() => {
    if (!k) return null;
    try {
      const bruto = localStorage.getItem(k);
      return bruto ? (JSON.parse(bruto) as T) : null;
    } catch {
      return null;
    }
  }, [k]);

  const guardar = useCallback(
    (valor: T, vazio: boolean) => {
      if (!k) return;
      try {
        if (vazio) localStorage.removeItem(k);
        else localStorage.setItem(k, JSON.stringify(valor));
      } catch {
        // Sem armazenamento (modo privado): segue sem rascunho.
      }
    },
    [k],
  );

  const limpar = useCallback(() => {
    if (!k) return;
    try {
      localStorage.removeItem(k);
    } catch {
      // idem
    }
  }, [k]);

  return { lido, guardar, limpar };
}
