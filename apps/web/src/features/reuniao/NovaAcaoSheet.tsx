import { useEffect, useMemo, useState } from 'react';
import { BottomSheet, Button, Input } from '@contro/ui';
import type { PessoaResumo } from '../perfil/usePessoas';
import type { EntradaTarefa } from '../obras/campo';
import type { ReuniaoObraDados } from './reuniaoApi';
import styles from '../obras/AdiarSheet.module.css';

const TIPO: Record<string, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};
const VERBO: Record<string, string> = {
  contratacao: 'Contratar',
  locacao: 'Alugar',
  compra: 'Comprar',
};

interface Sugestao {
  texto: string;
  vinculoTipo: 'atividade' | 'providencia';
  vinculoId: string;
}

function emDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function NovaAcaoSheet({
  aberto,
  obra,
  pessoas,
  dataFmt,
  pendente,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  obra: ReuniaoObraDados | null;
  pessoas: PessoaResumo[];
  dataFmt: string;
  pendente?: boolean;
  onFechar: () => void;
  onSalvar: (e: EntradaTarefa) => void;
}) {
  const [texto, setTexto] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [prazo, setPrazo] = useState(emDias(5));
  const [vinculo, setVinculo] = useState<{ tipo: 'atividade' | 'providencia'; id: string } | null>(
    null,
  );

  useEffect(() => {
    if (aberto) {
      setTexto('');
      setResponsavelId('');
      setPrazo(emDias(5));
      setVinculo(null);
    }
  }, [aberto, obra]);

  const sugestoes = useMemo<Sugestao[]>(() => {
    if (!obra) return [];
    return [
      ...obra.atividadesAtrasadas.map((a) => ({
        texto: `Recuperar atraso: ${a.nome}`,
        vinculoTipo: 'atividade' as const,
        vinculoId: a.atividadeId,
      })),
      ...obra.concluir.map((a) => ({
        texto: `Garantir conclusão: ${a.nome}`,
        vinculoTipo: 'atividade' as const,
        vinculoId: a.atividadeId,
      })),
      ...obra.comecar.map((a) => ({
        texto: `Mobilizar início: ${a.nome}`,
        vinculoTipo: 'atividade' as const,
        vinculoId: a.atividadeId,
      })),
      ...obra.providenciasAtrasadas.map((p) => ({
        texto: `Destravar ${TIPO[p.tipo]}: ${p.descricao}`,
        vinculoTipo: 'providencia' as const,
        vinculoId: p.providenciaId,
      })),
      ...obra.providenciar.map((p) => ({
        texto: `${VERBO[p.tipo]}: ${p.descricao}`,
        vinculoTipo: 'providencia' as const,
        vinculoId: p.providenciaId,
      })),
    ];
  }, [obra]);

  function escolher(s: Sugestao) {
    setTexto(s.texto);
    setVinculo({ tipo: s.vinculoTipo, id: s.vinculoId });
  }

  return (
    <BottomSheet open={aberto} title="Nova providência / tarefa" onClose={onFechar}>
      {sugestoes.length > 0 ? (
        <>
          <p className={styles.rotulo}>Sugestões da obra</p>
          <div className={styles.pills}>
            {sugestoes.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.pill} ${texto === s.texto ? styles.ativo : ''}`}
                onClick={() => escolher(s)}
              >
                {s.texto}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className={styles.rodape} style={{ marginTop: 'var(--contro-space-3)' }}>
        <Input
          label="O que"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setVinculo(null);
          }}
        />
      </div>

      <p className={styles.rotulo}>Responsável</p>
      <select
        className={styles.data}
        style={{ width: '100%' }}
        value={responsavelId}
        onChange={(e) => setResponsavelId(e.target.value)}
        aria-label="Responsável"
      >
        <option value="">—</option>
        {pessoas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>

      <p className={styles.rotulo}>Prazo</p>
      <input
        type="date"
        className={styles.data}
        value={prazo}
        onChange={(e) => setPrazo(e.target.value)}
        aria-label="Prazo"
      />

      <div className={styles.rodape}>
        <Button
          full
          disabled={!texto.trim() || !prazo || pendente}
          onClick={() =>
            onSalvar({
              texto: texto.trim(),
              responsavelId: responsavelId || null,
              prazo,
              vinculoTipo: vinculo?.tipo ?? null,
              vinculoId: vinculo?.id ?? null,
              origemTexto: `Reunião ${dataFmt}`,
            })
          }
        >
          {pendente ? 'Registrando…' : 'Registrar'}
        </Button>
      </div>
    </BottomSheet>
  );
}
