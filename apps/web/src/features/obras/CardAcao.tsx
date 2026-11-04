import type { ReactNode } from 'react';
import { estadoAcao, textoReplanejamento, type EstadoAcao } from '@contro/core';
import { Icon, type IconName } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { dataLocal } from './api';
import type { AcaoObra, SecaoAcoes } from './acoesObra';
import styles from './CardAcao.module.css';

const CRIT: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

const CLASSE_SECAO: Record<EstadoAcao, string> = {
  atrasada: styles.sAtraso,
  hoje: styles.sHoje,
  proxima: '',
  concluida: styles.sFeita,
};

/** Cabeçalho da seção: ícone + nome + " · N". */
export function TituloSecao({ secao }: { secao: SecaoAcoes }) {
  return (
    <h2 className={`${styles.secao} ${CLASSE_SECAO[secao.estado]}`}>
      <Icon name={secao.icone} size={16} strokeWidth={2.2} />
      {secao.titulo} · {secao.itens.length}
    </h2>
  );
}

function linhaPrazo(a: AcaoObra, e: EstadoAcao): string {
  if (e === 'atrasada') return `ATRASADA · prazo era ${formatarDataCurta(a.prazo)}`;
  if (e === 'hoje') return `VENCE HOJE · ${formatarDataCurta(a.prazo)}`;
  if (e === 'proxima') return `Prazo ${formatarDataCurta(a.prazo)}`;
  // Pendência se resolve (foto do depois); tarefa se faz.
  const feita = a.origem === 'pendencia' ? 'Resolvida' : 'Feita';
  return a.concluidaEm ? `${feita} ${formatarDataCurta(dataLocal(a.concluidaEm))}` : feita;
}

function linhaMeta(a: AcaoObra, obra: string | null, comResponsavel: boolean): string {
  const resp = comResponsavel ? (a.responsavelNome ?? 'Sem responsável') : null;
  const partes =
    a.origem === 'tarefa'
      ? [obra, resp, a.tarefa.origem_texto]
      : a.origem === 'providencia'
        ? [obra, resp, a.providencia.atividadeNome]
        : [
            obra,
            resp,
            CRIT[a.pendencia.criticidade] ?? null,
            a.pendencia.local,
            `apontada ${formatarDataCurta(dataLocal(a.pendencia.apontada_em))}`,
          ];
  return partes.filter(Boolean).join(' · ');
}

const CLASSE_CARD: Record<EstadoAcao, string> = {
  atrasada: styles.atrasada,
  hoje: styles.venceHoje,
  proxima: '',
  concluida: styles.feita,
};

/**
 * Card de ação (tarefa ou pendência), igual nas Tarefas da equipe e em Minhas
 * ações, sem rótulo de origem. `esquerda` é o marcador (check ou anel); com
 * `cardInteiro`, o card todo é o botão (o marcador vai dentro, sem ação própria).
 */
export function CardAcao({
  acao: a,
  hoje,
  obra = null,
  comResponsavel = true,
  esquerda,
  direita,
  cardInteiro = false,
  rotulo,
  onToque,
}: {
  acao: AcaoObra;
  hoje: string;
  /** Nome da obra na linha de detalhe (null quando a lista já agrupa por obra). */
  obra?: string | null;
  comResponsavel?: boolean;
  esquerda?: ReactNode;
  direita?: ReactNode;
  cardInteiro?: boolean;
  rotulo: string;
  onToque: () => void;
}) {
  const e = estadoAcao(a, hoje);
  const t = a.origem === 'tarefa' ? a.tarefa : null;
  const repl =
    t && a.aberta
      ? textoReplanejamento(
          t.replanejamentos,
          t.prazo_original ? formatarDataCurta(t.prazo_original) : null,
        )
      : null;
  const avanco =
    t && a.aberta && (t.avanco_pct > 0 || t.comentario)
      ? [
          t.avanco_pct > 0 ? `${t.avanco_pct}% feito` : null,
          t.comentario ? `“${t.comentario}”` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;
  const prazo = linhaPrazo(a, e);
  // O aria-label substitui o conteúdo: leva junto o estado do prazo.
  const nomeAcessivel = `${rotulo}. ${prazo}`;
  const iconePrazo: IconName | null = e === 'atrasada' ? 'alert' : e === 'hoje' ? 'atencao' : null;

  const corpo = (
    <>
      <span className={styles.texto}>{a.texto}</span>
      <span className={styles.meta}>{linhaMeta(a, obra, comResponsavel)}</span>
      <span className={styles.prazo}>
        {iconePrazo ? <Icon name={iconePrazo} size={14} strokeWidth={2.4} /> : null}
        {prazo}
      </span>
      {repl ? <span className={styles.repl}>{repl}</span> : null}
      {avanco ? <span className={styles.repl}>{avanco}</span> : null}
    </>
  );
  const classe = `${styles.item} ${CLASSE_CARD[e]}`;

  if (cardInteiro) {
    return (
      <button
        type="button"
        className={`${classe} ${styles.inteiro}`}
        aria-label={nomeAcessivel}
        onClick={onToque}
      >
        {esquerda}
        <span className={styles.corpo}>{corpo}</span>
        {direita}
      </button>
    );
  }
  return (
    <div className={classe}>
      {esquerda}
      <button type="button" className={styles.corpo} aria-label={nomeAcessivel} onClick={onToque}>
        {corpo}
      </button>
      {direita}
    </div>
  );
}

/** Marcador sem ação (pendência nas Tarefas): círculo vazio ou check feito. */
export function MarcadorAcao({ feita }: { feita: boolean }) {
  return (
    <span className={`${styles.marcador} ${feita ? styles.marcadorFeito : ''}`} aria-hidden="true">
      {feita ? <Icon name="checkGrosso" size={20} strokeWidth={2.6} /> : null}
    </span>
  );
}
