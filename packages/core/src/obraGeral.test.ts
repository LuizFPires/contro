import { describe, expect, it } from 'vitest';
import {
  atalhosDataPrevista,
  diaCurto,
  podePlanejarObraGeral,
  prazoAtividadeGeral,
  resumoObraGeral,
  statusAtividadeGeral,
  trilhaObraGeral,
  type AtividadeGeral,
  type FaseGeral,
} from './obraGeral';

const hoje = '2026-11-05'; // quinta

function ativ(p: Partial<AtividadeGeral> & { id: string }): AtividadeGeral {
  return {
    fase_id: 'f1',
    pai_id: null,
    ordem: 1,
    nome: p.id,
    data_prevista: null,
    replanejamentos: 0,
    responsavel_id: null,
    concluida_em: null,
    avanco_pct: 0,
    foto_conclusao_id: null,
    prestador: null,
    ...p,
  };
}

const fases = [{ id: 'f1', ordem: 1, titulo: 'Demolição' }];

describe('diaCurto', () => {
  it('formata dia da semana e data', () => {
    expect(diaCurto('2026-11-04')).toBe('qua 04/11');
    expect(diaCurto('2026-11-07')).toBe('sáb 07/11');
  });
});

describe('prazoAtividadeGeral', () => {
  it('usa a maior data dos subitens', () => {
    const subs = [
      ativ({ id: 's1', data_prevista: '2026-11-06' }),
      ativ({ id: 's2', data_prevista: null }),
      ativ({ id: 's3', data_prevista: '2026-11-09' }),
    ];
    expect(prazoAtividadeGeral(ativ({ id: 'a' }), subs)).toBe('2026-11-09');
  });
  it('cai na data da atividade quando os subitens não têm data', () => {
    const subs = [ativ({ id: 's1' })];
    expect(prazoAtividadeGeral(ativ({ id: 'a', data_prevista: '2026-11-10' }), subs)).toBe(
      '2026-11-10',
    );
  });
  it('é nulo sem subitens e sem data', () => {
    expect(prazoAtividadeGeral(ativ({ id: 'a' }), [])).toBeNull();
  });
});

describe('statusAtividadeGeral', () => {
  it('atrasada, vence hoje, aberta', () => {
    expect(statusAtividadeGeral(null, '2026-11-04', hoje)).toBe('atrasada');
    expect(statusAtividadeGeral(null, '2026-11-05', hoje)).toBe('vence_hoje');
    expect(statusAtividadeGeral(null, '2026-11-06', hoje)).toBe('aberta');
    expect(statusAtividadeGeral(null, null, hoje)).toBe('aberta');
  });
  it('concluída vence tudo', () => {
    expect(statusAtividadeGeral('2026-11-01T10:00:00Z', '2026-10-01', hoje)).toBe('concluida');
  });
  it('prazo na sexta com hoje no sábado está atrasada', () => {
    expect(statusAtividadeGeral(null, '2026-11-06', '2026-11-07')).toBe('atrasada');
  });
});

