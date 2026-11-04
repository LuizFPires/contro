// Números do Score no padrão brasileiro: "92%", "1,2 d.u.", "0,5".

export function pct(nota: number | null): string {
  return nota == null ? '—' : `${Math.round(nota * 100)}%`;
}

export function decimal(n: number | null): string {
  return n == null
    ? '—'
    : n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function du(n: number | null): string {
  return n == null ? '—' : `${decimal(n)} d.u.`;
}
