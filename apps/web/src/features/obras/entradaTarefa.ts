import { normalizarTextoProvidencia } from '@contro/core';
import type { EntradaTarefa } from './campo';
import type { TarefaObra } from './tarefasObra';

/** Valor do select da folha de tarefa para digitar o nome de quem não tem login. */
export const OUTRO = '__outro';

/** Campos da folha de tarefa (responsavelId: '' = ninguém, OUTRO = nome digitado). */
export interface FormTarefa {
  texto: string;
  responsavelId: string;
  nomeDigitado: string;
  prazo: string;
}

/**
 * Responsável da folha a partir da tarefa: pessoa do app pelo id; nome digitado
 * abre em "Outro nome" com o nome completo gravado (não o curto da etiqueta).
 */
export function responsavelDaTarefa(
  t: Pick<TarefaObra, 'responsavel_id' | 'responsavelNomeBruto'>,
): { responsavelId: string; nomeDigitado: string } {
  if (t.responsavel_id) return { responsavelId: t.responsavel_id, nomeDigitado: '' };
  const nome = t.responsavelNomeBruto?.trim() ?? '';
  return nome
    ? { responsavelId: OUTRO, nomeDigitado: nome }
    : { responsavelId: '', nomeDigitado: '' };
}

/**
 * Entrada de `salvar_tarefa` a partir da folha. O nome digitado vai completo (é
 * o que fica gravado e vira sugestão). Na edição, a observação segue igual
 * (a folha não a edita e o servidor grava o que receber).
 */
export function entradaDaFolha(f: FormTarefa, tarefa: TarefaObra | null): EntradaTarefa {
  const outro = f.responsavelId === OUTRO;
  return {
    id: tarefa?.id ?? null,
    texto: normalizarTextoProvidencia(f.texto.trim()),
    responsavelId: outro ? null : f.responsavelId || null,
    responsavelNome: outro ? f.nomeDigitado.trim() || null : null,
    prazo: f.prazo,
    ...(tarefa ? { observacao: tarefa.observacao } : {}),
  };
}

/**
 * Tarefa que atribui a providência: vinculada a ela, com o nome digitado
 * completo (com pessoa do app o nome vai nulo: o servidor usa o id).
 */
export function entradaAtribuicao(
  p: { id: string },
  e: Pick<EntradaTarefa, 'texto' | 'responsavelId' | 'responsavelNome' | 'prazo'>,
): EntradaTarefa {
  return {
    texto: normalizarTextoProvidencia(e.texto),
    responsavelId: e.responsavelId,
    responsavelNome: e.responsavelId ? null : e.responsavelNome?.trim() || null,
    prazo: e.prazo,
    vinculoTipo: 'providencia',
    vinculoId: p.id,
    origemTexto: 'Providência da obra',
  };
}

/**
 * Tarefa que atribui a atividade sem dono: vinculada a ela (concluir a tarefa
 * abre a câmera da atividade), com o nome digitado completo.
 */
export function entradaAtribuicaoAtividade(
  a: { id: string },
  e: Pick<EntradaTarefa, 'texto' | 'responsavelId' | 'responsavelNome' | 'prazo'>,
): EntradaTarefa {
  return {
    texto: e.texto,
    responsavelId: e.responsavelId,
    responsavelNome: e.responsavelId ? null : e.responsavelNome?.trim() || null,
    prazo: e.prazo,
    vinculoTipo: 'atividade',
    vinculoId: a.id,
    origemTexto: 'Atividade da obra',
  };
}

/** Tamanho máximo do motivo do replanejamento. */
export const MOTIVO_MAX = 120;

/** O prazo da tarefa aberta mudou? (Só então a folha pede o motivo.) */
export function prazoMudou(
  tarefa: Pick<TarefaObra, 'prazo' | 'status'> | null,
  prazo: string,
): boolean {
  return Boolean(tarefa && tarefa.status === 'aberta' && prazo && prazo !== tarefa.prazo);
}

/** Motivo opcional do replanejamento: só quando o prazo da tarefa aberta muda. */
export function motivoReplanejamento(
  tarefa: Pick<TarefaObra, 'prazo' | 'status'> | null,
  prazo: string,
  motivo: string,
): string | null {
  if (!prazoMudou(tarefa, prazo)) return null;
  return motivo.trim().slice(0, MOTIVO_MAX) || null;
}
