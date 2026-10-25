import { useMemo, useState } from 'react';
import { Button, Card, Icon, useToast } from '@obdc/ui';
import { AssistenteAtividade } from './AssistenteAtividade';
import { Gantt } from './Gantt';
import { useModeloCompleto, useSalvarAtividade } from './useModeloDetalhe';
import { useEdicaoModelo } from './useEdicaoModelo';
import styles from './ModeloEditor.module.css';

const TIPO_ROTULO: Record<string, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};

export function ModeloEditor({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const { data: modelo, isLoading } = useModeloCompleto(id);
  const ed = useEdicaoModelo(id);
  const salvar = useSalvarAtividade(id);
  const { showToast } = useToast();
  const [assistente, setAssistente] = useState(false);

  const topo = useMemo(() => (modelo?.atividades ?? []).filter((a) => !a.pai_id), [modelo]);
  const nomes = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of topo) m[a.id] = a.nome;
    return m;
  }, [topo]);
  const preds = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const a of topo) m[a.id] = a.predecessoras;
    return m;
  }, [topo]);

  // Descendentes (sucessores transitivos) de uma atividade — não podem ser predecessoras.
  const descendentes = useMemo(() => {
    const succ: Record<string, string[]> = {};
    for (const a of topo) succ[a.id] = [];
    for (const a of topo) for (const p of a.predecessoras) succ[p]?.push(a.id);
    // Memoização pura (o grafo é DAG — o trigger anti-ciclo garante). O
    // placeholder evita recursão infinita se houver um ciclo transitório.
    const memo: Record<string, Set<string>> = {};
    const calc = (x: string): Set<string> => {
      const pronto = memo[x];
      if (pronto) return pronto;
      memo[x] = new Set();
      const out = new Set<string>();
      for (const s of succ[x] ?? []) {
        out.add(s);
        for (const d of calc(s)) out.add(d);
      }
      memo[x] = out;
      return out;
    };
    const r: Record<string, Set<string>> = {};
    for (const a of topo) r[a.id] = calc(a.id);
    return r;
  }, [topo]);

  if (isLoading || !modelo) {
    return (
      <div className={styles.wrap}>
        <p className={styles.meta}>Carregando…</p>
      </div>
    );
  }

  const candidatosPred = (atvId: string) =>
    topo.filter(
      (c) => c.id !== atvId && !preds[atvId].includes(c.id) && !descendentes[atvId].has(c.id),
    );

  return (
    <div className={styles.wrap}>
      <div className={styles.topo}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronRight" size={24} />
        </button>
        <div className={styles.tituloBloco}>
          <h1 className={styles.titulo}>{modelo.nome}</h1>
          <p className={styles.meta}>
            {modelo.cronograma.total} dias úteis · {topo.length} atividades · entrega em{' '}
            {modelo.cronograma.entrega}
          </p>
        </div>
        <div className={styles.acoesTopo}>
          <Button onClick={() => setAssistente(true)}>+ atividade</Button>
          <Button
            variant="tertiary"
            onClick={() =>
              ed.criarFase.mutate({ titulo: 'Nova fase', ordem: modelo.fases.length + 1 })
            }
          >
            + fase
          </Button>
        </div>
      </div>

      <Card className={styles.ganttCard}>
        <Gantt
          itens={modelo.cronograma.itens}
          nomes={nomes}
          predecessoras={preds}
          total={modelo.cronograma.total}
        />
      </Card>

      {modelo.fases.map((f) => {
        const daFase = topo.filter((a) => a.fase_id === f.id);
        return (
          <Card key={f.id}>
            <div className={styles.faseBloco}>
              <input
                className={styles.faseTitulo}
                defaultValue={f.titulo}
                aria-label="Título da fase"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== f.titulo) ed.renomearFase.mutate({ id: f.id, titulo: v });
                }}
              />
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Atividade</th>
                    <th>Duração</th>
                    <th>Depende de</th>
                    <th>Providências</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {daFase.map((a) => {
                    const c = modelo.cronograma.porId[a.id];
                    const subs = modelo.atividades.filter((x) => x.pai_id === a.id);
                    const temSubs = subs.length > 0;
                    return (
                      <tr key={a.id}>
                        <td>
                          <span className={c?.critico ? styles.critico : styles.nome}>
                            {a.nome}
                          </span>
                          {subs.map((s) => (
                            <div key={s.id} className={styles.subitem}>
                              ↳ {s.nome} · {s.duracao_du} du {s.em_sequencia ? '' : '(paralelo)'}
                            </div>
                          ))}
                        </td>
                        <td>
                          {temSubs ? (
                            <span>{c?.dur} du</span>
                          ) : (
                            <span className={styles.stepper}>
                              <button
                                type="button"
                                className={styles.stepBtn}
                                aria-label="Menos"
                                onClick={() =>
                                  ed.duracao.mutate({
                                    id: a.id,
                                    dur: Math.max(1, a.duracao_du - 1),
                                  })
                                }
                              >
                                −
                              </button>
                              {a.duracao_du}
                              <button
                                type="button"
                                className={styles.stepBtn}
                                aria-label="Mais"
                                onClick={() =>
                                  ed.duracao.mutate({ id: a.id, dur: a.duracao_du + 1 })
                                }
                              >
                                +
                              </button>
                            </span>
                          )}
                        </td>
                        <td>
                          <div className={styles.chips}>
                            {a.predecessoras.map((p) => (
                              <span key={p} className={styles.chip}>
                                {nomes[p] ?? '—'}
                                <button
                                  type="button"
                                  className={styles.chipX}
                                  aria-label={`Remover ${nomes[p]}`}
                                  onClick={() =>
                                    ed.desligarDep.mutate({ atividadeId: a.id, predId: p })
                                  }
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            <select
                              className={styles.addSelect}
                              aria-label="Adicionar predecessora"
                              value=""
                              onChange={(e) => {
                                if (e.target.value)
                                  ed.ligarDep.mutate(
                                    { atividadeId: a.id, predId: e.target.value },
                                    {
                                      onError: (err) =>
                                        showToast({ message: (err as Error).message }),
                                    },
                                  );
                              }}
                            >
                              <option value="">+ depende de…</option>
                              {candidatosPred(a.id).map((c2) => (
                                <option key={c2.id} value={c2.id}>
                                  {c2.nome}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>
                          {a.providencias.length === 0
                            ? '—'
                            : a.providencias.map((pr) => (
                                <div key={pr.id}>
                                  {TIPO_ROTULO[pr.tipo]}: {pr.descricao}
                                </div>
                              ))}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.lixo}
                            aria-label={`Excluir ${a.nome}`}
                            onClick={() =>
                              ed.excluirAtv.mutate(a.id, {
                                onSuccess: () => showToast({ message: `"${a.nome}" excluída.` }),
                                onError: (err) => showToast({ message: (err as Error).message }),
                              })
                            }
                          >
                            <Icon name="lixeira" size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      {assistente ? (
        <AssistenteAtividade
          modeloId={id}
          fases={modelo.fases}
          fasePadrao={modelo.fases[0]?.id ?? ''}
          candidatosPred={topo.map((a) => ({ id: a.id, nome: a.nome, fase_id: a.fase_id }))}
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
