import { useEffect, useState } from 'react';
import { gradeDoMes, somarMeses } from '@contro/core';
import { Icon } from '@contro/ui';
import { formatarDataCurta } from '../lib/datas';
import styles from './EscolherData.module.css';

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

const anoMes = (iso: string) => ({ ano: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) });

/**
 * Data com sugestões em chips e "Outra data", que abre o mês inteiro (pedido do
 * usuário, 29/10/2026): providência, remarcar e prazo de tarefa. Sábado e
 * domingo ficam em cinza (fora do cronograma), mas podem ser escolhidos.
 */
export function EscolherData({
  valor,
  onEscolher,
  sugestoes,
  min,
  hoje,
  rotulo,
}: {
  valor: string;
  onEscolher: (iso: string) => void;
  /** Chips rápidos; o rótulo padrão é a data curta ("qua 04/11"). */
  sugestoes: { valor: string; rotulo?: string }[];
  /** Antes disso não dá para escolher (ex.: hoje). */
  min?: string;
  hoje: string;
  rotulo: string;
}) {
  const naSugestao = sugestoes.some((s) => s.valor === valor);
  const [aberto, setAberto] = useState(Boolean(valor) && !naSugestao);
  const [mes, setMes] = useState(() => anoMes(valor || min || hoje));
  // Valor que chega de fora (abrir para remarcar) fora das sugestões: mostra o mês dele.
  useEffect(() => {
    if (valor && !naSugestao) {
      setAberto(true);
      setMes(anoMes(valor));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  const grade = gradeDoMes(mes.ano, mes.mes);
  const outra = !naSugestao && Boolean(valor);

  return (
    <div className={styles.caixa}>
      <div className={styles.chips} role="group" aria-label={rotulo}>
        {sugestoes.map((s) => {
          const on = s.valor === valor;
          return (
            <button
              key={s.valor}
              type="button"
              aria-pressed={on}
              className={`${styles.chip} ${on ? styles.on : ''}`}
              onClick={() => {
                setAberto(false);
                onEscolher(s.valor);
              }}
            >
              {s.rotulo ?? formatarDataCurta(s.valor)}
            </button>
          );
        })}
        <button
          type="button"
          aria-expanded={aberto}
          aria-pressed={outra}
          className={`${styles.chip} ${outra || aberto ? styles.on : ''}`}
          onClick={() => {
            setMes(anoMes(valor || min || hoje));
            setAberto(!aberto);
          }}
        >
          <Icon name="calendario" size={16} />
          {outra ? formatarDataCurta(valor) : 'Outra data'}
        </button>
      </div>

      {aberto ? (
        <div className={styles.cal}>
          <div className={styles.mesTopo}>
            <button
              type="button"
              className={styles.seta}
              aria-label="Mês anterior"
              onClick={() => setMes(somarMeses(mes.ano, mes.mes, -1))}
            >
              <Icon name="chevronLeft" size={20} />
            </button>
            <span className={styles.mesNome} aria-live="polite">
              {MESES[mes.mes - 1]} de {mes.ano}
            </span>
            <button
              type="button"
              className={styles.seta}
              aria-label="Próximo mês"
              onClick={() => setMes(somarMeses(mes.ano, mes.mes, 1))}
            >
              <Icon name="chevronRight" size={20} />
            </button>
          </div>
          <div
            className={styles.grade}
            role="grid"
            aria-label={`${MESES[mes.mes - 1]} de ${mes.ano}`}
          >
            {SEMANA.map((d) => (
              <span key={d} className={styles.diaSemana} aria-hidden="true">
                {d}
              </span>
            ))}
            {grade.flat().map((d) => {
              const desab = Boolean(min && d.data < min);
              const on = d.data === valor;
              const cls = [
                styles.dia,
                !d.doMes ? styles.fora : '',
                d.fimDeSemana ? styles.fds : '',
                d.data === hoje ? styles.hoje : '',
                on ? styles.diaOn : '',
              ].join(' ');
              return (
                <button
                  key={d.data}
                  type="button"
                  className={cls}
                  disabled={desab}
                  aria-pressed={on}
                  aria-label={formatarDataCurta(d.data)}
                  onClick={() => onEscolher(d.data)}
                >
                  {Number(d.data.slice(8, 10))}
                </button>
              );
            })}
          </div>
          <p className={styles.dica}>Sábado e domingo ficam fora do cronograma.</p>
        </div>
      ) : null}
    </div>
  );
}