describe('trilhaObraGeral', () => {
  const base = {
    fases,
    hoje,
    pessoaId: 'eu',
    nomes: { carlos: 'Carlos', eu: 'Luiz' },
  };

  it('monta o sub de cada atividade e conta atrasadas e vence hoje', () => {
    const [f] = trilhaObraGeral({
      ...base,
      atividades: [
        ativ({ id: 'a1', ordem: 1, responsavel_id: 'carlos', data_prevista: '2026-11-04' }),
        ativ({ id: 'a2', ordem: 2, responsavel_id: 'eu', data_prevista: '2026-11-05' }),
        ativ({ id: 'a3', ordem: 3 }),
      ],
    });
    expect(f.atividades.map((a) => a.sub)).toEqual([
      'Carlos · era para qua 04/11',
      'Você · vence hoje',
      'Sem responsável · sem data',
    ]);
    expect(f.atrasadas).toBe(1);
    expect(f.venceHoje).toBe(1);
    expect(f.total).toBe(3);
    expect(f.n).toBe(1);
  });

  it('aberta com prazo mostra o dia; nome desconhecido vira sem responsável', () => {
    const [f] = trilhaObraGeral({
      ...base,
      atividades: [ativ({ id: 'a1', responsavel_id: 'x', data_prevista: '2026-11-06' })],
    });
    expect(f.atividades[0].sub).toBe('Sem responsável · sex 06/11');
  });

  it('concluída sem foto e com foto', () => {
    const [f] = trilhaObraGeral({
      ...base,
      atividades: [
        ativ({
          id: 'a1',
          ordem: 1,
          responsavel_id: 'carlos',
          concluida_em: '2026-11-03T10:00:00Z',
        }),
        ativ({
          id: 'a2',
          ordem: 2,
          responsavel_id: 'carlos',
          concluida_em: '2026-11-03T10:00:00Z',
          foto_conclusao_id: 'foto',
        }),
      ],
    });
    expect(f.atividades[0].sub.endsWith('concluída sem foto')).toBe(true);
    expect(f.atividades[0].semFoto).toBe(true);
    expect(f.atividades[1].sub).toBe('Carlos · concluída');
    expect(f.atividades[1].semFoto).toBe(false);
    expect(f.concluidas).toBe(2);
    expect(f.concluida).toBe(true);
  });

  it('ordena fases, atividades e subitens e deriva o prazo dos subitens', () => {
    const r = trilhaObraGeral({
      ...base,
      fases: [
        { id: 'f2', ordem: 2, titulo: 'Segunda' },
        { id: 'f1', ordem: 1, titulo: 'Primeira' },
      ],
      atividades: [
        ativ({ id: 'a2', ordem: 2 }),
        ativ({ id: 'a1', ordem: 1 }),
        ativ({ id: 's2', pai_id: 'a1', ordem: 2, data_prevista: '2026-11-09' }),
        ativ({ id: 's1', pai_id: 'a1', ordem: 1 }),
      ],
    });
    expect(r.map((f) => [f.id, f.n])).toEqual([
      ['f1', 1],
      ['f2', 2],
    ]);
    expect(r[0].total).toBe(2);
    const [a1, a2] = r[0].atividades;
    expect([a1.id, a2.id]).toEqual(['a1', 'a2']);
    expect(a1.prazo).toBe('2026-11-09');
    expect(a1.subitens.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(a1.subitens.map((s) => s.prazoTxt)).toEqual([null, 'seg 09/11']);
  });
});

describe('resumoObraGeral', () => {
  const f = (p: Partial<FaseGeral>): FaseGeral => ({
    id: 'x',
    n: 1,
    titulo: 't',
    total: 1,
    concluidas: 0,
    atrasadas: 0,
    venceHoje: 0,
    concluida: false,
    atividades: [],
    ...p,
  });
  it('cobre as quatro formas', () => {
    expect(resumoObraGeral([])).toBe('Nenhuma fase ainda');
    expect(resumoObraGeral([f({ concluida: true }), f({ n: 2, concluida: true })])).toBe(
      'Todas as fases concluídas',
    );
    expect(resumoObraGeral([f({ concluida: true }), f({ n: 2 }), f({ n: 3 })])).toBe('Fase 2 de 3');
    expect(resumoObraGeral([f({ atrasadas: 1 }), f({ n: 2 })])).toBe(
      'Fase 1 de 2 · 1 atividade atrasada',
    );
    expect(resumoObraGeral([f({ atrasadas: 1 }), f({ n: 2, atrasadas: 2 })])).toBe(
      'Fase 1 de 2 · 3 atividades atrasadas',
    );
  });
});

describe('atalhosDataPrevista', () => {
  it('quinta', () => {
    expect(atalhosDataPrevista('2026-11-05')).toEqual([
      { valor: '2026-11-05', rotulo: 'Hoje' },
      { valor: '2026-11-06', rotulo: 'Amanhã' },
      { valor: '2026-11-09', rotulo: 'Seg 09/11' },
      { valor: '2026-11-10', rotulo: 'Ter 10/11' },
    ]);
  });
  it('sexta', () => {
    const r = atalhosDataPrevista('2026-11-06');
    expect(r[1]).toEqual({ valor: '2026-11-07', rotulo: 'Amanhã' });
    expect(r.slice(2).map((a) => a.rotulo)).toEqual(['Seg 09/11', 'Ter 10/11']);
  });
});

describe('podePlanejarObraGeral', () => {
  it('administrador e coordenador planejam; membro não', () => {
    expect(
      podePlanejarObraGeral({ administrador: true, acessoContorno: false, papelGeral: null }),
    ).toBe(true);
    expect(
      podePlanejarObraGeral({
        administrador: false,
        acessoContorno: false,
        papelGeral: 'coordenador',
      }),
    ).toBe(true);
    expect(
      podePlanejarObraGeral({ administrador: false, acessoContorno: false, papelGeral: 'membro' }),
    ).toBe(false);
  });
});
