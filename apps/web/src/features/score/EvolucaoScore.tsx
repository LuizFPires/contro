import { useEffect, useMemo, useRef, useState } from 'react';
import {
  evolucaoScore,
  faixaDoScore,
  rotuloFaixa,
  variacaoScore,
  type Faixa,
  type Janela,
  type PontoScore,
  type RegistroScoreDia,
} from '@contro/core';
import { Icon } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { corFaixa, type AbaScore } from './scoreTela';
import styles from './ScoreScreen.module.css';

const W = 320;
const H = 96;
const PAD = { l: 6, r: 10, t: 16, b: 16 };

/**
 * Card do topo do detalhe (opção B, 05/11/2026): número grande com a faixa e a
 * variação desde ontem, linha do score de fim de cada dia útil (maior e menor
 * marcados, hoje vazado) e a janela 30/90. Tocar ou arrastar lê um dia.
 */
export function EvolucaoScore({
  aba,
  registros,
  agora,
  faixaAgora,
  hoje,
  janela,
  score30,
  score90,
  tendencia,
  minimo,
  onJanela,
}: {
  aba: AbaScore;
  registros: RegistroScoreDia[];
  agora: number | null;
  faixaAgora: Faixa;
  hoje: string;
  janela: Janela;
  score30: number | null;
  score90: number | null;
  tendencia: string;
  /** "mínimo de 5 ações/atividades" para quem ainda não tem score. */
  minimo: string;
  onJanela: (j: Janela) => void;
}) {
  const { pontos, maior, menor } = useMemo(
    () => evolucaoScore(registros, agora, hoje, janela),
    [registros, agora, hoje, janela],
  );
  const ultimoFechado = pontos.length - (pontos.at(-1)?.aberto ? 2 : 1);
  const padrao = ultimoFechado >= 0 ? ultimoFechado : pontos.length - 1;
  const [sel, setSel] = useState<number | null>(null);
  const i = sel != null && sel < pontos.length ? sel : padrao;
  const p: PontoScore | undefined = pontos[i];
  const voltar = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(voltar.current), []);

  const temLinha = pontos.length >= 2;
  const vs = pontos.map((x) => x.score);
  const min = Math.min(...vs) - 4;
  const max = Math.max(...vs) + 4;
  const X = (k: number) =>
    PAD.l + (pontos.length < 2 ? 0 : (k * (W - PAD.l - PAD.r)) / (pontos.length - 1));
  const Y = (v: number) => PAD.t + ((max - v) * (H - PAD.t - PAD.b)) / (max - min || 1);
  const fechados = pontos.filter((x) => !x.aberto);
  const linha = fechados
    .map((x, k) => `${k ? 'L' : 'M'}${X(k).toFixed(1)},${Y(x.score).toFixed(1)}`)
    .join('');

  function escolher(clientX: number, alvo: SVGSVGElement) {
    const r = alvo.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    let melhor = 0;
    pontos.forEach((_, k) => {
      if (Math.abs(X(k) - x) < Math.abs(X(melhor) - x)) melhor = k;
    });
    window.clearTimeout(voltar.current);
    setSel(melhor);
  }

  const delta = p ? variacaoScore(pontos, i, hoje) : null;
  const faixaSel = p && !p.aberto ? faixaDoScore(p.score, aba) : faixaAgora;
  const cor = corFaixa(faixaSel);
  const dia = !p
    ? ''
    : p.aberto
      ? 'hoje, até agora'
      : `fechou ${formatarDataCurta(p.dia)}${delta?.eOntem ? ' · ontem' : ''}`;

  return (
    <div className={styles.evolucao}>
      <div className={styles.evoTopo}>
        <span className={`${styles.evoNumero} ${styles[`faixa_${cor}`]}`}>
          {p ? p.score : '—'}
          <small>/100</small>
        </span>
        <span className={styles.evoDireita}>
          {p ? (
            <span className={`${styles.evoSelo} ${styles[`faixa_${cor}`]}`}>
              <Icon name={cor === 'ok' ? 'check' : 'alert'} size={13} strokeWidth={2.4} />
              {rotuloFaixa(faixaSel)}
            </span>
          ) : null}
          {delta ? (
            <span className={styles.evoDelta}>
              <Icon
                name={delta.delta > 0 ? 'sobe' : delta.delta < 0 ? 'desce' : 'igual'}
                size={12}
                strokeWidth={2.6}
              />
              {delta.delta > 0 ? '+' : delta.delta < 0 ? '−' : ''}
              {Math.abs(delta.delta)} {delta.desdeOntem ? 'desde ontem' : 'vs dia anterior'}
            </span>
          ) : null}
        </span>
      </div>
      <div className={styles.evoDia}>{p ? dia : `Sem score ainda · ${minimo}`}</div>

      {temLinha ? (
        <svg
          className={styles.evoGrafico}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Score de fim de dia nos últimos ${janela} dias: de ${pontos[0]!.score} a ${pontos.at(-1)!.score}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            escolher(e.clientX, e.currentTarget);
          }}
          onPointerMove={(e) => {
            if (e.pointerType === 'mouse' || e.buttons) escolher(e.clientX, e.currentTarget);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setSel(null);
          }}
          onPointerUp={(e) => {
            if (e.pointerType !== 'mouse')
              voltar.current = window.setTimeout(() => setSel(null), 1600);
          }}
        >
          {75 > min && 75 < max ? (
            <g>
              <line x1={PAD.l} x2={W - PAD.r} y1={Y(75)} y2={Y(75)} className={styles.evoRef} />
              <text x={W - PAD.r} y={Y(75) - 4} textAnchor="end" className={styles.evoTexto}>
                75
              </text>
            </g>
          ) : null}
          {fechados.length >= 2 ? (
            <>
              <path
                d={`${linha}L${X(fechados.length - 1)},${H}L${X(0)},${H}Z`}
                className={styles.evoArea}
              />
              <path d={linha} className={styles.evoLinha} />
            </>
          ) : null}
          {pontos.at(-1)?.aberto && fechados.length ? (
            <path
              d={`M${X(fechados.length - 1)},${Y(fechados.at(-1)!.score)}L${X(pontos.length - 1)},${Y(pontos.at(-1)!.score)}`}
              className={styles.evoHoje}
            />
          ) : null}
          {pontos.at(-1)?.aberto ? (
            <circle
              cx={X(pontos.length - 1)}
              cy={Y(pontos.at(-1)!.score)}
              r={3.5}
              className={styles.evoPontoAberto}
            />
          ) : null}
          {maior && menor && maior !== menor
            ? [
                { pt: maior, nome: 'maior', dy: -6 },
                { pt: menor, nome: 'menor', dy: 13 },
              ].map(({ pt, nome, dy }) => {
                const k = pontos.indexOf(pt);
                const anc = X(k) < 40 ? 'start' : X(k) > W - 60 ? 'end' : 'middle';
                return (
                  <g key={nome}>
                    <circle cx={X(k)} cy={Y(pt.score)} r={3} className={styles.evoMarca} />
                    <text
                      x={X(k)}
                      y={Y(pt.score) + dy}
                      textAnchor={anc}
                      className={styles.evoRotulo}
                    >
                      {nome} {pt.score}
                    </text>
                  </g>
                );
              })
            : null}
          {p ? (
            <g>
              <line x1={X(i)} x2={X(i)} y1={4} y2={H} className={styles.evoGuia} />
              <circle
                cx={X(i)}
                cy={Y(p.score)}
                r={5}
                className={`${p.aberto ? styles.evoPontoAberto : styles.evoPonto} ${styles[`ponto_${cor}`]}`}
              />
            </g>
          ) : null}
        </svg>
      ) : p ? (
        <p className={styles.evoVazio}>
          A linha começa a se formar a partir de hoje: cada dia útil fechado vira um ponto.
        </p>
      ) : null}

      <div className={styles.evoRodape}>
        <span className={styles.numeros}>
          30 dias: <b>{score30 ?? '—'}</b> · 90 dias: <b>{score90 ?? '—'}</b> · {tendencia}
        </span>
        <span className={styles.evoJanela} role="group" aria-label="Período do gráfico">
          {([30, 90] as const).map((j) => (
            <button
              key={j}
              type="button"
              aria-pressed={janela === j}
              className={janela === j ? styles.evoJanelaAtiva : undefined}
              onClick={() => {
                setSel(null);
                onJanela(j);
              }}
            >
              {j}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}
