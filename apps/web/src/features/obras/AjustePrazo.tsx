import { useMemo, useState } from 'react';
import { addDU, duEntre, simularAjuste, type AtividadeEntrada } from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import type { ObraCompleta } from './detalhe';
import { useObraCampo } from './useObraCampo';
import styles from './AjustePrazo.module.css';

const JANELA = 15; // três semanas de dias úteis
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

interface Alvo {
  dur: number;
  inicioManual: string | null;
  preds: string[];
}

/**
 * Ajustar prazo e dependências pela linha do tempo (protótipo aprovado · opção C):
 * a atividade entre as vizinhas, setas para início e duração, efeito na entrega
 * calculado pelo core e "Salvar ajustes" com Desfazer.
 */
export function AjustePrazo({ obra, atividadeId }: { obra: ObraCompleta; atividadeId: string }) {
  const campo = useObraCampo(obra.id);
  const { showToast } = useToast();
  const a = obra.atividades.find((x) => x.id === atividadeId);
  const temSubitens = obra.atividades.some((x) => x.pai_id === atividadeId);

  const salvo = useMemo(
    () => ({
      dur: a?.duracao_du ?? 1,
      esManual: a?.inicio_manual ? duEntre(obra.inicio, a.inicio_manual) : null,
      preds: a?.predecessoras ?? [],
    }),
    [a, obra.inicio],
  );
  const [dur, setDur] = useState(salvo.dur);
  const [esManual, setEsManual] = useState<number | null>(salvo.esManual);
  const [preds, setPreds] = useState<string[]>(salvo.preds);
  const [lista, setLista] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const entrada: AtividadeEntrada[] = useMemo(
    () =>
      obra.atividades
        .filter((x) => !x.preObra)
        .map((x) => ({
          id: x.id,
          duracao_du: x.duracao_du,
          pai_id: x.pai_id,
          em_sequencia: x.em_sequencia,
          inicio_manual: x.inicio_manual,
          predecessoras: x.predecessoras,
        })),
    [obra.atividades],
  );

  const sim = useMemo(() => {
    try {
      return simularAjuste(obra.inicio, entrada, {
        id: atividadeId,
        duracao_du: dur,
        esManual,
        predecessoras: preds,
      });
    } catch {
      return null; // ciclo: não deveria acontecer (a lista não oferece quem depende desta)
    }
  }, [obra.inicio, entrada, atividadeId, dur, esManual, preds]);

  const topo = obra.atividades.filter((x) => !x.pai_id && !x.preObra);
  const nome = (id: string) => topo.find((x) => x.id === id)?.nome ?? '';

  // Quem depende desta (direta ou indiretamente) não pode virar predecessora.
  const bloqueadas = useMemo(() => {
    const succ = new Map<string, string[]>();
    for (const x of topo)
      for (const p of x.predecessoras) succ.set(p, [...(succ.get(p) ?? []), x.id]);
    const out = new Set<string>();
    const pilha = [atividadeId];
    while (pilha.length) {
      const id = pilha.pop() as string;
      if (out.has(id)) continue;
      out.add(id);
      pilha.push(...(succ.get(id) ?? []));
    }
    return out;
  }, [topo, atividadeId]);

  if (!a || !sim) return null;

  const sucessoras = topo.filter((x) => x.predecessoras.includes(atividadeId)).slice(0, 2);
  const inicioJanela = Math.max(0, sim.es - 5);
  const cron = sim.cronograma.porId;
  const barra = (id: string, tipo: 'antes' | 'esta' | 'depois', rotulo: string) => {
    const it = cron[id];
    if (!it) return null;
    const ini = Math.max(0, it.es - inicioJanela);
    const fim = Math.min(JANELA, it.ef - inicioJanela);
    if (fim <= 0 || ini >= JANELA) return null;
    return { id, tipo, rotulo, coluna: `${ini + 1} / span ${Math.max(1, fim - ini)}` };
  };
  const barras = [
    ...preds.slice(0, 2).map((p) => barra(p, 'antes', `${nome(p)} (antes)`)),
    barra(atividadeId, 'esta', a.nome),
    ...sucessoras.map((s) => barra(s.id, 'depois', `${s.nome} (depois)`)),
  ].filter((b): b is NonNullable<typeof b> => Boolean(b));

  const diaIni = addDU(obra.inicio, sim.es);
  const diaFim = addDU(obra.inicio, sim.ef - 1);
  const mudou =
    dur !== salvo.dur ||
    sim.inicioManual !== (a.inicio_manual ?? null) ||
    preds.join() !== salvo.preds.join();
  const impacto = !mudou
    ? 'Sem mudanças. Mexa nas setas ou nas dependências para ver o efeito.'
    : sim.deltaEntrega > 0
      ? `Termina ${formatarDataCurta(diaFim)} · empurra a entrega da obra em ${plural(sim.deltaEntrega, 'dia útil', 'dias úteis')} (para ${formatarDataCurta(sim.entregaDepois)})`
      : sim.deltaEntrega < 0
        ? `Termina ${formatarDataCurta(diaFim)} · adianta a entrega da obra em ${plural(-sim.deltaEntrega, 'dia útil', 'dias úteis')}`
        : `Termina ${formatarDataCurta(diaFim)} · não muda a entrega da obra`;

  const candidatos = topo.filter((x) => !bloqueadas.has(x.id) && !preds.includes(x.id));

  async function aplicar(alvo: Alvo, antes: Alvo) {
    for (const p of antes.preds.filter((x) => !alvo.preds.includes(x)))
      await campo.removerPred.mutateAsync({ atividadeId, predecessoraId: p });
    for (const p of alvo.preds.filter((x) => !antes.preds.includes(x)))
      await campo.addPred.mutateAsync({ atividadeId, predecessoraId: p });
    if (alvo.dur !== antes.dur && !temSubitens)
      await campo.duracao.mutateAsync({ id: atividadeId, du: alvo.dur });
    if (alvo.inicioManual !== antes.inicioManual)
      await campo.inicio.mutateAsync({ id: atividadeId, data: alvo.inicioManual });
  }

  async function salvar() {
    if (!mudou || !sim || !a) return;
    const antes: Alvo = {
      dur: salvo.dur,
      inicioManual: a.inicio_manual ?? null,
      preds: salvo.preds,
    };
    const alvo: Alvo = { dur, inicioManual: sim.inicioManual, preds };
    setSalvando(true);
    try {
      await aplicar(alvo, antes);
      showToast({
        message: 'Prazo e dependências salvos',
        onUndo: () =>
          void aplicar(antes, alvo).catch(() =>
            showToast({ message: 'Não foi possível desfazer' }),
          ),
      });
    } catch (e) {
      const err = e as { message?: string; code?: string };
      const ciclo = err.code === '23514' || /ciclo/i.test(err.message ?? '');
      showToast({
        message: ciclo ? 'Essa dependência criaria um ciclo' : 'Não foi possível salvar os ajustes',
      });
    } finally {
      setSalvando(false);
    }
  }

  function descartar() {
    setDur(salvo.dur);
    setEsManual(salvo.esManual);
    setPreds(salvo.preds);
    setLista(false);
  }

  return (
    <div className={styles.ajuste}>
      <div className={styles.linhaTempo}>
        <div className={styles.dias} aria-hidden="true">
          {Array.from({ length: JANELA }, (_, i) => {
            const d = addDU(obra.inicio, inicioJanela + i);
            return (
              <span key={i} className={inicioJanela + i === sim.es ? styles.diaHoje : ''}>
                {Number(d.slice(8, 10))}
              </span>
            );
          })}
        </div>
        {barras.map((b) => (
          <div key={b.id} className={styles.faixa}>
            <div className={b.tipo === 'esta' ? styles.rotuloEsta : styles.rotulo}>{b.rotulo}</div>
            <div className={styles.trilho} aria-hidden="true">
              <span className={styles[`barra_${b.tipo}`]} style={{ gridColumn: b.coluna }} />
            </div>
          </div>
        ))}
        <div className={styles.legenda}>
          {formatarDataCurta(addDU(obra.inicio, inicioJanela))} a{' '}
          {formatarDataCurta(addDU(obra.inicio, inicioJanela + JANELA - 1))} · só dias úteis
        </div>
      </div>

      <div className={styles.controles}>
        <div className={styles.controle}>
          <div className={styles.controleRotulo}>Começa</div>
          <div className={styles.controleLinha}>
            <button
              type="button"
              className={styles.seta}
              aria-label="Um dia útil antes"
              disabled={sim.es <= sim.esMinimo}
              onClick={() => setEsManual(sim.es - 1 <= sim.esMinimo ? null : sim.es - 1)}
            >
              ‹
            </button>
            <b>{formatarDataCurta(diaIni)}</b>
            <button
              type="button"
              className={styles.seta}
              aria-label="Um dia útil depois"
              onClick={() => setEsManual(sim.es + 1)}
            >
              ›
            </button>
          </div>
          <div className={styles.miuda}>
            {sim.inicioManual ? 'início manual' : 'pelo cronograma'}
          </div>
        </div>
        <div className={styles.controle}>
          <div className={styles.controleRotulo}>Duração</div>
          <div className={styles.controleLinha}>
            <button
              type="button"
              className={styles.seta}
              aria-label="Menos um dia"
              disabled={temSubitens || dur <= 1}
              onClick={() => setDur((d) => Math.max(1, d - 1))}
            >
              −
            </button>
            <b>{sim.ef - sim.es} d</b>
            <button
              type="button"
              className={styles.seta}
              aria-label="Mais um dia"
              disabled={temSubitens}
              onClick={() => setDur((d) => d + 1)}
            >
              +
            </button>
          </div>
          <div className={styles.miuda}>
            {temSubitens ? 'calculada pelos subitens' : `termina ${formatarDataCurta(diaFim)}`}
          </div>
        </div>
      </div>

      <div className={styles.deps}>
        <span className={styles.depsRotulo}>Depois de:</span>
        {preds.map((p) => (
          <button
            key={p}
            type="button"
            className={styles.dep}
            aria-label={`Tirar ${nome(p)}`}
            onClick={() => setPreds((arr) => arr.filter((x) => x !== p))}
          >
            {nome(p)}
            <Icon name="close" size={14} strokeWidth={2.4} />
          </button>
        ))}
        {preds.length === 0 ? <span className={styles.miuda}>nada (início da obra)</span> : null}
        <button
          type="button"
          className={styles.adicionar}
          aria-expanded={lista}
          onClick={() => setLista((v) => !v)}
        >
          + Adicionar
        </button>
      </div>
      {lista ? (
        <div className={styles.lista}>
          {candidatos.map((c) => (
            <button
              key={c.id}
              type="button"
              className={styles.candidato}
              onClick={() => {
                setPreds((arr) => [...arr, c.id]);
                setLista(false);
              }}
            >
              <span>
                <b>{c.nome}</b>
                <span className={styles.miuda}>
                  termina {formatarDataCurta(obra.cron.porId[c.id]?.fim_previsto ?? obra.inicio)}
                </span>
              </span>
              <span className={styles.mais}>+</span>
            </button>
          ))}
          <div className={styles.miuda}>
            Não aparece quem depende desta atividade, para não criar ciclo.
          </div>
        </div>
      ) : null}

      <div className={`${styles.impacto} ${mudou ? styles.impactoOn : ''}`}>{impacto}</div>

      <div className={styles.botoes}>
        <button
          type="button"
          className={styles.descartar}
          disabled={!mudou || salvando}
          onClick={descartar}
        >
          Descartar
        </button>
        <button
          type="button"
          className={styles.salvar}
          disabled={!mudou || salvando}
          onClick={() => void salvar()}
        >
          {salvando ? 'Salvando…' : 'Salvar ajustes'}
        </button>
      </div>
    </div>
  );
}
