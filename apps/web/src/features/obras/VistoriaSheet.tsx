import { useState } from 'react';
import { podeVistoriar } from '@obdc/core';
import { BottomSheet, Button, Icon } from '@obdc/ui';
import type { PendenciaObra } from './pendenciasObra';
import styles from './VistoriaSheet.module.css';

export function VistoriaSheet({
  pendencia,
  pessoaId,
  onFechar,
  onAprovar,
  onReabrir,
  pendente,
}: {
  pendencia: PendenciaObra | null;
  pessoaId: string | null;
  onFechar: () => void;
  onAprovar: () => void;
  onReabrir: (motivo: string) => void;
  pendente?: boolean;
}) {
  const [motivo, setMotivo] = useState('');
  const p = pendencia;
  const pode = p ? podeVistoriar(p, pessoaId) : false;

  return (
    <BottomSheet open={Boolean(p)} title="Vistoria" onClose={onFechar}>
      {p ? (
        <>
          <div className={styles.par}>
            <figure className={styles.lado}>
              <figcaption>Antes</figcaption>
              {p.fotoAntesUrl ? (
                <img src={p.fotoAntesUrl} alt="Antes" />
              ) : (
                <div className={styles.semFoto}>sem foto</div>
              )}
            </figure>
            <figure className={styles.lado}>
              <figcaption>Depois</figcaption>
              {p.fotoDepoisUrl ? (
                <img src={p.fotoDepoisUrl} alt="Depois" />
              ) : (
                <div className={styles.semFoto}>sem foto</div>
              )}
            </figure>
          </div>

          <p className={styles.titulo}>{p.titulo}</p>
          <p className={styles.meta}>
            {p.local ? `${p.local} · ` : ''}resolvida por {p.resolveuNome ?? '—'}
          </p>

          {!pode ? (
            <p className={styles.bloqueio}>
              <Icon name="alert" size={16} />
              Quem resolveu não pode vistoriar a própria pendência.
            </p>
          ) : (
            <>
              <input
                className={styles.motivo}
                placeholder="Motivo da reabertura (opcional)"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                aria-label="Motivo da reabertura"
              />
              <div className={styles.acoes}>
                <Button
                  variant="tertiary"
                  disabled={pendente}
                  onClick={() => onReabrir(motivo.trim())}
                >
                  Reabrir
                </Button>
                <Button full disabled={pendente} onClick={onAprovar}>
                  {pendente ? 'Enviando…' : 'Aprovar e fechar'}
                </Button>
              </div>
            </>
          )}
        </>
      ) : null}
    </BottomSheet>
  );
}
