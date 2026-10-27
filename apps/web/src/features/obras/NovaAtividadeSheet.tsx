import { useEffect, useMemo, useState } from 'react';
import { BottomSheet, Button, Input, useToast } from '@contro/ui';
import { AvisoRascunho } from '../../components/AvisoRascunho';
import { useRascunho } from '../../lib/useRascunho';
import type { ObraCompleta } from './detalhe';
import { numeracaoObra } from './numeracaoObra';
import { useObraCampo } from './useObraCampo';
import styles from './NovaAtividadeSheet.module.css';

const JUNTO = 'junto';

/**
 * Novo card numa fase da obra: nome, prazo e depois de quê começa. Só na obra
 * (o modelo não muda). Prazo e dependências se ajustam depois na ficha.
 */
export function NovaAtividadeSheet({
  obra,
  faseId,
  onFechar,
}: {
  obra: ObraCompleta;
  /** Fase que recebe o card; null = fechado. */
  faseId: string | null;
  onFechar: () => void;
}) {
  const campo = useObraCampo(obra.id);
  const { showToast } = useToast();
  const [nome, setNome] = useState('');
  const [dias, setDias] = useState(5);
  const [depois, setDepois] = useState(JUNTO);
  const [erro, setErro] = useState('');
  // Rascunho por fase: volta ao reabrir, mesmo se o app fechou no meio.
  const rascunho = useRascunho<{ nome: string; dias: number; depois: string }>(
    faseId ? `atividade:${obra.id}:${faseId}` : null,
  );
  const [recuperado, setRecuperado] = useState(false);
  const lido = rascunho.lido;

  useEffect(() => {
    if (faseId) {
      setNome(lido?.nome ?? '');
      setDias(lido?.dias ?? 5);
      setDepois(lido?.depois ?? JUNTO);
      setRecuperado(Boolean(lido));
      setErro('');
    }
  }, [faseId, lido]);
  const guardarRascunho = rascunho.guardar;
  useEffect(() => {
    if (faseId) guardarRascunho({ nome, dias, depois }, !nome.trim());
  }, [faseId, nome, dias, depois, guardarRascunho]);

  const num = useMemo(() => numeracaoObra(obra), [obra]);
  const fase = obra.fases.find((f) => f.id === faseId);
  const topo = obra.atividades
    .filter((a) => !a.pai_id && !a.preObra)
    .sort((a, b) => (num.get(a.id) ?? 0) - (num.get(b.id) ?? 0));
  // "Junto com a fase": as mesmas predecessoras do primeiro card da fase.
  const primeira = topo.find((a) => a.fase_id === faseId);

  function salvar() {
    const n = nome.trim().replace(/\s+/g, ' ');
    if (!n) {
      setErro('Dê um nome à atividade.');
      return;
    }
    if (!faseId) return;
    rascunho.limpar();
    const predecessoras = depois === JUNTO ? (primeira?.predecessoras ?? []) : [depois];
    campo.novaAtividade.mutate(
      { faseId, nome: n, duracaoDu: dias, predecessoras },
      {
        onSuccess: (id) =>
          showToast({
            message: `"${n}" adicionada`,
            onUndo: () => campo.excluir.mutate(id),
          }),
        onError: () => showToast({ message: 'Não foi possível adicionar a atividade' }),
      },
    );
    onFechar();
  }

  return (
    <BottomSheet
      open={Boolean(faseId)}
      title={fase ? `Nova atividade · ${fase.titulo}` : 'Nova atividade'}
      onClose={onFechar}
    >
      <div className={styles.corpo}>
        {recuperado ? (
          <AvisoRascunho
            onDescartar={() => {
              rascunho.limpar();
              setRecuperado(false);
              setNome('');
              setDias(5);
              setDepois(JUNTO);
            }}
          />
        ) : null}
        <Input
          label="Nome da atividade"
          value={nome}
          autoFocus
          placeholder="Ex.: Impermeabilização da laje"
          onChange={(e) => setNome(e.target.value)}
          error={erro || undefined}
        />

        <div>
          <div className={styles.rotulo} id="nova-atv-prazo">
            Prazo
          </div>
          <div className={styles.linha} role="group" aria-labelledby="nova-atv-prazo">
            <button
              type="button"
              className={styles.quadrado}
              aria-label="Menos um dia"
              onClick={() => setDias((d) => Math.max(1, d - 1))}
            >
              −
            </button>
            <span className={styles.dias}>{dias}</span>
            <button
              type="button"
              className={styles.quadrado}
              aria-label="Mais um dia"
              onClick={() => setDias((d) => d + 1)}
            >
              +
            </button>
            <span className={styles.miuda}>{dias === 1 ? 'dia útil' : 'dias úteis'}</span>
          </div>
        </div>

        <label className={styles.rotulo} htmlFor="nova-atv-depois">
          Começa depois de
        </label>
        <select
          id="nova-atv-depois"
          className={styles.select}
          value={depois}
          onChange={(e) => setDepois(e.target.value)}
        >
          <option value={JUNTO}>Junto com o início da fase</option>
          {topo.map((a) => (
            <option key={a.id} value={a.id}>
              #{num.get(a.id)} {a.nome}
            </option>
          ))}
        </select>
        <p className={styles.miuda}>
          Vale só para esta obra. Prazo e dependências se ajustam depois, na ficha da atividade.
        </p>

        <Button full disabled={campo.novaAtividade.isPending} onClick={salvar}>
          Adicionar
        </Button>
      </div>
    </BottomSheet>
  );
}
