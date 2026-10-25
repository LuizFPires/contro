import { useState } from 'react';
import { BottomSheet, Button } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import styles from './AdiarSheet.module.css';

const MOTIVOS = ['Aguardando material', 'Aguardando outra equipe', 'Local sem acesso', 'Outro'];

function emDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function AdiarSheet({
  aberto,
  onFechar,
  onConfirmar,
  pendente,
}: {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (data: string, motivo: string) => void;
  pendente?: boolean;
}) {
  const [data, setData] = useState<string>(emDias(1));
  const [motivo, setMotivo] = useState<string>(MOTIVOS[0]);

  const opcoesData = [
    { rotulo: 'Amanhã', valor: emDias(1) },
    { rotulo: 'Em 3 dias', valor: emDias(3) },
    { rotulo: 'Em 1 semana', valor: emDias(7) },
  ];

  return (
    <BottomSheet open={aberto} title="Adiar pendência" onClose={onFechar}>
      <p className={styles.rotulo}>Voltar à fila em</p>
      <div className={styles.pills}>
        {opcoesData.map((o) => (
          <button
            key={o.valor}
            type="button"
            className={`${styles.pill} ${data === o.valor ? styles.ativo : ''}`}
            onClick={() => setData(o.valor)}
          >
            {o.rotulo}
          </button>
        ))}
        <input
          type="date"
          className={styles.data}
          value={data}
          min={emDias(1)}
          onChange={(e) => setData(e.target.value)}
          aria-label="Escolher data de retorno"
        />
      </div>

      <p className={styles.rotulo}>Motivo</p>
      <div className={styles.pills}>
        {MOTIVOS.map((m) => (
          <button
            key={m}
            type="button"
            className={`${styles.pill} ${motivo === m ? styles.ativo : ''}`}
            onClick={() => setMotivo(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div className={styles.rodape}>
        <span className={styles.resumo}>Volta em {formatarDataCurta(data)}</span>
        <Button full disabled={pendente} onClick={() => onConfirmar(data, motivo)}>
          {pendente ? 'Adiando…' : 'Adiar'}
        </Button>
      </div>
    </BottomSheet>
  );
}
