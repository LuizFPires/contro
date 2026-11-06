const PADRAO = 'Não foi possível salvar. Confira a conexão e tente de novo.';

/** Texto curto em pt-BR vindo das nossas RPCs (e não uma mensagem técnica do Postgres). */
function parecePtBrCurto(m: string): boolean {
  return (
    m.length > 0 &&
    m.length <= 120 &&
    /[À-ÿ]|\b(não|de|do|da|para|e-mail|papel|obra|obras)\b/i.test(m)
  );
}

/** Traduz o erro das RPCs de acesso de Obras gerais para uma mensagem em pt-BR. */
export function mensagemErroAcesso(error: unknown): string {
  const e = (error ?? {}) as { code?: string; message?: string };
  if (e.code === '42501') return 'Só o Administrador pode dar acesso.';
  if (e.code === '22023') {
    const m = (e.message ?? '').trim();
    return parecePtBrCurto(m) ? m : 'Confira os dados: nome, e-mail, papel e obras.';
  }
  if (e.code === '23503') return 'Esse item não existe mais.';
  return PADRAO;
}
