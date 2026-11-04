import { describe, expect, it } from 'vitest';
import { entradaAtribuicao, entradaDaFolha, OUTRO, responsavelDaTarefa } from './entradaTarefa';
import { tarefaDaLinha, type LinhaTarefa, type TarefaObra } from './tarefasObra';

const linha = (o: Partial<LinhaTarefa> = {}): LinhaTarefa => ({
  id: 't1',
  obra_id: 'o1',
  texto: 'Compra: Cabos',
  responsavel_id: null,
  prazo: '2026-11-10',
  prazo_original: null,
  replanejamentos: 0,
  status: 'aberta',
  vinculo_tipo: 'providencia',
  vinculo_id: 'p1',
  origem_texto: 'Providência da obra',
  observacao: 'Ver com o fornecedor de sempre',
  responsavel_nome: 'Maria Souza',
  avanco_pct: null,
  comentario: null,
  avanco_em: null,
  feita_em: null,
  responsavel: null,
  ...o,
});

describe('entradaAtribuicao', () => {
  it('manda o nome digitado completo (não o curto) e o vínculo com a providência', () => {
    const e = entradaAtribuicao(
      { id: 'p1' },
      {
        texto: 'Compra: Cabos',
        responsavelId: null,
        responsavelNome: '  Maria Souza ',
        prazo: '2026-11-10',
      },
    );
    expect(e).toEqual({
      texto: 'Compra: Cabos',
      responsavelId: null,
      responsavelNome: 'Maria Souza',
      prazo: '2026-11-10',
      vinculoTipo: 'providencia',
      vinculoId: 'p1',
      origemTexto: 'Providência da obra',
    });
  });

  it('com pessoa do app, o nome vai nulo', () => {
    const e = entradaAtribuicao(
      { id: 'p1' },
      { texto: 'x', responsavelId: 'u1', responsavelNome: 'Ana Lima', prazo: '2026-11-10' },
    );
    expect(e.responsavelId).toBe('u1');
    expect(e.responsavelNome).toBeNull();
  });
});

describe('tarefaDaLinha', () => {
  it('guarda o nome digitado bruto para editar e o curto para exibir', () => {
    const t = tarefaDaLinha(linha());
    expect(t.responsavelNome).toBe('Maria S');
    expect(t.responsavelNomeBruto).toBe('Maria Souza');
  });
});

describe('folha de tarefa (edição)', () => {
  const tarefa: TarefaObra = tarefaDaLinha(linha());

  it('abre em "Outro nome" com o nome completo quando não há pessoa do app', () => {
    expect(responsavelDaTarefa(tarefa)).toEqual({
      responsavelId: OUTRO,
      nomeDigitado: 'Maria Souza',
    });
    expect(responsavelDaTarefa({ responsavel_id: 'u1', responsavelNomeBruto: null })).toEqual({
      responsavelId: 'u1',
      nomeDigitado: '',
    });
    expect(responsavelDaTarefa({ responsavel_id: null, responsavelNomeBruto: null })).toEqual({
      responsavelId: '',
      nomeDigitado: '',
    });
  });

  it('mudar só o prazo preserva o nome digitado e a observação', () => {
    const e = entradaDaFolha(
      { texto: tarefa.texto, ...responsavelDaTarefa(tarefa), prazo: '2026-11-12' },
      tarefa,
    );
    expect(e).toEqual({
      id: 't1',
      texto: 'Compra: Cabos',
      responsavelId: null,
      responsavelNome: 'Maria Souza',
      prazo: '2026-11-12',
      observacao: 'Ver com o fornecedor de sempre',
    });
  });

  it('nova tarefa com pessoa do app: sem nome e sem observação', () => {
    const e = entradaDaFolha(
      { texto: ' Ligar ', responsavelId: 'u1', nomeDigitado: '', prazo: '2026-11-05' },
      null,
    );
    expect(e).toEqual({
      id: null,
      texto: 'Ligar',
      responsavelId: 'u1',
      responsavelNome: null,
      prazo: '2026-11-05',
    });
  });
});
