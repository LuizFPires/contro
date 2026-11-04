import { useMemo, useState } from 'react';
import {
  calcularScoreEquipe,
  calcularScorePrestadores,
  iniciais,
  rotuloFaixa,
  type IndicadoresEquipe,
  type IndicadoresPrestador,
  type Janela,
} from '@contro/core';
import { Icon } from '@contro/ui';
import { useLembrado } from '../../lib/useLembrado';
import { NavInferior, type ItemNav } from '../../screens/NavInferior';
import { useScoreDados } from '../log/dadosLogScore';
import { hojeISO } from '../obras/api';
import { usePerfil } from '../perfil/usePerfil';
import { du, pct } from './formato';
import { ScoreDetalhe } from './ScoreDetalhe';
import { contagem, corFaixa, nomeExibido, type AbaScore, type LinhaQualquer } from './scoreTela';
import styles from './ScoreScreen.module.css';

/**
 * Score: como cada um entrega (protótipo Score e Log, 04/11/2026). Equipe
 * (tarefas e pendências por responsável) e Prestadores (atividades), janela de
 * 30 ou 90 dias; a própria pessoa aparece com "você"; abaixo de 5 itens fica
 * sem score. Tocar abre o detalhe.
 */
export function ScoreScreen({ onNav }: { onNav: (item: ItemNav) => void }) {
  const { equipe, prestadores, carregando } = useScoreDados();
  const { data: perfil } = usePerfil();
  const [aba, setAba] = useLembrado<AbaScore>('score:aba', 'equipe');
  const [janela, setJanela] = useLembrado<Janela>('score:janela', 90);
  const [sel, setSel] = useState<string | null>(null);
  const hoje = hojeISO();

  // As duas janelas: a lista usa a escolhida; o detalhe mostra a tendência 30 × 90.
  const porJanela = useMemo(() => {
    const calc = (j: Janela): LinhaQualquer[] =>
      aba === 'equipe'
        ? calcularScoreEquipe(equipe, j, hoje)
        : calcularScorePrestadores(prestadores, j, hoje);
    return { 30: calc(30), 90: calc(90) } as Record<Janela, LinhaQualquer[]>;
  }, [aba, equipe, prestadores, hoje]);
  const linhas = porJanela[janela];
  const eu = aba === 'equipe' ? perfil?.id : undefined;

  const linhaSel = sel ? linhas.find((l) => l.chave === sel) : undefined;
  if (linhaSel) {
    const s = (j: Janela) => porJanela[j].find((l) => l.chave === linhaSel.chave)?.score ?? null;
    return (
      <ScoreDetalhe
        linha={linhaSel}
        aba={aba}
        janela={janela}
        score30={s(30)}
        score90={s(90)}
        voce={linhaSel.chave === eu}
        onVoltar={() => setSel(null)}
        onNav={(item) => {
          setSel(null);
          onNav(item);
        }}
      />
    );
  }

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <h1 className={styles.titulo}>Score</h1>
        <div className={styles.sub}>como cada um entrega</div>
      </header>

      <div className={styles.corpo}>
        <Segmentos
          rotulo="Quem"
          opcoes={[
            { valor: 'equipe', rotulo: 'Equipe' },
            { valor: 'prestadores', rotulo: 'Prestadores' },
          ]}
          valor={aba}
          onChange={setAba}
        />
        <Segmentos
          rotulo="Período"
          opcoes={[
            { valor: 30 as Janela, rotulo: '30 dias' },
            { valor: 90 as Janela, rotulo: '90 dias' },
          ]}
          valor={janela}
          onChange={setJanela}
        />

        {carregando ? <p className={styles.vazio}>Carregando…</p> : null}
        {!carregando && linhas.length === 0 ? (
          <p className={styles.vazio}>Sem itens no período.</p>
        ) : null}

        {linhas.map((l) => (
          <CardNome
            key={l.chave}
            linha={l}
            aba={aba}
            voce={l.chave === eu}
            onAbrir={() => setSel(l.chave)}
          />
        ))}

        {linhas.length ? (
          <p className={styles.nota}>
            Todo mundo vê a classificação de todos. Toque num nome para ver os indicadores e as
            ações que mais pesaram.
          </p>
        ) : null}
      </div>

      <NavInferior ativo="score" onEscolher={onNav} />
    </div>
  );
}

export function Segmentos<T extends string | number>({
  rotulo,
  opcoes,
  valor,
  onChange,
}: {
  rotulo: string;
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.seg} role="tablist" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          role="tab"
          aria-selected={o.valor === valor}
          className={`${styles.segBtn} ${o.valor === valor ? styles.segAtivo : ''}`}
          onClick={() => onChange(o.valor)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

function CardNome({
  linha: l,
  aba,
  voce,
  onAbrir,
}: {
  linha: LinhaQualquer;
  aba: AbaScore;
  voce: boolean;
  onAbrir: () => void;
}) {
  const cor = corFaixa(l.faixa);
  const nome = nomeExibido(l, aba);
  const principal =
    aba === 'equipe'
      ? `${pct((l.indicadores as IndicadoresEquipe).pontualidade)} no prazo`
      : `${pct((l.indicadores as IndicadoresPrestador).noFimPrevisto)} no fim previsto`;
  return (
    <button
      type="button"
      className={`${styles.card} ${voce ? styles.cardVoce : ''} ${cor === 'sem' ? styles.cardSem : ''}`}
      onClick={onAbrir}
    >
      <span className={`${styles.avatar} ${voce ? styles.avatarVoce : ''}`} aria-hidden="true">
        {iniciais(l.nome)}
      </span>
      <span className={styles.cardTexto}>
        <span className={styles.nome}>
          {nome}
          {voce ? ' · você' : ''}
        </span>
        <span className={styles.numeros}>
          {l.score == null ? (
            <>
              {contagem(l.itens, aba)} no período · <b>sem score ainda</b>
            </>
          ) : (
            <>
              <b>{principal}</b> · atraso médio <b>{du(l.numeros.atrasoMedioDU)}</b> ·{' '}
              {contagem(l.itens, aba)}
            </>
          )}
        </span>
      </span>
      <span className={`${styles.score} ${styles[`faixa_${cor}`]}`}>
        <span className={styles.scoreValor}>{l.score ?? '—'}</span>
        <span className={styles.scoreFaixa}>
          {l.score == null ? 'mín. 5' : rotuloFaixa(l.faixa)}
        </span>
      </span>
      <Icon name="chevronRight" size={18} className={styles.seta} />
    </button>
  );
}
