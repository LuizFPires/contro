import { useCallback, useEffect, useState, type SetStateAction } from 'react';

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
  // Grava também na hora: se a tela sai junto com a mudança (ex.: fechar a
  // obra e ir ao Log), o efeito acima não chega a rodar e o valor velho ficaria.
  // Valor direto: grava antes de mudar o estado (efeito colateral fora do
  // updater). Só a forma funcional precisa do valor anterior, dentro do updater.
  const guardar = useCallback(
    (v: SetStateAction<T>) => {
      if (!(v instanceof Function)) {
        lembrar(chave, v);
        setValor(v);
        return;
      }
      setValor((antes) => {
        const novo = v(antes);
        lembrar(chave, novo);
        return novo;
      });
    },
    [chave],
  );
  return [valor, guardar] as const;
}

/** Grava um valor lembrado fora do componente (ex.: a aba do início pelo menu). */
export function lembrar<T>(chave: string, valor: T) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento: só não lembra.
  }
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
