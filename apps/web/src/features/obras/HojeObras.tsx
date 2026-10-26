import { useState } from 'react';
import { resumoDoDia, ritmoTexto, type ItemDia, type TipoItemDia } from '@contro/core';
import { Icon } from '@contro/ui';
import { formatarDataCompleta, formatarDataCurta } from '../../lib/datas';
import { hojeISO, type ObraResumo } from './api';
import styles from './HojeObras.module.css';

const ROTULO: Record<TipoItemDia, string> = {
  concluir: 'Concluir',
  comecar: 'Começar',
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
  tarefa: 'Tarefa',
};

function detalhe(i: ItemDia): string {
  const quem = i.pessoa ?? 'sem responsável';
  if (i.atraso) {
    if (i.tipo === 'concluir') return `devia terminar ${formatarDataCurta(i.data)}`;
    if (i.tipo === 'tarefa') return `${quem} · venceu ${formatarDataCurta(i.data)}`;
    return `era para providenciar até ${formatarDataCurta(i.data)}`;
  }
  if (i.tipo === 'concluir') return 'previsto concluir hoje';
  if (i.tipo === 'comecar') return 'previsto começar hoje';
  if (i.tipo === 'tarefa') return `${quem} · até hoje`;
  return 'providenciar até hoje';
}

/**
 * "Hoje" na tela inicial (opção A): um card por obra, recolhível, com o que está
 * atrasado (em vermelho, no topo) e o que é para hoje.
 */
export function HojeObras({
  obras,
  onAbrirObra,
  onAbrirTarefas,
  onAbrirPlano,
}: {
  obras: ObraResumo[];
  onAbrirObra: (id: string) => void;
  onAbrirTarefas: () => void;
  /** Abre a obra direto no plano de recuperação. */
  onAbrirPlano: (id: string) => void;
}) {
  const comAlgo = obras.filter(
    (o) => o.risco || o.agenda.atrasados.length + o.agenda.hoje.length > 0,
  );
  // Aberto por padrão só quem tem atraso; o resto começa recolhido.
  // Todas começam recolhidas: o resumo no cabeçalho do card já avisa o atraso.
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
    <section className={styles.hoje} aria-labelledby="hoje-titulo">
      <h2 id="hoje-titulo" className={styles.titulo}>
        Hoje · {data}
      </h2>
      <p className={nAtrasos ? styles.resumoAtraso : styles.resumo}>
        {resumoDoDia(obras.map((o) => o.agenda))}
      </p>

      {comAlgo.map((o) => {
        const aberta = abertas.has(o.id);
        const ritmo = ritmoTexto(o.ritmoDias, true);
        const { atrasados, hoje } = o.agenda;
        const painel = `hoje-${o.id}`;
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
                  <span className={ritmo.atrasada ? styles.ritmoAtraso : styles.ritmo}>
                    {ritmo.atrasada ? <Icon name="relogio" size={14} strokeWidth={2.4} /> : null}
                    {ritmo.texto}
                  </span>
                </span>
                <span className={styles.contagem}>
                  {o.faseAtual ? `Fase ${o.faseAtualN} · ${o.faseAtual} · ` : ''}
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
                {o.risco ? (
                  <button type="button" className={styles.risco} onClick={() => onAbrirPlano(o.id)}>
                    <Icon name="relogio" size={16} strokeWidth={2.4} className={styles.txtAtraso} />
                    <span className={styles.riscoTexto}>
                      <b className={styles.txtAtraso}>
                        Inauguração em risco · +{o.risco.atrasoDu} d.u.
                      </b>
                      <span>
                        {formatarDataCurta(o.risco.original)} →{' '}
                        {formatarDataCurta(o.risco.prevista)}
                      </span>
                    </span>
                    <span className={styles.riscoLink}>Ver plano</span>
                  </button>
                ) : null}
                {atrasados.length ? (
                  <>
                    <div className={styles.faixaAtraso}>
                      <Icon name="relogio" size={14} strokeWidth={2.4} />
                      Atrasado · {atrasados.length}
                    </div>
                    {atrasados.map((i) => (
                      <Linha
                        key={i.chave}
                        i={i}
                        onClick={() => (i.tipo === 'tarefa' ? onAbrirTarefas() : onAbrirObra(o.id))}
                      />
                    ))}
                  </>
                ) : null}
                {hoje.length ? (
                  <>
                    <div className={styles.faixa}>Para hoje · {hoje.length}</div>
                    {hoje.map((i) => (
                      <Linha
                        key={i.chave}
                        i={i}
                        onClick={() => (i.tipo === 'tarefa' ? onAbrirTarefas() : onAbrirObra(o.id))}
                      />
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
        <span className={i.atraso ? styles.tipoAtraso : styles.tipo}>{ROTULO[i.tipo]}</span>
        <b className={i.atraso ? styles.txtAtraso : undefined}>{i.nome}</b>
        <span className={i.atraso ? styles.detalheAtraso : styles.detalhe}>
          {i.atraso ? <Icon name="relogio" size={13} strokeWidth={2.4} /> : null}
          {detalhe(i)}
        </span>
      </span>
      <Icon name="chevronRight" size={18} className={styles.seta} />
    </button>
  );
}
