import { describe, expect, it } from 'vitest';
import type { ObraAtv, ObraCompleta, ObraFase } from './detalhe';
import {
  agruparPorFase,
  alvosMapa,
  ehFaseMapa,
  itensAtividadesObra,
  nomesItensMapa,
} from './listaAtividades';

const fases: ObraFase[] = [
  { id: 'orc', ordem: 0, titulo: 'Orçamento', preliminar: true },
  { id: 'map', ordem: 1, titulo: 'Mapa de coleta', preliminar: true },
  { id: 'f2', ordem: 3, titulo: 'Acabamento', preliminar: false },
  { id: 'f1', ordem: 2, titulo: 'Demolição', preliminar: false },
];

function atv(p: Partial<ObraAtv> & Pick<ObraAtv, 'id' | 'fase_id' | 'nome' | 'ordem'>): ObraAtv {
  return {
    duracao_du: 1,
    pai_id: null,
    em_sequencia: true,
    inicio_manual: null,
    concluida_em: null,
    avanco_pct: 0,
    foto_conclusao_id: null,
    prestador: null,
    mapa_antecedencia_du: null,
    mapaLibera: [],
    preObra: false,
    predecessoras: [],
    defasagens: {},
    providencias: [],
    ...p,
  };
}

const obra = {
  fases,
  atividades: [
    atv({ id: 'o1', fase_id: 'orc', nome: 'Orçamento', ordem: 1, preObra: true }),
    atv({
      id: 'm1',
      fase_id: 'map',
      nome: 'Elétrica',
      ordem: 1,
      preObra: true,
      mapa_antecedencia_du: 10,
    }),
    atv({
      id: 'm2',
      fase_id: 'map',
      nome: '  eletrica ',
      ordem: 2,
      preObra: true,
      mapa_antecedencia_du: 10,
    }),
    atv({
      id: 'm3',
      fase_id: 'map',
      nome: 'Ar-condicionado',
      ordem: 3,
      preObra: true,
      mapa_antecedencia_du: 5,
    }),
    atv({ id: 'b2', fase_id: 'f2', nome: 'Pintura', ordem: 1 }),
    atv({ id: 'a1', fase_id: 'f1', nome: 'Infra de elétrica', ordem: 1 }),
    atv({ id: 'a2', fase_id: 'f1', nome: 'Remoção do piso', ordem: 2, concluida_em: '2026-11-01' }),
    atv({ id: 's1', fase_id: 'f1', nome: 'Subitem elétrico', ordem: 1, pai_id: 'a1' }),
  ],
} as unknown as ObraCompleta;

describe('itensAtividadesObra', () => {
  it('lista só o topo, fase a fase, com o #N da obra', () => {
    expect(itensAtividadesObra(obra).map((a) => [a.id, a.numero])).toEqual([
      ['o1', 1],
      ['m1', 2],
      ['m2', 3],
      ['m3', 4],
      ['a1', 5],
      ['a2', 6],
      ['b2', 7],
    ]);
  });
});

describe('alvosMapa', () => {
  it('tira o pré-obra, os subitens e as concluídas', () => {
    expect(alvosMapa(obra).map((a) => a.id)).toEqual(['a1', 'b2']);
  });

  it('busca pelo nome sem acento', () => {
    expect(alvosMapa(obra, 'eletrica').map((a) => a.id)).toEqual(['a1']);
    expect(alvosMapa(obra, 'PINTURA').map((a) => a.id)).toEqual(['b2']);
  });

  it('busca pelo #N', () => {
    expect(alvosMapa(obra, '#7').map((a) => a.id)).toEqual(['b2']);
    expect(alvosMapa(obra, '5').map((a) => a.id)).toEqual(['a1']);
    expect(alvosMapa(obra, '#6')).toEqual([]);
  });

  it('agrupa por fase na ordem das fases', () => {
    const g = agruparPorFase(obra.fases, alvosMapa(obra));
    expect(g.map((x) => [x.fase.titulo, x.itens.map((a) => a.id)])).toEqual([
      ['Demolição', ['a1']],
      ['Acabamento', ['b2']],
    ]);
  });
});

describe('ehFaseMapa', () => {
  it('é a fase preliminar cujo título começa com "Mapa"', () => {
    expect(ehFaseMapa(fases[1])).toBe(true);
    expect(ehFaseMapa({ preliminar: true, titulo: 'mapa' })).toBe(true);
    expect(ehFaseMapa(fases[0])).toBe(false);
    expect(ehFaseMapa({ preliminar: false, titulo: 'Mapa de coleta' })).toBe(false);
  });
});

describe('nomesItensMapa', () => {
  it('nomes da fase do mapa, sem repetição (ignora acento e caixa), em ordem', () => {
    expect(nomesItensMapa(obra)).toEqual(['Ar-condicionado', 'Elétrica']);
  });
});
