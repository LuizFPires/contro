import { estadoAcao } from '@contro/core';
import { Icon } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import styles from './DataLimiteTag.module.css';

/**
 * Data limite da pendência no card (10/11/2026): "Resolver até qua 18/11";
 * vencida e aberta, em vermelho "Atrasada · era até"; no dia, âmbar "Vence hoje".
 * Sempre texto e ícone (nunca só cor).
 */
export function DataLimiteTag({
  prazo,
  aberta,
  hoje,
}: {
  prazo: string | null | undefined;
  aberta: boolean;
  hoje: string;
}) {
  if (!prazo) return null;
  const estado = estadoAcao({ aberta, prazo }, hoje);
  const data = formatarDataCurta(prazo);
  if (estado === 'atrasada')
    return (
      <span className={`${styles.tag} ${styles.atrasada}`}>
        <Icon name="alert" size={14} strokeWidth={2.2} />
        Atrasada · era até {data}
      </span>
    );
  if (estado === 'hoje')
    return (
      <span className={`${styles.tag} ${styles.hoje}`}>
        <Icon name="relogio" size={14} strokeWidth={2.2} />
        Vence hoje
      </span>
    );
  return (
    <span className={styles.tag}>
      <Icon name="calendario" size={14} strokeWidth={2.2} />
      Resolver até {data}
    </span>
  );
}
