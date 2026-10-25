import { useMemo, useState } from 'react';
import { Icon, useToast } from '@obdc/ui';
import { formatarDataCompleta } from '../../lib/datas';
import { useObraDetalhe } from './useObraDetalhe';
import type { ObraAtv, ObraCompleta } from './detalhe';
import styles from './ObraDetalhe.module.css';

type FaseEstado = 'concluida' | 'execucao' | 'planejada' | 'atraso';
const ESTADO_ROTULO: Record<FaseEstado, string> = {
  concluida: 'Concluída',
  execucao: 'Em execução',
  planejada: 'Planejada',
  atraso: 'Com atraso',
};

export function ObraDetalhe({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const { data: obra, isLoading } = useObraDetalhe(id);
  const { showToast } = useToast();
  const [faseAberta, setFaseAberta] = useState<string | null>(null);

  const dados = useMemo(() => (obra ? derivar(obra) : null), [obra]);

  if (isLoading || !obra || !dados) {
    return (
      <div className={styles.screen}>
        <div className={styles.cabecalho}>
          <div className={styles.topo}>
            <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
              <Icon name="chevronRight" size={24} />
            </button>
            <span className={styles.dia}>Carregando…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.cabecalho}>
        <div className={styles.topo}>
          <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
            <Icon name="chevronRight" size={24} />
          </button>
          <h1 className={styles.nome}>{obra.nome}</h1>
          <button
            type="button"
            className={styles.boletim}
            aria-label="Boletim"
            onClick={() => showToast({ message: 'Boletim chega no M8.' })}
          >
            <Icon name="boletim" size={22} />
          </button>
        </div>
        <div className={styles.linhaDia}>
          <span className={styles.dia}>
            Dia {obra.dia.n} de {obra.dia.m}
          </span>
          <span className={styles.pct}>{Math.round(obra.pct * 100)}%</span>
        </div>
        <div className={styles.barra}>
          <div className={styles.barraFill} style={{ width: `${Math.round(obra.pct * 100)}%` }} />
        </div>
      </div>

      <div className={styles.trilha}>
        {obra.fases.map((f) => {
          const est = dados.faseEstado[f.id] ?? 'planejada';
          const aberta = faseAberta === f.id;
          const atvs = dados.topPorFase[f.id] ?? [];
          return (
            <div key={f.id}>
              <button
                type="button"
                className={styles.faseBtn}
                aria-expanded={aberta}
                onClick={() => setFaseAberta((x) => (x === f.id ? null : f.id))}
              >
                <span className={`${styles.faseIcone} ${styles[est]}`}>
                  {est === 'concluida' ? (
                    <Icon name="check" size={18} />
                  ) : est === 'atraso' ? (
                    <Icon name="alert" size={16} />
                  ) : (
                    <span style={{ fontWeight: 800 }}>{f.ordem}</span>
                  )}
                </span>
                <span className={styles.faseInfo}>
                  <span className={styles.faseTitulo}>{f.titulo}</span>
                  <br />
                  <span className={styles.faseEstado}>{ESTADO_ROTULO[est]}</span>
                </span>
                <Icon name={aberta ? 'chevronDown' : 'chevronRight'} size={20} />
              </button>
              {aberta ? (
                <div className={styles.atividades}>
                  {atvs.map((a) => {
                    const info = dados.atvInfo[a.id];
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={styles.atv}
                        onClick={() => showToast({ message: `Ficha de "${a.nome}" chega já.` })}
                      >
                        {info.concluida ? (
                          <Icon name="check" size={18} />
                        ) : info.atrasada ? (
                          <Icon name="alert" size={16} />
                        ) : (
                          <span style={{ width: 18 }} />
                        )}
                        <span
                          className={`${styles.atvNome} ${
                            info.concluida
                              ? styles.atvConcluida
                              : info.atrasada
                                ? styles.atvAtrasada
                                : ''
                          }`}
                        >
                          {a.nome}
                        </span>
                        {info.motivo ? <span className={styles.motivo}>{info.motivo}</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className={styles.inauguracao}>
        <strong>Inauguração</strong>
        <span>{formatarDataCompleta(obra.entrega)}</span>
      </div>
    </div>
  );
}

interface AtvInfo {
  concluida: boolean;
  atrasada: boolean;
  motivo: string | null;
}

function derivar(obra: ObraCompleta): {
  faseEstado: Record<string, FaseEstado>;
  topPorFase: Record<string, ObraAtv[]>;
  atvInfo: Record<string, AtvInfo>;
} {
  const nomePorId = new Map(obra.atividades.map((a) => [a.id, a.nome]));
  const topo = obra.atividades.filter((a) => !a.pai_id);
  const concluidas = new Set(topo.filter((a) => a.concluida_em).map((a) => a.id));

  const topPorFase: Record<string, ObraAtv[]> = {};
  for (const a of topo) (topPorFase[a.fase_id] ??= []).push(a);

  // fase atual = menor fase com atividade não concluída
  let faseAtualId: string | null = null;
  for (const f of obra.fases) {
    if ((topPorFase[f.id] ?? []).some((a) => !concluidas.has(a.id))) {
      faseAtualId = f.id;
      break;
    }
  }

  const atvInfo: Record<string, AtvInfo> = {};
  for (const a of topo) {
    const e = obra.estados[a.id];
    let motivo: string | null = null;
    if (!a.concluida_em && e) {
      if (!e.predsOk) {
        const pend = a.predecessoras
          .filter((p) => !concluidas.has(p))
          .map((p) => nomePorId.get(p))
          .filter(Boolean);
        motivo = pend.length ? `aguarda ${pend.join(', ')}` : null;
      } else if (!e.provOk) {
        motivo = 'aguarda providências';
      }
    }
    atvInfo[a.id] = {
      concluida: Boolean(a.concluida_em),
      atrasada: Boolean(e?.atrasada),
      motivo,
    };
  }

  const faseEstado: Record<string, FaseEstado> = {};
  for (const f of obra.fases) {
    const atvs = topPorFase[f.id] ?? [];
    const todas = atvs.length > 0 && atvs.every((a) => concluidas.has(a.id));
    const temAtraso = atvs.some((a) => obra.estados[a.id]?.atrasada);
    faseEstado[f.id] = todas
      ? 'concluida'
      : temAtraso
        ? 'atraso'
        : f.id === faseAtualId
          ? 'execucao'
          : 'planejada';
  }

  return { faseEstado, topPorFase, atvInfo };
}
