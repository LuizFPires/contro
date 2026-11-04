import { describe, expect, it } from 'vitest';
import { PRAZOS_PENDENCIA_PADRAO, nomeCurto, prazoPendencia } from '@contro/core';
import { dataLocal } from './api';
import { acoesVisiveis, pendenciaParaAcao, tarefaParaAcao } from './acoesObra';
import type { PendenciaObra } from './pendenciasObra';
import type { TarefaObra } from './tarefasObra';

const tarefa = (o: Partial<TarefaObra> = {}): TarefaObra => ({
  id: 't1',
  obra_id: 'o1',
  texto: 'Ligar para o eletricista',
  responsavel_id: null,
  responsavelNome: 'Marcos',
  observacao: null,
  prazo: '2026-11-05',
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
  ...o,
});

const pendencia = (o: Partial<PendenciaObra> = {}): PendenciaObra => ({
  id: 'p1',
  obra_id: 'o1',
  atividade_id: null,
  titulo: 'Rejunte manchado',
  local: 'Sala 2',
  criticidade: 'alta',
  status: 'aberta',
  ordem_fila: 1,
  adiada_ate: null,
  motivo_adiamento: null,
  apontada_em: '2026-11-02T14:00:00-03:00',
  resolvida_por: null,
  resolvida_em: null,
  vistoriada_por: null,
  vistoriada_em: null,
  fotoAntesUrl: null,
  fotoDepoisUrl: null,
  apontouNome: null,
  resolveuNome: null,
  atividadeNome: null,
  ...o,
});

describe('tarefaParaAcao', () => {
  it('tarefa aberta vira ação aberta com o prazo e o nome digitado', () => {
    const a = tarefaParaAcao(tarefa());
    expect(a).toMatchObject({
      origem: 'tarefa',
      id: 't1',
      obraId: 'o1',
      texto: 'Ligar para o eletricista',
      prazo: '2026-11-05',
      aberta: true,
      responsavelId: null,
      responsavelNome: 'Marcos',
    });
  });

  it('tarefa feita: aberta=false e concluidaEm=feita_em', () => {
    const a = tarefaParaAcao(tarefa({ status: 'feita', feita_em: '2026-11-03T12:00:00Z' }));
    expect(a.aberta).toBe(false);
    expect(a.concluidaEm).toBe('2026-11-03T12:00:00Z');
  });
});

describe('pendenciaParaAcao', () => {
  it('prazo parte da data local do apontamento, não da data UTC', () => {
    const ts = '2026-11-02T23:30:00-03:00'; // 02:30 UTC do dia 3
    const a = pendenciaParaAcao(pendencia({ apontada_em: ts }), PRAZOS_PENDENCIA_PADRAO);
    expect(a.origem).toBe('pendencia');
    expect(a.prazo).toBe(prazoPendencia('alta', dataLocal(ts), PRAZOS_PENDENCIA_PADRAO));
    expect(a.aberta).toBe(true);
    expect(a.texto).toBe('Rejunte manchado');
  });

  it('pendência fechada: aberta=false e concluidaEm=resolvida_em', () => {
    const a = pendenciaParaAcao(
      pendencia({ status: 'fechada', resolvida_em: '2026-11-03T15:00:00Z' }),
      PRAZOS_PENDENCIA_PADRAO,
    );
    expect(a.aberta).toBe(false);
    expect(a.concluidaEm).toBe('2026-11-03T15:00:00Z');
  });

  it('sem responsável: responsavelId e responsavelNome nulos', () => {
    const a = pendenciaParaAcao(pendencia(), PRAZOS_PENDENCIA_PADRAO);
    expect(a.responsavelId).toBeNull();
    expect(a.responsavelNome).toBeNull();
  });

  it('com responsável: carrega id e nome', () => {
    const a = pendenciaParaAcao(
      pendencia({ responsavel_id: 'u1', responsavelNome: 'Ana' }),
      PRAZOS_PENDENCIA_PADRAO,
    );
    expect(a.responsavelId).toBe('u1');
    expect(a.responsavelNome).toBe('Ana');
  });

  it('nome do responsável fica curto, como nas tarefas', () => {
    const a = pendenciaParaAcao(
      pendencia({ responsavel_id: 'u1', responsavelNome: 'Ana Paula Souza' }),
      PRAZOS_PENDENCIA_PADRAO,
    );
    expect(a.responsavelNome).toBe(nomeCurto('Ana Paula Souza'));
  });
});

describe('acoesVisiveis', () => {
  const hoje = '2026-11-04';
  const fechada = (resolvida_em: string | null, id = 'p') =>
    pendenciaParaAcao(pendencia({ id, status: 'fechada', resolvida_em }), PRAZOS_PENDENCIA_PADRAO);

  it('mantém pendência resolvida nos últimos 30 dias e tira a mais antiga', () => {
    const r = acoesVisiveis(
      [
        fechada('2026-10-05T15:00:00-03:00', 'limite'),
        fechada('2026-10-04T15:00:00-03:00', 'velha'),
      ],
      hoje,
    );
    expect(r.map((a) => a.id)).toEqual(['limite']);
  });

  it('mantém pendência aberta, resolvida sem data e tarefa feita antiga', () => {
    const r = acoesVisiveis(
      [
        pendenciaParaAcao(pendencia({ id: 'aberta' }), PRAZOS_PENDENCIA_PADRAO),
        fechada(null, 'sem-data'),
        tarefaParaAcao(tarefa({ id: 'feita', status: 'feita', feita_em: '2026-01-01T12:00:00Z' })),
      ],
      hoje,
    );
    expect(r.map((a) => a.id)).toEqual(['aberta', 'sem-data', 'feita']);
  });
});
