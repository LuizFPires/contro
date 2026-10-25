// @obdc/core — REGRAS DE DOMÍNIO puras e testadas.
// Telas e pdf-service importam daqui e nunca recalculam por conta própria.
// O motor de cronograma (calendar, schedule) entra no M1.

export * from './calendar';
export * from './schedule';
export * from './obra';
export * from './providencias';
export * from './pendencias';

export type Perfil = 'gestor' | 'equipe';

/** Rótulo curto do perfil, em pt-BR. */
export function rotuloPerfil(perfil: Perfil): string {
  return perfil === 'gestor' ? 'Gestor' : 'Equipe de obra';
}

/** Só o gestor edita modelos de obra (regra de domínio, espelhada na RLS). */
export function podeEditarModelos(perfil: Perfil): boolean {
  return perfil === 'gestor';
}
