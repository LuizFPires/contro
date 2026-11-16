import { useMemo, useRef, useState } from 'react';
import {
  UNIDADES_QUANT,
  barrasPorDia,
  comparativoAtividade,
  diaMedido,
  diasCorridosInclusivo,
  duDaMedicao,
  duInclusivo,
  ehFimDeSemana,
  erroPeriodo,
  formatarNumero,
  gradeDoMesDomingo,
  lerNumero,
  linhasPlanilhaComparativo,
  medicaoCompleta,
  metaDoDia,
  produtividade,
  referenciaLancamento,
  rotuloDia,
  situacaoEm,
  somaMedida,
  somarMeses,
  tabelaMeta,
  textoMetaWhatsApp,
  tituloMedicao,
  type Medicao,
  type Quantitativo,
  type TomSituacao,
} from '@contro/core';
import { BottomSheet, Icon, Segmented, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import {
  baixarArquivo,
  datasDe,
  pdfTabela,
  planilhaCsv,
  quantDe,
  useMedicoesDaAtividade,
} from './quantitativoObra';
import { Camera } from './Camera';
import type { ObraAtv, ObraCompleta, ObraMedicao } from './detalhe';
import { numeracaoObra } from './numeracaoObra';
import { useConcluirAtividade, type AoConcluir } from './useConcluirAtividade';
import { useObraCampo } from './useObraCampo';
import styles from './AvancoQuant.module.css';

/** Telas do avanço por quantitativo, todas a partir da ficha da atividade. */
export type TelaAvanco =
  | { t: 'quant' }
  | { t: 'lancar'; medicaoId?: string | null }
  | { t: 'medicoes' }
  | { t: 'meta' }
  | { t: 'prod' }
  | { t: 'comparar' };

const fmt = formatarNumero;
const pc = (f: number) => `${fmt(f * 100, 1)}%`;

/** Selo de situação: texto e ícone, nunca só cor. */
function Selo({ tom, texto }: { tom: TomSituacao; texto: string }) {
  const icone =
    tom === 'atraso'
      ? 'alert'
      : tom === 'hoje'
        ? 'relogio'
        : tom === 'planejada'
          ? 'calendario'
          : 'checkGrosso';
  return (
    <span className={`${styles.selo} ${styles[`selo_${tom}`]}`}>
      <Icon name={icone} size={14} strokeWidth={2.4} />
      {texto}
    </span>
  );
}

/** Barra do executado com a marca preta do previsto. */
function Barra({ real, previsto }: { real: number; previsto: number }) {
  return (
    <div className={styles.barra} aria-hidden="true">
      <span className={styles.barraReal} style={{ width: `${Math.min(100, real * 100)}%` }} />
      <span
        className={styles.barraMarca}
        style={{ left: `calc(${Math.min(100, previsto * 100)}% - 1px)` }}
      />
    </div>
  );
}

/**
 * Bloco "Avanço por quantitativo" da ficha da atividade: sem quantitativo, o
 * convite "+ Quantitativo"; com, o medido x previsto e os atalhos (Medições,
 * Meta, Produtividade). Lançar avanço fica no rodapé da ficha.
 */
export function BlocoQuantitativo({
  obra,
  a,
  onAbrir,
}: {
  obra: ObraCompleta;
  a: ObraAtv;
  onAbrir: (t: TelaAvanco) => void;
}) {
  const q = quantDe(obra, a);
  if (!q) {
    return (
      <section className={styles.secaoFicha}>
        <h3 className={styles.rotuloFicha}>
          <Icon name="regua" size={16} strokeWidth={2} />
          Avanço por quantitativo
        </h3>
        <div className={styles.convite}>
          <b>Medir por quantitativo</b>
          <span>
            Informe a quantidade (ex.: 1.200 m²). O avanço desta atividade passa a ser o % medido,
            no lugar de 25 · 50 · 75 · 100, e entra no histórico de produtividade do prestador.
          </span>
          <button
            type="button"
            className={styles.btnSecundario}
            onClick={() => onAbrir({ t: 'quant' })}
          >
            <Icon name="plus" size={18} strokeWidth={2.2} />
            Quantitativo
          </button>
        </div>
      </section>
    );
  }
  const hoje = hojeISO();
  const s = situacaoEm(q, a.medicoes, hoje);
  const p = produtividade(a.medicoes, metaDoDia(q));
  const precisa =
    Math.max(0, q.total - s.real) / Math.max(1, duInclusivo(hoje > q.fim ? q.fim : hoje, q.fim));
  return (
    <section className={styles.secaoFicha}>
      <h3 className={styles.rotuloFicha}>
        <Icon name="regua" size={16} strokeWidth={2} />
        Avanço por quantitativo
      </h3>
      <div className={styles.cardMedido}>
        <button
          type="button"
          className={styles.cardMedidoTopo}
          onClick={() => onAbrir({ t: 'quant' })}
          aria-label="Editar quantitativo"
        >
          <span>
            <span className={styles.numGrande}>
              {fmt(s.real, 2)} {q.unidade}
            </span>
            <span className={styles.miuda}>
              de {fmt(q.total, 2)} {q.unidade} · previsto até hoje {pc(s.previsto / q.total)}
            </span>
          </span>
          <span className={styles.numGrande}>{pc(Math.min(1, s.real / q.total))}</span>
        </button>
        <Barra real={s.real / q.total} previsto={s.previsto / q.total} />
        <div className={styles.linhaEntre}>
          <Selo tom={s.tom} texto={s.texto} />
          <span className={styles.miuda}>
            meta {fmt(metaDoDia(q), 1)}
            {p.dias ? ` · real ${fmt(p.ritmo, 1)}` : ''} {q.unidade}/dia
          </span>
        </div>
        <div className={styles.miuda}>
          {s.real >= q.total
            ? 'Quantitativo todo medido.'
            : `Para terminar em ${rotuloDia(q.fim)}: ${fmt(precisa, 1)} ${q.unidade}/dia nos próximos ${duInclusivo(hoje > q.fim ? q.fim : hoje, q.fim) || 1} d.u.`}
        </div>
        <div className={styles.atalhos}>
          <button
            type="button"
            className={styles.atalho}
            onClick={() => onAbrir({ t: 'medicoes' })}
          >
            <Icon name="grafico" size={18} strokeWidth={1.9} />
            Medições
          </button>
          <button type="button" className={styles.atalho} onClick={() => onAbrir({ t: 'meta' })}>
            <Icon name="documento" size={18} strokeWidth={1.9} />
            Meta
          </button>
          <button type="button" className={styles.atalho} onClick={() => onAbrir({ t: 'prod' })}>
            <Icon name="tabela" size={18} strokeWidth={1.9} />
            Produtividade
          </button>
        </div>
      </div>
    </section>
  );
}

/** Rodapé da ficha com quantitativo: Lançar avanço + Foto (concluir com foto). */
export function RodapeMedicao({ onLancar, onFoto }: { onLancar: () => void; onFoto: () => void }) {
  return (
    <div className={styles.rodapeFicha}>
      <button type="button" className={styles.btnPrimario} onClick={onLancar}>
        <Icon name="plus" size={20} strokeWidth={2.2} />
        Lançar avanço
      </button>
      <button type="button" className={styles.btnContorno} onClick={onFoto}>
        <Icon name="camera" size={20} strokeWidth={2} />
        Foto
      </button>
    </div>
  );
}

/**
 * Telas em pilha (quantitativo, lançar/editar, medições, meta, produtividade e
 * comparar). Sempre de UMA atividade: nenhuma tela mostra outra atividade.
 */
export function AvancoTelas({
  obra,
  atividadeId,
  inicio,
  onSair,
  onConcluida,
}: {
  obra: ObraCompleta;
  atividadeId: string;
  inicio: TelaAvanco;
  onSair: () => void;
  onConcluida: AoConcluir;
}) {
  const [pilha, setPilha] = useState<TelaAvanco[]>([inicio]);
  const tela = pilha[pilha.length - 1];
  const ir = (t: TelaAvanco) => setPilha((p) => [...p, t]);
  const voltar = () => (pilha.length > 1 ? setPilha((p) => p.slice(0, -1)) : onSair());
  const a = obra.atividades.find((x) => x.id === atividadeId);
  const num = numeracaoObra(obra).get(atividadeId);
  if (!a) return null;
  const rotulo = `${num ? `#${num} ` : ''}${a.nome}`;
  const q = quantDe(obra, a);
  const comum = { obra, a, rotulo, voltar, ir };
  // O quantitativo é uma gaveta da ficha; sem ele, não há o que mostrar aqui.
  if (tela.t === 'quant' || !q) return null;
  if (tela.t === 'lancar')
    return (
      <TelaLancar {...comum} q={q} medicaoId={tela.medicaoId ?? null} onConcluida={onConcluida} />
    );
  if (tela.t === 'medicoes') return <TelaMedicoes {...comum} q={q} />;
  if (tela.t === 'meta') return <TelaMeta {...comum} q={q} num={num ?? null} />;
  if (tela.t === 'prod') return <TelaProdutividade {...comum} q={q} />;
  return <TelaComparar {...comum} q={q} />;
}

interface TelaProps {
  obra: ObraCompleta;
  a: ObraAtv;
  rotulo: string;
  voltar: () => void;
  ir: (t: TelaAvanco) => void;
}

function Cabecalho({
  sub,
  titulo,
  onVoltar,
}: {
  sub: string;
  titulo: string;
  onVoltar: () => void;
}) {
  return (
    <header className={styles.cabecalho}>
      <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
        <Icon name="chevronLeft" size={22} />
      </button>
      <div className={styles.cabTexto}>
        <span className={styles.cabSub}>{sub}</span>
        <h2 className={styles.cabTitulo}>{titulo}</h2>
      </div>
    </header>
  );
}

function Stepper({
  valor,
  onMudar,
  rotulo,
}: {
  valor: number;
  onMudar: (n: number) => void;
  rotulo: string;
}) {
  return (
    <div className={styles.stepper}>
      <button
        type="button"
        aria-label={`Menos uma pessoa em ${rotulo}`}
        onClick={() => onMudar(Math.max(1, valor - 1))}
      >
        −
      </button>
      <span aria-live="polite">{valor}</span>
      <button
        type="button"
        aria-label={`Mais uma pessoa em ${rotulo}`}
        onClick={() => onMudar(valor + 1)}
      >
        +
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quantitativo da atividade: gaveta (só quantidade e unidade)         */
/* ------------------------------------------------------------------ */
/**
 * Gaveta do quantitativo (pedido do usuário, 16/11/2026): abre por cima da ficha,
 * só com a quantidade e a unidade (lista); a meta do dia aparece ao digitar. As
 * pessoas entram em cada medição, não aqui.
 */
export function QuantitativoSheet({
  obra,
  a,
  open,
  onClose,
}: {
  obra: ObraCompleta;
  a: ObraAtv;
  open: boolean;
  onClose: () => void;
}) {
  const campo = useObraCampo(obra.id);
  const { showToast } = useToast();
  const datas = datasDe(obra, a);
  const num = numeracaoObra(obra).get(a.id);
  const [total, setTotal] = useState(a.quant_total ? fmt(a.quant_total, 2) : '');
  const [unidade, setUnidade] = useState<string>(a.quant_unidade ?? 'm²');
  const n = lerNumero(total);
  const meta = n / datas.du;
  const hist = useMedicoesDaAtividade(open ? a.nome : null, unidade, 'contorno');
  const historico = useMemo(() => {
    const outras = (hist.data ?? []).filter((x) => x.obraId !== obra.id);
    if (!outras.length || !n) return null;
    const c = comparativoAtividade(outras, obra.id);
    const doPrest = a.prestador
      ? c.porPrestador.find((p) => p.prestador.toLowerCase() === a.prestador!.trim().toLowerCase())
      : null;
    const ref = doPrest ? doPrest.porDia : c.porDia;
    const obras = doPrest ? doPrest.obras.length : c.obras;
    const precisa = n / ref;
    const dif = precisa - datas.du;
    return `${doPrest ? `${a.prestador} fez em média` : 'A média das obras é'} ${fmt(ref)} ${unidade}/dia nesta atividade (${obras} ${obras === 1 ? 'obra' : 'obras'}). Nesse ritmo: ${fmt(precisa, 1)} d.u. — ${
      Math.abs(dif) < 0.5
        ? 'cabe no cronograma.'
        : dif > 0
          ? `${fmt(dif, 1)} d.u. a mais que o cronograma. Reforce a equipe ou ajuste o prazo.`
          : `${fmt(-dif, 1)} d.u. de folga.`
    }`;
  }, [hist.data, obra.id, a.prestador, n, unidade, datas.du]);

  const antes = { total: a.quant_total, unidade: a.quant_unidade, pessoas: a.quant_pessoas };
  function salvar() {
    if (!n) {
      showToast({ message: 'Informe a quantidade total' });
      return;
    }
    campo.quantitativo.mutate({ atividadeId: a.id, total: n, unidade, pessoas: null });
    showToast({
      message: `Quantitativo salvo · meta ${fmt(meta, 1)} ${unidade}/dia`,
      onUndo: () => campo.quantitativo.mutate({ atividadeId: a.id, ...antes }),
    });
    onClose();
  }
  function tirar() {
    campo.quantitativo.mutate({ atividadeId: a.id, total: null, unidade: null, pessoas: null });
    showToast({
      message: 'Avanço volta aos passos 25 · 50 · 75',
      onUndo: () => campo.quantitativo.mutate({ atividadeId: a.id, ...antes }),
    });
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Quantitativo">
      <div className={styles.gaveta}>
        <span className={styles.miuda}>
          {num ? `#${num} ` : ''}
          {a.nome} · {formatarDataCurta(datas.inicio)} → {formatarDataCurta(datas.fim)} · {datas.du}{' '}
          d.u.
        </span>
        <div className={styles.linhaQuant}>
          <label className={styles.campo}>
            <span className={styles.rotuloCampo}>Quantidade total</span>
            <input
              className={styles.input}
              inputMode="decimal"
              value={total}
              placeholder="0"
              onChange={(e) => setTotal(e.target.value)}
            />
          </label>
          <label className={styles.campo}>
            <span className={styles.rotuloCampo}>Unidade</span>
            <span className={styles.selectCaixa}>
              <select
                className={styles.select}
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
              >
                {UNIDADES_QUANT.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={18} />
            </span>
          </label>
        </div>
        {n ? (
          <div className={styles.cardEscuro}>
            <span className={styles.kicker}>META DO DIA</span>
            <span className={styles.numEscuro}>
              {fmt(meta, 1)} {unidade}/dia
            </span>
            <span className={styles.miudaEscura}>
              {fmt(n, 2)} {unidade} em {datas.du} dias úteis
            </span>
            {historico ? (
              <span className={styles.historico}>
                <Icon name="grafico" size={18} strokeWidth={2} />
                {historico}
              </span>
            ) : null}
          </div>
        ) : null}
        {a.quant_total ? (
          <button type="button" className={styles.link} onClick={tirar}>
            Medir pelos passos 25 · 50 · 75 (tirar o quantitativo)
          </button>
        ) : null}
        <button type="button" className={n ? styles.btnPrimario : styles.btnOff} onClick={salvar}>
          Salvar quantitativo
        </button>
      </div>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Lançar e editar medição                                             */
/* ------------------------------------------------------------------ */
function TelaLancar({
  obra,
  a,
  rotulo,
  voltar,
  q,
  medicaoId,
  onConcluida,
}: TelaProps & { q: Quantitativo; medicaoId: string | null; onConcluida: AoConcluir }) {
  const campo = useObraCampo(obra.id);
  const conclusao = useConcluirAtividade(obra);
  const { showToast } = useToast();
  const hoje = hojeISO();
  const editando = medicaoId ? (a.medicoes.find((m) => m.id === medicaoId) ?? null) : null;
  const [modo, setModo] = useState<'dia' | 'periodo'>(editando?.tipo ?? 'dia');
  const [de, setDe] = useState<string | null>(
    editando?.de ?? (ehFimDeSemana(hoje) || diaMedido(a.medicoes, hoje) ? null : hoje),
  );
  const [ate, setAte] = useState<string | null>(editando?.ate ?? de);
  const [esperaFim, setEsperaFim] = useState(false);
  const arrastando = useRef(false);
  const ancora = editando?.de ?? hoje;
  const [mes, setMes] = useState(() => ({
    ano: Number(ancora.slice(0, 4)),
    mes: Number(ancora.slice(5, 7)),
  }));
  const [qtd, setQtd] = useState(editando ? fmt(editando.quantidade, 2) : '');
  // Pessoas: as da medição editada, senão as do último lançamento.
  const [pessoas, setPessoas] = useState(
    editando?.pessoas ?? a.medicoes[a.medicoes.length - 1]?.pessoas ?? q.pessoas ?? 4,
  );
  const [foto, setFoto] = useState<File | null>(null);
  const [camera, setCamera] = useState(false);
  const exc = editando?.id ?? null;

  const lo = de && ate ? (de < ate ? de : ate) : null;
  const hi = de && ate ? (de < ate ? ate : de) : null;
  const erro = lo && hi ? erroPeriodo(a.medicoes, lo, hi, hoje, exc) : null;
  const valido = Boolean(lo && hi && !erro && !esperaFim);
  const nDu = lo && hi ? duInclusivo(lo, hi) : 0;
  const n = lerNumero(qtd);
  const refDia = valido ? lo! : ehFimDeSemana(hoje) ? hoje : hoje < q.inicio ? q.inicio : hoje;
  const ref = valido
    ? referenciaLancamento(q, a.medicoes, lo!, hi!, exc)
    : referenciaLancamento(q, a.medicoes, refDia, refDia, exc);
  const sit = situacaoEm(q, a.medicoes, refDia, { soAntes: true, excluirId: exc });
  const realOutros = somaMedida(a.medicoes, exc);

  function escolher(dia: string) {
    if (modo === 'dia') {
      setDe(dia);
      setAte(dia);
      setEsperaFim(false);
      return;
    }
    if (esperaFim && de && dia !== de) {
      setAte(dia);
      setEsperaFim(false);
    } else {
      setDe(dia);
      setAte(dia);
      setEsperaFim(true);
      arrastando.current = true;
    }
  }
  function arrastar(e: React.PointerEvent) {
    if (!arrastando.current || modo !== 'periodo') return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const dia = el?.closest<HTMLElement>('[data-dia]')?.dataset.dia;
    if (!dia || !livre(dia) || dia === ate) return;
    setAte(dia);
    setEsperaFim(dia === de);
  }
  const livre = (dia: string) =>
    !ehFimDeSemana(dia) && dia <= hoje && !diaMedido(a.medicoes, dia, exc);

  function salvar() {
    if (!valido || !lo || !hi) {
      showToast({
        message: lo
          ? (erro ?? 'Marque o último dia do período')
          : 'Marque o dia ou o período no calendário',
      });
      return;
    }
    if (!n) {
      showToast({ message: 'Informe quanto foi executado' });
      return;
    }
    const id = editando?.id ?? crypto.randomUUID();
    const tipo = lo === hi ? 'dia' : modo;
    const antes = editando;
    const nova: ObraMedicao = {
      id,
      tipo,
      de: lo,
      ate: hi,
      quantidade: n,
      pessoas,
      prestador: a.prestador,
      foto_id: null,
      criado_em: new Date().toISOString(),
      criado_por_nome: null,
      editado_em: null,
      editado_por_nome: null,
    };
    campo.medicao.mutate({
      atividadeId: a.id,
      medicao: { id, tipo, de: lo, ate: hi, quantidade: n, pessoas },
      foto,
    });
    const completou =
      !a.concluida_em && medicaoCompleta(q.total, [...a.medicoes.filter((m) => m.id !== id), nova]);
    voltar();
    if (completou) {
      // 100% medido é concluir, pelo caminho de sempre (celebração, Desfazer).
      conclusao.concluir(a.id, null, onConcluida);
      return;
    }
    showToast({
      message: `${antes ? 'Medição ajustada' : 'Avanço lançado'} · ${fmt(n, 2)} ${q.unidade}`,
      onUndo: () =>
        antes
          ? campo.medicao.mutate({
              atividadeId: a.id,
              medicao: {
                id: antes.id,
                tipo: antes.tipo,
                de: antes.de,
                ate: antes.ate,
                quantidade: antes.quantidade,
                pessoas: antes.pessoas,
              },
              foto: null,
            })
          : campo.excluirMed.mutate({ atividadeId: a.id, medicao: nova, restaurar: false }),
    });
  }
  function excluir() {
    if (!editando) return;
    const m = editando;
    campo.excluirMed.mutate({ atividadeId: a.id, medicao: m, restaurar: false });
    voltar();
    showToast({
      message: 'Medição excluída',
      onUndo: () => campo.excluirMed.mutate({ atividadeId: a.id, medicao: m, restaurar: true }),
    });
  }

  const grade = gradeDoMesDomingo(mes.ano, mes.mes);
  const mesTxt = new Date(Date.UTC(mes.ano, mes.mes - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const mesHoje = { ano: Number(hoje.slice(0, 4)), mes: Number(hoje.slice(5, 7)) };
  const noMesAtual = mes.ano === mesHoje.ano && mes.mes === mesHoje.mes;
  const corridos = lo && hi ? diasCorridosInclusivo(lo, hi) : 0;
  const selTxt =
    modo === 'dia'
      ? lo
        ? `${formatarDataCurta(lo)}${lo === hoje ? ' · hoje' : ''} · meta do dia ${fmt(metaDoDia(q), 1)} ${q.unidade}`
        : 'Toque no dia medido'
      : !lo
        ? 'Toque no primeiro dia e arraste o dedo até o último (ou toque no último).'
        : esperaFim
          ? `Início ${formatarDataCurta(lo)} · agora toque ou arraste até o último dia`
          : `${formatarDataCurta(lo)} → ${formatarDataCurta(hi!)} · ${nDu} ${nDu === 1 ? 'dia útil' : 'dias úteis'}${corridos > nDu ? ' (sáb e dom não contam)' : ''}`;
  const quandoTxt = refDia === hoje ? 'Hoje' : `Em ${formatarDataCurta(refDia)}`;

  if (camera)
    return (
      <Camera
        kicker="Foto do lançamento"
        titulo={a.nome}
        dica="Opcional. Fica como registro do que foi medido."
        pendente={false}
        onCancelar={() => setCamera(false)}
        onCapturar={(f) => {
          setFoto(f);
          setCamera(false);
        }}
      />
    );

  return (
    <div className={styles.tela}>
      <Cabecalho
        sub={obra.nome}
        titulo={editando ? 'Editar medição' : 'Lançar avanço'}
        onVoltar={voltar}
      />
      <div className={styles.conteudo}>
        <div className={`${styles.cardStatus} ${sit.tom === 'atraso' ? styles.cardAtraso : ''}`}>
          <div className={styles.linhaEntre}>
            <span>
              <b>{rotulo}</b>
              <span className={styles.miuda}>
                {a.prestador || 'sem prestador'} · {formatarDataCurta(q.inicio)} →{' '}
                {formatarDataCurta(q.fim)}
              </span>
            </span>
            <Selo tom={sit.tom} texto={sit.texto} />
          </div>
          <Barra real={sit.real / q.total} previsto={sit.previsto / q.total} />
          <span className={styles.miuda}>
            {quandoTxt}, antes deste lançamento: {fmt(sit.real, 2)} de {fmt(q.total, 2)} {q.unidade}{' '}
            · meta {fmt(metaDoDia(q), 1)} {q.unidade}/dia
          </span>
        </div>

        <Segmented
          ariaLabel="Lançamento do dia ou do período"
          options={[
            { value: 'dia', label: 'Do dia' },
            { value: 'periodo', label: 'Do período' },
          ]}
          value={modo}
          onChange={(v) => {
            setModo(v);
            setEsperaFim(false);
            if (v === 'dia' && de) setAte(de);
          }}
        />

        <div>
          <div className={styles.linhaEntre}>
            <span className={styles.rotuloCampo}>
              {modo === 'dia' ? 'Dia medido' : 'Período medido (de / até)'}
            </span>
            <span className={styles.mesNav}>
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => setMes((m) => somarMeses(m.ano, m.mes, -1))}
              >
                <Icon name="chevronLeft" size={20} />
              </button>
              <span className={styles.mesTxt}>{mesTxt}</span>
              <button
                type="button"
                aria-label="Próximo mês"
                disabled={noMesAtual}
                onClick={() => setMes((m) => somarMeses(m.ano, m.mes, 1))}
              >
                <Icon name="chevronRight" size={20} />
              </button>
            </span>
          </div>
          <div className={styles.calendario}>
            <div className={styles.semana} aria-hidden="true">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div
              className={styles.grade}
              onPointerMove={arrastar}
              onPointerUp={() => (arrastando.current = false)}
              onPointerCancel={() => (arrastando.current = false)}
              onPointerLeave={() => (arrastando.current = false)}
            >
              {grade.map((dia, i) => {
                if (!dia) return <span key={`v${i}`} />;
                const sab = new Date(`${dia}T00:00:00Z`).getUTCDay();
                const medido = !ehFimDeSemana(dia) && diaMedido(a.medicoes, dia, exc);
                const futuro = dia > hoje;
                const pode = livre(dia);
                const dentro = Boolean(lo && hi && dia >= lo && dia <= hi);
                const ponta = dia === lo || dia === hi;
                const inicioFaixa = dentro && (dia === lo || sab === 0 || dia.endsWith('-01'));
                const fimFaixa = dentro && (dia === hi || sab === 6 || i === grade.length - 1);
                return (
                  <span
                    key={dia}
                    className={`${styles.celula} ${dentro ? (ehFimDeSemana(dia) ? styles.faixaFds : styles.faixa) : ''} ${inicioFaixa ? styles.faixaIni : ''} ${fimFaixa ? styles.faixaFim : ''}`}
                  >
                    <button
                      type="button"
                      data-dia={pode ? dia : undefined}
                      aria-disabled={!pode}
                      aria-pressed={dentro}
                      aria-label={`${formatarDataCurta(dia)}${medido ? ', já medido' : ehFimDeSemana(dia) ? ', fim de semana' : futuro ? ', futuro' : ''}`}
                      className={`${styles.dia} ${ehFimDeSemana(dia) ? styles.diaFds : ''} ${futuro ? styles.diaOff : ''} ${medido ? styles.diaMedido : ''} ${ponta && dentro ? styles.diaPonta : ''} ${dia === hoje ? styles.diaHoje : ''}`}
                      onPointerDown={(e) => {
                        if (!pode) return;
                        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                        escolher(dia);
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && pode) {
                          e.preventDefault();
                          escolher(dia);
                        }
                      }}
                    >
                      {Number(dia.slice(8))}
                    </button>
                  </span>
                );
              })}
            </div>
            <div className={styles.legenda}>
              <span>
                <i className={styles.legFaixa} />
                período
              </span>
              <span>
                <i className={styles.legMedido} />
                já medido
              </span>
              <span>
                <i className={styles.legHoje} />
                hoje
              </span>
              <span>sáb e dom não contam</span>
            </div>
          </div>
          <div className={styles.selTxt}>
            <Icon name="calendario" size={16} strokeWidth={2} />
            <span>{selTxt}</span>
          </div>
          {erro && !esperaFim ? (
            <div className={styles.erro}>
              <Icon name="info" size={16} strokeWidth={2} />
              {erro}
            </div>
          ) : null}
        </div>

        <label className={styles.campo}>
          <span className={styles.rotuloCampo}>
            {modo === 'dia' ? 'Quanto foi executado no dia' : 'Quanto foi executado no período'}
          </span>
          <span className={styles.inputGrande}>
            <input
              inputMode="decimal"
              placeholder="0"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
            />
            <b>{q.unidade}</b>
          </span>
        </label>

        {realOutros < q.total ? (
          <div className={styles.referencia}>
            <div className={styles.refTitulo}>
              {valido
                ? `REFERÊNCIA PARA ${nDu === 1 ? 'ESTE DIA' : `ESTE PERÍODO · ${nDu} DIAS ÚTEIS`}`
                : `REFERÊNCIA POR DIA ÚTIL · A PARTIR DE ${formatarDataCurta(refDia).toUpperCase()}`}
            </div>
            <div className={styles.refLinha}>
              <span>
                <span className={styles.refRotulo}>Meta do cronograma</span>
                <b className={styles.refNum}>
                  {fmt(ref.meta, 0)} {q.unidade}
                </b>
                <span className={styles.miuda}>
                  {fmt(ref.metaDia, 1)} {q.unidade}/dia · {fmt(q.total, 2)} {q.unidade} em {q.du}{' '}
                  d.u.
                </span>
              </span>
              {valido ? (
                <button
                  type="button"
                  className={styles.usarContorno}
                  onClick={() => setQtd(fmt(Math.round(ref.meta)))}
                >
                  Usar
                </button>
              ) : null}
            </div>
            <div
              className={`${styles.refLinha} ${ref.tom === 'recuperar' ? styles.refAtraso : styles.refOk}`}
            >
              <span>
                <span
                  className={`${styles.refRotulo} ${ref.tom === 'recuperar' ? styles.txtAtraso : ''}`}
                >
                  <Icon
                    name={ref.tom === 'recuperar' ? 'alert' : 'checkGrosso'}
                    size={14}
                    strokeWidth={2.4}
                  />
                  {ref.titulo}
                </span>
                <b className={styles.refNum}>
                  {fmt(ref.prazo, 0)} {q.unidade}
                </b>
                <span className={styles.miuda}>{ref.detalhe}</span>
              </span>
              {valido ? (
                <button
                  type="button"
                  className={styles.usarEscuro}
                  onClick={() => setQtd(fmt(Math.round(ref.prazo)))}
                >
                  Usar
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={styles.linhaCard}>
          <span>
            <b>Pessoas na frente</b>
            <span className={styles.miuda}>
              {modo === 'dia' ? 'no dia' : 'média por dia no período'}
            </span>
          </span>
          <Stepper valor={pessoas} onMudar={setPessoas} rotulo="pessoas na frente" />
        </div>

        <div className={styles.duasColunas}>
          <div className={styles.cardInfo}>
            <span className={styles.miuda}>Prestador</span>
            <b>{a.prestador || '—'}</b>
          </div>
          <button type="button" className={styles.btnFoto} onClick={() => setCamera(true)}>
            <Icon name={foto ? 'checkGrosso' : 'camera'} size={20} strokeWidth={2} />
            {foto ? 'Foto anexada' : editando?.foto_id ? 'Trocar foto' : 'Foto (opcional)'}
          </button>
        </div>

        {valido && n ? (
          <div className={styles.previa}>
            <span className={styles.kickerEscuro}>PRÉVIA</span>
            <b className={styles.previaNum}>
              {fmt(n / nDu, 1)} {q.unidade}/dia · meta {fmt(metaDoDia(q), 1)}
            </b>
            <span>
              {fmt(n / nDu / Math.max(1, pessoas), 1)} {q.unidade}/pessoa·dia com {pessoas} pessoas
              {nDu > 1 ? ` · ${nDu} d.u.` : ''}
            </span>
            <span className={styles.previaAv}>
              <Icon name="seta" size={14} strokeWidth={2.4} />
              Avanço da atividade {editando ? 'fica' : 'vai de'}{' '}
              {pc(Math.min(1, somaMedida(a.medicoes) / q.total))} {editando ? '→' : 'para'}{' '}
              {pc(Math.min(1, (realOutros + n) / q.total))}
            </span>
          </div>
        ) : null}
      </div>
      <div className={styles.rodape}>
        {editando ? (
          <div className={styles.rodapeDuplo}>
            <button type="button" className={styles.btnContorno} onClick={excluir}>
              <Icon name="lixeira" size={18} strokeWidth={2} />
              Excluir
            </button>
            <button
              type="button"
              className={valido && n ? styles.btnPrimario : styles.btnOff}
              onClick={salvar}
            >
              Salvar alterações
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={valido && n ? styles.btnPrimario : styles.btnOff}
            onClick={salvar}
          >
            Salvar avanço
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Medições da atividade                                               */
/* ------------------------------------------------------------------ */
function TelaMedicoes({ obra, a, rotulo, voltar, ir, q }: TelaProps & { q: Quantitativo }) {
  const hoje = hojeISO();
  const s = situacaoEm(q, a.medicoes, hoje);
  const p = produtividade(a.medicoes, metaDoDia(q));
  const barras = barrasPorDia(q, a.medicoes, hoje);
  const max = Math.max(metaDoDia(q) * 1.35, ...barras.map((b) => b.real ?? 0));
  const aPartir = hoje > q.fim ? q.fim : hoje < q.inicio ? q.inicio : hoje;
  const duRest = Math.max(1, duInclusivo(aPartir, q.fim));
  return (
    <div className={styles.tela}>
      <Cabecalho sub={obra.nome} titulo={`Medições · ${rotulo}`} onVoltar={voltar} />
      <div className={styles.conteudo}>
        <div className={styles.card}>
          <div className={styles.linhaEntre}>
            <span>
              <span className={styles.numGrande}>
                {fmt(s.real, 2)} {q.unidade}
              </span>
              <span className={styles.miuda}>
                de {fmt(q.total, 2)} {q.unidade} · {pc(Math.min(1, s.real / q.total))} executado
              </span>
            </span>
            <Selo tom={s.tom} texto={s.texto} />
          </div>
          <Barra real={s.real / q.total} previsto={s.previsto / q.total} />
          <span className={styles.miuda}>
            Marca preta = previsto até hoje ({fmt(s.previsto)} {q.unidade} ·{' '}
            {pc(s.previsto / q.total)})
          </span>
          <div className={styles.grade2}>
            <div className={styles.mini}>
              <span>Meta</span>
              <b>
                {fmt(metaDoDia(q), 1)} {q.unidade}/dia
              </b>
              <span>
                {fmt(q.total, 2)} {q.unidade} em {q.du} d.u.
              </span>
            </div>
            <div className={styles.mini}>
              <span>Ritmo real</span>
              <b>{p.dias ? `${fmt(p.ritmo, 1)} ${q.unidade}/dia` : '—'}</b>
              <span>
                {p.dias ? `${fmt(p.porPessoa, 1)} ${q.unidade}/pessoa·dia` : 'sem medição'}
              </span>
            </div>
            <div className={styles.mini}>
              <span>Equipe média</span>
              <b>{p.dias ? `${fmt(p.pessoasMedia, 1)} pessoas` : '—'}</b>
              <span>{a.prestador || 'sem prestador'}</span>
            </div>
            <div className={styles.mini}>
              <span>Para terminar em {rotuloDia(q.fim)}</span>
              <b>
                {s.real >= q.total
                  ? 'Concluído'
                  : `${fmt(Math.max(0, q.total - s.real) / duRest, 1)} ${q.unidade}/dia`}
              </b>
              <span>{duRest} d.u. a partir de hoje</span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.linhaEntre}>
            <b>Produção por dia útil</b>
            <span className={styles.miuda}>
              {formatarDataCurta(q.inicio)} → {formatarDataCurta(q.fim)} · {q.du} d.u.
            </span>
          </div>
          <div
            className={styles.grafico}
            role="img"
            aria-label="Produção por dia útil contra a meta"
          >
            <span
              className={styles.metaLinha}
              style={{ bottom: `${(metaDoDia(q) / max) * 100}%` }}
            />
            {barras.map((b) => (
              <span key={b.dia} className={styles.colGraf}>
                <span
                  className={`${styles.barraGraf} ${b.periodo ? styles.hachura : ''}`}
                  style={{ height: `${((b.real ?? 0) / max) * 100}%` }}
                />
              </span>
            ))}
          </div>
          <div className={styles.eixo}>
            {barras.map((b) => (
              <span key={b.dia} className={b.hoje ? styles.eixoHoje : ''}>
                {b.dia.slice(8)}
              </span>
            ))}
          </div>
          <div className={styles.legenda}>
            <span>
              <i className={styles.legDia} />
              lançamento do dia
            </span>
            <span>
              <i className={`${styles.legDia} ${styles.hachura}`} />
              média do período
            </span>
            <span>
              <i className={styles.legMeta} />
              meta {fmt(metaDoDia(q))} {q.unidade}/dia
            </span>
          </div>
        </div>

        <b className={styles.subtitulo}>Medições</b>
        <span className={styles.miuda}>
          Toque numa medição para corrigir o período, a quantidade ou as pessoas.
        </span>
        {a.medicoes.length === 0 ? (
          <div className={styles.vazio}>
            Nenhuma medição ainda. O primeiro lançamento começa o histórico da atividade.
          </div>
        ) : null}
        {[...a.medicoes].reverse().map((m) => {
          const du = duDaMedicao(m);
          const r = m.quantidade / du;
          return (
            <button
              key={m.id}
              type="button"
              className={styles.itemMedicao}
              onClick={() => ir({ t: 'lancar', medicaoId: m.id })}
            >
              <span className={styles.iconeMedicao}>
                <Icon
                  name={m.tipo === 'dia' ? 'calendario' : 'cronograma'}
                  size={20}
                  strokeWidth={1.9}
                />
              </span>
              <span className={styles.itemTexto}>
                <span className={styles.linhaEntre}>
                  <b>{tituloMedicao(m)}</b>
                  <b>
                    {fmt(m.quantidade, 2)} {q.unidade}
                  </b>
                </span>
                <span className={styles.miuda}>
                  {du} d.u. · {fmt(r, 1)} {q.unidade}/dia · {fmt(m.pessoas, 1)} pessoas ·{' '}
                  {fmt(r / m.pessoas, 1)} {q.unidade}/pessoa·dia
                </span>
                <span className={styles.miuda}>
                  {m.prestador || 'sem prestador'} · lançado por {m.criado_por_nome ?? '—'}
                  {m.editado_em
                    ? ` · ajustada ${formatarDataCurta(m.editado_em.slice(0, 10))}${m.editado_por_nome ? ` por ${m.editado_por_nome}` : ''}`
                    : ''}
                </span>
              </span>
              <Icon name="editar" size={18} strokeWidth={1.9} />
            </button>
          );
        })}
      </div>
      <div className={styles.rodape}>
        <div className={styles.rodapeDuplo}>
          <button type="button" className={styles.btnEscuro} onClick={() => ir({ t: 'meta' })}>
            Meta
          </button>
          <button type="button" className={styles.btnPrimario} onClick={() => ir({ t: 'lancar' })}>
            Lançar avanço
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Meta da atividade                                                   */
/* ------------------------------------------------------------------ */
function TelaMeta({
  obra,
  a,
  rotulo,
  voltar,
  q,
  num,
}: TelaProps & { q: Quantitativo; num: number | null }) {
  const { showToast } = useToast();
  const hoje = hojeISO();
  const linhas = tabelaMeta(q, a.medicoes, hoje);
  const meta = metaDoDia(q);
  const texto = textoMetaWhatsApp({
    obra: obra.nome,
    numero: num,
    atividade: a.nome,
    prestador: a.prestador,
    q,
    meds: a.medicoes,
    hoje,
  });
  const wa = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  async function pdf() {
    try {
      const blob = await pdfTabela({
        titulo: `CONTRO · Meta · ${rotulo}`,
        subtitulo: [
          obra.nome,
          `${a.prestador || 'sem prestador'} · ${fmt(q.total, 2)} ${q.unidade} · ${formatarDataCurta(q.inicio)} a ${formatarDataCurta(q.fim)} · ${q.du} d.u.`,
          `Meta ${fmt(meta, 1)} ${q.unidade}/dia`,
        ],
        larguras: [45, 40, 45, 45],
        linhas: [
          ['Dia', `Meta (${q.unidade})`, 'Acumulado', 'Real'],
          ...linhas.map((l) => [
            formatarDataCurta(l.dia),
            fmt(l.meta, 1),
            fmt(l.acumulado),
            l.real === null ? '-' : `${fmt(l.real, 1)}${l.periodo ? '*' : ''}`,
          ]),
        ],
      });
      baixarArquivo(blob, `Meta ${rotulo}.pdf`);
    } catch {
      showToast({ message: 'Não foi possível gerar o PDF' });
    }
  }
  return (
    <div className={styles.tela}>
      <Cabecalho
        sub={`${rotulo} · ${a.prestador || 'sem prestador'}`}
        titulo="Meta"
        onVoltar={voltar}
      />
      <div className={styles.conteudo}>
        <div className={styles.cardTabela}>
          <div className={styles.tabelaTopo}>
            <b>{rotulo}</b>
            <span className={styles.miuda}>
              {fmt(q.total, 2)} {q.unidade} · {formatarDataCurta(q.inicio)} →{' '}
              {formatarDataCurta(q.fim)} · {q.du} d.u. · {fmt(meta, 1)} {q.unidade}/dia
            </span>
          </div>
          <div className={`${styles.linhaTabela} ${styles.cabTabela}`}>
            <span>Dia</span>
            <span>Meta</span>
            <span>Acumulado</span>
            <span>Real</span>
          </div>
          {linhas.map((l) => (
            <div key={l.dia} className={`${styles.linhaTabela} ${l.hoje ? styles.linhaHoje : ''}`}>
              <b>{formatarDataCurta(l.dia)}</b>
              <span>{fmt(l.meta, 1)}</span>
              <span>{fmt(l.acumulado)}</span>
              <b className={l.real !== null && l.real < meta * 0.97 ? styles.txtAtraso : ''}>
                {l.real === null ? '—' : `${fmt(l.real, 1)}${l.periodo ? '*' : ''}`}
              </b>
            </div>
          ))}
        </div>
        <span className={styles.miuda}>
          Real com * é a média do período medido. Linha destacada = hoje.
        </span>
        <div className={styles.card}>
          <span className={styles.refTitulo}>TEXTO DO WHATSAPP · PRÓXIMOS 5 DIAS ÚTEIS</span>
          <pre className={styles.textoWa}>{texto}</pre>
        </div>
      </div>
      <div className={styles.rodape}>
        <div className={styles.rodapeDuplo}>
          <a className={styles.btnPrimario} href={wa} target="_blank" rel="noreferrer">
            <Icon name="whatsapp" size={20} strokeWidth={2} />
            WhatsApp
          </a>
          <button type="button" className={styles.btnEscuro} onClick={pdf}>
            <Icon name="baixar" size={20} strokeWidth={2} />
            Baixar PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Produtividade da atividade nesta obra                               */
/* ------------------------------------------------------------------ */
function TelaProdutividade({ a, rotulo, voltar, ir, q }: TelaProps & { q: Quantitativo }) {
  const meta = metaDoDia(q);
  const p = produtividade(a.medicoes, meta);
  const hoje = hojeISO();
  const decorridos = Math.max(
    0,
    Math.min(q.du, duInclusivo(q.inicio, hoje) - (ehFimDeSemana(hoje) ? 0 : 1)),
  );
  const max = Math.max(meta * 1.3, ...p.linhas.map((l) => l.porDia));
  const tom: TomSituacao = !p.dias ? 'planejada' : p.ritmo < meta * 0.97 ? 'atraso' : 'ok';
  const rot = (l: (typeof p.linhas)[number]) => tituloMedicao(l.m).replace('Dia · ', '');
  return (
    <div className={styles.tela}>
      <Cabecalho
        sub={`${rotulo} · ${a.prestador || 'sem prestador'}`}
        titulo="Produtividade"
        onVoltar={voltar}
      />
      <div className={styles.conteudo}>
        <div className={styles.card}>
          <div className={styles.linhaEntre}>
            <span>
              <span className={styles.miuda}>Ritmo médio nesta obra</span>
              <span className={styles.numGrande}>
                {p.dias ? `${fmt(p.ritmo, 1)} ${q.unidade}/dia` : '—'}
              </span>
              <span className={styles.miuda}>
                meta {fmt(meta, 1)} {q.unidade}/dia
              </span>
            </span>
            <Selo tom={tom} texto={p.dias ? `${fmt(p.daMeta * 100)}% da meta` : 'Sem medição'} />
          </div>
          <div className={styles.grade3}>
            <div className={styles.mini}>
              <span>Por pessoa</span>
              <b>{p.dias ? fmt(p.porPessoa, 1) : '—'}</b>
              <span>{q.unidade}/pessoa·dia</span>
            </div>
            <div className={styles.mini}>
              <span>Equipe média</span>
              <b>{p.dias ? fmt(p.pessoasMedia, 1) : '—'}</b>
              <span>pessoas/dia</span>
            </div>
            <div className={styles.mini}>
              <span>Dias medidos</span>
              <b>{p.dias}</b>
              <span>
                {p.dias > decorridos
                  ? 'inclui dias antes do início previsto'
                  : `de ${decorridos} d.u. decorridos`}
              </span>
            </div>
          </div>
        </div>

        {p.linhas.length > 1 ? (
          <>
            <div className={styles.card}>
              <div className={styles.linhaEntre}>
                <b>Evolução do ritmo</b>
                <span className={styles.miuda}>
                  meta {fmt(meta)} {q.unidade}/dia
                </span>
              </div>
              <div
                className={styles.grafico}
                role="img"
                aria-label="Ritmo de cada medição contra a meta"
              >
                <span className={styles.metaLinha} style={{ bottom: `${(meta / max) * 100}%` }} />
                {p.linhas.map((l) => (
                  <span key={l.m.id} className={styles.colGraf}>
                    <span
                      className={`${styles.barraGraf} ${l.m.tipo === 'periodo' ? styles.hachura : ''}`}
                      style={{ height: `${(l.porDia / max) * 100}%` }}
                    >
                      <span className={styles.valorGraf}>{fmt(l.porDia)}</span>
                    </span>
                  </span>
                ))}
              </div>
              <div className={styles.eixo}>
                {p.linhas.map((l) => (
                  <span key={l.m.id}>
                    {l.m.tipo === 'dia'
                      ? l.m.de.slice(8) + '/' + l.m.de.slice(5, 7)
                      : `${l.m.de.slice(8)}–${l.m.ate.slice(8)}/${l.m.ate.slice(5, 7)}`}
                    <br />
                    <b>{fmt(l.m.pessoas, 1)}p</b>
                  </span>
                ))}
              </div>
              <div className={styles.legenda}>
                <span>
                  <i className={styles.legDia} />
                  dia
                </span>
                <span>
                  <i className={`${styles.legDia} ${styles.hachura}`} />
                  média do período
                </span>
                <span>p = pessoas na frente</span>
              </div>
            </div>
            <div className={styles.cardLista}>
              {p.melhor ? (
                <div>
                  <span className={styles.refTitulo}>MELHOR RITMO</span>
                  <b>
                    {rot(p.melhor)} · {fmt(p.melhor.porDia, 1)} {q.unidade}/dia com{' '}
                    {fmt(p.melhor.m.pessoas, 1)} pessoas
                  </b>
                </div>
              ) : null}
              {p.menor ? (
                <div>
                  <span className={styles.refTitulo}>MENOR RITMO</span>
                  <b>
                    {rot(p.menor)} · {fmt(p.menor.porDia, 1)} {q.unidade}/dia com{' '}
                    {fmt(p.menor.m.pessoas, 1)} pessoas
                  </b>
                </div>
              ) : null}
              <div>
                <span className={styles.refTitulo}>POR PESSOA</span>
                <b>
                  entre {fmt(p.porPessoaMin, 1)} e {fmt(p.porPessoaMax, 1)} {q.unidade}/pessoa·dia
                </b>
              </div>
              <div>
                <span className={styles.refTitulo}>PARA BATER A META</span>
                <b>
                  com esse rendimento por pessoa, a meta de {fmt(meta)} {q.unidade}/dia pede{' '}
                  {p.pessoasParaMeta} pessoas na frente · {p.bateramMeta} de {p.linhas.length}{' '}
                  medições bateram a meta
                </b>
              </div>
            </div>
          </>
        ) : null}

        <b className={styles.subtitulo}>Por medição</b>
        {p.linhas.length === 0 ? (
          <div className={styles.vazio}>
            Sem medições ainda. A produtividade aparece a partir do primeiro lançamento.
          </div>
        ) : null}
        {[...p.linhas].reverse().map((l) => (
          <div key={l.m.id} className={styles.card}>
            <div className={styles.linhaEntre}>
              <b>{tituloMedicao(l.m)}</b>
              <b className={l.porDia < meta * 0.97 ? styles.txtAtraso : ''}>
                {fmt(l.porDia, 1)} {q.unidade}/dia
              </b>
            </div>
            <div className={styles.barra} aria-hidden="true">
              <span
                className={styles.barraReal}
                style={{ width: `${Math.min(100, (l.porDia / max) * 100)}%` }}
              />
              <span
                className={styles.barraMarca}
                style={{ left: `calc(${(meta / max) * 100}% - 1px)` }}
              />
            </div>
            <div className={styles.linhaEntre}>
              <span className={styles.miuda}>
                {fmt(l.m.quantidade, 2)} {q.unidade} · {l.du} d.u. · {fmt(l.m.pessoas, 1)} pessoas ·{' '}
                {fmt(l.porPessoa, 1)}/pessoa
              </span>
              <b className={styles.miuda}>
                {l.vsMeta >= 0 ? '+' : '−'}
                {fmt(Math.abs(l.vsMeta) * 100)}% vs meta
              </b>
            </div>
          </div>
        ))}
        <span className={styles.miuda}>
          Marca preta na barra = meta do dia. Período conta só dias úteis.
        </span>
      </div>
      <div className={styles.rodape}>
        <button type="button" className={styles.link} onClick={() => ir({ t: 'comparar' })}>
          Comparar com outras obras
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Comparar com outras obras (só esta atividade)                       */
/* ------------------------------------------------------------------ */
function TelaComparar({ obra, a, rotulo, voltar, q }: TelaProps & { q: Quantitativo }) {
  const { showToast } = useToast();
  const [visao, setVisao] = useState<'obra' | 'prest'>('obra');
  const dados = useMedicoesDaAtividade(a.nome, q.unidade, 'contorno');
  // A obra atual vem do cache (já com o que ainda está na fila).
  const linhas = useMemo(
    () => [
      ...(dados.data ?? []).filter((x) => x.obraId !== obra.id),
      ...a.medicoes.map((m) => ({
        obraId: obra.id,
        obra: obra.nome,
        prestador: m.prestador,
        m: m as Medicao,
      })),
    ],
    [dados.data, a.medicoes, obra.id, obra.nome],
  );
  const c = useMemo(() => comparativoAtividade(linhas, obra.id), [linhas, obra.id]);
  const maxO = Math.max(1, ...c.porObra.map((l) => l.porDia));
  const maxP = Math.max(1, ...c.porPrestador.map((l) => l.porDia));
  const un = q.unidade;
  const nomeArq = `Produtividade ${a.nome}`;
  async function pdf() {
    try {
      const l = linhasPlanilhaComparativo(c, un);
      const blob = await pdfTabela({
        titulo: `CONTRO · Produtividade · ${a.nome}`,
        subtitulo: [
          `Média desta atividade em todas as obras: ${fmt(c.porDia, 1)} ${un}/dia · ${fmt(c.porPessoa, 1)} ${un}/pessoa·dia`,
          `${c.obras} obras · ${c.prestadores} prestadores · ${c.medicoes} medições`,
        ],
        larguras: [44, 30, 22, 14, 18, 18, 22, 14],
        linhas: l.map((x) => x.slice(0, 8)),
      });
      baixarArquivo(blob, `${nomeArq}.pdf`);
    } catch {
      showToast({ message: 'Não foi possível gerar o PDF' });
    }
  }
  return (
    <div className={styles.tela}>
      <Cabecalho
        sub={`${rotulo} · só esta atividade`}
        titulo="Comparar com outras obras"
        onVoltar={voltar}
      />
      <div className={styles.conteudo}>
        <div className={styles.card}>
          <span className={styles.miuda}>Média desta atividade em todas as obras</span>
          <div className={styles.linhaEntre}>
            <span className={styles.numGrande}>
              {fmt(c.porDia, 1)} {un}/dia
            </span>
            <b>
              {fmt(c.porPessoa, 1)} {un}/pessoa·dia
            </b>
          </div>
          <span className={styles.miuda}>
            {c.obras} {c.obras === 1 ? 'obra' : 'obras'} · {c.prestadores}{' '}
            {c.prestadores === 1 ? 'prestador' : 'prestadores'} · {c.medicoes} medições
          </span>
        </div>
        <Segmented
          ariaLabel="Comparar por obra ou por prestador"
          options={[
            { value: 'obra', label: 'Por obra' },
            { value: 'prest', label: 'Por prestador' },
          ]}
          value={visao}
          onChange={setVisao}
        />
        {dados.isLoading ? <div className={styles.vazio}>Carregando as outras obras…</div> : null}
        {visao === 'obra'
          ? c.porObra.map((l, i) => (
              <div key={`${l.obraId}${l.prestador}`} className={styles.itemRank}>
                <span className={styles.pos}>{i + 1}</span>
                <span className={styles.itemTexto}>
                  <span className={styles.linhaEntre}>
                    <b>
                      {l.obra}
                      {l.estaObra ? ' · esta obra' : ''}
                    </b>
                    <b>{fmt(l.porDia, 1)}/dia</b>
                  </span>
                  <span className={styles.linhaEntre}>
                    <span>{l.prestador}</span>
                    <span className={styles.miuda}>{fmt(l.porPessoa, 1)}/pessoa</span>
                  </span>
                  <span className={styles.barraFina}>
                    <span
                      className={l.estaObra ? styles.barraPreta : ''}
                      style={{ width: `${(l.porDia / maxO) * 100}%` }}
                    />
                  </span>
                  <span className={styles.linhaEntre}>
                    <span className={styles.miuda}>
                      {fmt(l.quantidade, 2)} {un} em {l.du} d.u. · {fmt(l.pessoas, 1)} pessoas ·{' '}
                      {l.estaObra ? 'em andamento' : formatarDataCurta(l.ultima)}
                    </span>
                    <b className={styles.miuda}>
                      {l.vsMedia >= 0 ? '+' : '−'}
                      {fmt(Math.abs(l.vsMedia) * 100)}% vs média
                    </b>
                  </span>
                </span>
              </div>
            ))
          : c.porPrestador.map((l, i) => (
              <div key={l.prestador} className={styles.itemRank}>
                <span className={styles.pos}>{i + 1}</span>
                <span className={styles.itemTexto}>
                  <span className={styles.linhaEntre}>
                    <b>{l.prestador}</b>
                    <b>
                      {fmt(l.porDia, 1)} {un}/dia
                    </b>
                  </span>
                  <span className={styles.miuda}>
                    {fmt(l.porPessoa, 1)} {un}/pessoa·dia
                  </span>
                  <span className={styles.barraFina}>
                    <span style={{ width: `${(l.porDia / maxP) * 100}%` }} />
                  </span>
                  <span className={styles.miuda}>
                    {l.obras.length} {l.obras.length === 1 ? 'obra' : 'obras'} ·{' '}
                    {fmt(l.quantidade, 2)} {un} · equipe média {fmt(l.pessoas, 1)}
                  </span>
                  <span className={styles.miuda}>
                    Por obra ({un}/dia):{' '}
                    {l.obras
                      .map((o) => `${o.obra}${o.estaObra ? '*' : ''} ${fmt(o.porDia)}`)
                      .join(' · ')}
                  </span>
                </span>
              </div>
            ))}
        <span className={styles.miuda}>
          Barra preta e * = esta obra, ainda em andamento. Só a atividade “{a.nome}”, na mesma
          unidade ({un}).
        </span>
      </div>
      <div className={styles.rodape}>
        <div className={styles.rodapeDuplo}>
          <button
            type="button"
            className={styles.btnPrimario}
            onClick={() =>
              baixarArquivo(planilhaCsv(linhasPlanilhaComparativo(c, un)), `${nomeArq}.csv`)
            }
          >
            Baixar Excel
          </button>
          <button type="button" className={styles.btnEscuro} onClick={pdf}>
            Baixar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
