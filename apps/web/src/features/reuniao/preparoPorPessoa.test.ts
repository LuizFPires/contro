import { expect, it } from 'vitest';
import { preparoPorPessoa } from '@contro/core';
import { montarPreparo, origemDa } from './ataDados';
import type { ReuniaoCompleta } from './reuniaoApi';

it('inclui tarefas da própria reunião e separa responsáveis com nomes completos', () => {
  const r = {
    data: '2026-11-03',
    respostas: {},
    acoesResposta: {},
    obras: [
      {
        obraId: 'obra1',
        nome: 'Obra Centro',
        pct: 0,
        ritmoDias: 0,
        passadaConcluir: [],
        passadaComecar: [],
        concluir: [],
        comecar: [],
        atividadesAtrasadas: [],
        providenciasAtrasadas: [],
        providenciar: [
          { providenciaId: 'prov1', descricao: 'Tubos', tipo: 'compra', naObraEm: '2026-11-05' },
        ],
      },
    ],
    tarefas: [],
  } as unknown as ReuniaoCompleta;
  r.tarefas = [
    {
      id: 't1',
      obraId: 'obra1',
      texto: 'Comprar tubos',
      pessoa: 'Ana S',
      pessoaNomeCompleto: 'Ana Silva',
      origem: origemDa(r),
      concluido: false,
      prazo: '2026-11-05',
      atrasado: false,
      vinculoTipo: 'providencia',
      vinculoId: 'prov1',
      avancoPct: 0,
    },
    {
      id: 't2',
      obraId: 'obra1',
      texto: 'Conferir medição',
      pessoa: 'Bruno L',
      pessoaNomeCompleto: 'Bruno Lima',
      origem: null,
      concluido: false,
      prazo: '2026-11-04',
      atrasado: false,
      avancoPct: 0,
    },
    {
      id: 't3',
      obraId: 'obra1',
      texto: 'Tarefa encerrada',
      pessoa: 'Carlos',
      origem: null,
      concluido: true,
      prazo: null,
      atrasado: false,
      avancoPct: 0,
    },
  ] as ReuniaoCompleta['tarefas'];
  expect(montarPreparo(r)[0].cobranca.some((t) => t.texto === 'Comprar tubos')).toBe(false);
  const { pessoas, semDono } = preparoPorPessoa(montarPreparo(r, true));
  expect(pessoas.map((p) => p.pessoa)).toEqual(['Ana Silva', 'Bruno Lima']);
  expect(pessoas[0].itens[0].texto).toBe('Comprar tubos (Obra Centro)');
  expect(pessoas[1].itens[0].texto).toBe('Conferir medição (Obra Centro)');
  expect(semDono).toEqual([]);
});
