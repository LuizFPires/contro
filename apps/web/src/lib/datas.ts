// Formatos de data em pt-BR (CLAUDE.md): curta "qua 21/10", completa
// "quinta, 03/12/2026". ISO 'YYYY-MM-DD' em UTC para não deslocar o dia.
const DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const p2 = (n: number) => String(n).padStart(2, '0');

export function formatarDataCurta(iso: string): string {
  const dt = parse(iso);
  return `${DIAS_CURTO[dt.getUTCDay()]} ${p2(dt.getUTCDate())}/${p2(dt.getUTCMonth() + 1)}`;
}

export function formatarDataCompleta(iso: string): string {
  const dt = parse(iso);
  return `${DIAS_LONGO[dt.getUTCDay()]}, ${p2(dt.getUTCDate())}/${p2(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()}`;
}
