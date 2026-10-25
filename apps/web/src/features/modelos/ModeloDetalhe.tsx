import { useState } from 'react';
import { Button, Card, Icon, useToast } from '@contro/ui';
import { AssistenteAtividade } from './AssistenteAtividade';
import { ModeloEditor } from './ModeloEditor';
import { useModeloCompleto, useSalvarAtividade } from './useModeloDetalhe';
import styles from './ModeloDetalhe.module.css';

export function ModeloDetalhe({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const { data: modelo, isLoading } = useModeloCompleto(id);
  const salvar = useSalvarAtividade(id);
  const { showToast } = useToast();
  const [assistente, setAssistente] = useState(false);
  const [editor, setEditor] = useState(false);

  if (editor) {
    return <ModeloEditor id={id} onVoltar={() => setEditor(false)} />;
  }

  if (isLoading || !modelo) {
    return (
      <div className={styles.screen}>
        <div className={styles.topo}>
          <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
            <Icon name="chevronRight" size={24} />
          </button>
          <p className={styles.meta}>Carregando…</p>
        </div>
      </div>
    );
  }

  const topo = modelo.atividades.filter((a) => !a.pai_id);
  const candidatos = topo.map((a) => ({ id: a.id, nome: a.nome, fase_id: a.fase_id }));

  return (
    <div className={styles.screen}>
      <div className={styles.topo}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronRight" size={24} />
        </button>
        <div className={styles.tituloBloco}>
          <h1 className={styles.titulo}>{modelo.nome}</h1>
          <p className={styles.meta}>
            {modelo.cronograma.total} dias úteis · {topo.length} atividades
          </p>
        </div>
        <Button variant="tertiary" onClick={() => setEditor(true)}>
          Editor
        </Button>
        <button
          type="button"
          className={styles.novo}
          aria-label="Nova atividade"
          onClick={() => setAssistente(true)}
        >
          <Icon name="plus" size={24} />
        </button>
      </div>

      {modelo.fases.map((f) => {
        const daFase = topo.filter((a) => a.fase_id === f.id);
        if (daFase.length === 0) return null;
        return (
          <Card key={f.id}>
            <div className={styles.fase}>
              <p className={styles.faseTitulo}>{f.titulo}</p>
              {daFase.map((a) => {
                const c = modelo.cronograma.porId[a.id];
                const subs = modelo.atividades.filter((x) => x.pai_id === a.id);
                return (
                  <div key={a.id}>
                    <div className={styles.atv}>
                      <span className={styles.atvNome}>{a.nome}</span>
                      <span className={styles.atvMeta}>
                        {c?.dur ?? a.duracao_du} du{a.predecessoras.length ? ' · dep' : ''}
                      </span>
                    </div>
                    {c?.critico ? <span className={styles.critChip}>caminho crítico</span> : null}
                    {subs.map((s) => (
                      <div key={s.id} className={styles.subitem}>
                        ↳ {s.nome} · {s.duracao_du} du {s.em_sequencia ? '' : '(paralelo)'}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {assistente ? (
        <AssistenteAtividade
          modeloId={id}
          fases={modelo.fases}
          fasePadrao={modelo.fases[0]?.id ?? ''}
          candidatosPred={candidatos}
          salvando={salvar.isPending}
          onFechar={() => setAssistente(false)}
          onSalvar={(a) =>
            salvar.mutate(
              { ...a, modeloId: id },
              {
                onSuccess: () => {
                  setAssistente(false);
                  showToast({ message: 'Atividade adicionada.' });
                },
                onError: (e) => showToast({ message: (e as Error).message }),
              },
            )
          }
        />
      ) : null}
    </div>
  );
}
