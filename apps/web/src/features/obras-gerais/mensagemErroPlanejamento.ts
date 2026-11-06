import { mensagemErroAcesso } from './mensagemErroAcesso';

/** Erros das RPCs de planejamento: igual ao de acesso, mas "sem permissão" não fala em Administrador. */
export function mensagemErroPlanejamento(error: unknown): string {
  if ((error as { code?: string } | null)?.code === '42501')
    return 'Você não tem permissão para isso.';
  return mensagemErroAcesso(error);
}
