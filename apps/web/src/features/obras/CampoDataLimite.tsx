import { addDU } from '@contro/core';
import { EscolherData } from '../../components/EscolherData';
import { hojeISO } from './api';
import styles from './AdiarSheet.module.css';

/**
 * "Resolver até" da pendência (pedido de campo, 10/11/2026): opcional. Sem
 * data, vale o prazo da criticidade; com data, ela manda (card, PDF, Hoje, Log).
 */
export function CampoDataLimite({
  valor,
  onMudar,
}: {
  valor: string | null | undefined;
  onMudar: (prazo: string | null) => void;
}) {
  const hoje = hojeISO();
  return (
    <>
      <p className={styles.rotulo}>Resolver até (opcional)</p>
      <EscolherData
        rotulo="Resolver até"
        valor={valor ?? ''}
        onEscolher={(v) => onMudar(v || null)}
        sugestoes={[
          { valor: '', rotulo: 'Sem data' },
          { valor: addDU(hoje, 5), rotulo: 'Em 1 semana' },
          { valor: addDU(hoje, 10), rotulo: 'Em 2 semanas' },
        ]}
        min={hoje}
        hoje={hoje}
      />
    </>
  );
}
