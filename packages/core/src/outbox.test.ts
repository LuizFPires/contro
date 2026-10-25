import { describe, expect, it } from 'vitest';
import {
  aguardando,
  aposTentativa,
  backoffMs,
  classificarErro,
  proximaOp,
  rejeitadas,
  type OpFila,
} from './outbox';

const op = (p: Partial<OpFila>): OpFila => ({
  id: p.id ?? 'x',
  tipo: p.tipo ?? 'marcar_providencia',
  status: p.status ?? 'pendente',
  tentativas: p.tentativas ?? 0,
  criadoEm: p.criadoEm ?? 0,
  proximaEm: p.proximaEm ?? 0,
});

describe('backoffMs', () => {
  it('0 na primeira, exponencial depois, cap em 60s', () => {
    expect(backoffMs(0)).toBe(0);
    expect(backoffMs(1)).toBe(2000);
    expect(backoffMs(2)).toBe(4000);
    expect(backoffMs(3)).toBe(8000);
    expect(backoffMs(20)).toBe(60000);
  });
});

describe('proximaOp', () => {
  it('pega a mais antiga pronta (pendente/erro, proximaEm <= agora)', () => {
    const ops = [
      op({ id: 'a', criadoEm: 20 }),
      op({ id: 'b', criadoEm: 10 }),
      op({ id: 'c', status: 'enviando', criadoEm: 5 }),
      op({ id: 'd', status: 'erro', criadoEm: 1, proximaEm: 999 }), // ainda em backoff
    ];
    expect(proximaOp(ops, 100)?.id).toBe('b');
  });
  it('null quando nada está pronto', () => {
    expect(proximaOp([op({ status: 'rejeitada' })], 100)).toBeNull();
    expect(proximaOp([op({ status: 'erro', proximaEm: 999 })], 100)).toBeNull();
  });
});

describe('aguardando / rejeitadas', () => {
  it('conta as que aguardam sinal (menos rejeitadas)', () => {
    const ops = [
      op({ status: 'pendente' }),
      op({ status: 'enviando' }),
      op({ status: 'erro' }),
      op({ status: 'rejeitada' }),
    ];
    expect(aguardando(ops)).toBe(3);
    expect(rejeitadas(ops)).toHaveLength(1);
  });
});

describe('classificarErro', () => {
  it('código SQLSTATE/PostgREST = rejeição; sem código = rede', () => {
    expect(classificarErro('42501')).toBe('rejeicao'); // não liberada
    expect(classificarErro('23505')).toBe('rejeicao'); // duplicada
    expect(classificarErro('PGRST116')).toBe('rejeicao');
    expect(classificarErro(undefined)).toBe('rede'); // falha de fetch
    expect(classificarErro(null)).toBe('rede');
  });
});

describe('aposTentativa', () => {
  it('ok remove da fila', () => {
    expect(aposTentativa(op({}), 'ok', 100)).toBeNull();
  });
  it('rede volta para erro com backoff', () => {
    const r = aposTentativa(op({ tentativas: 1 }), 'rede', 100);
    expect(r?.status).toBe('erro');
    expect(r?.tentativas).toBe(2);
    expect(r?.proximaEm).toBe(100 + backoffMs(2));
  });
  it('rejeição marca rejeitada (sem novo backoff)', () => {
    const r = aposTentativa(op({ tentativas: 0 }), 'rejeicao', 100);
    expect(r?.status).toBe('rejeitada');
    expect(r?.tentativas).toBe(1);
  });
});
