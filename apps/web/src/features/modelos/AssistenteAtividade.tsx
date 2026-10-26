import { useMemo, useState } from 'react';
import { durSubitens, previaAtividadeModelo, type AtividadeEntrada } from '@contro/core';
import { Icon } from '@contro/ui';
import type { ModeloCompleto } from './detalhe';
import type { AtividadeEditada } from './edicao';
import { useSugestoesAtividade } from './useModeloDetalhe';
import styles from './AssistenteAtividade.module.css';

type Tipo = 'contratacao' | 'locacao' | 'compra';
interface Subitem {
  nome: string;
  duracao_du: number;
  em_sequencia: boolean;
}
interface Prov {
  tipo: Tipo;
  descricao: string;
  antecedencia_du: number;
}

const TIPO_ROTULO: Record<Tipo, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};
const TIPO_EXEMPLO: Record<Tipo, string> = {
  contratacao: 'Ex.: eletricista',
  locacao: 'Ex.: plataforma elevatória',
  compra: 'Ex.: porcelanato',
};
const PRAZOS = [1, 2, 3, 5, 8, 10];
const ANTECEDENCIAS = [0, 3, 5, 7, 10, 15, 20, 30];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Assistente de 5 passos para lançar ou editar atividade no modelo (regra 13;
 * protótipo · ModeloCel · ASSISTENTE). Editar abre direto na revisão.
 */
