import { useEffect, useState } from 'react';
import {
  diaCurto,
  MOTIVO_DATA_MAX,
  mudancaDeDataPedeMotivo,
  normalizarMotivoData,
} from '@contro/core';
import { BottomSheet, Button, TextoCrescente } from '@contro/ui';
import { EscolherData } from '../../components/EscolherData';
import styles from './MudarDataSheet.module.css';

/**
 * Folha de data da atividade da obra geral (início ou término previsto). Data
 * nova em item sem data: salva no toque. Replanejar (item aberto que já tinha
 * data): segundo passo "de X para Y" com o motivo da mudança, que vai para a
 * Vida da atividade e o Log (pedido do usuário, 24/11/2026).
 */
export function MudarDataSheet({
  aberto,
  titulo,
  rotulo,
  valor,
  concluida,
  hoje,
  sugestoes,
  min,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  titulo: string;
  rotulo: string;
  valor: string | null;
  concluida: boolean;
  hoje: string;
  sugestoes: { valor: string; rotulo?: string }[];
  min?: string;
  onFechar: () => void;
  onSalvar: (data: string, motivo: string | null) => void;
}) {
  const [nova, setNova] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!aberto) {
      setNova(null);
      setMotivo('');
    }
  }, [aberto]);

  return (
    <BottomSheet open={aberto} title={titulo} onClose={onFechar}>
      {nova === null ? (
        <EscolherData
          valor={valor ?? ''}
          onEscolher={(d) => {
            if (d === valor) return onFechar();
            if (mudancaDeDataPedeMotivo({ concluida, atual: valor, nova: d })) setNova(d);
            else onSalvar(d, null);
          }}
          sugestoes={sugestoes}
          min={min}
          hoje={hoje}
          rotulo={rotulo}
        />
      ) : (
        <div className={styles.passo}>
          <p className={styles.dePara}>
            De <b>{valor ? diaCurto(valor) : 'sem data'}</b> para <b>{diaCurto(nova)}</b>
          </p>
          <TextoCrescente
            label="Motivo da mudança"
            placeholder="Ex.: choveu, não deu para trabalhar"
            maxLength={MOTIVO_DATA_MAX}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            autoFocus
          />
          <p className={styles.dica}>Fica na vida da atividade e no Log.</p>
          <Button type="button" full onClick={() => onSalvar(nova, normalizarMotivoData(motivo))}>
            Salvar
          </Button>
          <Button type="button" variant="tertiary" full onClick={() => setNova(null)}>
            Escolher outra data
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
