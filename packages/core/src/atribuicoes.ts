// "Quem faz o quê" (SPEC §4.7). Compila, por pessoa, as tarefas da obra + itens
// derivados do engenheiro (atrasos e semana) e de compras (providências). Texto
// no core (regra 1). Datas chegam já formatadas pela UI.
import type { DataISO } from './calendar';

export type Origem = 'tarefa' | 'engenheiro' | 'compras';

export interface ItemAtribuicao {
  texto: string;
  pessoa: string;
  prazo: DataISO | null;
  atrasado: boolean; // aberta e vencida → vermelho
  concluido: boolean;
  origem: Origem;
}

const VERBO_COMPRA: Record<string, string> = {
  contratacao: 'Contratar',
  locacao: 'Alugar',
  compra: 'Comprar',
};
const TIPO_ROTULO: Record<string, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};

export interface EntradaAtribuicoes {
  /** Tarefas já resolvidas pela UI (nome do responsável, situação). */
  tarefas: {
    texto: string;
    pessoa: string;
    prazo: DataISO | null;
    atrasado: boolean;
    concluido: boolean;
  }[];
  engenheiroNome: string | null;
  comprasNome: string | null;
  /** Atividades atrasadas (prazo = fim previsto, já ISO). */
  atividadesAtrasadas: { nome: string; fimPrevisto: DataISO }[];
  /** concluir_semana: "Garantir conclusão" (com prestador se houver). */
  concluirSemana: { nome: string; prestador: string | null; fimPrevisto: DataISO }[];
  /** comecar_semana: "Mobilizar início". */
  comecarSemana: { nome: string; inicioPrevisto: DataISO }[];
  /** Providências atrasadas: "Destravar <tipo>". */
  providenciasAtrasadas: { tipo: string; descricao: string }[];
  /** Providências da semana: "<Contratar|Alugar|Comprar> (na obra <data>)". */
  providenciarSemana: { tipo: string; descricao: string; naObraEmFmt: string | null }[];
}

/** Monta a lista achatada de itens de atribuição (ainda sem agrupar). */
export function derivarAtribuicoes(e: EntradaAtribuicoes, hoje: DataISO): ItemAtribuicao[] {
  const itens: ItemAtribuicao[] = [];

  for (const t of e.tarefas) {
    itens.push({ ...t, origem: 'tarefa' });
  }

  if (e.engenheiroNome) {
    for (const a of e.atividadesAtrasadas) {
      itens.push({
        texto: `Recuperar atraso: ${a.nome}`,
        pessoa: e.engenheiroNome,
        prazo: a.fimPrevisto,
        atrasado: a.fimPrevisto < hoje,
        concluido: false,
        origem: 'engenheiro',
      });
    }
    for (const a of e.concluirSemana) {
      itens.push({
        texto: `Garantir conclusão: ${a.nome}${a.prestador ? ` (${a.prestador})` : ''}`,
        pessoa: e.engenheiroNome,
        prazo: a.fimPrevisto,
        atrasado: false,
        concluido: false,
        origem: 'engenheiro',
      });
    }
    for (const a of e.comecarSemana) {
      itens.push({
        texto: `Mobilizar início: ${a.nome}`,
        pessoa: e.engenheiroNome,
        prazo: a.inicioPrevisto,
        atrasado: false,
        concluido: false,
        origem: 'engenheiro',
      });
    }
  }

  if (e.comprasNome) {
    for (const p of e.providenciasAtrasadas) {
      itens.push({
        texto: `Destravar ${TIPO_ROTULO[p.tipo] ?? p.tipo}: ${p.descricao}`,
        pessoa: e.comprasNome,
        prazo: null,
        atrasado: true,
        concluido: false,
        origem: 'compras',
      });
    }
    for (const p of e.providenciarSemana) {
      const verbo = VERBO_COMPRA[p.tipo] ?? 'Providenciar';
      itens.push({
        texto: `${verbo}: ${p.descricao}${p.naObraEmFmt ? ` (na obra ${p.naObraEmFmt})` : ''}`,
        pessoa: e.comprasNome,
        prazo: null,
        atrasado: false,
        concluido: false,
        origem: 'compras',
      });
    }
  }

  return itens;
}

export interface GrupoAtribuicao {
  pessoa: string;
  itens: ItemAtribuicao[];
}

/** Agrupa por pessoa; dentro, abertas por prazo (nulos no fim) e concluídas por último. */
export function compilarPorPessoa(itens: ItemAtribuicao[]): GrupoAtribuicao[] {
  const mapa = new Map<string, ItemAtribuicao[]>();
  for (const it of itens) {
    const arr = mapa.get(it.pessoa) ?? [];
    arr.push(it);
    mapa.set(it.pessoa, arr);
  }
  const grupos: GrupoAtribuicao[] = [];
  for (const [pessoa, arr] of mapa) {
    arr.sort((a, b) => {
      if (a.concluido !== b.concluido) return a.concluido ? 1 : -1;
      if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
      if (a.prazo) return -1;
      if (b.prazo) return 1;
      return 0;
    });
    grupos.push({ pessoa, itens: arr });
  }
  return grupos;
}
