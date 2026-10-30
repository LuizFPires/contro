// Preparar a reunião (pedido do usuário, 30/10/2026): a pauta antecipada da
// próxima reunião, para cada um saber o que vai ser cobrado e perguntado e
// agir antes. São os mesmos quatro blocos da pauta (cobrança, previsto para a
// semana que termina, semana que vem, providências). Em PDF, em até três
// formatos num arquivo só: tabela (paisagem), folha para preencher e por pessoa.
// Datas chegam já formatadas pela UI. Sem emoji.

export type FormatoPreparo = 'tabela' | 'folha' | 'pessoa';

export const FORMATOS_PREPARO: { id: FormatoPreparo; titulo: string; desc: string }[] = [
  {
    id: 'tabela',
    titulo: 'Tabela da pauta',
    desc: 'paisagem · uma linha por obra (como o resumo da ata)',
  },
  {
    id: 'folha',
    titulo: 'Folha para preencher',
    desc: 'retrato · por obra, com caixinhas para marcar',
  },
  { id: 'pessoa', titulo: 'Por pessoa', desc: 'retrato · o que cada um vai ser cobrado' },
];

/** Um item da pauta antecipada: o que é e o prazo ("fim qui 29/10", "era 28/10"). */
export interface ItemPreparo {
  texto: string;
  prazo: string;
  /** Vermelho: já venceu. */
  atraso: boolean;
}

/** Ação a cobrar: tem dono (ou "Sem responsável"). */
export interface CobrancaPreparo extends ItemPreparo {
  pessoa: string;
}

export interface ObraPreparo {
  nome: string;
  indicador: string;
  atrasada: boolean;
  cobranca: CobrancaPreparo[];
  /** Previsto para terminar ou começar até a reunião: vai perguntar se aconteceu. */
  previstos: ItemPreparo[];
  /** Semana depois da reunião: segue o plano ou precisa de ação? */
  semanaQueVem: ItemPreparo[];
  /** Contratar, alugar, comprar. */
  providencias: ItemPreparo[];
}

/** Os blocos da folha, com os títulos das duas caixinhas e da anotação. */
export const BLOCOS_FOLHA: {
  chave: 'cobranca' | 'previstos' | 'semanaQueVem' | 'providencias';
  titulo: string;
  sim: string;
  nao: string;
  anotacao: string;
}[] = [
  { chave: 'cobranca', titulo: '1 · Cobrança', sim: 'Feita', nao: 'Não', anotacao: 'Novo prazo' },
  {
    chave: 'previstos',
    titulo: '2 · Previsto para esta semana',
    sim: 'Sim',
    nao: 'Não',
    anotacao: 'Quanto andou',
  },
  {
    chave: 'semanaQueVem',
    titulo: '3 · Semana que vem',
    sim: 'Segue',
    nao: 'Ação',
    anotacao: 'Quem · até quando',
  },
  {
    chave: 'providencias',
    titulo: '4 · Providências',
    sim: 'Feito',
    nao: 'Falta',
    anotacao: 'Quem · até quando',
  },
];

/** Ordem fixa dos formatos marcados (tabela primeiro: é a única em paisagem). */
export function formatosEmOrdem(marcados: FormatoPreparo[]): FormatoPreparo[] {
  return FORMATOS_PREPARO.map((f) => f.id).filter((id) => marcados.includes(id));
}

export function textoBotaoPreparo(n: number): string {
  if (n === 0) return 'Marque um formato';
  return n === 1 ? 'Baixar PDF' : `Baixar PDF · ${n} formatos`;
}

export interface TotaisPreparo {
  cobrar: number;
  atrasadas: number;
  providencias: number;
}

export function totaisPreparo(obras: ObraPreparo[]): TotaisPreparo {
  const cob = obras.flatMap((o) => o.cobranca);
  return {
    cobrar: cob.length,
    atrasadas: cob.filter((c) => c.atraso).length,
    providencias: obras.reduce((s, o) => s + o.providencias.length, 0),
  };
}

export interface PessoaPreparo {
  pessoa: string;
  itens: { texto: string; prazo: string; atraso: boolean }[];
}

/**
 * Por pessoa: o que cada um vai ser cobrado (com a obra entre parênteses), as
 * atrasadas primeiro. "Sem responsável" vai por último. As providências da
 * pauta ainda não têm dono: viram o bloco `semDono`, para decidir na reunião.
 */
export function preparoPorPessoa(obras: ObraPreparo[]): {
  pessoas: PessoaPreparo[];
  semDono: { texto: string; prazo: string; atraso: boolean }[];
} {
  const mapa = new Map<string, PessoaPreparo['itens']>();
  for (const o of obras) {
    for (const c of o.cobranca) {
      const l = mapa.get(c.pessoa) ?? [];
      l.push({ texto: `${c.texto} (${o.nome})`, prazo: c.prazo, atraso: c.atraso });
      mapa.set(c.pessoa, l);
    }
  }
  const pessoas = [...mapa.entries()]
    .map(([pessoa, itens]) => ({
      pessoa,
      itens: [...itens].sort((a, b) => Number(b.atraso) - Number(a.atraso)),
    }))
    .sort((a, b) => {
      if (a.pessoa === 'Sem responsável') return 1;
      if (b.pessoa === 'Sem responsável') return -1;
      return a.pessoa.localeCompare(b.pessoa, 'pt-BR');
    });
  const semDono = obras.flatMap((o) =>
    o.providencias.map((p) => ({
      texto: `${p.texto} (${o.nome})`,
      prazo: p.prazo,
      atraso: p.atraso,
    })),
  );
  return { pessoas, semDono };
}

/** Resumo da pauta antecipada para o WhatsApp. */
export function textoPreparoWhatsapp(
  dataFmt: string,
  horaFmt: string,
  obras: ObraPreparo[],
): string {
  const t = totaisPreparo(obras);
  const L: string[] = [];
  const item = (i: ItemPreparo) => `${i.texto} (${i.prazo})`;
  L.push(`*CONTRO · Pauta da reunião de ${dataFmt} · ${horaFmt}*`);
  L.push(
    `${t.cobrar} ${t.cobrar === 1 ? 'ação' : 'ações'} a cobrar` +
      (t.atrasadas ? ` (${t.atrasadas} ${t.atrasadas === 1 ? 'atrasada' : 'atrasadas'})` : '') +
      ` · ${t.providencias} ${t.providencias === 1 ? 'providência' : 'providências'}`,
  );
  for (const o of obras) {
    L.push('');
    L.push(`*${o.nome}* — ${o.indicador}`);
    if (o.cobranca.length)
      L.push(
        `Cobrança: ${o.cobranca.map((c) => `${c.texto} — ${c.pessoa} (${c.prazo})`).join('; ')}`,
      );
    if (o.previstos.length) L.push(`Previsto até a reunião: ${o.previstos.map(item).join('; ')}`);
    if (o.semanaQueVem.length) L.push(`Semana que vem: ${o.semanaQueVem.map(item).join('; ')}`);
    if (o.providencias.length) L.push(`Providências: ${o.providencias.map(item).join('; ')}`);
  }
  L.push('');
  L.push('Prepare as respostas. PDF completo no app CONTRO.');
  return L.join('\n');
}
