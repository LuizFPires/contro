import { useMemo } from 'react';
import { PRAZOS_PENDENCIA_PADRAO } from '@contro/core';
import { Icon } from '@contro/ui';
import { hojeISO } from '../../obras/api';
import { BoletimTela } from '../../obras/BoletimTela';
import { usePendenciasDasObras } from '../../obras/useObraPendencias';
import { useTarefasDasObras } from '../../obras/useObraTarefas';
import { useConfigAvisosObra } from '../reuniao/useConfigAvisosObra';
import { useObraGeral } from '../useObraGeral';
import { boletimDaObraGeral } from './boletimGeral';
import styles from '../../boletim-auto/ConfigBoletimScreen.module.css';

/** Boletim da semana de uma obra geral (WhatsApp e PDF), aberto pelo ícone da obra ou pelo aviso. */
export function BoletimGeralScreen({ obraId, onVoltar }: { obraId: string; onVoltar: () => void }) {
  const { data: obra, isLoading, isError, refetch } = useObraGeral(obraId);
  const { tarefas } = useTarefasDasObras([obraId]);
  const { pendencias } = usePendenciasDasObras([obraId]);
  const avisos = useConfigAvisosObra(obraId);
  const { pendAltaDu, pendMediaDu, pendBaixaDu } = avisos.config;
  const prazos = useMemo(
    () =>
      avisos.query.isSuccess
        ? { alta: pendAltaDu, media: pendMediaDu, baixa: pendBaixaDu }
        : PRAZOS_PENDENCIA_PADRAO,
    [avisos.query.isSuccess, pendAltaDu, pendMediaDu, pendBaixaDu],
  );

  const dados = useMemo(
    () =>
      obra
        ? boletimDaObraGeral({
            obra,
            atividades: obra.atividades,
            nomes: Object.fromEntries(obra.pessoas.map((p) => [p.id, p.nome])),
            tarefas,
            pendencias,
            prazosPendencia: prazos,
            hoje: hojeISO(),
          })
        : null,
    [obra, tarefas, pendencias, prazos],
  );

  return (
    <div className={styles.screen}>
      <div className={styles.barra}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronRight" size={22} />
        </button>
        <span className={styles.titulo}>Boletim da obra</span>
      </div>
      {dados ? (
        <BoletimTela dados={dados} />
      ) : isError ? (
        <p className={styles.carregando}>
          Sem conexão.{' '}
          <button type="button" onClick={() => void refetch()}>
            Tentar de novo
          </button>
        </p>
      ) : isLoading ? (
        <p className={styles.carregando}>Carregando…</p>
      ) : (
        <p className={styles.carregando}>Obra não encontrada.</p>
      )}
    </div>
  );
}
