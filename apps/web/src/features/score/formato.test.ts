import { describe, expect, it } from 'vitest';
import { decimal, du, pct } from './formato';

describe('formato do Score', () => {
  it('porcentagem, decimal e d.u. em pt-BR', () => {
    expect(pct(0.923)).toBe('92%');
    expect(pct(null)).toBe('—');
    expect(decimal(1.25)).toBe('1,3');
    expect(decimal(0)).toBe('0,0');
    expect(du(1.2)).toBe('1,2 d.u.');
    expect(du(null)).toBe('—');
  });
});
