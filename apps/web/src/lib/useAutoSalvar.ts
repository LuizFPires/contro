import { useEffect, useRef } from 'react';

/**
 * Salva sozinho o que a pessoa digitou quando o app vai para segundo plano ou
 * fecha, ou quando o campo sai da tela (no celular o campo nem chega a perder o
 * foco). Com `esperaMs`, salva também um instante depois de parar de digitar
 * (sem ele, não: em campos que viram sugestão, como o prestador, salvar no meio
 * da digitação criaria sugestões pela metade). Só salva se o texto mudou.
 */
export function useAutoSalvar(
  texto: string,
  salvo: string,
  salvar: (texto: string) => void,
  { ativo = true, esperaMs = null }: { ativo?: boolean; esperaMs?: number | null } = {},
) {
  // Refs: os ouvintes de pagehide/visibilidade sempre veem o texto mais novo.
  const atual = useRef({ texto, salvo, salvar, ativo });
  atual.current = { texto, salvo, salvar, ativo };
  const ultimo = useRef(salvo);
  useEffect(() => {
    ultimo.current = salvo;
  }, [salvo]);

  const descarregar = () => {
    const { texto: t, salvar: s, ativo: a } = atual.current;
    if (!a || t === ultimo.current) return;
    ultimo.current = t;
    s(t);
  };

  useEffect(() => {
    if (!ativo || esperaMs === null || texto === ultimo.current) return;
    const id = window.setTimeout(descarregar, esperaMs);
    return () => window.clearTimeout(id);
  }, [texto, ativo, esperaMs]);

  useEffect(() => {
    const aoEsconder = () => {
      if (document.visibilityState === 'hidden') descarregar();
    };
    document.addEventListener('visibilitychange', aoEsconder);
    window.addEventListener('pagehide', descarregar);
    return () => {
      document.removeEventListener('visibilitychange', aoEsconder);
      window.removeEventListener('pagehide', descarregar);
      // Saiu da tela (fechou a ficha) com texto não salvo: salva também.
      descarregar();
    };
  }, []);
}
