import { describe, expect, it } from 'vitest';
import { mensagemErroPlanejamento } from './mensagemErroPlanejamento';

describe('mensagemErroPlanejamento', () => {
  it('42501 diz que a pessoa não tem permissão, sem falar em Administrador', () => {
    expect(mensagemErroPlanejamento({ code: '42501', message: 'x' })).toBe(
      'Você não tem permissão para isso.',
    );
  });
  it('os demais códigos seguem a mensagem de acesso', () => {
    expect(mensagemErroPlanejamento({ code: '23503' })).toBe('Esse item não existe mais.');
    expect(mensagemErroPlanejamento({ code: '22023', message: 'Nome não pode ficar vazio.' })).toBe(
      'Nome não pode ficar vazio.',
    );
    expect(mensagemErroPlanejamento(new TypeError('Failed to fetch'))).toBe(
      'Não foi possível salvar. Confira a conexão e tente de novo.',
    );
  });
});
