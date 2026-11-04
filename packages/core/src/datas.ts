// Utilitários internos de data usados por log.ts e score.ts (não exportados
// pelo index): dia local de um timestamp e atraso em dias úteis.
import { duEntre, type DataISO } from './calendar';

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Dia local de um timestamp ISO (ou a própria data, se já for data). */
export function diaLocal(em: string): DataISO {
  if (RE_DATA.test(em)) return em;
  const d = new Date(em);
  if (Number.isNaN(d.getTime())) return em.slice(0, 10);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Dias úteis de atraso de quem tinha `prazo` e fechou (ou segue aberto) em `dia`.
 * Passou do prazo conta pelo menos 1 d.u. (prazo no sábado, concluído na segunda = 1).
 */
export function atrasoDU(prazo: DataISO, dia: DataISO): number {
  if (dia <= prazo) return 0;
  return Math.max(1, duEntre(prazo, dia));
}
