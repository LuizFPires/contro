// Itens da pauta e montagem da ata a partir da reunião carregada. A regra
// (para onde cada resposta vai, totais, texto) está no core; aqui só se junta o
// que veio do banco e se formatam as datas. Usado pela pauta, pela ata e pelo PDF.
import {
  compilarPorPessoa,
  derivarAtribuicoes,
  entraNaCobranca,
  montarObraAta,
  origemReuniao,
  respostaEfetiva,
  ritmoTexto,
  totaisAta,
  type ItemPautaAta,
  type ObraAta,
  type ObraAtaEntrada,
  type PessoaAta,
  type RespostaReuniao,
  type SecaoResposta,
  type TotaisAta,
} from '@contro/core';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from '../obras/api';
import {
  chaveResposta,
  type ItemPassada,
  type ReuniaoCompleta,
  type ReuniaoObraDados,
  type TarefaAtrib,
} from './reuniaoApi';

export const VERBO_PROV: Record<string, string> = {
  contratacao: 'Contratar',
  locacao: 'Alugar',
  compra: 'Comprar',
};

export type SecaoPassada = 'passada_concluir' | 'passada_comecar';
export type SecaoSemana = 'semana_concluir' | 'semana_comecar' | 'semana_providencia';

export interface ItemPassadaPauta extends ItemPassada {
  secao: SecaoPassada;
}

export interface ItemSemanaPauta {
  id: string;
  secao: SecaoSemana;
  vinculoTipo: 'atividade' | 'providencia';
  nome: string;
  sub: string;
  prestador: string | null;
  atraso: string | null;
  /** Texto sugerido da ação. */
  sugestao: string;
  tipoProvidencia?: 'contratacao' | 'locacao' | 'compra';
  naObraEm: string | null;
}

export function itensPassada(o: ReuniaoObraDados): ItemPassadaPauta[] {
  return [
    ...o.passadaConcluir.map((it) => ({ ...it, secao: 'passada_concluir' as const })),
    ...o.passadaComecar.map((it) => ({ ...it, secao: 'passada_comecar' as const })),
  ];
}

export function itensSemana(o: ReuniaoObraDados): ItemSemanaPauta[] {
  return [
    ...o.concluir.map((a) => ({
      id: a.atividadeId,
      secao: 'semana_concluir' as const,
      vinculoTipo: 'atividade' as const,
      nome: a.nome,
      sub: `fim previsto ${formatarDataCurta(a.data)}`,
      prestador: a.prestador ?? null,
      atraso: null,
      sugestao: a.prestador
        ? `Confirmar com ${a.prestador} a conclusão`
        : `Garantir conclusão: ${a.nome}`,
      naObraEm: null,
    })),
    ...o.comecar.map((a) => ({
      id: a.atividadeId,
      secao: 'semana_comecar' as const,
      vinculoTipo: 'atividade' as const,
      nome: a.nome,
      sub: `início previsto ${formatarDataCurta(a.data)}`,
      prestador: a.prestador ?? null,
      atraso: null,
      sugestao: a.prestador
        ? `Confirmar com ${a.prestador} o início`
        : `Mobilizar início: ${a.nome}`,
      naObraEm: null,
    })),
    ...o.providenciasAtrasadas.map((p) => ({
      id: p.providenciaId,
      secao: 'semana_providencia' as const,
      vinculoTipo: 'providencia' as const,
      nome: p.descricao,
      sub: 'era para já estar providenciado',
      prestador: null,
      atraso: p.naObraEm ? `Atrasado · na obra ${formatarDataCurta(p.naObraEm)}` : 'Atrasado',
      sugestao: `${VERBO_PROV[p.tipo]} ${p.descricao}`,
      tipoProvidencia: p.tipo,
      naObraEm: p.naObraEm,
    })),
    ...o.providenciar.map((p) => ({
      id: p.providenciaId,
      secao: 'semana_providencia' as const,
      vinculoTipo: 'providencia' as const,
      nome: p.descricao,
      sub: p.naObraEm
        ? `precisa estar na obra ${formatarDataCurta(p.naObraEm)}`
        : 'providenciar nesta semana',
      prestador: null,
      atraso: null,
      sugestao: `${VERBO_PROV[p.tipo]} ${p.descricao}`,
      tipoProvidencia: p.tipo,
      naObraEm: p.naObraEm,
    })),
  ];
}

/** Origem das ações criadas nesta reunião ("Reunião seg 02/11"). */
export const origemDa = (r: Pick<ReuniaoCompleta, 'data'>) =>
  origemReuniao(formatarDataCurta(r.data));

/** Ações de reuniões anteriores cobradas nesta obra. */
export function cobrancaDaObra(r: ReuniaoCompleta, obraId: string): TarefaAtrib[] {
  const origem = origemDa(r);
  return r.tarefas.filter((t) => t.obraId === obraId && entraNaCobranca(t, origem, r.data));
}

