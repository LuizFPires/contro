import { describe, expect, it } from 'vitest';
import {
  PRAZOS_PENDENCIA_PADRAO,
  classificarAcoes,
  nomeCurto,
  prazoPendencia,
  type AtividadeSemDono,
  type ProvidenciaSemDono,
} from '@contro/core';
import { dataLocal } from './api';
import {
  acoesVisiveis,
  atividadeParaAcao,
  pendenciaParaAcao,
  providenciaParaAcao,
  secoesAcoes,
  tarefaParaAcao,
  tarefasFechadasPelaAtividade,
} from './acoesObra';
import type { PendenciaObra } from './pendenciasObra';
import type { TarefaObra } from './tarefasObra';

const tarefa = (o: Partial<TarefaObra> = {}): TarefaObra => ({
  id: 't1',
  obra_id: 'o1',
  texto: 'Ligar para o eletricista',
  responsavel_id: null,
  responsavelNome: 'Marcos',
  responsavelNomeBruto: 'Marcos',
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

describe('providenciaParaAcao', () => {
  const p: ProvidenciaSemDono = {
    id: 'pv1',
    obraId: 'o1',
    obraNome: 'Savassi',
    tipo: 'compra',
    descricao: 'Cabos',
    prazo: '2026-11-03',
    atividadeNome: 'Elétrica',
  };

  it('vira ação de origem providência, sem responsável, com a providência anexada', () => {
    const a = providenciaParaAcao(p);
    expect(a).toMatchObject({
      origem: 'providencia',
      id: 'pv1',
      obraId: 'o1',
      texto: 'Compra: Cabos',
      prazo: '2026-11-03',
      aberta: true,
      responsavelId: null,
      responsavelNome: null,
    });
    expect(a.origem === 'providencia' && a.providencia).toBe(p);
  });

  it('providência vencida cai em Atrasadas', () => {
    const s = secoesAcoes(classificarAcoes([providenciaParaAcao(p)], '2026-11-04'));
    expect(s.map((x) => x.estado)).toEqual(['atrasada']);
    expect(s[0].itens[0].id).toBe('pv1');
  });
});

describe('atividadeParaAcao', () => {
  const a: AtividadeSemDono = {
    id: 'av1',
    obraId: 'o1',
    obraNome: 'Savassi',
    nome: 'Pintura',
    faseNome: 'Acabamento',
    prestador: 'Paulo',
    prazo: '2026-11-03',
  };

  it('vira ação de origem atividade, sem responsável, com a atividade anexada', () => {
    const x = atividadeParaAcao(a);
    expect(x).toMatchObject({
      origem: 'atividade',
      id: 'av1',
      obraId: 'o1',
      texto: 'Atividade: Pintura',
      prazo: '2026-11-03',
      aberta: true,
      responsavelId: null,
      responsavelNome: null,
    });
    expect(x.origem === 'atividade' && x.atividade).toBe(a);
  });

  it('atividade com fim previsto vencido cai em Atrasadas', () => {
    const s = secoesAcoes(classificarAcoes([atividadeParaAcao(a)], '2026-11-04'));
    expect(s.map((x) => x.estado)).toEqual(['atrasada']);
    expect(s[0].itens[0].id).toBe('av1');
  });
});

describe('tarefasFechadasPelaAtividade', () => {
  const agora = new Date('2026-11-04T15:00:00Z').getTime();
  const t = (
    id: string,
    o: Partial<{
      vinculo_tipo: 'atividade' | 'providencia' | null;
      vinculo_id: string | null;
      status: 'aberta' | 'feita';
      feita_em: string | null;
    }> = {},
  ) => ({
    id,
    vinculo_tipo: 'atividade' as const,
    vinculo_id: 'atv',
    status: 'feita' as const,
    feita_em: '2026-11-04T14:58:00Z',
    ...o,
  });
  it('pega só as feitas da atividade dentro da janela de 5 minutos', () => {
    expect(
      tarefasFechadasPelaAtividade(
        [
          t('ok'),
          t('velha', { feita_em: '2026-11-04T14:50:00Z' }),
          t('aberta', { status: 'aberta', feita_em: null }),
          t('outra', { vinculo_id: 'x' }),
          t('prov', { vinculo_tipo: 'providencia' }),
        ],
        'atv',
        agora,
      ),
    ).toEqual(['ok']);
  });
});
