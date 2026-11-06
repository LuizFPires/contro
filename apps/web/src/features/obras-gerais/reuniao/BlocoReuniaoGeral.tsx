import { horaCurta } from '@contro/core';
import { Icon } from '@contro/ui';
import { formatarDataCurta } from '../../../lib/datas';
import styles from './BlocoReuniaoGeral.module.css';

/**
 * Bloco "Reunião" da obra geral (C1, A13): a próxima reunião ("seg 09/11 · 16h") e o
 * acesso à pauta e às atas, como o bloco da aba Obras da Contorno.
 */
export function BlocoReuniaoGeral({
  proxima,
  onAbrir,
}: {
  /** Data (ISO) e hora ("16:00") da próxima reunião; null enquanto carrega. */
  proxima: { data: string; hora: string } | null;
  onAbrir: () => void;
}) {
  return (
    <button type="button" className={styles.bloco} onClick={onAbrir}>
      <span className={styles.titulo}>
        <Icon name="calendario" size={18} strokeWidth={2} className={styles.icone} />
        Reunião
      </span>
      <span className={styles.sub}>
        {proxima
          ? `${formatarDataCurta(proxima.data)} · ${horaCurta(proxima.hora)}`
          : 'Carregando…'}
      </span>
      <span className={styles.status}>Pauta e atas</span>
    </button>
  );
}

/** Os blocos Reunião e Ações da equipe lado a lado. */
export function BlocosObraGeral({ children }: { children: React.ReactNode }) {
  return <div className={styles.blocos}>{children}</div>;
}
