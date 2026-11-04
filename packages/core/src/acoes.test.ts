import { describe, expect, it } from 'vitest';
import {
  classificarAcoes,
  contarAcoesNaJanela,
  estadoAcao,
  prazoPendencia,
  PROXIMOS_DU,
  providenciaParaAcaoBase,
  resumoAcoesDia,
  resumoEquipeDia,
  textoAvisoAcoes,
  textoAvisoEquipe,
  textoResumoSecoes,
  type Acao,
} from './acoes';

const HOJE = '2026-11-04';

function acao(p: Partial<Acao> & { id: string }): Acao {
  return {
    origem: 'tarefa',
    obraId: 'o1',
    texto: 'x',
    prazo: HOJE,
    aberta: true,
    responsavelId: null,
    responsavelNome: null,
    ...p,
  };
}

describe('prazoPendencia', () => {
  it('alta: 2 d.u. a partir de segunda 02/11 → qua 04/11', () =>
    expect(prazoPendencia('alta', '2026-11-02')).toBe('2026-11-04'));
  it('média 4 e baixa 6 d.u.', () => {
    expect(prazoPendencia('media', '2026-11-02')).toBe('2026-11-06');
    expect(prazoPendencia('baixa', '2026-11-02')).toBe('2026-11-10');
  });
  it('apontada no sábado conta a partir da segunda', () =>
    expect(prazoPendencia('alta', '2026-10-31')).toBe('2026-11-04'));
  it('config própria', () =>
    expect(prazoPendencia('alta', '2026-11-02', { alta: 1, media: 4, baixa: 6 })).toBe(
      '2026-11-03',
    ));
});

describe('estadoAcao', () => {
  it('atrasada, hoje, próxima e concluída', () => {
    expect(estadoAcao({ aberta: true, prazo: '2026-11-03' }, HOJE)).toBe('atrasada');
    expect(estadoAcao({ aberta: true, prazo: '2026-11-04' }, HOJE)).toBe('hoje');
    expect(estadoAcao({ aberta: true, prazo: '2026-11-05' }, HOJE)).toBe('proxima');
    expect(estadoAcao({ aberta: false, prazo: '2026-10-01' }, HOJE)).toBe('concluida');
  });
});

