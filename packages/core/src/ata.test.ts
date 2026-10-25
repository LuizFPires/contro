import { describe, expect, it } from 'vitest';
import { textoAtaWhatsapp, type ObraAta } from './ata';

const obra = (p: Partial<ObraAta>): ObraAta => ({
  nome: p.nome ?? 'CDC X',
  indicador: p.indicador ?? '47% · Atrasada · 3 dias',
  atrasos: p.atrasos ?? [],
  concluir: p.concluir ?? [],
  comecar: p.comecar ?? [],
  providenciar: p.providenciar ?? [],
  observacoes: p.observacoes ?? '',
});

describe('textoAtaWhatsapp', () => {
  it('cabeçalho + obra com seções preenchidas', () => {
    const t = textoAtaWhatsapp('segunda, 26/10/2026', [
      obra({
        nome: 'CDC Eldorado',
        atrasos: ['Contrapiso'],
        concluir: ['Pintura'],
        providenciar: ['Compra: Porcelanato'],
        observacoes: 'Confirmar pintor',
      }),
    ]);
    expect(t).toContain('*CONTRO · Ata da semana*');
    expect(t).toContain('segunda, 26/10/2026 · 16h');
    expect(t).toContain('1 obra');
    expect(t).toContain('*CDC Eldorado* — 47% · Atrasada · 3 dias');
    expect(t).toContain('ATENÇÃO · atrasos: Contrapiso');
    expect(t).toContain('Concluir: Pintura');
    expect(t).toContain('Providenciar: Compra: Porcelanato');
    expect(t).toContain('Obs: Confirmar pintor');
    expect(t).not.toContain('Começar:'); // vazio, omitido
  });

  it('plural e sem emoji', () => {
    const t = textoAtaWhatsapp('x', [obra({}), obra({})]);
    expect(t).toContain('2 obras');
    expect(/\p{Emoji_Presentation}/u.test(t)).toBe(false);
  });
});
