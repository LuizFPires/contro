import { useState } from 'react';
import { BottomSheet, Button, Input } from '@contro/ui';
import { Camera } from './Camera';
import type { NovaPendencia } from './campo';
import styles from './AdiarSheet.module.css';

const CRITS: { valor: 'alta' | 'media' | 'baixa'; rotulo: string }[] = [
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'baixa', rotulo: 'Baixa' },
];

export function ApontarSheet({
  aberto,
  atividades,
  onFechar,
  onApontar,
  pendente,
}: {
  aberto: boolean;
  atividades: { id: string; nome: string }[];
  onFechar: () => void;
  onApontar: (dados: NovaPendencia, file: File) => void;
  pendente?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [local, setLocal] = useState('');
  const [criticidade, setCriticidade] = useState<'alta' | 'media' | 'baixa'>('media');
  const [atividadeId, setAtividadeId] = useState('');

  function fechar() {
    setFile(null);
    setTitulo('');
    setLocal('');
    setCriticidade('media');
    setAtividadeId('');
    onFechar();
  }

  if (!aberto) return null;

  // Passo 1: foto primeiro.
  if (!file) {
    return <Camera titulo="Apontar pendência" onCapturar={setFile} onCancelar={fechar} />;
  }

  // Passo 2: descrição.
  return (
    <BottomSheet open title="Nova pendência" onClose={fechar}>
      <div className={styles.rodape} style={{ marginTop: 0 }}>
        <Input label="O que" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <Input label="Local" value={local} onChange={(e) => setLocal(e.target.value)} />
      </div>

      <p className={styles.rotulo}>Criticidade</p>
      <div className={styles.pills}>
        {CRITS.map((c) => (
          <button
            key={c.valor}
            type="button"
            className={`${styles.pill} ${criticidade === c.valor ? styles.ativo : ''}`}
            onClick={() => setCriticidade(c.valor)}
          >
            {c.rotulo}
          </button>
        ))}
      </div>

      {atividades.length > 0 ? (
        <>
          <p className={styles.rotulo}>Atividade (opcional)</p>
          <select
            className={styles.data}
            style={{ width: '100%' }}
            value={atividadeId}
            onChange={(e) => setAtividadeId(e.target.value)}
            aria-label="Atividade relacionada"
          >
            <option value="">—</option>
            {atividades.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <div className={styles.rodape}>
        <Button
          full
          disabled={!titulo.trim() || pendente}
          onClick={() =>
            onApontar(
              {
                titulo: titulo.trim(),
                local: local.trim() || null,
                criticidade,
                atividadeId: atividadeId || null,
              },
              file,
            )
          }
        >
          {pendente ? 'Enviando…' : 'Apontar'}
        </Button>
      </div>
    </BottomSheet>
  );
}
