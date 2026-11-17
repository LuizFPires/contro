import { useMemo, useState, type ReactNode } from 'react';
import {
  analisarScoreEquipe,
  analisarScorePrestador,
  tendencia,
  type Ambiente,
  type Indicador,
  type ItemEquipe,
  type ItemPrestador,
  type IndicadoresEquipe,
  type IndicadoresPrestador,
  type Janela,
} from '@contro/core';
import { Icon } from '@contro/ui';
import { hojeISO } from '../obras/api';
import { EvolucaoScore } from './EvolucaoScore';
import { AnalisadorIndicador, BarraPontos, ComoChegar100 } from './ScoreAnalisador';
import { rotuloPerda } from './textosAnalise';
import an from './ScoreAnalisador.module.css';
import { decimal, du, pct } from './formato';
import { useScoreHistorico } from './scoreDiario';
import { contagem, nomeExibido, type AbaScore, type LinhaQualquer } from './scoreTela';
import styles from './ScoreScreen.module.css';

const TENDENCIA = { melhorando: 'melhorando', estavel: 'estável', piorando: 'piorando' } as const;

interface Kpi {
  indicador: Indicador;
  rotulo: string;
  valor: string;
  descricao: string;
  /** Nota de 0 a 1 (barra); nula sem base no período. */
  nota: number | null;
}

function kpisEquipe(l: LinhaQualquer): Kpi[] {
  const i = l.indicadores as IndicadoresEquipe;
  const n = l.numeros;
  return [
    {
      indicador: 'pontualidade',
      rotulo: 'Pontualidade',
      valor: pct(i.pontualidade),
      descricao: 'concluídas até o prazo original',
      nota: i.pontualidade,
    },
    {
      indicador: 'conclusaoDoDia',
      rotulo: 'Conclusão do dia',
      valor: pct(i.conclusaoDoDia),
      descricao: 'do que vencia no dia, feito até o dia',
      nota: i.conclusaoDoDia,
    },
    {
      indicador: 'respostaAtraso',
      rotulo: 'Resposta ao atraso',
      valor: n.respostaMedianaDU == null ? 'sem atraso' : du(n.respostaMedianaDU),
      descricao: 'entre vencer e concluir (mediana)',
      nota: i.respostaAtraso,
    },
    {
      indicador: 'replanejamentos',
      rotulo: 'Replanejamentos',
      valor: decimal(n.replanejamentosMedia),
      descricao: 'por tarefa',
      nota: i.replanejamentos,
    },
    {
      indicador: 'pendencias',
      rotulo: 'Pendências',
      valor: pct(i.pendencias),
      descricao: 'resolvidas no prazo da criticidade',
      nota: i.pendencias,
    },
  ];
}

function kpisPrestador(l: LinhaQualquer): Kpi[] {
  const i = l.indicadores as IndicadoresPrestador;
  return [
    {
      indicador: 'noFimPrevisto',
      rotulo: 'No fim previsto',
      valor: pct(i.noFimPrevisto),
      descricao: 'concluídas até o fim previsto',
      nota: i.noFimPrevisto,
    },
    {
      indicador: 'atrasoMedio',
      rotulo: 'Atraso médio',
      valor: du(l.numeros.atrasoMedioDU),
      descricao: 'por atividade (0 para as no prazo)',
      nota: i.atrasoMedio,
    },
    {
      indicador: 'comFoto',
      rotulo: 'Com foto',
      valor: pct(i.comFoto),
      descricao: 'concluídas com foto',
      nota: i.comFoto,
    },
  ];
}

/**
 * Cor da nota pela régua das faixas: ≥ 75 turquesa, 50–74 âmbar, < 50 preto.
 * Vermelho fica só na faixa "Atenção" e no atraso das ações que mais pesaram.
 */
function corNota(nota: number): 'ok' | 'regular' | 'baixa' {
  if (nota >= 0.75) return 'ok';
  if (nota >= 0.5) return 'regular';
  return 'baixa';
}