export function AssistenteAtividade({
  modelo,
  faseId,
  editarId,
  numeros,
  salvando,
  onSalvar,
  onRemover,
  onFechar,
}: {
  modelo: ModeloCompleto;
  faseId: string;
  /** Id da atividade em edição; null = nova. */
  editarId: string | null;
  /** Número (#) de cada atividade de topo no modelo. */
  numeros: Map<string, number>;
  salvando: boolean;
  onSalvar: (dados: AtividadeEditada) => void;
  onRemover?: () => void;
  onFechar: () => void;
}) {
  const { data: sugestoes } = useSugestoesAtividade();
  const original = editarId ? modelo.atividades.find((a) => a.id === editarId) : undefined;
  const editando = Boolean(original);

  const [passo, setPasso] = useState(editando ? 5 : 1);
  const [nome, setNome] = useState(original?.nome ?? '');
  const [duracao, setDuracao] = useState(original?.duracao_du ?? 1);
  const [subitens, setSubitens] = useState<Subitem[]>(() =>
    modelo.atividades
      .filter((a) => a.pai_id && a.pai_id === editarId)
      .sort((a, b) => a.ordem - b.ordem)
      .map((s) => ({ nome: s.nome, duracao_du: s.duracao_du, em_sequencia: s.em_sequencia })),
  );
  const [preds, setPreds] = useState<string[]>(original?.predecessoras ?? []);
  const [alvo, setAlvo] = useState<string | null>(original?.mapa_alvo_id ?? null);
  const [antecedencia, setAntecedencia] = useState(original?.mapa_antecedencia_du ?? 5);
  const [provs, setProvs] = useState<Prov[]>(
    () =>
      original?.providencias.map((p) => ({
        tipo: p.tipo,
        descricao: p.descricao,
        antecedencia_du: p.antecedencia_du,
      })) ?? [],
  );
  const [abaFase, setAbaFase] = useState(faseId);
  const [busca, setBusca] = useState('');
  const [confirmaRemover, setConfirmaRemover] = useState(false);
  const [aviso, setAviso] = useState('');

  const nFase = (id: string) => modelo.fases.findIndex((f) => f.id === id) + 1;
  const fase = modelo.fases.find((f) => f.id === faseId);
  // Pré-obra: não tem "começa depois de"; diz o que prepara (só aviso, nunca trava).
  const preObra = Boolean(fase?.preliminar);
  const fasesPre = new Set(modelo.fases.filter((f) => f.preliminar).map((f) => f.id));
  const topo = modelo.atividades.filter((a) => !a.pai_id);
  const nomeDe = (id: string) =>
    `#${numeros.get(id) ?? '?'} ${topo.find((a) => a.id === id)?.nome ?? ''}`;

  const dur = subitens.length
    ? durSubitens(
        subitens.map((s, i) => ({
          id: String(i),
          duracao_du: s.duracao_du,
          em_sequencia: s.em_sequencia,
        })),
      )
    : duracao;

  // Quem depende desta atividade (direta ou indiretamente) não pode ser predecessora: evita ciclo.
  const bloqueadas = useMemo(() => {
    const out = new Set<string>();
    if (!editarId) return out;
    const succ = new Map<string, string[]>();
    for (const a of topo)
      for (const p of a.predecessoras) succ.set(p, [...(succ.get(p) ?? []), a.id]);
    const pilha = [editarId];
    while (pilha.length) {
      const x = pilha.pop() as string;
      if (out.has(x)) continue;
      out.add(x);
      pilha.push(...(succ.get(x) ?? []));
    }
    return out;
  }, [editarId, topo]);

  const previa = useMemo(() => {
    const entrada: AtividadeEntrada[] = modelo.atividades.map((a) => ({
      id: a.id,
      duracao_du: a.duracao_du,
      pai_id: a.pai_id,
      em_sequencia: a.em_sequencia,
      predecessoras: a.predecessoras,
    }));
    try {
      return previaAtividadeModelo(entrada, {
        id: editarId ?? undefined,
        duracao_du: dur,
        predecessoras: preds,
      });
    } catch {
      return null;
    }
  }, [modelo, editarId, dur, preds]);

  const podeAvancar = passo !== 1 || nome.trim().length > 0;

  function avancar() {
    if (!podeAvancar) {
      setAviso('Dê um nome para a atividade');
      return;
    }
    setAviso('');
    if (passo < 5) {
      setPasso(editando ? 5 : passo + 1);
      return;
    }
    onSalvar({
      nome: nome.trim(),
      duracaoDu: dur,
      subitens: subitens.map((s) => ({ ...s, nome: s.nome.trim() || 'Subitem' })),
      predecessoras: preObra ? [] : preds,
      mapaAlvoId: preObra ? alvo : null,
      mapaAntecedenciaDu: preObra && alvo ? antecedencia : null,
      providencias: provs
        .filter((p) => p.descricao.trim())
        .map((p) => ({ ...p, descricao: p.descricao.trim() })),
    });
  }

  function voltar() {
    if (editando) {
      if (passo === 5) onFechar();
      else setPasso(5);
    } else if (passo > 1) setPasso(passo - 1);
    else onFechar();
  }

  const termo = busca.trim().toLowerCase();
  const candidatos = topo
    .filter((a) => !bloqueadas.has(a.id) && a.id !== editarId)
    .filter((a) =>
      termo
        ? a.nome.toLowerCase().includes(termo) ||
          String(numeros.get(a.id)) === termo.replace('#', '')
        : a.fase_id === abaFase,
    )
    .sort((a, b) => (numeros.get(a.id) ?? 0) - (numeros.get(b.id) ?? 0));
  const nBloq = bloqueadas.size - (editarId ? 1 : 0);
  const faseAba = modelo.fases.find((f) => f.id === abaFase);

  const sugs = (sugestoes ?? [])
    .filter((s) => !nome.trim() || s.toLowerCase().includes(nome.trim().toLowerCase()))
    .slice(0, 6);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={editando ? 'Editar atividade' : 'Nova atividade'}
    >
      <div className={styles.topo}>
        <button
          type="button"
          className={styles.iconeBtn}
          aria-label={passo > 1 && !(editando && passo === 5) ? 'Passo anterior' : 'Voltar à fase'}
          onClick={voltar}
        >
          <Icon name="chevronLeft" size={22} />
        </button>
        <div className={styles.topoTexto}>
          <div className={styles.sup}>
            {editando
              ? `Editar #${numeros.get(editarId as string)}`
              : `Nova atividade · passo ${passo} de 5`}
          </div>
          <div className={styles.tit}>
            Fase {nFase(faseId)} · {fase?.titulo}
          </div>
        </div>
        <button
          type="button"
          className={styles.iconeBtn}
          aria-label="Fechar sem salvar"
          onClick={onFechar}
        >
          <Icon name="close" size={22} />
        </button>
      </div>
      {!editando ? (
        <div className={styles.passos} aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={n <= passo ? styles.passoOn : ''} />
          ))}
        </div>
      ) : null}

      <div className={styles.corpo}>
        {passo === 1 ? (
          <div className={styles.etapa}>
            <h2 className={styles.pergunta}>Qual é a atividade?</h2>
            <input
              className={styles.campo}
              value={nome}
              placeholder="Digite ou escolha abaixo"
              aria-label="Nome da atividade"
              onChange={(e) => setNome(e.target.value)}
            />
            {!editando && sugs.length ? (
              <>
                <div className={styles.secao}>Já usadas nos modelos</div>
                <div className={styles.sugestoes}>
                  {sugs.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`${styles.sugestao} ${s.toLowerCase() === nome.trim().toLowerCase() ? styles.sugestaoOn : ''}`}
                      onClick={() => {
                        setNome(s);
                        setPasso(2);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {passo === 2 ? (
          <div className={styles.etapa}>
            <h2 className={styles.pergunta}>Quantos dias úteis?</h2>
            {subitens.length === 0 ? (
              <>
                <div className={styles.contador}>
                  <button
                    type="button"
                    className={styles.redondo}
                    aria-label="Menos um dia"
                    onClick={() => setDuracao((d) => Math.max(1, d - 1))}
                  >
                    −
                  </button>
                  <span className={styles.contadorValor}>
                    <strong>{duracao}</strong>
                    <span>dias úteis</span>
                  </span>
                  <button
                    type="button"
                    className={styles.redondo}
                    aria-label="Mais um dia"
                    onClick={() => setDuracao((d) => d + 1)}
                  >
                    +
                  </button>
                </div>
                <div className={styles.prazos}>
                  {PRAZOS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={duracao === n}
                      className={`${styles.prazo} ${duracao === n ? styles.prazoOn : ''}`}
                      onClick={() => setDuracao(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <div className={styles.caixa}>
              <div className={styles.caixaTopo}>
                <span>
                  <b>Dividir em subitens</b>
                  <span className={styles.miuda}>Ex.: demolição de alvenaria, forro e piso</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={subitens.length > 0}
                  aria-label="Dividir em subitens"
                  className={`${styles.chave} ${subitens.length ? styles.chaveOn : ''}`}
                  onClick={() =>
                    setSubitens((s) =>
                      s.length
                        ? []
                        : [
                            {
                              nome: `${nome.trim() || 'Subitem'} · parte 1`,
                              duracao_du: duracao,
                              em_sequencia: true,
                            },
                            { nome: 'Parte 2', duracao_du: 1, em_sequencia: true },
                          ],
                    )
                  }
                >
                  <span />
                </button>
              </div>
              {subitens.map((s, i) => (
                <div key={i} className={styles.subitem}>
                  <div className={styles.linha}>
                    <input
                      className={`${styles.campo} ${styles.campoMenor}`}
                      value={s.nome}
                      aria-label="Nome do subitem"
                      onChange={(e) =>
                        setSubitens((arr) =>
                          arr.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)),
                        )
                      }
                    />
                    <button
                      type="button"
                      className={styles.remover}
                      aria-label="Remover subitem"
                      onClick={() => setSubitens((arr) => arr.filter((_, j) => j !== i))}
                    >
                      <Icon name="close" size={20} />
                    </button>
                  </div>
                  <div className={styles.linha}>
                    <button
                      type="button"
                      className={styles.quadrado}
                      aria-label="Menos um dia"
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
                    <span className={styles.dias}>{s.duracao_du} d</span>
                    <button
                      type="button"
                      className={styles.quadrado}
                      aria-label="Mais um dia"
                      onClick={() =>
                        setSubitens((arr) =>
                          arr.map((x, j) => (j === i ? { ...x, duracao_du: x.duracao_du + 1 } : x)),
                        )
                      }
                    >
                      +
                    </button>
                    {i > 0 ? (
                      <div className={styles.segmento} role="group" aria-label="Quando começa">
                        <button
                          type="button"
                          aria-pressed={s.em_sequencia}
                          className={s.em_sequencia ? styles.segOn : ''}
                          onClick={() =>
                            setSubitens((arr) =>
                              arr.map((x, j) => (j === i ? { ...x, em_sequencia: true } : x)),
                            )
                          }
                        >
                          Depois
                        </button>
                        <button
                          type="button"
                          aria-pressed={!s.em_sequencia}
                          className={!s.em_sequencia ? styles.segOn : ''}
                          onClick={() =>
                            setSubitens((arr) =>
                              arr.map((x, j) => (j === i ? { ...x, em_sequencia: false } : x)),
                            )
                          }
                        >
                          Junto
                        </button>
                      </div>
                    ) : (
                      <span className={styles.miuda}>abre a atividade</span>
                    )}
                  </div>
                </div>
              ))}
              {subitens.length ? (
                <>
                  <button
                    type="button"
                    className={styles.tracejado}
                    onClick={() =>
                      setSubitens((arr) => [
                        ...arr,
                        { nome: `Parte ${arr.length + 1}`, duracao_du: 1, em_sequencia: true },
                      ])
                    }
                  >
                    + Subitem
                  </button>
                  <div className={styles.total}>
                    Total calculado: <b>{dur} dias úteis</b>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {passo === 3 && preObra ? (
          <div className={styles.etapa}>
            <h2 className={styles.pergunta}>O que esta etapa prepara?</h2>
            <div className={styles.explica}>
              Pré-obra: escolha a atividade da obra que esta etapa libera (ex.: o mapa de coleta do
              eletricista prepara a Infra de elétrica). Ela termina antes do início dessa atividade.
              É só um aviso para se programar: nada trava.
            </div>
            <button
              type="button"
              role="radio"
              aria-checked={alvo === null}
              className={`${styles.opcao} ${alvo === null ? styles.opcaoOn : ''}`}
              onClick={() => setAlvo(null)}
            >
              <span className={`${styles.caixinha} ${alvo === null ? styles.caixinhaOn : ''}`}>
                {alvo === null ? <Icon name="check" size={16} strokeWidth={3} /> : null}
              </span>
              <span className={styles.opcaoTexto}>
                <b>Nenhuma em especial</b>
                <span className={styles.miuda}>
                  Termina antes da primeira etapa que prepara algo
                </span>
              </span>
            </button>
            <div className={styles.secao}>Libera qual atividade da obra?</div>
            {topo
              .filter((a) => !fasesPre.has(a.fase_id))
              .sort((a, b) => (numeros.get(a.id) ?? 0) - (numeros.get(b.id) ?? 0))
              .map((a) => {
                const on = alvo === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`${styles.opcao} ${on ? styles.opcaoOn : ''}`}
                    onClick={() => setAlvo(a.id)}
                  >
                    <span className={`${styles.caixinha} ${on ? styles.caixinhaOn : ''}`}>
                      {on ? <Icon name="check" size={16} strokeWidth={3} /> : null}
                    </span>
                    <span className={styles.opcaoTexto}>
                      <b>
                        #{numeros.get(a.id)} {a.nome}
                      </b>
                      <span className={styles.miuda}>
                        Fase {nFase(a.fase_id)} · começa no D
                        {modelo.cronograma.porId[a.id]?.es ?? '?'}
                      </span>
                    </span>
                  </button>
                );
              })}
            {alvo ? (
              <>
                <div className={styles.secao}>Fechar quantos dias úteis antes do início dela?</div>
                <div className={styles.abas}>
                  {ANTECEDENCIAS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={antecedencia === n}
                      className={`${styles.aba} ${antecedencia === n ? styles.abaOn : ''}`}
                      onClick={() => setAntecedencia(n)}
                    >
                      {n === 0 ? 'no dia' : `${n} du`}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {passo === 3 && !preObra ? (
          <div className={styles.etapa}>
            <h2 className={styles.pergunta}>Começa depois de quê?</h2>
            <div className={styles.explica}>
              Marque o que precisa estar pronto antes. Vale atividade de qualquer fase.
            </div>
            {preds.length ? (
              <div className={styles.selecionadas}>
                {preds.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={styles.selecionada}
                    aria-label={`Desmarcar ${nomeDe(p)}`}
                    onClick={() => setPreds((arr) => arr.filter((x) => x !== p))}
                  >
                    <span>{nomeDe(p)}</span>
                    <Icon name="close" size={16} />
                  </button>
                ))}
              </div>
            ) : null}
            <input
              className={`${styles.campo} ${styles.busca}`}
              value={busca}
              placeholder="Buscar em todas as fases"
              aria-label="Buscar atividade"
              onChange={(e) => setBusca(e.target.value)}
            />
            {!termo ? (
              <div className={styles.abas}>
                {modelo.fases.map((f) => {
                  const marcadas = preds.filter(
                    (p) => topo.find((a) => a.id === p)?.fase_id === f.id,
                  ).length;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={abaFase === f.id}
                      className={`${styles.aba} ${abaFase === f.id ? styles.abaOn : ''}`}
                      onClick={() => setAbaFase(f.id)}
                    >
                      Fase {nFase(f.id)}
                      {f.id === faseId ? ' · esta' : ''}
                      {marcadas ? <span className={styles.abaN}>{marcadas}</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className={styles.secao}>
              {termo
                ? `${candidatos.length} encontradas`
                : `Fase ${nFase(abaFase)} · ${faseAba?.titulo ?? ''}`}
            </div>
            {candidatos.length === 0 ? (
              <div className={styles.explica}>Nenhuma atividade encontrada.</div>
            ) : null}
            {candidatos.map((a) => {
              const on = preds.includes(a.id);
              const c = modelo.cronograma.porId[a.id];
              return (
                <button
                  key={a.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className={`${styles.opcao} ${on ? styles.opcaoOn : ''}`}
                  onClick={() =>
                    setPreds((arr) => (on ? arr.filter((x) => x !== a.id) : [...arr, a.id]))
                  }
                >
                  <span className={`${styles.caixinha} ${on ? styles.caixinhaOn : ''}`}>
                    {on ? <Icon name="check" size={16} strokeWidth={3} /> : null}
                  </span>
                  <span className={styles.opcaoTexto}>
                    <b>
                      #{numeros.get(a.id)} {a.nome}
                    </b>
                    <span className={styles.miuda}>
                      {a.fase_id !== faseId ? `Fase ${nFase(a.fase_id)} · ` : ''}termina no D
                      {c?.ef ?? '?'}
                    </span>
                  </span>
                </button>
              );
            })}
            {editando && nBloq > 0 ? (
              <div className={styles.miuda}>
                Não aparecem {plural(nBloq, 'atividade que depende', 'atividades que dependem')}{' '}
                desta, para não criar um ciclo.
              </div>
            ) : null}
          </div>
        ) : null}

        {passo === 4 ? (
          <div className={styles.etapa}>
            <h2 className={styles.pergunta}>Precisa providenciar algo antes?</h2>
            <div className={styles.explica}>Vira lembrete na obra. Sem valor nem fornecedor.</div>
            {provs.map((p, i) => (
              <div key={i} className={styles.caixa}>
                <div className={styles.caixaTopo}>
                  <span className={`${styles.tipo} ${styles[`tipo_${p.tipo}`]}`}>
                    {TIPO_ROTULO[p.tipo]}
                  </span>
                  <button
                    type="button"
                    className={styles.remover}
                    aria-label="Remover lembrete"
                    onClick={() => setProvs((arr) => arr.filter((_, j) => j !== i))}
                  >
                    <Icon name="close" size={20} />
                  </button>
                </div>
                <input
                  className={`${styles.campo} ${styles.campoMenor}`}
                  value={p.descricao}
                  placeholder={TIPO_EXEMPLO[p.tipo]}
                  aria-label="O que providenciar"
                  onChange={(e) =>
                    setProvs((arr) =>
                      arr.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)),
                    )
                  }
                />
                <div className={styles.linha}>
                  <button
                    type="button"
                    className={styles.quadrado}
                    aria-label="Menos um dia"
                    onClick={() =>
                      setProvs((arr) =>
                        arr.map((x, j) =>
                          j === i
                            ? { ...x, antecedencia_du: Math.max(0, x.antecedencia_du - 1) }
                            : x,
                        ),
                      )
                    }
                  >
                    −
                  </button>
                  <span className={styles.dias}>{p.antecedencia_du} d</span>
                  <button
                    type="button"
                    className={styles.quadrado}
                    aria-label="Mais um dia"
                    onClick={() =>
                      setProvs((arr) =>
                        arr.map((x, j) =>
                          j === i ? { ...x, antecedencia_du: x.antecedencia_du + 1 } : x,
                        ),
                      )
                    }
                  >
                    +
                  </button>
                  <span className={styles.miuda}>antes de começar</span>
                </div>
              </div>
            ))}
            <div className={styles.novos}>
              {(Object.keys(TIPO_ROTULO) as Tipo[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={styles.novo}
                  onClick={() =>
                    setProvs((arr) => [
                      ...arr,
                      { tipo: t, descricao: '', antecedencia_du: t === 'locacao' ? 3 : 7 },
                    ])
                  }
                >
                  <span className={`${styles.mais} ${styles[`tipo_${t}`]}`}>+</span>
                  {TIPO_ROTULO[t]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {passo === 5 ? (
          <div className={styles.etapa}>
            <h2 className={styles.pergunta}>
              {editando ? nome || 'Atividade' : 'Confere e salva'}
            </h2>
            {previa && !preObra ? (
              <div className={styles.linhaTempo}>
                <div className={styles.linhaTempoTopo}>
                  <span>
                    D{previa.diaInicio} → D{previa.diaFim}
                  </span>
                  <span>{previa.texto}</span>
                </div>
                <div className={styles.linhaTempoBarra} aria-hidden="true">
                  <span
                    style={{
                      left: `${((previa.diaInicio - 1) / (previa.totalDepois || 1)) * 100}%`,
                      width: `${(dur / (previa.totalDepois || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
            {[
              { rot: 'Atividade', val: nome.trim() || 'sem nome', ir: 1 },
              {
                rot: 'Prazo',
                val: `${dur} dias úteis${subitens.length ? ` · ${plural(subitens.length, 'subitem', 'subitens')}` : ''}`,
                ir: 2,
              },
              preObra
                ? {
                    rot: 'Prepara (pré-obra · só aviso)',
                    val: alvo
                      ? `${nomeDe(alvo)} · fecha ${antecedencia ? `${antecedencia} du antes` : 'no dia'} do início`
                      : 'nenhuma em especial',
                    ir: 3,
                  }
                : {
                    rot: 'Começa depois de',
                    val: preds.length ? preds.map(nomeDe).join(', ') : 'início da obra',
                    ir: 3,
                  },
              {
                rot: 'Providências',
                val: provs.length
                  ? provs
                      .map((p) => `${TIPO_ROTULO[p.tipo]}${p.descricao ? `: ${p.descricao}` : ''}`)
                      .join(' · ')
                  : 'nenhuma',
                ir: 4,
              },
            ].map((r) => (
              <button
                key={r.rot}
                type="button"
                className={styles.resumo}
                onClick={() => setPasso(r.ir)}
              >
                <span className={styles.resumoTexto}>
                  <span className={styles.secao}>{r.rot}</span>
                  <b>{r.val}</b>
                </span>
                <span className={styles.alterar}>Alterar</span>
              </button>
            ))}
            {editando && onRemover ? (
              <button
                type="button"
                className={confirmaRemover ? styles.removerConfirma : styles.removerAtv}
                disabled={salvando}
                onClick={() => (confirmaRemover ? onRemover() : setConfirmaRemover(true))}
              >
                {confirmaRemover ? 'Toque de novo para remover' : 'Remover atividade'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {aviso ? (
        <div className={styles.aviso} role="alert">
          {aviso}
        </div>
      ) : null}
      <div className={styles.rodape}>
        {!editando && (passo === 3 || passo === 4) ? (
          <button type="button" className={styles.pular} onClick={() => setPasso(passo + 1)}>
            Pular
          </button>
        ) : null}
        <button
          type="button"
          className={`${styles.avancar} ${podeAvancar ? '' : styles.avancarOff}`}
          disabled={salvando}
          onClick={avancar}
        >
          {salvando
            ? 'Salvando…'
            : editando
              ? passo === 5
                ? 'Salvar alterações'
                : 'Ok'
              : passo === 5
                ? 'Salvar atividade'
                : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
