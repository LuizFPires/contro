import { describe, expect, it } from 'vitest';
import type { AtividadeGeral } from '@contro/core';
import type { TarefaObra } from '../../obras/tarefasObra';
import { boletimDaObraGeral } from './boletimGeral';

const atividade = (p: Partial<AtividadeGeral>): AtividadeGeral => ({
  id: 'a1',
  fase_id: 'f1',
  pai_id: null,
  ordem: 1,
  nome: 'Pintura',
  data_prevista: '2026-11-04',
  data_prevista_original: '2026-11-04',
  replanejamentos: 0,
  responsavel_id: null,
  concluida_em: null,
  avanco_pct: 0,
  foto_conclusao_id: null,
  prestador: null,
  ...p,
});

const tarefa = (p: Partial<TarefaObra>): TarefaObra => ({
  id: 't1',
  obra_id: 'o1',
  texto: 'Comprar tinta',
  responsavel_id: null,
  responsavelNome: 'Ana',
  responsavelNomeBruto: 'Ana',
  observacao: null,
  prazo: '2026-11-06',
  prazo_original: null,
  replanejamentos: 0,
  status: 'aberta',
  vinculo_tipo: null,
  vinculo_id: null,
  origem_texto: null,
  avanco_pct: 0,
  comentario: null,
  avanco_em: null,
  feita_em: null,
  ...p,
});

describe('boletimDaObraGeral', () => {
  it('monta o boletim da semana e põe as tarefas abertas em quem faz o quê', () => {
    const d = boletimDaObraGeral({
      obra: { nome: 'Sede', cidade: 'Recife' },
      atividades: [atividade({})],
      nomes: {},
      tarefas: [tarefa({}), tarefa({ id: 't2', texto: 'Feita', status: 'feita' })],
      pendencias: [],
      hoje: '2026-11-06',
    });
    expect(d.obra).toBe('Sede · Recife');
    expect(d.concluir.map((c) => c.nome)).toEqual(['Pintura']);
    expect(d.quemFazOQue).toHaveLength(1);
    expect(d.quemFazOQue[0]!.pessoa).toBe('Ana');
    expect(d.quemFazOQue[0]!.itens.map((i) => i.texto)).toEqual(['Comprar tinta']);
  });
});
