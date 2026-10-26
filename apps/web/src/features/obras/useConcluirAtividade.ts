import { faseFechaCom, xpConclusao } from '@contro/core';
import type { ObraCompleta } from './detalhe';
import { useObraCampo } from './useObraCampo';

export interface ConclusaoDetalhe {
  atividadeId: string;
  nome: string;
  libera: string[];
  faseOrdem: number | null;
  faseTitulo: string;
  proxOrdem: number | null;
}

export type AoConcluir = (r: { xp: number; fase_fechada: boolean }, det: ConclusaoDetalhe) => void;

/**
 * Concluir atividade, com ou sem foto (regra 3: a foto é opcional). O fechamento de fase e o XP vêm do core
 * (espelham o servidor); usado pela ficha e pelo botão de câmera da trilha.
 */
export function useConcluirAtividade(obra: ObraCompleta) {
  const campo = useObraCampo(obra.id);

  /** Conclui com foto (`file`) ou sem foto (`null`). */
  function concluir(atividadeId: string, file: File | null, aoConcluir: AoConcluir) {
    const a = obra.atividades.find((x) => x.id === atividadeId);
    if (!a) return;
    const fase = obra.fases.find((f) => f.id === a.fase_id);
    const prox = obra.fases.find((f) => f.ordem === (fase?.ordem ?? 0) + 1);
    const libera = obra.atividades
      .filter((x) => !x.pai_id && x.predecessoras.includes(a.id))
      .map((x) => x.nome);
    const faseFechada = faseFechaCom(
      a.id,
      a.fase_id,
      obra.atividades.map((x) => ({
        id: x.id,
        paiId: x.pai_id,
        faseId: x.fase_id,
        concluida: Boolean(x.concluida_em),
      })),
    );
    campo.concluir.mutate(
      { atividadeId: a.id, file, faseFechada, xp: xpConclusao(faseFechada) },
      {
        onSuccess: (r) =>
          aoConcluir(r, {
            atividadeId: a.id,
            nome: a.nome,
            libera,
            faseOrdem: fase?.ordem ?? null,
            faseTitulo: fase?.titulo ?? '',
            proxOrdem: prox?.ordem ?? null,
          }),
      },
    );
  }

  return { concluir, pendente: campo.concluir.isPending };
}