/** Detalhe de um nome: score e faixa, tendência 30 × 90, indicadores e as ações que mais pesaram. */
export function ScoreDetalhe({
  linha: l,
  itens,
  aba,
  janela,
  score30,
  score90,
  voce,
  ambiente = 'contorno',
  onJanela,
  onVoltar,
  menu,
}: {
  linha: LinhaQualquer;
  /** Itens do Score da aba (todos os nomes): o analisador filtra pela chave. */
  itens: ItemEquipe[] | ItemPrestador[];
  aba: AbaScore;
  janela: Janela;
  score30: number | null;
  score90: number | null;
  voce: boolean;
  ambiente?: Ambiente;
  onJanela: (j: Janela) => void;
  onVoltar: () => void;
  /** Menu de baixo, o mesmo da lista do Score. */
  menu: ReactNode;
}) {
  const hoje = hojeISO();
  const { data: historico = [] } = useScoreHistorico(aba, l.chave, hoje, ambiente);
  const t = tendencia(score30, score90);
  const kpis = aba === 'equipe' ? kpisEquipe(l) : kpisPrestador(l);
  const unidade = aba === 'equipe' ? 'ações' : 'atividades';
  const obras = l.numeros.obras === 1 ? '1 obra' : `${l.numeros.obras} obras`;
  const analise = useMemo(
    () =>
      aba === 'equipe'
        ? analisarScoreEquipe(itens as ItemEquipe[], l.chave, janela, hoje)
        : analisarScorePrestador(itens as ItemPrestador[], l.chave, janela, hoje),
    [aba, itens, l.chave, janela, hoje],
  );
  // Analisador: "Como chegar a 100" ou um indicador (lembra de onde veio).
  const [vista, setVista] = useState<
    { tipo: 'geral' } | { tipo: 'indicador'; indicador: Indicador; de: 'geral' | 'detalhe' } | null
  >(null);
  const temAnalise = analise.score != null;
  const nome = nomeExibido(l, aba);

  if (vista?.tipo === 'geral')
    return (
      <ComoChegar100
        analise={analise}
        aba={aba}
        nome={nome}
        janela={janela}
        onIndicador={(i) => setVista({ tipo: 'indicador', indicador: i, de: 'geral' })}
        onVoltar={() => setVista(null)}
        menu={menu}
      />
    );
  if (vista?.tipo === 'indicador')
    return (
      <AnalisadorIndicador
        analise={analise}
        indicador={vista.indicador}
        valor={kpis.find((k) => k.indicador === vista.indicador)?.valor ?? ''}
        nome={nome}
        janela={janela}
        onVoltar={() => setVista(vista.de === 'geral' ? { tipo: 'geral' } : null)}
        menu={menu}
      />
    );

  return (
    <div className={styles.screen}>
      <header className={`${styles.cabecalho} ${styles.cabecalhoVoltar}`}>
        <button
          type="button"
          className={styles.voltar}
          aria-label="Voltar para o Score"
          onClick={onVoltar}
        >
          <Icon name="chevronLeft" size={22} />
        </button>
        <div>
          <h1 className={styles.titulo}>
            {nome}
            {voce ? ' · você' : ''}
          </h1>
          <div className={styles.sub}>
            {janela} dias · {contagem(l.itens, aba)} em {obras}
          </div>
        </div>
      </header>

      <div className={styles.corpo}>
        <EvolucaoScore
          aba={aba}
          registros={historico}
          agora={l.score}
          faixaAgora={l.faixa}
          hoje={hoje}
          janela={janela}
          score30={score30}
          score90={score90}
          tendencia={t ? `tendência ${TENDENCIA[t]}` : 'sem tendência ainda'}
          minimo={`mínimo de 5 ${unidade}`}
          onJanela={onJanela}
        />

        {temAnalise && analise.score != null ? (
          <BarraPontos
            score={analise.score}
            perdas={analise.perdas}
            onComo={() => setVista({ tipo: 'geral' })}
          />
        ) : null}

        <div className={styles.kpis}>
          {kpis.map((k) => {
            const perda = analise.perdas.find((p) => p.indicador === k.indicador);
            const abre = temAnalise && analise.indicadores[k.indicador] != null;
            const Tag = abre ? 'button' : 'div';
            return (
              <Tag
                key={k.rotulo}
                {...(abre
                  ? {
                      type: 'button' as const,
                      onClick: () =>
                        setVista({ tipo: 'indicador', indicador: k.indicador, de: 'detalhe' }),
                    }
                  : {})}
                className={`${styles.kpi} ${abre ? an.kpiBotao : ''}`}
              >
                <span className={an.kpiTopo}>
                  <span
                    className={`${styles.kpiValor} ${k.nota == null ? '' : styles[`nota_${corNota(k.nota)}`]}`}
                  >
                    {k.valor}
                  </span>
                  {temAnalise ? (
                    <span className={`${an.chipPerda} ${perda?.perdidos ? '' : an.chipNeutro}`}>
                      {rotuloPerda(perda)}
                    </span>
                  ) : null}
                </span>
                <span className={styles.kpiRotulo}>{k.rotulo}</span>
                <span className={styles.kpiDesc}>
                  {k.nota == null ? 'sem base no período' : k.descricao}
                </span>
                {k.nota == null ? null : (
                  <span
                    className={styles.barra}
                    role="img"
                    aria-label={`${k.rotulo}: nota ${Math.round(k.nota * 100)} de 100`}
                  >
                    <i
                      className={styles[`nota_${corNota(k.nota)}`]}
                      style={{ width: `${Math.round(k.nota * 100)}%` }}
                    />
                  </span>
                )}
                {abre ? (
                  <span className={an.porque}>
                    Por quê <Icon name="chevronRight" size={14} />
                  </span>
                ) : null}
              </Tag>
            );
          })}
        </div>

        <h2 className={styles.secao}>Ações que mais pesaram</h2>
        {l.piores.length === 0 ? (
          <p className={styles.nota}>
            Nenhuma {aba === 'equipe' ? 'ação' : 'atividade'} atrasada no período.
          </p>
        ) : (
          l.piores.map((p) => (
            <div key={p.id} className={styles.pior}>
              <span className={styles.piorIcone} aria-hidden="true">
                <Icon name="alert" size={14} strokeWidth={2.6} />
              </span>
              <span className={styles.cardTexto}>
                <span className={styles.piorTexto}>{p.texto}</span>
                <span className={styles.numeros}>
                  {p.obraNome} · {p.detalhe}
                </span>
              </span>
            </div>
          ))
        )}
      </div>

      {menu}
    </div>
  );
}
