import { useState } from 'react';
import { Icon, Monograma, useToast } from '@obdc/ui';
import { ObraCard } from '../features/obras/ObraCard';
import { NovaObraScreen } from '../features/obras/NovaObraScreen';
import { useObras } from '../features/obras/useObras';
import styles from './MinhasObras.module.css';

export function MinhasObras() {
  const { data: obras, isLoading } = useObras();
  const { showToast } = useToast();
  const [vista, setVista] = useState<'lista' | 'nova'>('lista');

  if (vista === 'nova') {
    return (
      <NovaObraScreen
        onVoltar={() => setVista('lista')}
        onCriada={() => {
          setVista('lista');
          showToast({ message: 'Obra criada.' });
        }}
      />
    );
  }

  const temObras = (obras ?? []).length > 0;

  return (
    <div className={styles.screen}>
      <div className={styles.topo}>
        <h1 className={styles.titulo}>Minhas obras</h1>
        <button
          type="button"
          className={styles.nova}
          aria-label="Nova obra"
          onClick={() => setVista('nova')}
        >
          <Icon name="plus" size={24} />
        </button>
      </div>

      {isLoading ? (
        <p className={styles.vazio}>Carregando…</p>
      ) : temObras ? (
        <div className={styles.lista}>
          {(obras ?? []).map((o) => (
            <ObraCard
              key={o.id}
              obra={o}
              onAbrir={() => showToast({ message: 'A tela da obra chega na próxima etapa.' })}
            />
          ))}
        </div>
      ) : (
        <div className={styles.vazio}>
          <Monograma size={56} />
          <h2>Nenhuma obra ainda</h2>
          <p>Toque no “+” para criar a primeira obra a partir de um modelo.</p>
        </div>
      )}
    </div>
  );
}
