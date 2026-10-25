import { useState } from 'react';
import { Icon, Simbolo, useToast } from '@contro/ui';
import { ObraCard } from '../features/obras/ObraCard';
import { ObraDetalhe } from '../features/obras/ObraDetalhe';
import { NovaObraScreen } from '../features/obras/NovaObraScreen';
import { useObras } from '../features/obras/useObras';
import { usePerfil } from '../features/perfil/usePerfil';
import { ProntosParaEnviar } from '../features/boletim-auto/ProntosParaEnviar';
import styles from './MinhasObras.module.css';

export function MinhasObras() {
  const { data: obras, isLoading } = useObras();
  const { data: pessoa } = usePerfil();
  const { showToast } = useToast();
  const [vista, setVista] = useState<'lista' | 'nova'>('lista');
  const [obraAberta, setObraAberta] = useState<{
    id: string;
    aba?: 'tarefas';
    boletim?: boolean;
  } | null>(null);

  if (obraAberta) {
    return (
      <ObraDetalhe
        id={obraAberta.id}
        abaInicial={obraAberta.aba}
        abrirBoletim={obraAberta.boletim}
        onVoltar={() => setObraAberta(null)}
      />
    );
  }

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

      {pessoa?.perfil === 'gestor' ? (
        <ProntosParaEnviar
          onAbrirBoletim={(obraId) => setObraAberta({ id: obraId, boletim: true })}
        />
      ) : null}

      {isLoading ? (
        <p className={styles.vazio}>Carregando…</p>
      ) : temObras ? (
        <div className={styles.lista}>
          {(obras ?? []).map((o) => (
            <ObraCard
              key={o.id}
              obra={o}
              onAbrir={() => setObraAberta({ id: o.id })}
              onAbrirTarefas={() => setObraAberta({ id: o.id, aba: 'tarefas' })}
            />
          ))}
        </div>
      ) : (
        <div className={styles.vazio}>
          <Simbolo size={56} />
          <h2>Nenhuma obra ainda</h2>
          <p>Toque no “+” para criar a primeira obra a partir de um modelo.</p>
        </div>
      )}
    </div>
  );
}
