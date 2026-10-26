import { useEffect, useState } from 'react';
import { MOTIVOS_ADIAMENTO, opcoesAdiamento } from '@contro/core';
import { BottomSheet } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import styles from './AdiarSheet.module.css';

/** Folha "Adiar pendência" (protótipo): volta para a fila na data escolhida. */
export function AdiarSheet({
  aberto,
  titulo,
  onFechar,
  onConfirmar,
  pendente,
}: {
  aberto: boolean;
  /** Título da pendência adiada. */
  titulo?: string;
  onFechar: () => void;
  onConfirmar: (data: string, motivo: string) => void;
  pendente?: boolean;
}) {
  const datas = opcoesAdiamento(hojeISO());
  const [data, setData] = useState<string>(datas[0]);
  const [motivo, setMotivo] = useState<string>(MOTIVOS_ADIAMENTO[0]);

  // Cada abertura começa no próximo dia útil e no primeiro motivo.
  useEffect(() => {
    if (aberto) {
      setData(opcoesAdiamento(hojeISO())[0]);
      setMotivo(MOTIVOS_ADIAMENTO[0]);
    }
  }, [aberto]);

  return (
    <BottomSheet open={aberto} onClose={onFechar}>
      <div className={styles.adiar}>
        <div>
          <h2 className={styles.adiarTitulo}>Adiar pendência</h2>
          {titulo ? <div className={styles.adiarSub}>{titulo}</div> : null}
        </div>

        <div className={styles.campo}>
          <div className={styles.campoRotulo}>Volta para a fila em</div>
          <div className={styles.datas}>
            {datas.map((d) => {
              const [dow, dm] = formatarDataCurta(d).split(' ');
              return (
                <button
                  key={d}
                  type="button"
                  className={`${styles.dataBtn} ${data === d ? styles.dataAtiva : ''}`}
                  aria-pressed={data === d}
                  onClick={() => setData(d)}
                >
                  <span className={styles.dow}>{dow}</span>
                  <b>{dm}</b>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.campo}>
          <div className={styles.campoRotulo}>Motivo</div>
          <div className={styles.motivos}>
            {MOTIVOS_ADIAMENTO.map((m) => (
              <button
                key={m}
                type="button"
                className={`${styles.motivo} ${motivo === m ? styles.motivoAtivo : ''}`}
                aria-pressed={motivo === m}
                onClick={() => setMotivo(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.aviso}>
          Ela sai da fila agora e volta sozinha no dia escolhido. Fica visível em Lista completa ›
          Adiadas.
        </div>
        <button
          type="button"
          className={styles.confirmar}
          disabled={pendente}
          onClick={() => onConfirmar(data, motivo)}
        >
          {pendente ? 'Adiando…' : `Adiar até ${formatarDataCurta(data)}`}
        </button>
      </div>
    </BottomSheet>
  );
}
