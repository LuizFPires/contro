import { useMemo } from 'react';
import { duEntre, providenciaAtrasada, providenciarAte } from '@obdc/core';
import { Card } from '@obdc/ui';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import type { ObraCompleta } from './detalhe';
import { useObraCampo } from './useObraCampo';
import styles from './ProvidenciasAba.module.css';

const TIPO: Record<string, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};

interface Item {
  id: string;
  rotulo: string;
  atividade: string;
  providenciarAte: string;
  atrasada: boolean;
}

export function ProvidenciasAba({ obra }: { obra: ObraCompleta }) {
  const campo = useObraCampo(obra.id);

  const { atrasadas, aProvidenciar, feitas } = useMemo(() => {
    const hoje = hojeISO();
    const decorridos = duEntre(obra.inicio, hoje);
    const iniciada = hoje >= obra.inicio;
    const nomePorId = new Map(obra.atividades.map((a) => [a.id, a.nome]));

    const atr: Item[] = [];
    const aprov: Item[] = [];
    let feitasN = 0;

    for (const a of obra.atividades) {
      if (a.pai_id) continue;
      const es = obra.cron.porId[a.id]?.es ?? 0;
      for (const p of a.providencias) {
        if (p.status === 'feito') {
          feitasN += 1;
          continue;
        }
        const atrasada = providenciaAtrasada({
          status: p.status,
          atividadeConcluida: Boolean(a.concluida_em),
          obraIniciada: iniciada,
          decorridos,
          esAtividade: es,
          antecedenciaDu: p.antecedencia_du,
        });
        const item: Item = {
          id: p.id,
          rotulo: `${TIPO[p.tipo]}: ${p.descricao}`,
          atividade: nomePorId.get(a.id) ?? '',
          providenciarAte: providenciarAte(obra.inicio, es, p.antecedencia_du),
          atrasada,
        };
        (atrasada ? atr : aprov).push(item);
      }
    }
    return { atrasadas: atr, aProvidenciar: aprov, feitas: feitasN };
  }, [obra]);

  const marcar = (id: string) => campo.providencia.mutate({ id, feito: true });

  return (
    <div className={styles.aba}>
      {atrasadas.length > 0 ? (
        <Card>
          <div className={styles.grupo}>
            <p className={`${styles.grupoTitulo} ${styles.atrasadoTitulo}`}>
              Atrasados ({atrasadas.length})
            </p>
            {atrasadas.map((it) => (
              <div key={it.id} className={styles.item}>
                <div className={styles.info}>
                  <div className={styles.desc}>{it.rotulo}</div>
                  <div className={styles.metaAtraso}>
                    era para providenciar até {formatarDataCurta(it.providenciarAte)} ·{' '}
                    {it.atividade}
                  </div>
                </div>
                <button type="button" className={styles.marcar} onClick={() => marcar(it.id)}>
                  Marcar
                </button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className={styles.grupo}>
          <p className={styles.grupoTitulo}>A providenciar ({aProvidenciar.length})</p>
          {aProvidenciar.length === 0 ? (
            <p className={styles.contador}>Nada pendente por aqui.</p>
          ) : (
            aProvidenciar.map((it) => (
              <div key={it.id} className={styles.item}>
                <div className={styles.info}>
                  <div className={styles.desc}>{it.rotulo}</div>
                  <div className={styles.meta}>
                    até {formatarDataCurta(it.providenciarAte)} · {it.atividade}
                  </div>
                </div>
                <button type="button" className={styles.marcar} onClick={() => marcar(it.id)}>
                  Marcar
                </button>
              </div>
            ))
          )}
        </div>
      </Card>

      <p className={styles.contador}>{feitas} já providenciados</p>
    </div>
  );
}
