import { useMemo } from 'react';
import { Card } from '@obdc/ui';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import type { ObraCompleta } from './detalhe';
import { classificarProvidencias } from './providenciasObra';
import { useObraCampo } from './useObraCampo';
import styles from './ProvidenciasAba.module.css';

export function ProvidenciasAba({ obra }: { obra: ObraCompleta }) {
  const campo = useObraCampo(obra.id);

  const { atrasadas, aProvidenciar, feitas } = useMemo(
    () => classificarProvidencias(obra, hojeISO()),
    [obra],
  );

  const marcar = (id: string) => campo.providencia.mutate({ id, feito: true });

  return (
    <div className={styles.aba}>
      {atrasadas.length > 0 ? (
        <Card>
          <div className={styles.grupo}>
            <p className={`${styles.grupoTitulo} ${styles.atrasadoTitulo}`}>
              Atrasados ({atrasadas.length})
            </p>
            {atrasadas.map((it) => (
              <div key={it.id} className={styles.item}>
                <div className={styles.info}>
                  <div className={styles.desc}>{it.rotulo}</div>
                  <div className={styles.metaAtraso}>
                    era para providenciar até {formatarDataCurta(it.providenciarAte)} ·{' '}
                    {it.atividade}
                  </div>
                </div>
                <button type="button" className={styles.marcar} onClick={() => marcar(it.id)}>
                  Marcar
                </button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className={styles.grupo}>
          <p className={styles.grupoTitulo}>A providenciar ({aProvidenciar.length})</p>
          {aProvidenciar.length === 0 ? (
            <p className={styles.contador}>Nada pendente por aqui.</p>
          ) : (
            aProvidenciar.map((it) => (
              <div key={it.id} className={styles.item}>
                <div className={styles.info}>
                  <div className={styles.desc}>{it.rotulo}</div>
                  <div className={styles.meta}>
                    até {formatarDataCurta(it.providenciarAte)} · {it.atividade}
                  </div>
                </div>
                <button type="button" className={styles.marcar} onClick={() => marcar(it.id)}>
                  Marcar
                </button>
              </div>
            ))
          )}
        </div>
      </Card>

      <p className={styles.contador}>{feitas} já providenciados</p>
    </div>
  );
}
