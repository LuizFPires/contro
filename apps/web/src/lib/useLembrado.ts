import { useEffect, useState } from 'react';

const PREFIXO = 'contro:tela:';

function ler<T>(chave: string, inicial: T): T {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    return bruto === null ? inicial : (JSON.parse(bruto) as T);
  } catch {
    return inicial;
  }
}

/**
 * useState que lembra onde a pessoa estava (tela, obra, aba, fase, ficha): ao
 * voltar ao app ou à guia, mesmo depois de o celular fechar o app, ela continua
 * no mesmo lugar. Guardado neste aparelho; "Sair" apaga (esquecerTelas).
 */
export function useLembrado<T>(chave: string, inicial: T) {
  const [valor, setValor] = useState<T>(() => ler(chave, inicial));
  // Mesma tela com outra chave (ex.: outra obra): recomeça do que essa lembra.
  const [chaveAtual, setChaveAtual] = useState(chave);
  if (chave !== chaveAtual) {
    setChaveAtual(chave);
    setValor(ler(chave, inicial));
  }
  useEffect(() => {
    try {
      localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
    } catch {
      // Sem armazenamento (modo privado): só não lembra.
    }
  }, [chave, valor]);
  return [valor, setValor] as const;
}

/** Ao sair da conta: a próxima pessoa no aparelho começa do início. */
export function esquecerTelas() {
  try {
    for (const k of Object.keys(localStorage))
      if (k.startsWith(PREFIXO)) localStorage.removeItem(k);
  } catch {
    // idem
  }
}
