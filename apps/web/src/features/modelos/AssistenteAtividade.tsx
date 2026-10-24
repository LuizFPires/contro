import { useMemo, useState } from 'react';
import { durSubitens, type AtividadeEntrada } from '@obdc/core';
import { Button, Icon, Input } from '@obdc/ui';
import type { Fase, NovaAtividade } from './detalhe';
import { useSugestoesAtividade } from './useModeloDetalhe';
import styles from './AssistenteAtividade.module.css';

interface Subitem {
  nome: string;
  duracao_du: number;
  em_sequencia: boolean;
}
interface Prov {
  tipo: 'contratacao' | 'locacao' | 'compra';
  descricao: string;
  antecedencia_du: number;
}
interface CandidatoPred {
  id: string;
  nome: string;
  fase_id: string;
}

const PASSOS = ['Nome', 'Prazo', 'Começa depois de', 'Providências', 'Revisão'];
const TIPOS: { v: Prov['tipo']; r: string }[] = [
  { v: 'contratacao', r: 'Contratação' },
  { v: 'locacao', r: 'Locação' },
  { v: 'compra', r: 'Compra' },
];

export function AssistenteAtividade({
  fases,
  fasePadrao,
  candidatosPred,
  salvando,
  onSalvar,
  onFechar,
}: {
  modeloId: string;
  fases: Fase[];
  fasePadrao: string;
  candidatosPred: CandidatoPred[];
  salvando: boolean;
  onSalvar: (a: Omit<NovaAtividade, 'modeloId'>) => void;
  onFechar: () => void;
}) {
  const { data: sugestoes } = useSugestoesAtividade();
  const [passo, setPasso] = useState(0);
  const [nome, setNome] = useState('');
  const [faseId, setFaseId] = useState(fasePadrao || fases[0]?.id || '');
  const [temSubitens, setTemSubitens] = useState(false);
  const [duracao, setDuracao] = useState(1);
  const [subitens, setSubitens] = useState<Subitem[]>([]);
  const [preds, setPreds] = useState<Set<string>>(new Set());
  const [provs, setProvs] = useState<Prov[]>([]);
  const [abaFase, setAbaFase] = useState(fases[0]?.id ?? '');
  const [busca, setBusca] = useState('');

  const duracaoCalc = useMemo(() => {
    if (!temSubitens) return duracao;
    const entrada: AtividadeEntrada[] = subitens.map((s, i) => ({
      id: String(i),
      duracao_du: s.duracao_du,
      em_sequencia: s.em_sequencia,
    }));
    return durSubitens(entrada);
  }, [temSubitens, duracao, subitens]);

  const faseTitulo = (id: string) => fases.find((f) => f.id === id)?.titulo ?? '';
  const nomePred = (id: string) => candidatosPred.find((c) => c.id === id)?.nome ?? id;

  const podeAvancar =
    (passo === 0 && nome.trim().length > 0 && faseId) ||
    (passo === 1 && duracaoCalc >= 1 && (!temSubitens || subitens.length > 0)) ||
    passo === 2 ||
    passo === 3 ||
    passo === 4;

  function salvar() {
    onSalvar({
      faseId,
      nome: nome.trim(),
      duracaoDu: duracaoCalc,
      subitens: temSubitens ? subitens : [],
      predecessoras: [...preds],
      providencias: provs,
    });
  }

  const candidatosDaAba = candidatosPred.filter(
    (c) => c.fase_id === abaFase && c.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Nova atividade">
      <div className={styles.topo}>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={onFechar}>
          <Icon name="close" size={22} />
        </button>
        <span className={styles.passoTitulo}>{PASSOS[passo]}</span>
        <span className={styles.passoContador}>
          {passo + 1}/{PASSOS.length}
        </span>
      </div>
      <div className={styles.progresso}>
        <div
          className={styles.progressoFill}
          style={{ width: `${((passo + 1) / PASSOS.length) * 100}%` }}
        />
      </div>

      <div className={styles.corpo}>
        {passo === 0 ? (
          <>
            <div>
              <Input
                label="Nome da atividade"
                list="sug-atv"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <datalist id="sug-atv">
                {(sugestoes ?? []).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={styles.label} htmlFor="asst-fase">
                Fase
              </label>
              <select
                id="asst-fase"
                className={styles.select}
                value={faseId}
                onChange={(e) => setFaseId(e.target.value)}
              >
                {fases.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.titulo}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {passo === 1 ? (
          <>
            <label className={styles.opcao}>
              <input
                type="checkbox"
                checked={temSubitens}
                onChange={(e) => setTemSubitens(e.target.checked)}
              />
              Dividir em subitens
            </label>
            {!temSubitens ? (
              <div>
                <span className={styles.label}>Duração (dias úteis)</span>
                <div className={styles.stepper}>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    aria-label="Menos"
                    onClick={() => setDuracao((d) => Math.max(1, d - 1))}
                  >
                    −
                  </button>
                  <span className={styles.stepVal}>{duracao}</span>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    aria-label="Mais"
                    onClick={() => setDuracao((d) => d + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ) : (
              <>
                {subitens.map((s, i) => (
                  <div key={i} className={styles.sub}>
                    <div className={styles.subNome}>
                      <Input
                        label={`Subitem ${i + 1}`}
                        value={s.nome}
                        onChange={(e) =>
                          setSubitens((arr) =>
                            arr.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)),
                          )
                        }
                      />
                      <div className={styles.linha} style={{ marginTop: 8 }}>
                        <div className={styles.stepper}>
                          <button
                            type="button"
                            className={styles.stepBtn}
                            aria-label="Menos"
                            onClick={() =>
                              setSubitens((arr) =>
                                arr.map((x, j) =>
                                  j === i ? { ...x, duracao_du: Math.max(1, x.duracao_du - 1) } : x,
                                ),
                              )
                            }
                          >
                            −
                          </button>
                          <span className={styles.stepVal}>{s.duracao_du}</span>
                          <button
                            type="button"
                            className={styles.stepBtn}
                            aria-label="Mais"
                            onClick={() =>
                              setSubitens((arr) =>
                                arr.map((x, j) =>
                                  j === i ? { ...x, duracao_du: x.duracao_du + 1 } : x,
                                ),
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                        <label className={styles.opcao}>
                          <input
                            type="checkbox"
                            checked={!s.em_sequencia}
                            onChange={(e) =>
                              setSubitens((arr) =>
                                arr.map((x, j) =>
                                  j === i ? { ...x, em_sequencia: !e.target.checked } : x,
                                ),
                              )
                            }
                          />
                          Em paralelo
                        </label>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.remover}
                      aria-label="Remover subitem"
                      onClick={() => setSubitens((arr) => arr.filter((_, j) => j !== i))}
                    >
                      <Icon name="lixeira" size={20} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={styles.adicionar}
                  onClick={() =>
                    setSubitens((arr) => [...arr, { nome: '', duracao_du: 1, em_sequencia: true }])
                  }
                >
                  <Icon name="plus" size={18} /> Adicionar subitem
                </button>
                <p className={styles.label}>Prazo calculado: {duracaoCalc} dias úteis</p>
              </>
            )}
          </>
        ) : null}

        {passo === 2 ? (
          <>
            <Input
              label="Buscar atividade"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className={styles.abas}>
              {fases.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`${styles.aba} ${abaFase === f.id ? styles.abaAtiva : ''}`}
                  onClick={() => setAbaFase(f.id)}
                >
                  {f.titulo}
                </button>
              ))}
            </div>
            {candidatosDaAba.map((c) => (
              <label key={c.id} className={styles.opcao}>
                <input
                  type="checkbox"
                  checked={preds.has(c.id)}
                  onChange={(e) =>
                    setPreds((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(c.id);
                      else n.delete(c.id);
                      return n;
                    })
                  }
                />
                {c.nome}
              </label>
            ))}
            {candidatosDaAba.length === 0 ? (
              <p className={styles.label}>Nenhuma atividade nesta fase.</p>
            ) : null}
          </>
        ) : null}

        {passo === 3 ? (
          <>
            {provs.map((p, i) => (
              <div key={i} className={styles.sub}>
                <div className={styles.subNome}>
                  <div className={styles.linha}>
                    <select
                      className={styles.select}
                      value={p.tipo}
                      onChange={(e) =>
                        setProvs((arr) =>
                          arr.map((x, j) =>
                            j === i ? { ...x, tipo: e.target.value as Prov['tipo'] } : x,
                          ),
                        )
                      }
                    >
                      {TIPOS.map((t) => (
                        <option key={t.v} value={t.v}>
                          {t.r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Input
                      label="O que"
                      value={p.descricao}
                      onChange={(e) =>
                        setProvs((arr) =>
                          arr.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.remover}
                  aria-label="Remover providência"
                  onClick={() => setProvs((arr) => arr.filter((_, j) => j !== i))}
                >
                  <Icon name="lixeira" size={20} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.adicionar}
              onClick={() =>
                setProvs((arr) => [...arr, { tipo: 'compra', descricao: '', antecedencia_du: 0 }])
              }
            >
              <Icon name="plus" size={18} /> Adicionar providência
            </button>
          </>
        ) : null}

        {passo === 4 ? (
          <div className={styles.resumo}>
            <div className={styles.resumoItem}>
              <strong>Atividade</strong>
              {nome} · {faseTitulo(faseId)}
            </div>
            <div className={styles.resumoItem}>
              <strong>Prazo</strong>
              {duracaoCalc} dias úteis
              {temSubitens ? ` (${subitens.length} subitens)` : ''}
            </div>
            <div className={styles.resumoItem}>
              <strong>Começa depois de</strong>
              {preds.size === 0 ? 'Nada (começa no início)' : [...preds].map(nomePred).join(', ')}
            </div>
            <div className={styles.resumoItem}>
              <strong>Providências</strong>
              {provs.length === 0
                ? 'Nenhuma'
                : provs
                    .map((p) => `${TIPOS.find((t) => t.v === p.tipo)?.r}: ${p.descricao}`)
                    .join('; ')}
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.rodape}>
        {passo > 0 ? (
          <Button variant="tertiary" onClick={() => setPasso((p) => p - 1)}>
            Voltar
          </Button>
        ) : (
          <Button variant="tertiary" onClick={onFechar}>
            Cancelar
          </Button>
        )}
        {passo < PASSOS.length - 1 ? (
          <Button disabled={!podeAvancar} onClick={() => setPasso((p) => p + 1)}>
            Continuar
          </Button>
        ) : (
          <Button disabled={salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : 'Salvar atividade'}
          </Button>
        )}
      </div>
    </div>
  );
}
