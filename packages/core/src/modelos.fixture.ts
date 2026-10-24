// Fixture de teste: Modelo 1 (Anexo A da SPEC) e derivação dos Modelos 2 e 3.
// Não é exportado pelo index — serve só aos testes do motor de cronograma.
import type { AtividadeEntrada } from './schedule';

/** Modelo 1 · CDC completo — 28 atividades (Anexo A). */
export const MODELO_1: AtividadeEntrada[] = [
  { id: '1', duracao_du: 2 },
  { id: '2', duracao_du: 0, predecessoras: ['1'] }, // derivada dos subitens
  { id: '2.1', duracao_du: 2, pai_id: '2', em_sequencia: true }, // início
  { id: '2.2', duracao_du: 2, pai_id: '2', em_sequencia: false }, // paralelo
  { id: '2.3', duracao_du: 3, pai_id: '2', em_sequencia: true }, // em sequência
  { id: '3', duracao_du: 2, predecessoras: ['2'] },
  { id: '4', duracao_du: 6, predecessoras: ['3'] },
  { id: '5', duracao_du: 8, predecessoras: ['3'] },
  { id: '6', duracao_du: 6, predecessoras: ['3'] },
  { id: '7', duracao_du: 6, predecessoras: ['3'] },
  { id: '8', duracao_du: 4, predecessoras: ['5'] },
  { id: '9', duracao_du: 5, predecessoras: ['3'] },
  { id: '10', duracao_du: 3, predecessoras: ['7'] },
  { id: '11', duracao_du: 4, predecessoras: ['7', '10'] },
  { id: '12', duracao_du: 8, predecessoras: ['5', '6', '8', '9'] },
  { id: '13', duracao_du: 6, predecessoras: ['11'] },
  { id: '14', duracao_du: 4, predecessoras: ['4', '5'] },
  { id: '15', duracao_du: 6, predecessoras: ['12', '14'] },
  { id: '16', duracao_du: 6, predecessoras: ['15'] },
  { id: '17', duracao_du: 5, predecessoras: ['11', '16'] },
  { id: '18', duracao_du: 3, predecessoras: ['13'] },
  { id: '19', duracao_du: 3, predecessoras: ['13'] },
  { id: '20', duracao_du: 4, predecessoras: ['16'] },
  { id: '21', duracao_du: 4, predecessoras: ['16'] },
  { id: '22', duracao_du: 3, predecessoras: ['12', '16'] },
  { id: '23', duracao_du: 4, predecessoras: ['16'] },
  { id: '24', duracao_du: 3, predecessoras: ['21'] },
  { id: '25', duracao_du: 3, predecessoras: ['17'] },
  { id: '26', duracao_du: 2, predecessoras: ['18', '19', '20', '21', '22', '23', '24', '25'] },
  { id: '27', duracao_du: 2, predecessoras: ['26'] },
  { id: '28', duracao_du: 1, predecessoras: ['27'] },
];

/**
 * Deriva um modelo removendo atividades: quem dependia das removidas herda as
 * predecessoras delas (transitivamente). `overrides` ajusta atividades que ficam.
 */
export function derivarModelo(
  base: AtividadeEntrada[],
  remover: Iterable<string>,
  overrides: Record<string, Partial<AtividadeEntrada>> = {},
): AtividadeEntrada[] {
  const rem = new Set(remover);
  const porId = new Map(base.map((a) => [a.id, a]));

  const predsEfetivas = (id: string): string[] => {
    const a = porId.get(id);
    const out: string[] = [];
    for (const p of a?.predecessoras ?? []) {
      if (rem.has(p)) out.push(...predsEfetivas(p));
      else out.push(p);
    }
    return [...new Set(out)];
  };

  const result: AtividadeEntrada[] = [];
  for (const a of base) {
    if (rem.has(a.id)) continue;
    if (a.pai_id && rem.has(a.pai_id)) continue; // subitem de atividade/pai removido
    let na: AtividadeEntrada = { ...a };
    if (!a.pai_id) na.predecessoras = predsEfetivas(a.id);
    if (overrides[a.id]) na = { ...na, ...overrides[a.id] };
    result.push(na);
  }
  return result;
}

/** Modelo 2 · CDC sem vestiários — sem 10, 13, 18 e 19. */
export const MODELO_2: AtividadeEntrada[] = derivarModelo(MODELO_1, ['10', '13', '18', '19']);

/** Modelo 3 · Retrofit leve — sem 4,9,10,11,13,18,19; demolição vira "Retiradas pontuais" (2 du). */
export const MODELO_3: AtividadeEntrada[] = derivarModelo(
  MODELO_1,
  ['4', '9', '10', '11', '13', '18', '19', '2.1', '2.2', '2.3'],
  { '2': { duracao_du: 2 } },
);
