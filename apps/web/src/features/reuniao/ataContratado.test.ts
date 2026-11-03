import { describe, expect, it } from 'vitest';
import { contratadosDaAta, filtrarPorContratado, resumoTodosContratados } from './ataContratado';
import type { ReuniaoCompleta } from './reuniaoApi';
const fixture = () =>
  ({
    obras: [
      {
        obraId: 'o1',
        observacoes: 'Observação geral privada',
        contratadosPorVinculo: {
          a: 'Empresa A',
          b: 'Empresa B',
          p: 'Empresa A',
          fora: 'Sem itens',
        },
        passadaConcluir: [{ atividadeId: 'a' }],
        passadaComecar: [],
        concluir: [{ atividadeId: 'b' }],
        comecar: [],
        atividadesAtrasadas: [],
        providenciar: [{ providenciaId: 'p' }],
        providenciasAtrasadas: [],
      },
      {
        obraId: 'o2',
        observacoes: '',
        contratadosPorVinculo: { c: 'Empresa B' },
        passadaConcluir: [],
        passadaComecar: [],
        concluir: [{ atividadeId: 'c' }],
        comecar: [],
        atividadesAtrasadas: [],
        providenciar: [],
        providenciasAtrasadas: [],
      },
    ],
    tarefas: [
      { id: 't1', obraId: 'o1', vinculoId: 'a', pessoa: 'Engenheiro' },
      { id: 't2', obraId: 'o1', vinculoId: 'p' },
      { id: 't3', obraId: 'o2', vinculoId: 'c' },
      { id: 't4', obraId: 'o1', vinculoId: null, pessoa: 'Empresa A' },
    ],
  }) as unknown as ReuniaoCompleta;
describe('resumo por contratado', () => {
  it('lista prestadores com itens e não confunde o responsável da tarefa', () => {
    expect(contratadosDaAta(fixture())).toEqual(['Empresa A', 'Empresa B']);
  });
  it('isola atividades, providências e tarefas do contratado sem levar observações gerais', () => {
    const original = fixture();
    const r = filtrarPorContratado(original, ' empresa  a ');
    expect(r.obras.map((o) => o.obraId)).toEqual(['o1']);
    expect(r.obras[0].passadaConcluir).toHaveLength(1);
    expect(r.obras[0].concluir).toEqual([]);
    expect(r.obras[0].providenciar).toHaveLength(1);
    expect(r.obras[0].observacoes).toBe('');
    expect(r.tarefas.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(original.obras[0].concluir).toHaveLength(1);
  });
  it('não exporta a ata inteira quando não há contratado correspondente', () => {
    expect(filtrarPorContratado(fixture(), '').obras).toEqual([]);
    expect(filtrarPorContratado(fixture(), 'inexistente').tarefas).toEqual([]);
  });
});

it('exporta somente contratados com pendências juntos, e mantém próximos passos em ordem de prazo', () => {
  const r = fixture();
  r.data = '2026-11-03';
  r.respostas = {};
  r.acoesResposta = {};
  r.tarefas = [];
  for (const o of r.obras) {
    Object.assign(o, {
      nome: o.obraId,
      ritmoDias: 0,
      pct: 0,
      previstoSexta: 0,
      faseAtual: 'Execução',
      entrega: '2026-12-01',
      passadaConcluir: [],
      providenciar: [],
    });
    o.concluir = o.concluir.map((a) => ({
      ...a,
      nome: 'Pintura',
      data: o.obraId === 'o1' ? '2026-11-06' : '2026-11-04',
    }));
  }
  r.respostas['semana_concluir:b'] = 'segue';
  const resumo = resumoTodosContratados(r);
  expect(resumo.obras.map((o) => o.nome)).toEqual(['Empresa B']);
  expect(resumo.obras[0].providencias.map((l) => l.data)).toEqual(['2026-11-04', '2026-11-06']);
  expect(resumo.obras[0].providencias.every((l) => !l.ok)).toBe(true);
  expect(resumo.pessoas).toEqual([]);
  for (const o of r.obras) o.concluir = [];
  expect(resumoTodosContratados(r).obras).toEqual([]);
  r.propostas = [
    {
      id: 'p1',
      obra_id: 'o1',
      atividade_id: 'm1',
      contratado: 'João',
      descricao: 'Elétrica',
      prazo: '2026-11-05',
      recebida: false,
      mapa: { nome: 'Mapa elétrica', deleted_at: null },
    },
    {
      id: 'p2',
      obra_id: 'o2',
      atividade_id: 'm2',
      contratado: ' joao ',
      descricao: 'Hidráulica',
      prazo: null,
      recebida: false,
      mapa: { nome: 'Mapa hidráulica', deleted_at: null },
    },
    {
      id: 'p3',
      obra_id: 'o1',
      atividade_id: 'm1',
      contratado: 'Já resolveu',
      descricao: 'Entregue',
      prazo: null,
      recebida: true,
      mapa: { nome: 'Mapa elétrica', deleted_at: null },
    },
  ];
  const propostas = resumoTodosContratados(r);
  expect(propostas.obras.map((o) => o.nome)).toEqual(['João']);
  expect(propostas.obras[0].providencias).toHaveLength(2);
  expect(propostas.obras[0].providencias[0].texto).toContain(
    'o1 · Envio de proposta · Mapa elétrica · Elétrica',
  );
  r.propostas.forEach((p) => {
    p.recebida = true;
  });
  expect(resumoTodosContratados(r).obras).toEqual([]);
});
