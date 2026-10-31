import { describe, expect, it } from 'vitest';
import {
  formatosEmOrdem,
  preparoPorPessoa,
  textoBotaoPreparo,
  textoPreparoWhatsapp,
  totaisPreparo,
  type ObraPreparo,
} from './preparo';

const obra = (p: Partial<ObraPreparo> = {}): ObraPreparo => ({
  nome: 'CDC Ressaca',
  indicador: '47% · atrasada · 3 dias',
  atrasada: true,
  cobranca: [],
  previstos: [],
  semanaQueVem: [],
  providencias: [],
  ...p,
});

const ressaca = obra({
  cobranca: [
    { texto: 'Comprar tubos', pessoa: 'Marcos', prazo: 'até ter 03/11', atraso: false },
    { texto: 'Concluir contrapiso · 50%', pessoa: 'Marcos', prazo: 'era 28/10', atraso: true },
    {
      texto: 'Ligar para o síndico',
      pessoa: 'Sem responsável',
      prazo: 'até seg 02/11',
      atraso: false,
    },
  ],
  previstos: [{ texto: 'Terminar Hidráulica', prazo: 'fim qui 29/10', atraso: false }],
  semanaQueVem: [{ texto: 'Começar Emassamento', prazo: 'início qua 04/11', atraso: false }],
  providencias: [{ texto: 'Contratar pintor', prazo: 'na obra qua 04/11', atraso: false }],
});
const jf = obra({
  nome: 'CDC Juiz de Fora',
  indicador: '63% · no ritmo',
  atrasada: false,
  cobranca: [
    { texto: 'Contratar marceneiro', pessoa: 'Ana', prazo: 'até qua 04/11', atraso: false },
  ],
});

describe('preparar a reunião', () => {
  it('formatos na ordem fixa e texto do botão', () => {
    expect(formatosEmOrdem(['pessoa', 'tabela'])).toEqual(['tabela', 'pessoa']);
    expect(textoBotaoPreparo(0)).toBe('Marque um formato');
    expect(textoBotaoPreparo(1)).toBe('Baixar PDF');
    expect(textoBotaoPreparo(3)).toBe('Baixar PDF · 3 formatos');
  });

  it('totais', () => {
    expect(totaisPreparo([ressaca, jf])).toEqual({ cobrar: 4, atrasadas: 1, providencias: 1 });
  });

  it('por pessoa: em ordem, atrasadas primeiro, sem responsável no fim; providências sem dono', () => {
    const { pessoas, semDono } = preparoPorPessoa([ressaca, jf]);
    expect(pessoas.map((p) => p.pessoa)).toEqual(['Ana', 'Marcos', 'Sem responsável']);
    expect(pessoas[1].itens[0]).toEqual({
      texto: 'Concluir contrapiso · 50% (CDC Ressaca)',
      prazo: 'era 28/10',
      atraso: true,
    });
    expect(semDono).toEqual([
      { texto: 'Contratar pintor (CDC Ressaca)', prazo: 'na obra qua 04/11', atraso: false },
    ]);
  });

  it('WhatsApp', () => {
    const t = textoPreparoWhatsapp('seg 02/11', '16h', [ressaca, jf], '2026-10-31');
    expect(t).toContain('*CONTRO · Pauta da reunião*\n*seg 02/11 · 16h* · 2 obras');
    expect(t).toContain('4 ações a cobrar · 1 atrasada · 1 providência');
    expect(t).toContain('_🔴 atrasado · 🟡 vence em até 7 dias · 🔵 em dia_');
    expect(t).toContain('*🏗 CDC RESSACA*\n_47% · atrasada · 3 dias_');
    expect(t).toContain('*🔁 Cobrança*\n- 🔵 Comprar tubos · *Marcos* · até ter 03/11');
    expect(t).toContain('- 🔴 Concluir contrapiso · 50% · *Marcos* · era 28/10');
    expect(t).toContain('*📌 Previsto até a reunião*\n- 🔵 Terminar Hidráulica · fim qui 29/10');
    expect(t).toContain('*📅 Semana que vem*\n- 🔵 Começar Emassamento · início qua 04/11');
    expect(t).toContain('*🛒 Providências*\n- 🔵 Contratar pintor · na obra qua 04/11');
    expect(t).toContain('━━━━━━━━━━━━━━\n\n*🏗 CDC JUIZ DE FORA*');
    expect(t).not.toContain('; ');
  });
});