/** Ações criadas nesta reunião, nesta obra. */
export function acoesDaObra(r: ReuniaoCompleta, obraId: string): TarefaAtrib[] {
  const origem = origemDa(r);
  return r.tarefas.filter((t) => t.obraId === obraId && t.origem === origem);
}

/** Resposta gravada (ou o que o app já sabe). */
export function respostaDe(
  r: ReuniaoCompleta,
  secao: SecaoResposta,
  id: string,
  noApp: { concluida?: boolean; avancoPct?: number } = {},
): RespostaReuniao | null {
  return respostaEfetiva(secao, r.respostas[chaveResposta(secao, id)], noApp);
}

export function respostaCobranca(r: ReuniaoCompleta, t: TarefaAtrib): RespostaReuniao | null {
  return r.respostas[chaveResposta('cobranca', t.id)] ?? (t.concluido ? 'feita' : null);
}

/** Todas as respostas da obra (para o contador e o ✓ no chip). */
export function respostasDaObra(
  r: ReuniaoCompleta,
  o: ReuniaoObraDados,
): (RespostaReuniao | null)[] {
  return [
    ...cobrancaDaObra(r, o.obraId).map((t) => respostaCobranca(r, t)),
    ...itensPassada(o).map((it) =>
      respostaDe(r, it.secao, it.atividadeId, { concluida: it.ok, avancoPct: it.avancoPct }),
    ),
    ...itensSemana(o).map((it) => respostaDe(r, it.secao, it.id)),
  ];
}

const fmt = (d: string | null) => (d ? formatarDataCurta(d) : null);

export function entradaObraAta(r: ReuniaoCompleta, o: ReuniaoObraDados): ObraAtaEntrada {
  const ritmo = ritmoTexto(o.ritmoDias, true);
  const itens: ItemPautaAta[] = [
    ...itensPassada(o).map((it) => ({
      id: it.atividadeId,
      nome: it.nome,
      secao: it.secao,
      resposta: respostaDe(r, it.secao, it.atividadeId, {
        concluida: it.ok,
        avancoPct: it.avancoPct,
      }),
      avancoPct: it.avancoPct,
    })),
    ...itensSemana(o).map((it) => ({
      id: it.id,
      nome: it.nome,
      secao: it.secao,
      resposta: respostaDe(r, it.secao, it.id),
      prestador: it.prestador,
      tipoProvidencia: it.tipoProvidencia,
      naObraEmFmt: fmt(it.naObraEm),
    })),
  ];
  return {
    nome: o.nome,
    indicador: `${Math.round(o.pct * 100)}% · ${ritmo.texto.toLowerCase()}`,
    atrasada: ritmo.atrasada,
    situacao: `${o.faseAtual} · previsto ${Math.round(o.previstoSexta * 100)}% · inauguração ${formatarDataCurta(o.entrega)}`,
    itens,
    acoes: acoesDaObra(r, o.obraId).map((t) => ({
      vinculoId: t.vinculoId,
      texto: t.texto,
      pessoa: t.pessoa,
      prazoFmt: fmt(t.prazo),
    })),
    cobranca: cobrancaDaObra(r, o.obraId).map((t) => ({
      texto: t.texto,
      pessoa: t.pessoa,
      feita: t.concluido,
      atrasada: t.atrasado,
      prazoFmt: fmt(t.prazo),
      replanejamentos: t.replanejamentos,
      avancoPct: t.avancoPct,
    })),
    observacoes: o.observacoes,
  };
}

export interface AtaCompleta {
  obras: ObraAta[];
  totais: TotaisAta;
  pessoas: PessoaAta[];
}

/** A ata inteira: blocos por obra, totais e "Quem faz o quê" por pessoa. */
export function montarAta(r: ReuniaoCompleta): AtaCompleta {
  const entradas = r.obras.map((o) => entradaObraAta(r, o));
  const obras = entradas.map(montarObraAta);
  const nomeObra = new Map(r.obras.map((o) => [o.obraId, o.nome]));
  const grupos = compilarPorPessoa(
    derivarAtribuicoes(
      {
        tarefas: r.tarefas
          .filter((t) => !t.concluido)
          .map((t) => ({ ...t, texto: `${t.texto} (${nomeObra.get(t.obraId) ?? ''})` })),
        engenheiroNome: null,
        comprasNome: null,
        atividadesAtrasadas: [],
        concluirSemana: [],
        comecarSemana: [],
        providenciasAtrasadas: [],
        providenciarSemana: [],
      },
      hojeISO(),
    ),
  );
  const pessoas: PessoaAta[] = grupos.map((g) => ({
    pessoa: g.pessoa,
    itens: g.itens.map((it) => ({
      texto: `${it.prazo ? formatarDataCurta(it.prazo) : 'sem prazo'} · ${it.texto}`,
      atrasado: it.atrasado,
    })),
  }));
  return { obras, totais: totaisAta(entradas, obras), pessoas };
}
