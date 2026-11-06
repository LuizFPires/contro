import { useMemo } from 'react';
import { vidaDoItem, type Ambiente, type EventoBruto, type ItemLog } from '@contro/core';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from '../obras/api';
import { useVidaDoItem } from './dadosLogScore';
import { diaDe } from './formatos';
import styles from './VidaDoItem.module.css';

const TITULO: Record<ItemLog['origem'], string> = {
  tarefa: 'Vida da tarefa',
  providencia: 'Vida da tarefa',
  atividade: 'Vida da atividade',
  pendencia: 'Vida da pendência',
};

/** Linha do tempo de um item já carregado (cards do filtro Replanejadas). */
export function LinhaDoTempo({
  item,
  eventos,
  semTitulo,
  nomes,
}: {
  item: ItemLog;
  eventos: EventoBruto[];
  semTitulo?: boolean;
  /** Obras gerais: nome por id de pessoa (troca de responsável, de quem era). */
  nomes?: Record<string, string>;
}) {
  const vida = useMemo(
    () => vidaDoItem(item, eventos, hojeISO(), formatarDataCurta, nomes),
    [item, eventos, nomes],
  );
  if (vida.passos.length === 0) return null;
  return (
    <div className={styles.vida}>
      {semTitulo ? null : <h3 className={styles.titulo}>{TITULO[item.origem]}</h3>}
      <ol className={styles.passos}>
        {vida.passos.map((p, i) => (
          <li
            key={`${p.em}:${i}`}
            className={`${styles.passo} ${p.cor === 'atencao' ? styles.atencao : ''} ${
              p.cor === 'ok' ? styles.ok : ''
            } ${p.cor === 'atraso' ? styles.atraso : ''}`}
          >
            <span className={styles.rotulo}>
              {p.rotulo} · {formatarDataCurta(diaDe(p.em))}
              {p.pessoa ? ` · ${p.pessoa}` : ''}
            </span>
            {p.detalhe ? <span className={styles.detalhe}>{p.detalhe}</span> : null}
          </li>
        ))}
      </ol>
      <p className={styles.resumo}>{vida.resumo}</p>
    </div>
  );
}

/**
 * Bloco "Vida do item" nas fichas (tarefa, atividade, pendência): criada →
 * replanejada 1x (de → para, motivo) → … → concluída, e o resumo. Lê os
 * eventos dos últimos 90 dias (consulta do Log do ambiente, em cache). Telas
 * das obras gerais passam `ambiente="geral"`.
 */
export function VidaDoItem({
  itemId,
  ambiente = 'contorno',
}: {
  itemId: string;
  ambiente?: Ambiente;
}) {
  const { item, eventos, nomes } = useVidaDoItem(itemId, ambiente);
  if (!item) return null;
  return <LinhaDoTempo item={item} eventos={eventos} nomes={nomes} />;
}