describe('classificarAcoes', () => {
  it('ordena por prazo e concluídas da mais recente; fechada vencida vai para concluídas', () => {
    const r = classificarAcoes(
      [
        acao({ id: 'p2', prazo: '2026-11-09' }),
        acao({ id: 'p1', prazo: '2026-11-05' }),
        acao({ id: 'a2', prazo: '2026-11-02' }),
        acao({ id: 'a1', prazo: '2026-10-30' }),
        acao({ id: 'h', prazo: HOJE }),
        acao({ id: 'c1', aberta: false, prazo: '2026-10-01', concluidaEm: '2026-10-02T10:00:00Z' }),
        acao({ id: 'c2', aberta: false, prazo: '2026-10-01', concluidaEm: '2026-11-03T10:00:00Z' }),
      ],
      HOJE,
    );
    expect(r.atrasadas.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(r.hoje.map((a) => a.id)).toEqual(['h']);
    expect(r.proximas.map((a) => a.id)).toEqual(['p1', 'p2']);
    expect(r.concluidas.map((a) => a.id)).toEqual(['c2', 'c1']);
  });
});

describe('classificarAcoes · próximos 5 dias', () => {
  const sexta = '2026-11-06';
  it('proximas vai até 5 dias úteis; o resto vai para depois, ordenado', () => {
    expect(PROXIMOS_DU).toBe(5);
    const r = classificarAcoes(
      [
        acao({ id: 'd2', prazo: '2026-11-20' }),
        acao({ id: 'x', prazo: '2026-11-16' }),
        acao({ id: 'lim', prazo: '2026-11-13' }),
        acao({ id: 'seg', prazo: '2026-11-09' }),
        acao({ id: 'c', aberta: false, prazo: '2026-12-01', concluidaEm: '2026-11-05T10:00:00Z' }),
      ],
      sexta,
    );
    expect(r.proximas.map((a) => a.id)).toEqual(['seg', 'lim']);
    expect(r.depois.map((a) => a.id)).toEqual(['x', 'd2']);
    expect(r.concluidas.map((a) => a.id)).toEqual(['c']);
  });
});

describe('contarAcoesNaJanela', () => {
  it('conta atrasadas, hoje e até 5 dias úteis; ignora concluídas e as de depois', () => {
    const sexta = '2026-11-06';
    expect(
      contarAcoesNaJanela(
        [
          acao({ id: 'a', prazo: '2026-10-30' }),
          acao({ id: 'h', prazo: sexta }),
          acao({ id: 'lim', prazo: '2026-11-13' }),
          acao({ id: 'x', prazo: '2026-11-16' }),
          acao({ id: 'c', aberta: false, prazo: '2026-11-09' }),
        ],
        sexta,
      ),
    ).toBe(3);
  });
});

describe('resumoAcoesDia', () => {
  it('conta só abertas', () => {
    expect(
      resumoAcoesDia(
        [
          { aberta: true, prazo: '2026-11-01' },
          { aberta: true, prazo: HOJE },
          { aberta: true, prazo: HOJE },
          { aberta: true, prazo: '2026-11-10' },
          { aberta: false, prazo: '2026-11-01' },
          { aberta: false, prazo: HOJE },
        ],
        HOJE,
      ),
    ).toEqual({ atrasadas: 1, hoje: 2 });
  });
});

describe('resumoEquipeDia', () => {
  it('agrupa por responsavelId, nome digitado e "sem"; ordena atrasadas desc, hoje desc, nome', () => {
    const r = resumoEquipeDia(
      [
        acao({ id: '1', responsavelId: 'u1', responsavelNome: 'Zeca Lima', prazo: '2026-11-01' }),
        acao({ id: '2', responsavelId: 'u1', responsavelNome: 'Zeca Lima', prazo: HOJE }),
        acao({ id: '3', responsavelId: 'u2', responsavelNome: 'Ana Souza', prazo: HOJE }),
        acao({ id: '4', responsavelId: 'u2', responsavelNome: 'Ana Souza', prazo: HOJE }),
        acao({ id: '5', responsavelNome: 'Pedreiro Zé', prazo: '2026-11-02' }),
        acao({ id: '6', prazo: '2026-11-02' }),
        acao({ id: '7', responsavelId: 'u3', responsavelNome: 'Bia Dias', prazo: HOJE }),
        acao({ id: '8', responsavelId: 'u3', responsavelNome: 'Bia Dias', prazo: '2026-11-20' }),
        acao({ id: '9', responsavelId: 'u4', responsavelNome: 'Caio Reis', aberta: false }),
      ],
      HOJE,
    );
    expect(r.atrasadas).toBe(3);
    expect(r.hoje).toBe(4);
    expect(r.pessoas).toEqual([
      { chave: 'u1', nome: 'Zeca Lima', atrasadas: 1, hoje: 1 },
      { chave: 'nome:Pedreiro Zé', nome: 'Pedreiro Zé', atrasadas: 1, hoje: 0 },
      { chave: 'u2', nome: 'Ana Souza', atrasadas: 0, hoje: 2 },
      { chave: 'u3', nome: 'Bia Dias', atrasadas: 0, hoje: 1 },
      { chave: 'sem', nome: 'Sem responsável', atrasadas: 1, hoje: 0 },
    ]);
  });
});

describe('textoAvisoAcoes', () => {
  it('textos e singular/plural', () => {
    expect(textoAvisoAcoes({ atrasadas: 0, hoje: 0 })).toBeNull();
    expect(textoAvisoAcoes({ atrasadas: 3, hoje: 4 })).toEqual({
      titulo: 'CONTRO · Ações de hoje',
      corpo: '3 atrasadas e 4 vencem hoje. Toque para ver a lista.',
    });
    expect(textoAvisoAcoes({ atrasadas: 1, hoje: 0 })?.corpo).toBe(
      '1 atrasada. Toque para ver a lista.',
    );
    expect(textoAvisoAcoes({ atrasadas: 0, hoje: 1 })?.corpo).toBe(
      '1 vence hoje. Toque para ver a lista.',
    );
    expect(textoAvisoAcoes({ atrasadas: 1, hoje: 1 })?.corpo).toBe(
      '1 atrasada e 1 vence hoje. Toque para ver a lista.',
    );
  });
});

describe('textoAvisoEquipe', () => {
  it('até 3 pessoas, "e mais N", "Sem responsável" fora das vagas', () =>
    expect(
      textoAvisoEquipe({
        atrasadas: 5,
        hoje: 9,
        pessoas: [
          { chave: 'a', nome: 'João Vítor Silva', atrasadas: 2, hoje: 3 },
          { chave: 'b', nome: 'Matheus Teixeira', atrasadas: 1, hoje: 2 },
          { chave: 'c', nome: 'Thaina Costa', atrasadas: 0, hoje: 4 },
          { chave: 'd', nome: 'Rafael Souza', atrasadas: 1, hoje: 0 },
          { chave: 'sem', nome: 'Sem responsável', atrasadas: 1, hoje: 0 },
        ],
      }),
    ).toEqual({
      titulo: 'CONTRO · Equipe hoje',
      corpo: '5 atrasadas e 9 vencem hoje · João V 2+3, Matheus T 1+2, Thaina C 0+4 e mais 1.',
    }));

  it('só "Sem responsável": apenas os totais', () =>
    expect(
      textoAvisoEquipe({
        atrasadas: 1,
        hoje: 0,
        pessoas: [{ chave: 'sem', nome: 'Sem responsável', atrasadas: 1, hoje: 0 }],
      })?.corpo,
    ).toBe('1 atrasada.'));

  it('nada a avisar devolve null', () =>
    expect(textoAvisoEquipe({ atrasadas: 0, hoje: 0, pessoas: [] })).toBeNull());

  it('corta em 120 sem partir nome', () => {
    const longo = (c: string) => `${c.repeat(28)} Souza`;
    const r = textoAvisoEquipe({
      atrasadas: 6,
      hoje: 6,
      pessoas: [
        { chave: 'a', nome: longo('A'), atrasadas: 2, hoje: 2 },
        { chave: 'b', nome: longo('B'), atrasadas: 2, hoje: 2 },
        { chave: 'c', nome: longo('C'), atrasadas: 2, hoje: 2 },
      ],
    });
    expect(r?.corpo.length).toBeLessThanOrEqual(120);
    expect(r?.corpo).toBe(
      `6 atrasadas e 6 vencem hoje · ${'A'.repeat(28)} S 2+2, ${'B'.repeat(28)} S 2+2 e mais 1.`,
    );
  });
});

describe('textoResumoSecoes', () => {
  it('plural', () =>
    expect(textoResumoSecoes({ atrasadas: 1, hoje: 7, proximas: 43, concluidas: 2 })).toBe(
      '1 atrasada · 7 vencem hoje · 43 nos próximos 5 dias · 2 concluídas',
    ));
  it('singular', () =>
    expect(textoResumoSecoes({ atrasadas: 0, hoje: 1, proximas: 1, concluidas: 1 })).toBe(
      '0 atrasadas · 1 vence hoje · 1 nos próximos 5 dias · 1 concluída',
    ));
});

describe('providenciaParaAcaoBase', () => {
  const base = { id: 'p1', obraId: 'o1', descricao: 'Pinturas', prazo: '2026-10-26' };

  it('vira ação aberta, sem responsável, com o rótulo do tipo no texto', () =>
    expect(providenciaParaAcaoBase({ ...base, tipo: 'contratacao' })).toEqual({
      origem: 'providencia',
      id: 'p1',
      obraId: 'o1',
      texto: 'Contratação: Pinturas',
      prazo: '2026-10-26',
      aberta: true,
      responsavelId: null,
      responsavelNome: null,
    }));

  it('rótulos de locação e compra', () => {
    expect(providenciaParaAcaoBase({ ...base, tipo: 'locacao' }).texto).toBe('Locação: Pinturas');
    expect(providenciaParaAcaoBase({ ...base, tipo: 'compra' }).texto).toBe('Compra: Pinturas');
  });

  it('atrasada cai em "Sem responsável" no resumo, sem citar isso no aviso', () => {
    const r = resumoEquipeDia([providenciaParaAcaoBase({ ...base, tipo: 'contratacao' })], HOJE);
    expect(r.atrasadas).toBe(1);
    expect(r.pessoas).toEqual([{ chave: 'sem', nome: 'Sem responsável', atrasadas: 1, hoje: 0 }]);
    expect(textoAvisoEquipe(r)?.corpo).not.toContain('Sem responsável');
  });
});
