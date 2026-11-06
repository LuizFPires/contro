import type { ObraGeral } from './obraGeral';
import styles from './FichaAtividadeGeral.module.css';

/** Chips "Eu" + pessoas da obra (+ "Sem responsável" quando permitido). */
export function EscolherResponsavel({
  pessoas,
  pessoaId,
  valor,
  onEscolher,
  permitirNenhum = false,
}: {
  pessoas: ObraGeral['pessoas'];
  /** A pessoa logada: vira o chip "Eu". */
  pessoaId: string | null;
  valor: string | null;
  onEscolher: (id: string | null) => void;
  permitirNenhum?: boolean;
}) {
  const eu = pessoas.find((p) => p.id === pessoaId);
  const outras = pessoas.filter((p) => p.id !== pessoaId);
  const chip = (id: string | null, rotulo: string) => (
    <button
      key={id ?? 'nenhum'}
      type="button"
      className={`${styles.chipPessoa} ${valor === id ? styles.chipOn : ''}`}
      aria-pressed={valor === id}
      onClick={() => onEscolher(id)}
    >
      {rotulo}
    </button>
  );
  return (
    <div className={styles.chips} role="group" aria-label="Responsável">
      {eu ? chip(eu.id, 'Eu') : null}
      {outras.map((p) => chip(p.id, p.nome))}
      {permitirNenhum ? chip(null, 'Sem responsável') : null}
    </div>
  );
}
