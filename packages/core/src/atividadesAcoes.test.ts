import { describe, expect, it } from 'vitest';
import { atividadeParaAcaoBase, resumoEquipeDia, textoAvisoEquipe } from './acoes';
import {
  atividadesSemDono,
  prazosParaGravarAtividades,
  semTarefaAbertaAtividade,
  type LinhaAtividadeTopo,
} from './atividadesAcoes';

const fases = [
  { id: 'f0', preliminar: true, titulo: 'Pré-obra' },
  { id: 'f1', preliminar: false, titulo: 'Demolição' },
];

function atv(p: Partial<LinhaAtividadeTopo> & { id: string }): LinhaAtividadeTopo {
  return {
    obra_id: 'o1',
    fase_id: 'f1',
    pai_id: null,
    nome: `Atividade ${p.id}`,
    prestador: null,
    concluida_em: null,
    fim_previsto_calc: null,
    ...p,
  };
}

const cron = {
  porId: {
    a1: { fim_previsto: '2026-11-10' },
    a2: { fim_previsto: '2026-11-11' },
    a3: { fim_previsto: '2026-11-12' },
    a4: { fim_previsto: '2026-11-13' },
    a5: { fim_previsto: '2026-11-14' },
    a6: { fim_previsto: '2026-11-17' },
  },
};

describe('atividadesSemDono', () => {
  it('inclui a atividade de topo aberta com fim previsto', () => {
    const r = atividadesSemDono(
      [atv({ id: 'a1', nome: 'Demolir parede', prestador: 'João' })],
      fases,
      cron,
      [],
      'o1',
      'Unidade Centro',
    );
    expect(r).toEqual([
      {
        id: 'a1',
        obraId: 'o1',
        obraNome: 'Unidade Centro',
        nome: 'Demolir parede',
        faseNome: 'Demolição',
        prestador: 'João',
        prazo: '2026-11-10',
      },
    ]);
  });

  it('exclui subitem, concluída, pré-obra, fora do cronograma e com tarefa aberta vinculada', () => {
    const r = atividadesSemDono(
      [
        atv({ id: 'a1', pai_id: 'a2' }),
        atv({ id: 'a2', concluida_em: '2026-11-03T10:00:00Z' }),
        atv({ id: 'a3', fase_id: 'f0' }),
        atv({ id: 'x9' }),
        atv({ id: 'a4' }),
        atv({ id: 'a5' }),
      ],
      fases,
      cron,
      [
        { vinculo_tipo: 'atividade', vinculo_id: 'a4' },
        { vinculo_tipo: 'providencia', vinculo_id: 'a5' },
      ],
      'o1',
      'Centro',
    );
    expect(r.map((x) => x.id)).toEqual(['a5']);
  });

  it('passa null quando o prestador está em branco', () => {
    const r = atividadesSemDono([atv({ id: 'a1', prestador: '  ' })], fases, cron, [], 'o1', 'C');
    expect(r[0]?.prestador).toBeNull();
  });
});

describe('prazosParaGravarAtividades', () => {
  it('devolve só as que diferem do gravado, de topo, abertas e fora do pré-obra', () => {
    const r = prazosParaGravarAtividades(
      [
        atv({ id: 'a1', fim_previsto_calc: null }),
        atv({ id: 'a2', fim_previsto_calc: '2026-11-11' }),
        atv({ id: 'a3', fase_id: 'f0' }),
        atv({ id: 'a4', pai_id: 'a1' }),
        atv({ id: 'a5', concluida_em: '2026-11-03T10:00:00Z' }),
        atv({ id: 'a6', fim_previsto_calc: '2026-11-16' }),
        atv({ id: 'x9' }),
      ],
      cron,
      fases,
    );
    expect(r).toEqual([
      { id: 'a1', ate: '2026-11-10' },
      { id: 'a6', ate: '2026-11-17' },
    ]);
  });
});

describe('semTarefaAbertaAtividade', () => {
  it('tira as que têm tarefa aberta vinculada no cache', () => {
    const lista = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }];
    const r = semTarefaAbertaAtividade(lista, [
      { status: 'aberta', vinculo_tipo: 'atividade', vinculo_id: 'a1' },
      { status: 'concluida', vinculo_tipo: 'atividade', vinculo_id: 'a2' },
      { status: 'aberta', vinculo_tipo: 'providencia', vinculo_id: 'a3' },
    ]);
    expect(r.map((x) => x.id)).toEqual(['a2', 'a3']);
  });
});

describe('atividadeParaAcaoBase', () => {
  const base = {
    id: 'a1',
    obraId: 'o1',
    obraNome: 'Centro',
    nome: 'Demolir parede',
    faseNome: 'Demolição',
    prestador: null,
    prazo: '2026-11-03',
  };

  it('vira ação aberta sem responsável', () => {
    expect(atividadeParaAcaoBase(base)).toEqual({
      origem: 'atividade',
      id: 'a1',
      obraId: 'o1',
      texto: 'Atividade: Demolir parede',
      prazo: '2026-11-03',
      aberta: true,
      responsavelId: null,
      responsavelNome: null,
    });
  });

  it('atividade vencida sem dono conta em "sem" e fica fora do corpo do push', () => {
    const r = resumoEquipeDia([atividadeParaAcaoBase(base)], '2026-11-04');
    expect(r.atrasadas).toBe(1);
    expect(r.pessoas).toHaveLength(1);
    expect(r.pessoas[0]).toMatchObject({ chave: 'sem', atrasadas: 1, hoje: 0 });
    const aviso = textoAvisoEquipe(r);
    expect(aviso?.corpo).toBe('1 atrasada.');
    expect(aviso?.corpo).not.toContain('Sem responsável');
  });
});
