import { describe, expect, it } from 'vitest';
import type { Acao } from '@contro/core';
import { quemFazOQueBoletim } from './boletimAcoes';

const acao = (o: Partial<Acao> = {}): Acao => ({
  origem: 'pendencia',
  id: 'a1',
  obraId: 'o1',
  texto: 'Trocar rejunte',
  prazo: '2026-11-02',
  aberta: true,
  responsavelId: null,
  responsavelNome: 'Marcos',
  ...o,
});

describe('quemFazOQueBoletim', () => {
  const hoje = '2026-11-04';

  it('deixa de fora a pendência resolvida com prazo passado', () => {
    const g = quemFazOQueBoletim(
      [
        acao({ id: 'p1', texto: 'Resolvida antiga', aberta: false, concluidaEm: '2026-10-20' }),
        acao({ id: 'p2', texto: 'Aberta atrasada' }),
      ],
      hoje,
    );
    const textos = g.flatMap((x) => x.itens.map((i) => i.texto));
    expect(textos).toEqual(['Aberta atrasada']);
    expect(g[0]!.itens[0]!.atrasado).toBe(true);
  });

  it('deixa de fora a tarefa feita', () => {
    const g = quemFazOQueBoletim(
      [acao({ origem: 'tarefa', aberta: false, concluidaEm: '2026-10-30' })],
      hoje,
    );
    expect(g).toEqual([]);
  });

  it('agrupa a aberta sem responsável em "Sem responsável" e sem atraso no prazo futuro', () => {
    const g = quemFazOQueBoletim([acao({ responsavelNome: null, prazo: '2026-11-10' })], hoje);
    expect(g).toHaveLength(1);
    expect(g[0]!.pessoa).toBe('Sem responsável');
    expect(g[0]!.itens[0]).toMatchObject({ atrasado: false, data: '2026-11-10' });
  });
});
