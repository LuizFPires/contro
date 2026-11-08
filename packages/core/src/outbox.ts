// Fila offline (outbox) — lógica pura e testada (regra 1 / regra 9). O cliente
// enfileira cada ação de campo com um `client_op_id` idempotente; o sync drena a
// fila quando há sinal. O armazenamento (Dexie) e o envio (Supabase) ficam no web.

export type OpStatus = 'pendente' | 'enviando' | 'erro' | 'rejeitada';

export interface OpFila {
  id: string; // client_op_id (uuid), idempotente no servidor
  tipo: string; // ex.: 'marcar_providencia', 'concluir_tarefa'
  status: OpStatus;
  tentativas: number;
  criadoEm: number; // epoch ms (ordem FIFO)
  proximaEm: number; // epoch ms — não tentar antes disto (backoff)
}

const BACKOFF_MAX = 60_000;

/** Backoff exponencial: 0 na 1ª, depois 2s, 4s, 8s… até 60s. */
export function backoffMs(tentativas: number): number {
  if (tentativas <= 0) return 0;
  return Math.min(2000 * 2 ** (tentativas - 1), BACKOFF_MAX);
}

/**
 * Próxima op a enviar: a mais antiga que está pendente/erro e já pode tentar.
 * Com `chave`, ops de mesma chave saem em ordem: uma em backoff segura as seguintes
 * (o Desfazer de um item não pode passar na frente da ação que ele desfaz).
 */
export function proximaOp<T extends OpFila>(
  ops: T[],
  agora: number,
  chave?: (op: T) => string | null,
): T | null {
  const fila = ops
    .filter((o) => o.status === 'pendente' || o.status === 'erro')
    .sort((a, b) => a.criadoEm - b.criadoEm);
  const presas = new Set<string>();
  for (const o of fila) {
    const k = chave?.(o) ?? null;
    if (k && presas.has(k)) continue;
    if (o.proximaEm <= agora) return o;
    if (k) presas.add(k);
  }
  return null;
}

/** Quantas ações ainda aguardam sinal (para o indicador discreto). */
export function aguardando(ops: OpFila[]): number {
  return ops.filter(
    (o) => o.status === 'pendente' || o.status === 'enviando' || o.status === 'erro',
  ).length;
}

/** Ações recusadas pelo servidor (ex.: conclusão não liberada) — precisam de reversão/aviso. */
export function rejeitadas<T extends OpFila>(ops: T[]): T[] {
  return ops.filter((o) => o.status === 'rejeitada');
}

export type ClasseErro = 'rede' | 'rejeicao';

/**
 * Classifica a falha de uma op: código SQLSTATE/PostgREST = regra de negócio
 * (não adianta repetir → rejeita e reverte); sem código = rede (tenta de novo).
 */
export function classificarErro(codigo: string | null | undefined): ClasseErro {
  if (!codigo) return 'rede';
  return /^[0-9A-Z]{5}$/.test(codigo) || /^PGRST/.test(codigo) ? 'rejeicao' : 'rede';
}

/** Estado seguinte de uma op após uma tentativa (sucesso/rede/rejeição). */
export function aposTentativa(
  op: OpFila,
  resultado: 'ok' | ClasseErro,
  agora: number,
): OpFila | null {
  if (resultado === 'ok') return null; // sai da fila
  const tentativas = op.tentativas + 1;
  if (resultado === 'rejeicao') {
    return { ...op, status: 'rejeitada', tentativas };
  }
  return { ...op, status: 'erro', tentativas, proximaEm: agora + backoffMs(tentativas) };
}
