import { useMemo, useState, type ReactNode } from 'react';
import {
  calcularScoreEquipe,
  calcularScorePrestadores,
  iniciais,
  rotuloFaixa,
  type Ambiente,
  type IndicadoresEquipe,
  type IndicadoresPrestador,
  type Janela,
} from '@contro/core';
import { Icon } from '@contro/ui';
import { useLembrado } from '../../lib/useLembrado';
import { useScoreDados } from '../log/dadosLogScore';
import { hojeISO } from '../obras/api';
import { usePerfil } from '../perfil/usePerfil';
import { du, pct } from './formato';
import { ScoreDetalhe } from './ScoreDetalhe';
import { linhasDaAba, useGravarScoreDiario } from './scoreDiario';
import { contagem, corFaixa, nomeExibido, type AbaScore, type LinhaQualquer } from './scoreTela';
import styles from './ScoreScreen.module.css';

/**
 * Score: como cada um entrega (protótipo Score e Log, 04/11/2026). Equipe
 * (tarefas e pendências por responsável) e Prestadores (atividades), janela de
 * 30 ou 90 dias; a própria pessoa aparece com "você"; abaixo de 5 itens fica
 * sem score. Tocar abre o detalhe. Obras gerais (`ambiente="geral"`): os itens das
 * obras que a pessoa vê; o histórico só é gravado quando quem abre é Administrador.
 */
export function ScoreScreen({
  ambiente = 'contorno',
  menu,
}: {
  ambiente?: Ambiente;
  /**
   * Menu de baixo (Contorno: NavInferior; Obras gerais: NavGeral). `antesDeIr` fecha o
   * detalhe aberto antes de trocar de tela (tocar em Score no detalhe volta à lista).
   */
  menu: (antesDeIr?: () => void) => ReactNode;
}) {
  const { equipe, prestadores, carregando, erro } = useScoreDados(ambiente);
  const { data: perfil } = usePerfil();
  const prefixo = ambiente === 'contorno' ? '' : 'obrasgerais:';
  const [aba, setAba] = useLembrado<AbaScore>(`${prefixo}score:aba`, 'equipe');
  const [janela, setJanela] = useLembrado<Janela>(`${prefixo}score:janela`, 90);
  const [sel, setSel] = useState<string | null>(null);
  const hoje = hojeISO();

  // As duas abas nas duas janelas, calculadas uma vez: a lista usa a aba e a
  // janela escolhidas, o detalhe mostra a tendência 30 × 90 e o score diário
  // grava todas.
  const todas = useMemo(() => {
    const eq = (j: Janela): LinhaQualquer[] => calcularScoreEquipe(equipe, j, hoje);
    const pr = (j: Janela): LinhaQualquer[] => calcularScorePrestadores(prestadores, j, hoje);
    return {
      equipe: { 30: eq(30), 90: eq(90) } as Record<Janela, LinhaQualquer[]>,
      prestadores: { 30: pr(30), 90: pr(90) } as Record<Janela, LinhaQualquer[]>,
    };
  }, [equipe, prestadores, hoje]);
  const porJanela = todas[aba];
  const linhas = porJanela[janela];

  // Score diário: grava o de hoje das duas abas (o último cálculo do dia vence).
  const paraGravar = useMemo(
    () =>
      carregando || erro
        ? null
        : [
            ...linhasDaAba('equipe', todas.equipe),
            ...linhasDaAba('prestadores', todas.prestadores),
          ],
    [carregando, erro, todas],
  );
  useGravarScoreDiario(paraGravar, hoje, ambiente, perfil?.administrador ?? false);
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
        ambiente={ambiente}
        onJanela={setJanela}
        onVoltar={() => setSel(null)}
        menu={menu(() => setSel(null))}
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
        {erro && linhas.length === 0 ? (
          <p className={styles.vazio} role="alert">
            <Icon name="alert" size={16} /> Sem conexão: não foi possível carregar o Score.
          </p>
        ) : null}
        {!carregando && !erro && linhas.length === 0 ? (
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
            {ambiente === 'contorno'
              ? 'Todo mundo vê a classificação de todos.'
              : perfil?.administrador
                ? 'Todas as obras gerais.'
                : 'Você vê quem participa das suas obras.'}{' '}
            Toque num nome para ver os indicadores e as ações que mais pesaram.
          </p>
        ) : null}
      </div>

      {menu()}
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
