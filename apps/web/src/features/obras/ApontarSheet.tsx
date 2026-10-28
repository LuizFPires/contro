import { useEffect, useState } from 'react';
import { BottomSheet, Button, Input } from '@contro/ui';
import { AtividadePicker } from './AtividadePicker';
import { Camera } from './Camera';
import type { NovaPendencia } from './campo';
import type { ObraCompleta } from './detalhe';
import styles from './AdiarSheet.module.css';

const CRITS: { valor: 'alta' | 'media' | 'baixa'; rotulo: string }[] = [
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'baixa', rotulo: 'Baixa' },
];

const VAZIA: NovaPendencia = { titulo: '', local: '', criticidade: 'media', atividadeId: null };

/** Campos da pendência (o que, local, criticidade, atividade): apontar e editar. */
function PendenciaCampos({
  obra,
  dados,
  onMudar,
}: {
  obra: ObraCompleta;
  dados: NovaPendencia;
  onMudar: (d: NovaPendencia) => void;
}) {
  return (
    <>
      <div className={styles.rodape} style={{ marginTop: 0 }}>
        <Input
          label="O que"
          value={dados.titulo}
          onChange={(e) => onMudar({ ...dados, titulo: e.target.value })}
        />
        <Input
          label="Local"
          value={dados.local ?? ''}
          onChange={(e) => onMudar({ ...dados, local: e.target.value })}
        />
      </div>

      <p className={styles.rotulo}>Criticidade</p>
      <div className={styles.pills}>
        {CRITS.map((c) => (
          <button
            key={c.valor}
            type="button"
            className={`${styles.pill} ${dados.criticidade === c.valor ? styles.ativo : ''}`}
            onClick={() => onMudar({ ...dados, criticidade: c.valor })}
          >
            {c.rotulo}
          </button>
        ))}
      </div>

      <p className={styles.rotulo}>Atividade (opcional)</p>
      <AtividadePicker
        obra={obra}
        valor={dados.atividadeId}
        onMudar={(atividadeId) => onMudar({ ...dados, atividadeId })}
      />
    </>
  );
}

/** Limpa os textos antes de gravar (local vazio = sem local). */
function limpar(d: NovaPendencia): NovaPendencia {
  return { ...d, titulo: d.titulo.trim(), local: d.local?.trim() || null };
}

export function ApontarSheet({
  aberto,
  obra,
  onFechar,
  onApontar,
  pendente,
}: {
  aberto: boolean;
  obra: ObraCompleta;
  onFechar: () => void;
  onApontar: (dados: NovaPendencia, file: File) => void;
  pendente?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dados, setDados] = useState<NovaPendencia>(VAZIA);
  // Cada apontamento começa do zero (foto e campos), mesmo depois de um envio.
  useEffect(() => {
    if (aberto) {
      setFile(null);
      setDados(VAZIA);
    }
  }, [aberto]);

  function fechar() {
    setFile(null);
    setDados(VAZIA);
    onFechar();
  }

  if (!aberto) return null;

  // Passo 1: foto primeiro.
  if (!file) {
    return (
      <Camera
        kicker="Novo apontamento"
        titulo="Fotografe o problema"
        dica="Depois da foto você descreve, marca o local e a atividade responsável."
        onCapturar={setFile}
        onCancelar={fechar}
      />
    );
  }

  // Passo 2: descrição.
  return (
    <BottomSheet open title="Nova pendência" onClose={fechar}>
      <PendenciaCampos obra={obra} dados={dados} onMudar={setDados} />
      <div className={styles.rodape}>
        <Button
          full
          disabled={!dados.titulo.trim() || pendente}
          onClick={() => onApontar(limpar(dados), file)}
        >
          {pendente ? 'Enviando…' : 'Apontar'}
        </Button>
      </div>
    </BottomSheet>
  );
}

/** Editar pendência da lista completa (texto, local, criticidade, atividade). */
export function EditarPendenciaSheet({
  obra,
  inicial,
  onFechar,
  onSalvar,
}: {
  obra: ObraCompleta;
  /** Pendência em edição (null = fechado). */
  inicial: NovaPendencia | null;
  onFechar: () => void;
  onSalvar: (dados: NovaPendencia) => void;
}) {
  const [dados, setDados] = useState<NovaPendencia>(inicial ?? VAZIA);
  useEffect(() => {
    if (inicial) setDados(inicial);
  }, [inicial]);

  return (
    <BottomSheet open={Boolean(inicial)} title="Editar pendência" onClose={onFechar}>
      {inicial ? (
        <>
          <PendenciaCampos obra={obra} dados={dados} onMudar={setDados} />
          <div className={styles.rodape}>
            <Button full disabled={!dados.titulo.trim()} onClick={() => onSalvar(limpar(dados))}>
              Salvar
            </Button>
          </div>
        </>
      ) : null}
    </BottomSheet>
  );
}
