import { useState } from 'react';
import { ANOTACAO_MAX, normalizarAnotacao } from '@contro/core';
import { Button, TextoCrescente, useToast } from '@contro/ui';
import styles from './AnotarAndamento.module.css';

/**
 * "Andamento" na ficha da atividade (pedido do usuário, 24/11/2026): quem está
 * na obra escreve o que está acontecendo ("choveu, não deu para trabalhar").
 * Vai pela fila offline; a anotação aparece na Vida da atividade com o avanço
 * da hora. Contorno e Obras gerais, qualquer papel.
 */
export function AnotarAndamento({
  onAnotar,
  pendente,
}: {
  onAnotar: (texto: string, aoGravar: () => void) => void;
  pendente?: boolean;
}) {
  const { showToast } = useToast();
  const [texto, setTexto] = useState('');
  const valido = normalizarAnotacao(texto);

  return (
    <section className={styles.bloco} aria-label="Andamento">
      <TextoCrescente
        label="Andamento"
        placeholder="O que está acontecendo? Ex.: choveu, não deu para trabalhar"
        maxLength={ANOTACAO_MAX}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <Button
        type="button"
        variant="tertiary"
        className={styles.registrar}
        disabled={!valido || pendente}
        onClick={() => {
          if (!valido) return;
          onAnotar(valido, () => {
            setTexto('');
            showToast({ message: 'Anotação registrada' });
          });
        }}
      >
        Registrar
      </Button>
    </section>
  );
}
