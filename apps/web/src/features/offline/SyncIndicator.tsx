import { useState } from 'react';
import { Icon } from '@obdc/ui';
import { db } from '../../lib/db';
import { useOutbox } from './useOutbox';
import styles from './SyncIndicator.module.css';

/** Indicador discreto da fila offline + aviso de ações recusadas (reversão). */
export function SyncIndicator() {
  const { aguardando, rejeitadas } = useOutbox();
  const [aberto, setAberto] = useState(false);

  async function descartar() {
    await db.outbox.where('status').equals('rejeitada').delete();
    setAberto(false);
  }

  if (rejeitadas.length > 0) {
    return (
      <>
        <button type="button" className={styles.erro} onClick={() => setAberto(true)}>
          <Icon name="alert" size={16} />
          {rejeitadas.length} não {rejeitadas.length === 1 ? 'enviada' : 'enviadas'}
        </button>
        {aberto ? (
          <div className={styles.overlay} role="dialog" aria-label="Ações não enviadas">
            <div className={styles.sheet}>
              <p className={styles.titulo}>Ações recusadas pelo servidor</p>
              <p className={styles.texto}>
                O servidor desfez estas ações (a tela voltou ao estado real). Reveja e refaça se
                precisar.
              </p>
              <ul className={styles.lista}>
                {rejeitadas.map((o) => (
                  <li key={o.id}>
                    {o.tipo}
                    {o.erro ? ` — ${o.erro}` : ''}
                  </li>
                ))}
              </ul>
              <button type="button" className={styles.ok} onClick={descartar}>
                Entendi
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (aguardando > 0) {
    return (
      <div className={styles.aguardando} aria-live="polite">
        <span className={styles.ponto} aria-hidden="true" />
        {aguardando} {aguardando === 1 ? 'ação aguardando' : 'ações aguardando'} sinal
      </div>
    );
  }

  return null;
}
