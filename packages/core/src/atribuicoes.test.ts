import { describe, expect, it } from 'vitest';
import { compilarPorPessoa, derivarAtribuicoes, type EntradaAtribuicoes } from './atribuicoes';

const vazio: EntradaAtribuicoes = {
  tarefas: [],
  engenheiroNome: 'Rafael',
  comprasNome: 'Paulo',
  atividadesAtrasadas: [],
  concluirSemana: [],
  comecarSemana: [],
  providenciasAtrasadas: [],
  providenciarSemana: [],
};

describe('derivarAtribuicoes', () => {
  it('monta textos do engenheiro e de compras', () => {
    const itens = derivarAtribuicoes(
      {
        ...vazio,
        atividadesAtrasadas: [{ nome: 'Contrapiso', fimPrevisto: '2026-10-20' }],
        concluirSemana: [{ nome: 'Pintura', prestador: 'Cores SA', fimPrevisto: '2026-10-28' }],
        comecarSemana: [{ nome: 'Forro', inicioPrevisto: '2026-10-26' }],
        providenciasAtrasadas: [{ tipo: 'compra', descricao: 'Porcelanato' }],
        providenciarSemana: [
          { tipo: 'contratacao', descricao: 'Pintor', naObraEmFmt: 'qua 28/10' },
        ],
      },
      '2026-10-24',
    );
    const textos = itens.map((i) => i.texto);
    expect(textos).toContain('Recuperar atraso: Contrapiso');
    expect(textos).toContain('Garantir conclusão: Pintura (Cores SA)');
    expect(textos).toContain('Mobilizar início: Forro');
    expect(textos).toContain('Destravar Compra: Porcelanato');
    expect(textos).toContain('Contratar: Pintor (na obra qua 28/10)');
    // a atividade atrasada (fim 20/10 < hoje 24/10) é vermelha
    expect(itens.find((i) => i.texto.startsWith('Recuperar'))?.atrasado).toBe(true);
  });

  it('sem engenheiro/compras definidos, só tarefas', () => {
    const itens = derivarAtribuicoes(
      {
        ...vazio,
        engenheiroNome: null,
        comprasNome: null,
        tarefas: [
          {
            texto: 'Ligar pro arquiteto',
            pessoa: 'Júlia',
            prazo: '2026-10-25',
            atrasado: false,
            concluido: false,
          },
        ],
        atividadesAtrasadas: [{ nome: 'X', fimPrevisto: '2026-10-01' }],
      },
      '2026-10-24',
    );
    expect(itens).toHaveLength(1);
    expect(itens[0].origem).toBe('tarefa');
  });
});

describe('compilarPorPessoa', () => {
  it('agrupa e ordena (abertas por prazo, concluídas no fim)', () => {
    const grupos = compilarPorPessoa([
      {
        texto: 'b',
        pessoa: 'Rafael',
        prazo: '2026-10-28',
        atrasado: false,
        concluido: false,
        origem: 'tarefa',
      },
      {
        texto: 'z',
        pessoa: 'Rafael',
        prazo: '2026-10-10',
        atrasado: false,
        concluido: true,
        origem: 'tarefa',
      },
      {
        texto: 'a',
        pessoa: 'Rafael',
        prazo: '2026-10-20',
        atrasado: true,
        concluido: false,
        origem: 'tarefa',
      },
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].itens.map((i) => i.texto)).toEqual(['a', 'b', 'z']);
  });
});
