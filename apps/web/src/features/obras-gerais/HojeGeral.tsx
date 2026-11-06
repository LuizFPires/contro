import { useState } from 'react';
import { detalheItemGeral, resumoDoDia, type AgendaObra, type ItemDia } from '@contro/core';
import { Icon } from '@contro/ui';
import { formatarDataCompleta } from '../../lib/datas';
import { hojeISO } from '../obras/api';
import styles from '../obras/HojeObras.module.css';

/** O mínimo de cada obra que o Hoje das obras gerais mostra. */
export interface ObraDoHoje {
  id: string;
  nome: string;
  agenda: AgendaObra;
}

/** Id da atividade de uma linha do Hoje geral (chave `geral:{id}`). */
function atividadeDaLinha(i: ItemDia): string {
  return i.chave.replace(/^geral:/, '');
}

/**
 * "Hoje" das obras gerais (mockups A3, A14, C0, J0): igual ao da Contorno, um card
 * por obra, recolhido, com o que está atrasado e o que é para hoje. Tocar numa linha
 * abre a obra na ficha da atividade.
 */
export function HojeGeral({
  obras,
  onAbrirAtividade,
}: {
  obras: ObraDoHoje[];
  onAbrirAtividade: (obraId: string, atividadeId: string) => void;
}) {
  const comAlgo = obras.filter((o) => o.agenda.atrasados.length + o.agenda.hoje.length > 0);
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set());
  const alternar = (id: string) =>
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const nAtrasos = obras.reduce((s, o) => s + o.agenda.atrasados.length, 0);
  const data = formatarDataCompleta(hojeISO()).replace(/\/\d{4}$/, '');

  return (
    <section className={styles.hoje} aria-labelledby="hoje-geral-titulo">
      <h2 id="hoje-geral-titulo" className={styles.titulo}>
        Hoje · {data}
      </h2>
      <p className={nAtrasos ? styles.resumoAtraso : styles.resumo}>
        {resumoDoDia(obras.map((o) => o.agenda))}
      </p>

      {comAlgo.map((o) => {
        const aberta = abertas.has(o.id);
        const { atrasados, hoje } = o.agenda;
        const painel = `hoje-geral-${o.id}`;
        const abrir = (i: ItemDia) => onAbrirAtividade(o.id, atividadeDaLinha(i));
        return (
          <div key={o.id} className={`${styles.card} ${atrasados.length ? styles.cardAtraso : ''}`}>
            <button
              type="button"
              className={styles.cabeca}
              aria-expanded={aberta}
              aria-controls={painel}
              onClick={() => alternar(o.id)}
            >
              <span className={styles.cabecaTexto}>
                <span className={styles.nomeLinha}>
                  <b className={styles.nome}>{o.nome}</b>
                </span>
                <span className={styles.contagem}>
                  {atrasados.length ? (
                    <span className={styles.txtAtraso}>
                      {atrasados.length} {atrasados.length === 1 ? 'atrasado' : 'atrasados'}
                    </span>
                  ) : null}
                  {atrasados.length && hoje.length ? ' · ' : ''}
                  {hoje.length ? `${hoje.length} para hoje` : ''}
                </span>
              </span>
              <Icon name={aberta ? 'chevronDown' : 'chevronRight'} size={20} />
            </button>

            {aberta ? (
              <div id={painel} className={styles.corpo}>
                {atrasados.length ? (
                  <>
                    <div className={styles.faixaAtraso}>
                      <Icon name="relogio" size={14} strokeWidth={2.4} />
                      Atrasado · {atrasados.length}
                    </div>
                    {atrasados.map((i) => (
                      <Linha key={i.chave} i={i} onClick={() => abrir(i)} />
                    ))}
                  </>
                ) : null}
                {hoje.length ? (
                  <>
                    <div className={styles.faixa}>Para hoje · {hoje.length}</div>
                    {hoje.map((i) => (
                      <Linha key={i.chave} i={i} onClick={() => abrir(i)} />
                    ))}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function Linha({ i, onClick }: { i: ItemDia; onClick: () => void }) {
  return (
    <button type="button" className={styles.linha} onClick={onClick}>
      <span className={styles.linhaTexto}>
        <span className={i.atraso ? styles.tipoAtraso : styles.tipo}>Concluir</span>
        <b className={i.atraso ? styles.txtAtraso : undefined}>{i.nome}</b>
        <span className={i.atraso ? styles.detalheAtraso : styles.detalhe}>
          {i.atraso ? <Icon name="relogio" size={13} strokeWidth={2.4} /> : null}
          {detalheItemGeral(i)}
        </span>
      </span>
      <Icon name="chevronRight" size={18} className={styles.seta} />
    </button>
  );
}
