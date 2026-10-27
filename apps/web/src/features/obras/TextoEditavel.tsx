import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '@contro/ui';
import styles from './TextoEditavel.module.css';

/**
 * Texto da obra que o usuário edita livremente (nome da atividade, descrição do
 * lembrete): toque no lápis, edite e salve. Vazio não salva.
 */
export function TextoEditavel({
  valor,
  rotulo,
  onSalvar,
  children,
  editando: editandoFora,
  onFimEdicao,
}: {
  valor: string;
  /** Para leitores de tela: "Editar nome da atividade". */
  rotulo: string;
  onSalvar: (novo: string) => void;
  /** Como o texto aparece fora da edição. */
  children: ReactNode;
  /**
   * Controlado de fora (ex.: "Editar nome" no menu "⋯"): sem lápis; abre quando
   * true e avisa em onFimEdicao ao salvar ou cancelar.
   */
  editando?: boolean;
  onFimEdicao?: () => void;
}) {
  const [editandoLocal, setEditandoLocal] = useState(false);
  const controlado = editandoFora !== undefined;
  const editando = controlado ? editandoFora : editandoLocal;
  const setEditando = (v: boolean) => {
    if (controlado) {
      if (!v) onFimEdicao?.();
    } else setEditandoLocal(v);
  };
  const [texto, setTexto] = useState(valor);
  // Ao abrir pelo menu, começa do valor atual.
  useEffect(() => {
    if (editando) setTexto(valor);
  }, [editando, valor]);

  if (!editando && controlado) return <>{children}</>;
  if (!editando)
    return (
      <div className={styles.linha}>
        <div className={styles.texto}>{children}</div>
        <button
          type="button"
          className={styles.lapis}
          aria-label={rotulo}
          onClick={() => {
            setTexto(valor);
            setEditando(true);
          }}
        >
          <Icon name="editar" size={18} />
        </button>
      </div>
    );

  const final = texto.trim().replace(/\s+/g, ' ');
  const salvar = () => {
    setEditando(false);
    if (final && final !== valor) onSalvar(final);
  };
  return (
    <div className={styles.edicao}>
      <textarea
        className={styles.campo}
        value={texto}
        rows={2}
        autoFocus
        aria-label={rotulo}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            salvar();
          }
          if (e.key === 'Escape') setEditando(false);
        }}
      />
      <div className={styles.acoes}>
        <button type="button" className={styles.cancelar} onClick={() => setEditando(false)}>
          Cancelar
        </button>
        <button type="button" className={styles.salvar} disabled={!final} onClick={salvar}>
          <Icon name="check" size={16} strokeWidth={2.6} />
          Salvar
        </button>
      </div>
    </div>
  );
}
