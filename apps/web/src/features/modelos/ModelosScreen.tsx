import { useState } from 'react';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { ModeloFases } from './ModeloFases';
import { useModelos, useModelosMutations } from './useModelos';
import styles from './Modelos.module.css';

/** Modelos de obra (protótipo · ModeloCel · MODELOS). Só o gestor chega aqui. */
export function ModelosScreen({ onVoltar }: { onVoltar: () => void }) {
  const { data: modelos, isLoading } = useModelos();
  const { duplicar } = useModelosMutations();
  const { showToast } = useToast();
  const [aberto, setAberto] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);

  if (aberto) {
    return <ModeloFases id={aberto} onVoltar={() => setAberto(null)} onAbrir={setAberto} />;
  }

  function criar(origem: string | null, nome: string, subtitulo: string | null) {
    duplicar.mutate(
      { origem, nome, subtitulo },
      {
        onSuccess: (id) => {
          setNovo(false);
          setAberto(id);
          showToast({ message: 'Modelo criado · toque em Editar para dar nome e subtítulo' });
        },
        onError: (e) => showToast({ message: (e as Error).message }),
      },
    );
  }

  const lista = modelos ?? [];

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.barraTopo}>
          <button
            type="button"
            className={styles.iconeBtn}
            aria-label="Voltar ao início"
            onClick={onVoltar}
          >
            <Icon name="chevronLeft" size={22} />
          </button>
          <div className={styles.sobretitulo}>Contorno do Corpo</div>
        </div>
        <div className={styles.titulos}>
          <h1 className={styles.titulo}>Modelos de obra</h1>
          <div className={styles.texto}>Ao iniciar uma obra, você escolhe qual modelo seguir.</div>
        </div>
      </header>

      <div className={styles.lista}>
        {isLoading ? <p className={styles.vazio}>Carregando…</p> : null}
        {lista.map((m, i) => (
          <button
            key={m.id}
            type="button"
            className={styles.cartao}
            onClick={() => setAberto(m.id)}
          >
            <span className={styles.numero}>{i + 1}</span>
            <span className={styles.cartaoCorpo}>
              <span className={styles.cartaoNome}>{m.nome}</span>
              <span className={styles.cartaoSub}>{m.subtitulo || 'sem subtítulo'}</span>
              <span className={styles.chips}>
                <span className={styles.chipTurquesa}>{m.dias} dias úteis</span>
                <span className={styles.chip}>{m.atividades} atividades</span>
                <span className={styles.chip}>
                  {m.obras
                    ? `usado em ${m.obras} ${m.obras === 1 ? 'obra' : 'obras'}`
                    : 'ainda não usado'}
                </span>
              </span>
            </span>
            <Icon name="seta" size={20} className={styles.seta} />
          </button>
        ))}
      </div>

      <div className={styles.rodape}>
        <button type="button" className={styles.btnPrimario} onClick={() => setNovo(true)}>
          <Icon name="plus" size={22} strokeWidth={2.4} />
          Novo modelo
        </button>
      </div>

      <BottomSheet open={novo} onClose={() => setNovo(false)}>
        <div className={styles.folha}>
          <h2 className={styles.folhaTitulo}>Começar o novo modelo a partir de</h2>
          {lista.map((m) => (
            <button
              key={m.id}
              type="button"
              className={styles.base}
              disabled={duplicar.isPending}
              onClick={() => criar(m.id, `Cópia de ${m.nome}`, m.subtitulo)}
            >
              <span>
                <b>Cópia de {m.nome}</b>
                <small>{m.subtitulo || 'sem subtítulo'}</small>
              </span>
              <em>{m.dias} d</em>
            </button>
          ))}
          <button
            type="button"
            className={`${styles.base} ${styles.baseBranco}`}
            disabled={duplicar.isPending}
            onClick={() => criar(null, 'Novo modelo', null)}
          >
            <span>
              <b>Em branco</b>
              <small>Sem fases nem atividades · você cria as fases em seguida</small>
            </span>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
