import { useEffect, useRef, useState } from 'react';
import { BottomSheet, Segmented, useToast } from '@contro/ui';
import type { PapelGeral } from '@contro/core';
import type { ObraGeral } from './api';
import { ChavesObras } from './ChavesObras';
import { mensagemErroAcesso } from './mensagemErroAcesso';
import { useAcessoGeral, type PessoaGeral } from './usePessoasGerais';
import styles from './PessoasAcessos.module.css';

const PAPEIS: { value: PapelGeral; label: string }[] = [
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'membro', label: 'Membro' },
];

interface Estado {
  papel: PapelGeral;
  obraIds: string[];
}

const iguais = (a: Estado, b: Estado) =>
  a.papel === b.papel &&
  a.obraIds.length === b.obraIds.length &&
  a.obraIds.every((x) => b.obraIds.includes(x));

/**
 * Ficha da pessoa: papel e obras. Salva ao tocar. As gravações entram numa fila (uma por vez,
 * sempre com o estado mais recente); se falhar, volta ao último estado confirmado pelo servidor.
 * O Desfazer de um toast só vale enquanto não houver outra mudança depois dele.
 */
export function FichaPessoaGeral({
  pessoa,
  obras,
  carregando,
  erro,
  onFechar,
}: {
  pessoa: PessoaGeral | null;
  obras: ObraGeral[];
  carregando: boolean;
  erro: boolean;
  onFechar: () => void;
}) {
  const { showToast } = useToast();
  const { definir } = useAcessoGeral();
  const [estado, setEstado] = useState<Estado>({ papel: 'membro', obraIds: [] });
  const ultimo = useRef<Estado>(estado); // o que a tela mostra
  const confirmado = useRef<Estado>(estado); // o que o servidor confirmou
  const fila = useRef<Promise<void>>(Promise.resolve());
  const versao = useRef(0);

  const idPessoa = pessoa?.id;
  useEffect(() => {
    if (pessoa) {
      const e = { papel: pessoa.papel, obraIds: pessoa.obraIds };
      ultimo.current = e;
      confirmado.current = e;
      versao.current += 1;
      setEstado(e);
    }
    // Só ao abrir outra pessoa: depois disso o estado local é a fonte (salva ao tocar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idPessoa]);

  function mostrar(e: Estado) {
    ultimo.current = e;
    setEstado(e);
  }

  function aplicar(novo: Estado, comDesfazer: boolean) {
    if (!pessoa) return;
    const id = pessoa.id;
    const antes = ultimo.current;
    mostrar(novo);
    const minha = ++versao.current;
    fila.current = fila.current.then(async () => {
      const enviar = ultimo.current;
      if (iguais(enviar, confirmado.current)) return;
      try {
        await definir(id, enviar.papel, enviar.obraIds);
      } catch (err) {
        mostrar(confirmado.current);
        showToast({ message: mensagemErroAcesso(err) });
        return;
      }
      confirmado.current = enviar;
      if (minha !== versao.current) return; // veio outra mudança; o toast é dela
      showToast({
        message: comDesfazer ? 'Acesso salvo.' : 'Alteração desfeita.',
        onUndo: comDesfazer
          ? () => {
              if (versao.current !== minha) return;
              aplicar(antes, false);
            }
          : undefined,
      });
    });
  }

  return (
    <BottomSheet open={Boolean(pessoa)} title={pessoa?.nome ?? ''} onClose={onFechar}>
      <p className={styles.nota}>{pessoa?.email}</p>
      <div className={styles.campos} style={{ marginTop: 16 }}>
        <div>
          <p className={styles.rotulo}>Papel</p>
          <Segmented
            ariaLabel="Papel"
            options={PAPEIS}
            value={estado.papel}
            onChange={(p) => {
              if (p !== ultimo.current.papel) aplicar({ ...ultimo.current, papel: p }, true);
            }}
          />
        </div>
        <div>
          <p className={styles.rotulo}>Obras</p>
          <ChavesObras
            obras={obras}
            carregando={carregando}
            erro={erro}
            marcadas={estado.obraIds}
            onAlternar={(id) => {
              const cur = ultimo.current;
              aplicar(
                {
                  ...cur,
                  obraIds: cur.obraIds.includes(id)
                    ? cur.obraIds.filter((x) => x !== id)
                    : [...cur.obraIds, id],
                },
                true,
              );
            }}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
