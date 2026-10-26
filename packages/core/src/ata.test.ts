import { describe, expect, it } from 'vitest';
import {
  deReuniaoAnterior,
  origemReuniao,
  resumoReuniao,
  textoAtaWhatsapp,
  type ObraAta,
} from './ata';

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

describe('resumoReuniao', () => {
  const atual = origemReuniao('26/10');
  it('conta cumpridas e atrasadas só das reuniões anteriores e as novas da atual', () => {
    const r = resumoReuniao(
      [
        { origem: 'Reunião 19/10', concluida: true, atrasada: false },
        { origem: 'Reunião 19/10', concluida: false, atrasada: true },
        { origem: 'Reunião 12/10', concluida: false, atrasada: true },
        { origem: 'Reunião 26/10', concluida: false, atrasada: false },
        { origem: null, concluida: true, atrasada: true },
      ],
      atual,
    );
    expect(r).toEqual({ cumpridas: 1, atrasadas: 2, novas: 1 });
  });
  it('tarefa sem origem de reunião não é providência anterior', () => {
    expect(deReuniaoAnterior({ origem: null }, atual)).toBe(false);
    expect(deReuniaoAnterior({ origem: 'Cronograma' }, atual)).toBe(false);
    expect(deReuniaoAnterior({ origem: 'Reunião 26/10' }, atual)).toBe(false);
    expect(deReuniaoAnterior({ origem: 'Reunião 19/10' }, atual)).toBe(true);
  });
});
