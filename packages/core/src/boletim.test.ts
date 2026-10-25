import { describe, expect, it } from 'vitest';
import { textoBoletimWhatsapp, type BoletimDados } from './boletim';

const base: BoletimDados = {
  obra: 'CDC Eldorado',
  semanaFmt: 'seg 26/10 a sex 30/10',
  realPct: 0.47,
  previstoSextaPct: 0.63,
  ritmoTexto: 'Atrasada · 3 dias',
  ritmoAtrasado: true,
  atrasos: ['Contrapiso'],
  concluir: [{ dataFmt: 'qua 28/10', nome: 'Pintura' }],
  comecar: [{ dataFmt: 'ter 27/10', nome: 'Forro', motivo: 'aguarda predecessoras' }],
  quemFazOQue: [
    { pessoa: 'Rafael', itens: [{ dataFmt: 'qua 28/10', texto: 'Garantir conclusão: Pintura' }] },
  ],
};

describe('textoBoletimWhatsapp (SPEC §8.1)', () => {
  it('monta o texto com todas as seções', () => {
    const t = textoBoletimWhatsapp(base);
    expect(t).toContain('*CONTRO · Boletim da semana*');
    expect(t).toContain('*CDC Eldorado* · seg 26/10 a sex 30/10');
    expect(t).toContain('Avanço real 47% · previsto até sexta 63% · Atrasada · 3 dias');
    expect(t).toContain('*ATENÇÃO · 1 em atraso*');
    expect(t).toContain('• Contrapiso');
    expect(t).toContain('*Concluir nesta semana*');
    expect(t).toContain('• qua 28/10 · Pintura');
    expect(t).toContain('• ter 27/10 · Forro (aguarda predecessoras)');
    expect(t).toContain('*Quem faz o quê*');
    expect(t).toContain('_Rafael_');
    expect(t).toContain('PDF completo com fotos e cronograma no app CONTRO.');
    expect(/\p{Emoji_Presentation}/u.test(t)).toBe(false);
  });

  it('omite Atenção quando não há atraso', () => {
    const t = textoBoletimWhatsapp({ ...base, atrasos: [] });
    expect(t).not.toContain('ATENÇÃO');
  });

  it('trunca Quem faz o quê acima de ~4000 chars', () => {
    const muitos = Array.from({ length: 400 }, (_, i) => ({
      pessoa: `Pessoa ${i}`,
      itens: [{ dataFmt: 'qua 28/10', texto: `Tarefa longa número ${i} com bastante texto` }],
    }));
    const t = textoBoletimWhatsapp({ ...base, quemFazOQue: muitos });
    expect(t.length).toBeLessThanOrEqual(4000);
    expect(t).toContain('e o restante no PDF completo');
    // as seções curtas continuam
    expect(t).toContain('*Concluir nesta semana*');
  });
});
