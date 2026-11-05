import { useEffect, useState } from 'react';
import { BottomSheet, Segmented, useToast } from '@contro/ui';
import type { PapelGeral } from '@contro/core';
import type { ObraGeral } from './api';
import { ChavesObras } from './ChavesObras';
import { useAcessoGeral, type PessoaGeral } from './usePessoasGerais';
import styles from './PessoasAcessos.module.css';

const PAPEIS: { value: PapelGeral; label: string }[] = [
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'membro', label: 'Membro' },
];

/** Ficha da pessoa: papel e obras. Salva ao tocar; o toast Desfazer regrava o estado anterior. */
export function FichaPessoaGeral({
  pessoa,
  obras,
  onFechar,
}: {
  pessoa: PessoaGeral | null;
  obras: ObraGeral[];
  onFechar: () => void;
}) {
  const { showToast } = useToast();
  const { definir } = useAcessoGeral();
  const [papel, setPapel] = useState<PapelGeral>('membro');
  const [obraIds, setObraIds] = useState<string[]>([]);

  const idPessoa = pessoa?.id;
  useEffect(() => {
    if (pessoa) {
      setPapel(pessoa.papel);
      setObraIds(pessoa.obraIds);
    }
    // Só ao abrir outra pessoa: depois disso o estado local é a fonte (salva ao tocar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idPessoa]);

  async function aplicar(novoPapel: PapelGeral, novasObras: string[]) {
    if (!pessoa) return;
    const antesPapel = papel;
    const antesObras = obraIds;
    setPapel(novoPapel);
    setObraIds(novasObras);
    try {
      await definir(pessoa.id, novoPapel, novasObras);
    } catch {
      setPapel(antesPapel);
      setObraIds(antesObras);
      showToast({ message: 'Não foi possível salvar. Tente de novo.' });
      return;
    }
    showToast({
      message: 'Acesso salvo.',
      onUndo: () => {
        setPapel(antesPapel);
        setObraIds(antesObras);
        definir(pessoa.id, antesPapel, antesObras).catch(() => {
          setPapel(novoPapel);
          setObraIds(novasObras);
          showToast({ message: 'Não foi possível desfazer. Tente de novo.' });
        });
      },
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
            value={papel}
            onChange={(p) => {
              if (p !== papel) void aplicar(p, obraIds);
            }}
          />
        </div>
        <div>
          <p className={styles.rotulo}>Obras</p>
          <ChavesObras
            obras={obras}
            marcadas={obraIds}
            onAlternar={(id) =>
              void aplicar(
                papel,
                obraIds.includes(id) ? obraIds.filter((x) => x !== id) : [...obraIds, id],
              )
            }
          />
        </div>
      </div>
    </BottomSheet>
  );
}
