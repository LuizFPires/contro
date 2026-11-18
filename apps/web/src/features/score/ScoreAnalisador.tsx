import { useState, type ReactNode } from 'react';
import {
  rotuloDia,
  textoFrequencia,
  type AnaliseScore,
  type Indicador,
  type PerdaIndicador,
} from '@contro/core';
import { Icon } from '@contro/ui';
import { TEXTOS } from './textosAnalise';
import type { AbaScore } from './scoreTela';
import base from './ScoreScreen.module.css';
import styles from './ScoreAnalisador.module.css';

const TONS = [
  '#181818',
  'rgb(24 24 24 / 55%)',
  'rgb(24 24 24 / 35%)',
  'rgb(24 24 24 / 20%)',
  'rgb(24 24 24 / 12%)',
];

/** Barra dos 100 pontos: o conquistado e o que cada indicador tirou. */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function rotuloMes(inicio: string): string {
  return `${MESES[Number(inicio.slice(5, 7)) - 1]}/${inicio.slice(0, 4)}`;
}

export function BarraPontos({
  score,
  perdas,
  onComo,
}: {
  score: number;
  perdas: PerdaIndicador[];
  onComo: () => void;
}) {
  const ordem = [...perdas].filter((p) => p.perdidos > 0).sort((a, b) => b.perdidos - a.perdidos);
  const falta = 100 - score;
  return (
    <div className={styles.pontos}>
      <div
        className={styles.barra100}
        role="img"
        aria-label={`${score} pontos conquistados, ${falta} perdidos`}
      >
        <span className={styles.conquistado} style={{ flex: score }} />
        {ordem.map((p, i) => (
          <span key={p.indicador} style={{ flex: p.perdidos, background: TONS[i] }} />
        ))}
      </div>
      <div className={styles.legendaPontos}>
        <span>
          <b>{score} pontos</b> conquistados
        </span>
        <span>
          {falta ? (
            <>
              <b>{falta}</b> ficaram pelo caminho
            </>
          ) : (
            'nota cheia'
          )}
        </span>
      </div>
      {falta ? (
        <button type="button" className={styles.botaoPrimario} onClick={onComo}>
          <Icon name="alvo" size={18} />
          Como chegar a 100
        </button>
      ) : null}
    </div>
  );
}

