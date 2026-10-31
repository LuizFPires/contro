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
  concluir: [{ dataFmt: 'qua 28/10', nome: 'Pintura', data: '2026-10-28' }],
  comecar: [
    { dataFmt: 'ter 27/10', nome: 'Forro', motivo: 'aguarda predecessoras', data: '2026-10-27' },
  ],
  quemFazOQue: [
    {
      pessoa: 'Rafael',
      itens: [{ dataFmt: 'qua 28/10', texto: 'Garantir conclusão: Pintura', data: '2026-10-28' }],
    },
  ],
};

describe('textoBoletimWhatsapp (SPEC §8.1)', () => {
  it('monta o texto com todas as seções', () => {
    const t = textoBoletimWhatsapp(base, '2026-10-26');
    expect(t).toContain('*CONTRO · Boletim da semana*\n_seg 26/10 a sex 30/10_');
    expect(t).toContain(
      '*🏗 CDC ELDORADO*\n_real 47% · previsto até sexta 63% · Atrasada · 3 dias_',
    );
    expect(t).toContain('*🚨 Atenção · 1 em atraso*\n- 🔴 Contrapiso');
    expect(t).toContain('*🏁 Concluir nesta semana*\n- 🟡 Pintura · qua 28/10');
    expect(t).toContain(
      '*▶️ Começar nesta semana*\n- 🟡 Forro · ter 27/10 (aguarda predecessoras)',
    );
    expect(t).toContain('*👥 Quem faz o quê*');
    expect(t).toContain('*Rafael*\n- 🟡 qua 28/10 · Garantir conclusão: Pintura');
    expect(t).toContain('_PDF completo com fotos e cronograma no app CONTRO._');
  });

  it('omite Atenção quando não há atraso', () => {
    const t = textoBoletimWhatsapp({ ...base, atrasos: [] });
    expect(t).not.toContain('Atenção');
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
    expect(t).toContain('*🏁 Concluir nesta semana*');
  });
});
