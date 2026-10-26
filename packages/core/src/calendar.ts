// Calendário em DIAS ÚTEIS (segunda a sexta). Não há cadastro de feriados
// (decisão do produto): feriado/imprevisto se resolvem com inicio_manual.

/** Data de calendário no formato ISO 'YYYY-MM-DD' (sem hora). */
export type DataISO = string;

function parse(iso: DataISO): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(d: Date): DataISO {
  return d.toISOString().slice(0, 10);
}

function ehDiaUtil(d: Date): boolean {
  const dia = d.getUTCDay(); // 0=domingo … 6=sábado
  return dia >= 1 && dia <= 5;
}

function somaDias(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/**
 * Avança `n` dias úteis a partir de `data`.
 * `n = 0` devolve a própria data. Conta só dias úteis (pula fins de semana).
 */
export function addDU(data: DataISO, n: number): DataISO {
  let d = parse(data);
  if (n <= 0) return format(d);
  let avancados = 0;
  while (avancados < n) {
    d = somaDias(d, 1);
    if (ehDiaUtil(d)) avancados += 1;
  }
  return format(d);
}

/** Quantidade de dias úteis no intervalo [a, b) (a incluso, b excluso). */
export function duEntre(a: DataISO, b: DataISO): number {
  let d = parse(a);
  const fim = parse(b);
  let conta = 0;
  while (d < fim) {
    if (ehDiaUtil(d)) conta += 1;
    d = somaDias(d, 1);
  }
  return conta;
}

/**
 * Desloca `n` dias úteis a partir de `data`, para frente (n > 0) ou para trás
 * (n < 0). Usado pelo pré-obra, que acontece antes do dia 0 da obra.
 */
export function deslocarDU(data: DataISO, n: number): DataISO {
  if (n >= 0) return addDU(data, n);
  let d = parse(data);
  let voltados = 0;
  while (voltados < -n) {
    d = somaDias(d, -1);
    if (ehDiaUtil(d)) voltados += 1;
  }
  return format(d);
}