function Tela({
  titulo,
  sub,
  onVoltar,
  menu,
  children,
}: {
  titulo: string;
  sub: string;
  onVoltar: () => void;
  menu: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={base.screen}>
      <header className={`${base.cabecalho} ${base.cabecalhoVoltar}`}>
        <button type="button" className={base.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronLeft" size={22} />
        </button>
        <div>
          <h1 className={base.titulo}>{titulo}</h1>
          <div className={base.sub}>{sub}</div>
        </div>
      </header>
      <div className={`${base.corpo} ${styles.corpo}`}>{children}</div>
      {menu}
    </div>
  );
}

/** Como chegar a 100: onde foram os pontos, o que fazer hoje e o método. */
export function ComoChegar100({
  analise,
  aba,
  nome,
  janela,
  onIndicador,
  onVoltar,
  menu,
}: {
  analise: AnaliseScore;
  aba: AbaScore;
  nome: string;
  janela: number;
  onIndicador: (i: Indicador) => void;
  onVoltar: () => void;
  menu: ReactNode;
}) {
  const score = analise.score ?? 0;
  const ranking = [...analise.perdas].sort(
    (a, b) => b.perdidos - a.perdidos || Number(a.nota == null) - Number(b.nota == null),
  );
  const maior = ranking[0];
  const aMaior = maior ? analise.indicadores[maior.indicador] : undefined;
  const hoje = analise.vencidasAbertas.slice(0, 3);
  const equipe = aba === 'equipe';
  return (
    <Tela
      titulo="Como chegar a 100"
      sub={`${nome} · ${janela} dias`}
      onVoltar={onVoltar}
      menu={menu}
    >
      <section className={styles.heroi}>
        <span className={styles.rotuloTurquesa}>Seu score · {janela} dias</span>
        <p className={styles.heroiNumero}>
          <b>{score}</b>
          <span>
            faltam <b>{100 - score} pontos</b> para 100
          </span>
        </p>
        {maior && aMaior && maior.perdidos > 0 ? (
          <p className={styles.heroiTexto}>
            A maior parte ({maior.perdidos} {maior.perdidos === 1 ? 'ponto' : 'pontos'}) saiu de{' '}
            <b>{TEXTOS[maior.indicador].nome.toLowerCase()}</b>:{' '}
            {TEXTOS[maior.indicador].frase(aMaior)}.
          </p>
        ) : null}
      </section>

      <h2 className={base.secao}>Onde foram os {100 - score} pontos</h2>
      <div className={styles.lista}>
        {ranking.map((p) => {
          const a = analise.indicadores[p.indicador];
          const t = TEXTOS[p.indicador];
          const conteudo = (
            <>
              <span
                className={`${styles.badge} ${
                  p.nota == null ? styles.badgeNulo : p.perdidos >= 10 ? styles.badgeForte : ''
                }`}
              >
                {p.nota == null ? '0' : p.perdidos ? `−${p.perdidos}` : '0'}
              </span>
              <span className={styles.linhaTexto}>
                <b>{t.nome}</b>
                <span>
                  {a ? t.frase(a) : 'sem base no período: o peso foi dividido entre os outros'}
                </span>
              </span>
            </>
          );
          return a ? (
            <button
              key={p.indicador}
              type="button"
              className={styles.linha}
              onClick={() => onIndicador(p.indicador)}
            >
              {conteudo}
              <Icon name="chevronRight" size={16} />
            </button>
          ) : (
            <div key={p.indicador} className={styles.linha}>
              {conteudo}
            </div>
          );
        })}
      </div>

      {hoje.length ? (
        <>
          <h2 className={base.secao}>Dá para fazer hoje</h2>
          {hoje.map((x) => (
            <div key={x.id} className={styles.cardHoje}>
              <span className={styles.relogio} aria-hidden="true">
                <Icon name="relogio" size={16} />
              </span>
              <span className={styles.linhaTexto}>
                <b>{x.texto}</b>
                <span className={styles.vermelho}>
                  {x.obraNome} · vencida há {x.du} d.u.
                </span>
                <span>Concluir hoje para de aumentar o atraso nesta e na resposta ao atraso.</span>
              </span>
            </div>
          ))}
        </>
      ) : null}

      <h2 className={base.secao}>Como o CONTRO avalia</h2>
      <div className={styles.metodo}>
        <p>
          {equipe
            ? `Contam as tarefas e pendências com você de responsável concluídas ou vencidas nos últimos ${janela} dias. Abertas no prazo ainda não contam.`
            : `Contam as atividades do prestador concluídas ou vencidas nos últimos ${janela} dias. Abertas no prazo ainda não contam.`}{' '}
          Precisa de pelo menos 5.
        </p>
        {analise.perdas.map((p) => (
          <div key={p.indicador} className={styles.peso}>
            <span>
              <b>{TEXTOS[p.indicador].nome}</b>
            </span>
            <b>{p.peso}</b>
          </div>
        ))}
        <p className={styles.suave}>
          Indicador sem base no período não conta: o peso dele é dividido entre os outros.
        </p>
        <div className={styles.faixas}>
          <span className={styles.faixaOk}>75 a 100 · {equipe ? 'Resolutivo' : 'Em dia'}</span>
          <span className={styles.faixaRegular}>50 a 74 · Regular</span>
          <span className={styles.faixaAtencao}>0 a 49 · Atenção</span>
        </div>
      </div>
    </Tela>
  );
}

/** Analisador de um indicador: como é medido, o que tirou pontos e como chegar a 100. */
export function AnalisadorIndicador({
  analise,
  indicador,
  valor,
  nome,
  janela,
  onVoltar,
  menu,
}: {
  analise: AnaliseScore;
  indicador: Indicador;
  /** Valor como o card mostra ("57%", "2,5 d.u."). */
  valor: string;
  nome: string;
  janela: number;
  onVoltar: () => void;
  menu: ReactNode;
}) {
  const [todas, setTodas] = useState(false);
  const a = analise.indicadores[indicador];
  const p = analise.perdas.find((x) => x.indicador === indicador);
  const t = TEXTOS[indicador];
  if (!a || !p) return null;
  const nota = p.nota ?? 0;
  const tom = nota >= 0.75 ? styles.ok : nota >= 0.5 ? styles.regular : styles.baixa;
  const mostradas = todas ? a.acoes : a.acoes.slice(0, 4);
  const valePorAcao = a.base ? p.vale / a.base : 0;
  return (
    <Tela titulo={t.nome} sub={`${nome} · ${janela} dias`} onVoltar={onVoltar} menu={menu}>
      <section className={styles.cartao}>
        <div className={styles.cartaoTopo}>
          <div>
            <div className={`${styles.valor} ${tom}`}>{valor}</div>
            <div className={styles.suave}>{t.conta(a)}</div>
          </div>
          <div className={styles.perdeu}>
            <b>{p.perdidos ? `−${p.perdidos}` : '0'}</b>
            <span>pontos no score</span>
          </div>
        </div>
        <span className={styles.barraNota} aria-hidden="true">
          <i className={tom} style={{ width: `${Math.round(nota * 100)}%` }} />
        </span>
        <div className={styles.suave}>
          Vale {p.peso} na tabela; neste score pesa {p.vale} de 100 e você ficou com{' '}
          {p.vale - p.perdidos}.
        </div>
      </section>

      <section className={styles.bloco}>
        <span className={styles.rotulo}>Como é medido</span>
        <p>{t.como}</p>
      </section>

      {a.presenca ? (
        <>
          <h2 className={base.secao}>Por obra</h2>
          {a.presenca.obras.map((o) => (
            <article key={o.obraId} className={styles.acao}>
              <div className={styles.acaoTopo}>
                <b>{o.obraNome}</b>
                <b>
                  {o.feitos} de {o.esperados}
                </b>
              </div>
              <span className={styles.suave}>Frequência: {textoFrequencia(o.frequencia)}</span>
              {o.faltas.length ? (
                <div className={styles.faltas}>
                  {o.faltas.slice(0, todas ? undefined : 8).map((f) => (
                    <span key={`${f.periodo}${f.inicio}`} className={styles.chipAtraso}>
                      {f.periodo === 'semana'
                        ? `semana ${rotuloDia(f.inicio).slice(4)}`
                        : rotuloMes(f.inicio)}
                      : {f.feitos} de {f.pedidos}
                    </span>
                  ))}
                  {!todas && o.faltas.length > 8 ? (
                    <button
                      type="button"
                      className={styles.botaoSecundario}
                      onClick={() => setTodas(true)}
                    >
                      Ver as outras {o.faltas.length - 8}
                    </button>
                  ) : null}
                </div>
              ) : (
                <span className={styles.suave}>Sem falta no período.</span>
              )}
            </article>
          ))}
        </>
      ) : null}
      {a.presenca ? null : (
        <h2 className={base.secao}>{a.acoes.length ? t.titulo(a) : 'Nada tirou pontos aqui'}</h2>
      )}
      {!a.presenca && a.acoes.length === 0 ? <p className={base.nota}>{t.vazio}</p> : null}
      {mostradas.map((x) => {
        const fim = t.fim(x);
        return (
          <article key={x.id} className={styles.acao}>
            <div className={styles.acaoTopo}>
              <b>{x.texto}</b>
              <span className={styles.chipAtraso}>{t.chip(x)}</span>
            </div>
            <span className={styles.suave}>{x.obraNome}</span>
            <dl className={styles.fatos}>
              <dt>{t.prazoRotulo}</dt>
              <dd>{rotuloDia(x.prazo)}</dd>
              <dt>{fim.rotulo}</dt>
              <dd className={fim.atraso ? styles.vermelho : undefined}>{fim.valor}</dd>
            </dl>
            <p className={styles.dica}>
              <Icon name="lampada" size={16} />
              <span>{t.dica(x)}</span>
            </p>
          </article>
        );
      })}
      {a.acoes.length > 4 ? (
        <button type="button" className={styles.botaoSecundario} onClick={() => setTodas(!todas)}>
          {todas ? 'Mostrar menos' : `Ver as outras ${a.acoes.length - 4}`}
        </button>
      ) : null}

      <section className={styles.instrutor}>
        <span className={styles.rotuloTurquesa}>Para chegar a 100 aqui</span>
        <ol>
          {t.dicas(a, valePorAcao).map((d, i) => (
            <li key={i}>
              <span>{i + 1}</span>
              {d}
            </li>
          ))}
        </ol>
        {a.simulacao && analise.score != null && a.simulacao.score > analise.score ? (
          <div className={styles.simulacao}>
            <b>
              {analise.score} <span>→ {a.simulacao.score}</span>
            </b>
            <span>{t.simulacao(a.simulacao.quantas)}</span>
          </div>
        ) : null}
      </section>
    </Tela>
  );
}
