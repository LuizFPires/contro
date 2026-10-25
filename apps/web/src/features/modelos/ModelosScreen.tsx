import { useState } from 'react';
import { BottomSheet, Button, Card, Icon, Input, useToast } from '@contro/ui';
import { useModelos, useModelosMutations } from './useModelos';
import { ModeloDetalhe } from './ModeloDetalhe';
import type { ModeloResumo } from './api';
import styles from './ModelosScreen.module.css';

type Sheet = null | { tipo: 'novo' } | { tipo: 'renomear'; modelo: ModeloResumo };

export function ModelosScreen() {
  const { data: modelos, isLoading } = useModelos();
  const { duplicar, renomear, excluir, restaurar } = useModelosMutations();
  const { showToast } = useToast();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  if (aberto) {
    return <ModeloDetalhe id={aberto} onVoltar={() => setAberto(null)} />;
  }

  function apagar(m: ModeloResumo) {
    excluir.mutate(m.id, {
      onSuccess: () =>
        showToast({
          message: `"${m.nome}" excluído.`,
          onUndo: () => restaurar.mutate(m.id),
        }),
      onError: (e) => showToast({ message: (e as Error).message }),
    });
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topo}>
        <h1 className={styles.titulo}>Modelos de obra</h1>
        <button
          type="button"
          className={styles.novo}
          aria-label="Novo modelo"
          onClick={() => setSheet({ tipo: 'novo' })}
        >
          <Icon name="plus" size={24} />
        </button>
      </div>

      {isLoading ? (
        <p className={styles.vazio}>Carregando…</p>
      ) : (
        <div className={styles.lista}>
          {(modelos ?? []).map((m) => (
            <Card key={m.id}>
              <div className={styles.card}>
                <div
                  className={styles.info}
                  role="button"
                  tabIndex={0}
                  onClick={() => setAberto(m.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setAberto(m.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <h2 className={styles.nome}>{m.nome}</h2>
                  {m.subtitulo ? <p className={styles.sub}>{m.subtitulo}</p> : null}
                  <p className={styles.meta}>
                    {m.dias} dias úteis · {m.atividades} atividades
                  </p>
                </div>
                <div className={styles.acoes}>
                  <button
                    type="button"
                    className={styles.acao}
                    aria-label={`Duplicar ${m.nome}`}
                    onClick={() =>
                      duplicar.mutate(
                        { origem: m.id, nome: `${m.nome} (cópia)`, subtitulo: m.subtitulo },
                        { onSuccess: () => showToast({ message: 'Modelo duplicado.' }) },
                      )
                    }
                  >
                    <Icon name="duplicar" size={22} />
                  </button>
                  <button
                    type="button"
                    className={styles.acao}
                    aria-label={`Renomear ${m.nome}`}
                    onClick={() => setSheet({ tipo: 'renomear', modelo: m })}
                  >
                    <Icon name="editar" size={22} />
                  </button>
                  <button
                    type="button"
                    className={styles.acao}
                    aria-label={`Excluir ${m.nome}`}
                    onClick={() => apagar(m)}
                  >
                    <Icon name="lixeira" size={22} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <BottomSheet open={sheet?.tipo === 'novo'} title="Novo modelo" onClose={() => setSheet(null)}>
        <NovoModeloForm
          modelos={modelos ?? []}
          onSalvar={(origem, nome, subtitulo) =>
            duplicar.mutate(
              { origem, nome, subtitulo },
              {
                onSuccess: () => {
                  setSheet(null);
                  showToast({ message: 'Modelo criado.' });
                },
              },
            )
          }
        />
      </BottomSheet>

      <BottomSheet
        open={sheet?.tipo === 'renomear'}
        title="Renomear modelo"
        onClose={() => setSheet(null)}
      >
        {sheet?.tipo === 'renomear' ? (
          <RenomearForm
            modelo={sheet.modelo}
            onSalvar={(nome, subtitulo) =>
              renomear.mutate(
                { id: sheet.modelo.id, nome, subtitulo },
                { onSuccess: () => setSheet(null) },
              )
            }
          />
        ) : null}
      </BottomSheet>
    </div>
  );
}

function NovoModeloForm({
  modelos,
  onSalvar,
}: {
  modelos: ModeloResumo[];
  onSalvar: (origem: string | null, nome: string, subtitulo: string | null) => void;
}) {
  const [origem, setOrigem] = useState('');
  const [nome, setNome] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  return (
    <div className={styles.form}>
      <div>
        <label className={styles.campoLabel} htmlFor="novo-origem">
          Partir de
        </label>
        <select
          id="novo-origem"
          className={styles.select}
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
        >
          <option value="">Em branco</option>
          {modelos.map((m) => (
            <option key={m.id} value={m.id}>
              Copiar de: {m.nome}
            </option>
          ))}
        </select>
      </div>
      <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      <Input label="Subtítulo" value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
      <Button
        full
        disabled={!nome.trim()}
        onClick={() => onSalvar(origem || null, nome.trim(), subtitulo.trim() || null)}
      >
        Criar modelo
      </Button>
    </div>
  );
}

function RenomearForm({
  modelo,
  onSalvar,
}: {
  modelo: ModeloResumo;
  onSalvar: (nome: string, subtitulo: string | null) => void;
}) {
  const [nome, setNome] = useState(modelo.nome);
  const [subtitulo, setSubtitulo] = useState(modelo.subtitulo ?? '');
  return (
    <div className={styles.form}>
      <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      <Input label="Subtítulo" value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
      <Button
        full
        disabled={!nome.trim()}
        onClick={() => onSalvar(nome.trim(), subtitulo.trim() || null)}
      >
        Salvar
      </Button>
    </div>
  );
}
