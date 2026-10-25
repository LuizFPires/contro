import { aposTentativa, classificarErro, proximaOp } from '@obdc/core';
import type { QueryClient } from '@tanstack/react-query';
import { marcarProvidencia } from '../features/obras/campo';
import { db, type OpDB } from './db';

/**
 * Despachante de ações da fila: `tipo` → chamada ao servidor (com o client_op_id
 * para idempotência). Cada entrada só precisa fazer a chamada; o drenar cuida de
 * backoff, rejeição e reversão. (Fatia 1: marcar providência.)
 */
type Handler = (payload: Record<string, unknown>, opId: string) => Promise<void>;
const DISPATCH: Record<string, Handler> = {
  marcar_providencia: (p, opId) => marcarProvidencia(p.id as string, p.feito as boolean, opId),
};

let qc: QueryClient | null = null;
let drenando = false;

function invalidar(payload: Record<string, unknown>) {
  const obraId = payload?.obraId as string | undefined;
  if (qc && obraId) {
    qc.invalidateQueries({ queryKey: ['obra', obraId] });
    qc.invalidateQueries({ queryKey: ['obras'] });
  }
}

/** Enfileira uma ação de campo (otimista: a UI já atualizou o cache antes). */
export async function enfileirar(tipo: string, payload: Record<string, unknown>): Promise<string> {
  const id = crypto.randomUUID();
  const op: OpDB = {
    id,
    tipo,
    payload,
    status: 'pendente',
    tentativas: 0,
    criadoEm: Date.now(),
    proximaEm: 0,
  };
  await db.outbox.add(op);
  void drenar();
  return id;
}

/** Drena a fila enquanto houver sinal e ops prontas. Seguro contra reentrância. */
export async function drenar(): Promise<void> {
  if (drenando) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  drenando = true;
  try {
    for (;;) {
      const ops = await db.outbox.toArray();
      const op = proximaOp(ops, Date.now());
      if (!op) break;
      const handler = DISPATCH[op.tipo];
      if (!handler) {
        await db.outbox.update(op.id, { status: 'rejeitada', erro: 'tipo desconhecido' });
        continue;
      }
      await db.outbox.update(op.id, { status: 'enviando' });
      try {
        await handler(op.payload as Record<string, unknown>, op.id);
        await db.outbox.delete(op.id);
        invalidar(op.payload as Record<string, unknown>);
      } catch (e) {
        const err = e as { code?: string; message?: string };
        const classe = classificarErro(err.code);
        const proximo = aposTentativa(op, classe, Date.now());
        if (proximo) {
          await db.outbox.update(op.id, {
            status: proximo.status,
            tentativas: proximo.tentativas,
            proximaEm: proximo.proximaEm,
            erro: err.message,
          });
        }
        if (classe === 'rejeicao') {
          invalidar(op.payload as Record<string, unknown>); // reverte o otimismo (verdade do servidor)
        } else {
          break; // rede: para e tenta de novo no próximo gatilho
        }
      }
    }
  } finally {
    drenando = false;
  }
}

/** Liga o sync: drena ao voltar o sinal, ao focar a aba e a cada 30s. */
export function iniciarSync(client: QueryClient): void {
  qc = client;
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => void drenar());
  window.addEventListener('focus', () => void drenar());
  window.setInterval(() => void drenar(), 30_000);
  void drenar();
}
