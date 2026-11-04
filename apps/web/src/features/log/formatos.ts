// Instantes do Log no fuso do aparelho: dia (YYYY-MM-DD) e hora ("14:05").
// A linha "vencida" vem só com a data (sem hora).
import { dataLocal } from '../obras/api';

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function diaDe(em: string): string {
  return SO_DATA.test(em) ? em : dataLocal(em);
}

export function horaDe(em: string): string | null {
  if (SO_DATA.test(em)) return null;
  const d = new Date(em);
  if (Number.isNaN(d.getTime())) return null;
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
