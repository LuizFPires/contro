import { avancoAoTocarCard, normalizarAvanco, proximoAvancoAnel } from '@contro/core';
import { useToast } from '@contro/ui';
import type { ObraCompleta } from './detalhe';
import { numeracaoObra } from './numeracaoObra';
import { useConcluirAtividade, type AoConcluir } from './useConcluirAtividade';
import { useObraCampo } from './useObraCampo';

/**
 * Avanço parcial (opção C + B do protótipo): o anel da trilha soma 25% por toque
 * e os cards da ficha marcam 25 · 50 · 75 · Pronta. 100% conclui sem foto, pelo
 * caminho de sempre (celebração, liberou, Desfazer). Toda mudança tem Desfazer.
 */
export function useAvanco(obra: ObraCompleta | null, aoConcluir: AoConcluir) {
  const campo = useObraCampo(obra?.id ?? '');
  const conclusao = useConcluirAtividade(obra);
  const { showToast } = useToast();
  const num = obra ? numeracaoObra(obra) : new Map<string, number>();

  function rotulo(id: string, nome: string) {
    const n = num.get(id);
    return n ? `#${n} ${nome}` : nome;
  }

  /** Grava o avanço parcial (0..99) com Desfazer para o valor anterior. */
  function parcial(id: string, nome: string, antes: number, depois: number) {
    campo.avanco.mutate({ atividadeId: id, pct: depois });
    showToast({
      message: `${rotulo(id, nome)} · ${depois}%`,
      onUndo: () => campo.avanco.mutate({ atividadeId: id, pct: antes }),
    });
  }

  /** Vai a `pct` a partir do estado atual (aberta ou concluída). */
  function ir(atividadeId: string, pct: number) {
    const a = obra?.atividades.find((x) => x.id === atividadeId);
    if (!a || a.mapa_antecedencia_du !== null) return;
    const atual = a.concluida_em ? 100 : normalizarAvanco(a.avanco_pct);
    if (pct === atual) return;
    if (pct === 100) {
      conclusao.concluir(a.id, null, aoConcluir);
      return;
    }
    if (!a.concluida_em) {
      parcial(a.id, a.nome, atual, pct);
      return;
    }
    // Concluída e voltou para um passo: reabre e grava o avanço, nessa ordem na fila.
    const foto = a.foto_conclusao_id;
    campo.desfazer.mutate(
      { atividadeId: a.id, xp: 50 },
      {
        onSuccess: () => {
          campo.avanco.mutate({ atividadeId: a.id, pct });
          showToast({
            message: `${rotulo(a.id, a.nome)} voltou para ${pct}%`,
            onUndo: () => campo.reconcluir.mutate({ atividadeId: a.id, fotoId: foto, xp: 50 }),
          });
        },
      },
    );
  }

  return {
    /** Toque no anel da trilha: +25%; em 75% conclui. Concluída: nada. */
    anel(atividadeId: string) {
      const a = obra?.atividades.find((x) => x.id === atividadeId);
      if (!a || a.concluida_em) return;
      ir(a.id, proximoAvancoAnel(a.avanco_pct));
    },
    /** Toque num card da ficha (25, 50, 75, 100); o mesmo card volta um passo. */
    card(atividadeId: string, card: number) {
      const a = obra?.atividades.find((x) => x.id === atividadeId);
      if (!a) return;
      ir(a.id, avancoAoTocarCard(a.concluida_em ? 100 : a.avanco_pct, card));
    },
    pendente: conclusao.pendente,
  };
}
