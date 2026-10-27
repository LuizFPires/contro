import { aposTentativa, classificarErro, proximaOp } from '@contro/core';
import type { QueryClient } from '@tanstack/react-query';
import {
  adiarPendencia,
  anexarFotoConclusao,
  apontarPendencia,
  concluirAtividade,
  desfazerConclusao,
  concluirTarefa,
  excluirTarefa,
  marcarProvidencia,
  marcarSubitem,
  reabrirTarefa,
  resolverPendencia,
  restaurarTarefa,
  salvarTarefa,
  trazerPendencia,
  vistoriarPendencia,
  type EntradaTarefa,
  type NovaPendencia,
} from '../features/obras/campo';
import { removerFotoLocal, subirFotoLocal } from '../features/obras/foto';
import { supabase } from './supabase';
import { db, type OpDB } from './db';

/**
 * Despachante de ações da fila: `tipo` → chamada ao servidor (com o client_op_id
 * para idempotência). Cada entrada só precisa fazer a chamada; o drenar cuida de
 * backoff, rejeição e reversão. (Fatia 1: marcar providência.)
 */
type Handler = (payload: Record<string, unknown>, opId: string) => Promise<void>;
const DISPATCH: Record<string, Handler> = {
  marcar_providencia: (p, opId) => marcarProvidencia(p.id as string, p.feito as boolean, opId),
  concluir_atividade: async (p, opId) => {
    // Foto opcional: sem fotoLocalId, conclui sem foto.
    const local = (p.fotoLocalId as string | null) ?? null;
    // Foto já enviada (ex.: Desfazer de "Voltar para pendente") vem pronta em fotoId.
    const fotoId = local ? await subirFotoLocal(local) : ((p.fotoId as string | null) ?? null);
    await concluirAtividade(p.atividadeId as string, fotoId, opId);
    if (local) await removerFotoLocal(local);
  },
  anexar_foto_conclusao: async (p, opId) => {
    const fotoId = await subirFotoLocal(p.fotoLocalId as string); // upload com retomada
    await anexarFotoConclusao(p.atividadeId as string, fotoId, opId);
    await removerFotoLocal(p.fotoLocalId as string);
  },
  desfazer_conclusao: (p, opId) => desfazerConclusao(p.atividadeId as string, opId),
  marcar_subitem: (p, opId) => marcarSubitem(p.subitemId as string, p.feito as boolean, opId),
  concluir_tarefa: (p, opId) => concluirTarefa(p.id as string, opId),
  reabrir_tarefa: (p, opId) => reabrirTarefa(p.id as string, opId),
  salvar_tarefa: async (p, opId) => {
    await salvarTarefa(p.obraId as string, p.entrada as EntradaTarefa, opId);
  },
  excluir_tarefa: (p, opId) => excluirTarefa(p.id as string, opId),
  restaurar_tarefa: (p, opId) => restaurarTarefa(p.id as string, opId),
  adiar_pendencia: (p, opId) =>
    adiarPendencia(p.id as string, p.data as string, p.motivo as string, opId),
  trazer_pendencia: (p, opId) => trazerPendencia(p.id as string, opId),
  vistoriar_pendencia: (p, opId) =>
    vistoriarPendencia(p.id as string, p.aprovado as boolean, p.motivo as string | undefined, opId),
  resolver_pendencia: async (p, opId) => {
    const fotoId = await subirFotoLocal(p.fotoLocalId as string); // upload com retomada
    await resolverPendencia(p.id as string, fotoId, opId);
    await removerFotoLocal(p.fotoLocalId as string);
  },
  apontar_pendencia: async (p, opId) => {
    const fotoId = await subirFotoLocal(p.fotoLocalId as string); // foto do antes (retomada)
    await apontarPendencia(
      p.obraId as string,
      p.pendenciaId as string,
      p.dados as NovaPendencia,
      fotoId,
      opId,
    );
    await removerFotoLocal(p.fotoLocalId as string);
  },
};

let qc: QueryClient | null = null;
let drenando = false;
// Dono das ops a enviar: só a própria sessão drena a própria fila (aparelho
// compartilhado não envia ação de outra pessoa com a sessão errada).
let usuarioAtual: string | null = null;

async function uidAtual(): Promise<string | null> {
  if (usuarioAtual) return usuarioAtual;
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  usuarioAtual = data.session?.user.id ?? null;
  return usuarioAtual;
}

function invalidar(payload: Record<string, unknown>) {
  const obraId = payload?.obraId as string | undefined;
  if (qc && obraId) {
    qc.invalidateQueries({ queryKey: ['obra', obraId] });
    qc.invalidateQueries({ queryKey: ['obras'] });
    qc.invalidateQueries({ queryKey: ['tarefas', obraId] });
    qc.invalidateQueries({ queryKey: ['pendencias', obraId] });
  }
}

/** Enfileira uma ação de campo (otimista: a UI já atualizou o cache antes). */
export async function enfileirar(tipo: string, payload: Record<string, unknown>): Promise<string> {
  const id = crypto.randomUUID();
  const op: OpDB = {
    id,
    // Dono = sessão em cache (SÍNCRONO). Nunca bloqueamos o outbox.add numa
    // chamada de auth: offline, getSession pode travar sob o lock do refresh, e
    // a ação de campo (regra 9, <100ms) não pode esperar isso. Se o uid ainda
    // não está em cache, a op fica sem dono e o drenar a adota (ver abaixo).
    userId: usuarioAtual ?? '',
    tipo,
    payload,
    status: 'pendente',
    tentativas: 0,
    criadoEm: Date.now(),
    proximaEm: 0,
  };
  await db.outbox.add(op); // persiste PRIMEIRO
  void drenar();
  return id;
}

/** Drena a fila enquanto houver sinal e ops prontas. Seguro contra reentrância. */
export async function drenar(): Promise<void> {
  if (drenando) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const uid = await uidAtual();
  if (!uid) return; // sem sessão: não envia a fila de ninguém
  drenando = true;
  try {
    // Adota ops sem dono (enfileiradas antes do uid estar em cache) para a
    // sessão atual — senão ficariam órfãs e nunca seriam enviadas.
    const orfas = (await db.outbox.toArray()).filter((o) => o.userId === '');
    for (const o of orfas) await db.outbox.update(o.id, { userId: uid });
    for (;;) {
      const ops = (await db.outbox.toArray()).filter((o) => o.userId === uid);
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
          const pl = op.payload as Record<string, unknown>;
          // Rejeição é terminal: sem reenvio, então libera o blob local para não vazar no Dexie.
          if (typeof pl.fotoLocalId === 'string') await removerFotoLocal(pl.fotoLocalId);
          invalidar(pl); // reverte o otimismo (verdade do servidor)
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
  // Aquece o uid em cache o quanto antes, para o enqueue já ter dono (o
  // onAuthStateChange abaixo também seta no INITIAL_SESSION).
  void uidAtual();
  supabase?.auth.onAuthStateChange((_evento, session) => {
    usuarioAtual = session?.user.id ?? null;
    // Fora do callback: drenar chama o Supabase, e fazer isso aqui dentro trava
    // o lock do auth (o app fica em "Carregando…").
    if (usuarioAtual) setTimeout(() => void drenar(), 0);
  });
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => void drenar());
  window.addEventListener('focus', () => void drenar());
  window.setInterval(() => void drenar(), 30_000);
  void drenar();
}
