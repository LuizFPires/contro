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
  type ObraPreparo,
  type PessoaAta,
  type RespostaReuniao,
  type SecaoResposta,
  type TotaisAta,
} from '@contro/core';
import { formatarDataCurta } from '../../lib/datas';
import { dataLocal, hojeISO } from '../obras/api';
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
  return r.tarefas.filter(
    (t) =>
      t.obraId === obraId &&
      entraNaCobranca({ ...t, feitaEm: t.feitaEm ? dataLocal(t.feitaEm) : null }, origem, r.data),
  );
}

/** Seção da pauta a que cada ação desta reunião responde (tarefaId → seção). */
function secaoDasAcoes(r: ReuniaoCompleta): Map<string, SecaoResposta> {
  const m = new Map<string, SecaoResposta>();
  for (const [k, tarefaId] of Object.entries(r.acoesResposta)) {
    m.set(tarefaId, k.split(':')[0] as SecaoResposta);
  }
  return m;
}

/**
 * Ação do item nesta seção: a gravada na resposta ou, sem ela (respostas antigas),
 * a ação ligada ao item que não responde a outra seção.
 */
export function acaoDoItem(
  r: ReuniaoCompleta,
  obraId: string,
  secao: SecaoResposta,
  itemId: string,
): TarefaAtrib | null {
  const novas = acoesDaObra(r, obraId);
  const id = r.acoesResposta[chaveResposta(secao, itemId)];
  if (id) return novas.find((t) => t.id === id) ?? null;
  const secoes = secaoDasAcoes(r);
  return novas.find((t) => t.vinculoId === itemId && !secoes.has(t.id)) ?? null;
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
  const secoes = secaoDasAcoes(r);
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
      secao: secoes.get(t.id) ?? null,
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

/**
 * Pauta antecipada (Preparar a reunião): o que a reunião vai cobrar e
 * perguntar, obra por obra. Usa os mesmos itens da pauta; só entra o que ainda
 * está aberto (ação feita ou atividade concluída no app não precisa de resposta).
 */
export function montarPreparo(r: ReuniaoCompleta): ObraPreparo[] {
  const hoje = hojeISO();
  return r.obras.map((o) => {
    const ritmo = ritmoTexto(o.ritmoDias, true);
    const cobranca = cobrancaDaObra(r, o.obraId)
      .filter((t) => !t.concluido)
      .map((t) => ({
        texto: t.avancoPct > 0 ? `${t.texto} · ${t.avancoPct}%` : t.texto,
        pessoa: t.pessoa,
        prazo: t.prazo
          ? `${t.atrasado ? 'era' : 'até'} ${formatarDataCurta(t.prazo)}`
          : 'sem prazo',
        atraso: t.atrasado,
      }));
    const previstos = itensPassada(o)
      .filter((it) => !it.ok)
      .map((it) => {
        const terminar = it.secao === 'passada_concluir';
        return {
          texto: `${terminar ? 'Terminar' : 'Começar'} ${it.nome}${it.avancoPct > 0 ? ` · ${it.avancoPct}%` : ''}`,
          prazo: `${terminar ? 'fim' : 'início'} ${formatarDataCurta(it.data)}`,
          atraso: it.data < hoje,
        };
      });
    const semana = itensSemana(o);
    const semanaQueVem = semana
      .filter((it) => it.secao !== 'semana_providencia')
      .map((it) => ({
        texto: `${it.secao === 'semana_concluir' ? 'Terminar' : 'Começar'} ${it.nome}`,
        prazo: it.sub.replace(' previsto', ''),
        atraso: false,
      }));
    const providencias = semana
      .filter((it) => it.secao === 'semana_providencia')
      .map((it) => ({
        texto: `${VERBO_PROV[it.tipoProvidencia ?? 'compra']} ${it.nome}`,
        prazo: it.atraso
          ? 'atrasado'
          : it.naObraEm
            ? `na obra ${formatarDataCurta(it.naObraEm)}`
            : 'nesta semana',
        atraso: Boolean(it.atraso),
      }));
    return {
      nome: o.nome,
      indicador: `${Math.round(o.pct * 100)}% · ${ritmo.texto.toLowerCase()}`,
      atrasada: ritmo.atrasada,
      cobranca,
      previstos,
      semanaQueVem,
      providencias,
    };
  });
}
