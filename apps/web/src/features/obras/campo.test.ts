import { describe, expect, it } from 'vitest';
import { argsSalvarTarefa, type EntradaTarefa } from './campo';

const base: EntradaTarefa = {
  id: 't1',
  texto: 'Trocar o rodapé',
  responsavelId: 'u1',
  prazo: '2026-11-06',
};

describe('argsSalvarTarefa', () => {
  it('manda p_motivo quando há motivo de replanejamento', () => {
    const args = argsSalvarTarefa(
      'o1',
      { ...base, motivoReplanejamento: 'faltou material' },
      'op1',
    );
    expect(args).toMatchObject({
      p_id: 't1',
      p_obra_id: 'o1',
      p_prazo: '2026-11-06',
      p_client_op_id: 'op1',
      p_motivo: 'faltou material',
    });
  });

  it('não manda a chave p_motivo sem motivo (compatível com o banco antes do db push)', () => {
    expect('p_motivo' in argsSalvarTarefa('o1', base)).toBe(false);
    expect('p_motivo' in argsSalvarTarefa('o1', { ...base, motivoReplanejamento: null })).toBe(
      false,
    );
    expect(argsSalvarTarefa('o1', base).p_client_op_id).toBeNull();
  });
});
