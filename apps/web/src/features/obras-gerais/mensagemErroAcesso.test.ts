import { describe, expect, it } from 'vitest';
import { mensagemErroAcesso } from './mensagemErroAcesso';

describe('mensagemErroAcesso', () => {
  it('42501 vira aviso de permissão', () => {
    expect(mensagemErroAcesso({ code: '42501', message: 'x' })).toBe(
      'Só o Gestor pode dar acesso.',
    );
  });
  it('22023 mostra a mensagem curta em pt-BR do servidor ou um texto padrão', () => {
    expect(mensagemErroAcesso({ code: '22023', message: 'Papel inválido.' })).toBe(
      'Papel inválido.',
    );
    expect(mensagemErroAcesso({ code: '22023', message: 'invalid input value for enum' })).toBe(
      'Confira os dados: nome, e-mail, papel e obras.',
    );
  });
  it('23503 avisa que o item não existe mais', () => {
    expect(mensagemErroAcesso({ code: '23503' })).toBe('Esse item não existe mais.');
  });
  it('outros erros (rede) viram a mensagem de conexão', () => {
    expect(mensagemErroAcesso(new TypeError('Failed to fetch'))).toBe(
      'Não foi possível salvar. Confira a conexão e tente de novo.',
    );
  });
});
