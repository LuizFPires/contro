// Adaptadores puros do Log e do Score: linhas cruas do banco (já carregadas por
// loadDadosLogScore) → itens e eventos no formato do core. Sem React, sem
// regra de domínio: prazos de pendência e normalização de nome vêm do core.
import {
  itensEquipeObraGeral,
  itensLogObraGeral,
  normalizarNome,
  normalizarTextoProvidencia,
  prazoPendencia,
  replanejamentosPorEventos,
  type AtividadeGeral,
  type DataISO,
  type EventoBruto,
  type ItemEquipe,
  type ItemLog,
  type ItemPrestador,
  type OrigemLog,
  type PrazosPendencia,
} from '@contro/core';
import { dataLocal } from '../obras/api';

export type StatusObraLog = 'ativa' | 'concluida' | 'pausada';

export interface ObraLog {
  id: string;
  nome: string;
  status: StatusObraLog;
  /** Início da obra: nascimento das atividades na "Vida do item". */
  inicio?: string | null;
}

export interface LinhaAtividadeLog {
  id: string;
  obra_id: string;
  nome: string;
  pai_id: string | null;
  concluida_em: string | null;
  prestador: string | null;
  foto_conclusao_id: string | null;
}

export interface LinhaTarefaLog {
  id: string;
  obra_id: string;
  texto: string;
  status: 'aberta' | 'feita';
  prazo: DataISO;
  prazo_original: DataISO | null;
  replanejamentos: number;
  feita_em: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  responsavel: { nome: string } | null;
  vinculo_tipo: string | null;
  vinculo_id: string | null;
  created_at: string;
}

export interface LinhaPendenciaLog {
  id: string;
  obra_id: string;
  titulo: string;
  criticidade: 'alta' | 'media' | 'baixa';
  apontada_em: string;
  resolvida_em: string | null;
  status: string;
  responsavel_id: string | null;
  responsavel: { nome: string } | null;
  /** Data limite digitada e nome digitado (prestador); antigos podem não ter. */
  prazo?: string | null;
  responsavel_nome?: string | null;
}

type Json = Record<string, unknown> | null;
interface EventoBase {
  id: string;
  tipo: string;
  por: string | null;
  em: string;
  por_pessoa: { nome: string } | null;
}
export interface LinhaEventoTarefa extends EventoBase {
  tarefa_id: string;
  antes: Json;
  depois: Json;
}
/** pendencia_evento guarda tudo em `dados` (vira o "depois"). */
export interface LinhaEventoPendencia extends EventoBase {
  pendencia_id: string;
  dados: Json;
}
export interface LinhaEventoAtividade extends EventoBase {
  atividade_id: string;
  antes: Json;
  depois: Json;
}

export interface DadosLogScore {
  obras: ObraLog[];
  /** Atividades não excluídas (topo e subitens) das obras carregadas. */
  atividades: LinhaAtividadeLog[];
  tarefas: LinhaTarefaLog[];
  pendencias: LinhaPendenciaLog[];
  /** Fim previsto do cronograma vigente, por atividade de topo. */
  fimPrevisto: Record<string, DataISO>;
  prazos: PrazosPendencia;
  eventosTarefa: LinhaEventoTarefa[];
  eventosPendencia: LinhaEventoPendencia[];
  eventosAtividade: LinhaEventoAtividade[];
  /** Obras gerais (sem cronograma): só no carregador de `'geral'`. */
  geral?: DadosLogGeral;
}

/** Atividade de obra geral (topo e subitens, não excluídas) com a obra dela. */
export type LinhaAtividadeGeralLog = AtividadeGeral & { obra_id: string };

/**
 * Parte própria das obras gerais: atividades com data prevista digitada (no lugar
 * de `atividades` e `fimPrevisto`, que ficam vazios), prazos de pendência pela
 * config de cada obra e o nome de cada pessoa por id.
 */
export interface DadosLogGeral {
  atividades: LinhaAtividadeGeralLog[];
  prazosPorObra: Record<string, PrazosPendencia>;
  nomes: Record<string, string>;
}

/** Obras que entram no Log e no Score (ativas e concluídas), por id. */
function obrasValidas(d: DadosLogScore): Map<string, ObraLog> {
  return new Map(
    d.obras.filter((o) => o.status === 'ativa' || o.status === 'concluida').map((o) => [o.id, o]),
  );
}

const vazio = (s: string | null | undefined): s is null | undefined => !s || !s.trim();

function nomeResponsavelTarefa(t: LinhaTarefaLog): string | null {
  const n = t.responsavel?.nome ?? t.responsavel_nome;
  return vazio(n) ? null : n.trim();
}

/** Prazo da pendência pela config da obra (obra geral) ou pela global (Contorno). */
function prazoDaPendencia(p: LinhaPendenciaLog, d: DadosLogScore): DataISO {
  const prazos = d.geral?.prazosPorObra[p.obra_id] ?? d.prazos;
  return prazoPendencia(p.criticidade, dataLocal(p.apontada_em), prazos, p.prazo);
}

/** Atividades gerais agrupadas pela obra. */
function atividadesGeraisPorObra(g: DadosLogGeral): Map<string, AtividadeGeral[]> {
  const m = new Map<string, AtividadeGeral[]>();
  for (const { obra_id, ...a } of g.atividades) {
    const lista = m.get(obra_id);
    if (lista) lista.push(a);
    else m.set(obra_id, [a]);
  }
  return m;
}

const pendenciaAberta = (p: LinhaPendenciaLog) => p.status === 'aberta';

/** Itens do Log: tarefas (providência marcada), pendências e atividades de topo. */
export function itensDoLog(d: DadosLogScore): ItemLog[] {
  const obras = obrasValidas(d);
  const itens: ItemLog[] = [];
  for (const t of d.tarefas) {
    const o = obras.get(t.obra_id);
    if (!o) continue;
    itens.push({
      origem: 'tarefa',
      id: t.id,
      obraId: o.id,
      obraNome: o.nome,
      texto: normalizarTextoProvidencia(t.texto),
      prazo: t.prazo,
      prazoOriginal: t.prazo_original ?? t.prazo,
      aberta: t.status === 'aberta',
      concluidaEm: t.status === 'aberta' ? null : t.feita_em,
      responsavelNome: nomeResponsavelTarefa(t),
      responsavelId: t.responsavel_id,
      criadaEm: t.created_at,
      excluida: false,
      ...(t.vinculo_tipo === 'providencia' ? { vinculoProvidencia: true } : {}),
    });
  }
  for (const p of d.pendencias) {
    const o = obras.get(p.obra_id);
    if (!o) continue;
    const prazo = prazoDaPendencia(p, d);
    itens.push({
      origem: 'pendencia',
      id: p.id,
      obraId: o.id,
      obraNome: o.nome,
      texto: p.titulo,
      prazo,
      prazoOriginal: prazo,
      aberta: pendenciaAberta(p),
      concluidaEm: pendenciaAberta(p) ? null : p.resolvida_em,
      responsavelNome: p.responsavel?.nome ?? p.responsavel_nome ?? null,
      responsavelId: p.responsavel_id,
      criadaEm: p.apontada_em,
      excluida: false,
    });
  }
  for (const a of d.atividades) {
    const o = obras.get(a.obra_id);
    if (!o || a.pai_id) continue;
    // Pré-obra (Orçamento, Mapa de coleta) entra no Log como item real, mas fica
    // fora do cronograma: sem fim previsto, prazo null e nunca gera "vencida".
    itens.push({
      origem: 'atividade',
      id: a.id,
      obraId: o.id,
      obraNome: o.nome,
      texto: a.nome,
      prazo: d.fimPrevisto[a.id] ?? null,
      prazoOriginal: null,
      aberta: a.concluida_em == null,
      concluidaEm: a.concluida_em,
      responsavelNome: null,
      criadaEm: o.inicio ?? null,
      excluida: false,
    });
  }
  if (d.geral) {
    // Obra geral: atividades de topo com a data prevista como prazo (core).
    const porObra = atividadesGeraisPorObra(d.geral);
    for (const o of obras.values()) {
      itens.push(
        ...itensLogObraGeral({
          obraId: o.id,
          obraNome: o.nome,
          atividades: porObra.get(o.id) ?? [],
          nomes: d.geral.nomes,
          criadaEm: o.inicio ?? null,
        }),
      );
    }
  }
  return itens;
}

const evento = (e: EventoBase, itemId: string, antes: Json, depois: Json): EventoBruto => ({
  id: e.id,
  itemId,
  tipo: e.tipo,
  por: e.por,
  porNome: e.por_pessoa?.nome ?? null,
  em: e.em,
  antes,
  depois,
});

/** Sem repetidos pelo id (a paginação por offset pode trazer o mesmo evento duas vezes). */
function semRepetidos<T extends { id: string }>(linhas: T[]): T[] {
  const vistos = new Set<string>();
  return linhas.filter((l) => (vistos.has(l.id) ? false : (vistos.add(l.id), true)));
}

/** Eventos das três tabelas no formato do core, com a origem de cada um. */
export function eventosDoLog(d: DadosLogScore): { origem: OrigemLog; evento: EventoBruto }[] {
  return [
    ...semRepetidos(d.eventosTarefa).map((e) => ({
      origem: 'tarefa' as const,
      evento: evento(e, e.tarefa_id, e.antes, e.depois),
    })),
    ...semRepetidos(d.eventosPendencia).map((e) => ({
      origem: 'pendencia' as const,
      evento: evento(e, e.pendencia_id, null, e.dados),
    })),
    ...semRepetidos(d.eventosAtividade).map((e) => ({
      origem: 'atividade' as const,
      evento: evento(e, e.atividade_id, e.antes, e.depois),
    })),
  ];
}

/**
 * Obras que entram na carga: as ativas e as concluídas com algum item na janela
 * (tarefa, pendência ou atividade aberta ou concluída desde o início da janela;
 * as listas recebidas já vêm filtradas assim). Concluída sem nada na janela fica fora.
 */
export function obrasNaJanela<O extends ObraLog>(obras: O[], comItem: { obra_id: string }[]): O[] {
  const comAlgo = new Set(comItem.map((i) => i.obra_id));
  return obras.filter(
    (o) => o.status === 'ativa' || (o.status === 'concluida' && comAlgo.has(o.id)),
  );
}

/** Eventos agrupados pelo id do item (para a "Vida do item"). */
export function eventosPorItem(eventos: { evento: EventoBruto }[]): Map<string, EventoBruto[]> {
  const mapa = new Map<string, EventoBruto[]>();
  for (const { evento: e } of eventos) {
    const lista = mapa.get(e.itemId);
    if (lista) lista.push(e);
    else mapa.set(e.itemId, [e]);
  }
  return mapa;
}

type EventoReplanejamento = { id: string; itemId: string; tipo: string; depois: unknown };

/**
 * Itens do score da equipe: tarefas e pendências com responsável. Obras gerais
 * (decisão 3 da etapa 5): também as atividades de topo com responsável, e o
 * replanejamento conta pelos eventos `replanejada` não desfeitos da janela
 * carregada, não pela coluna.
 */
export function itensEquipe(d: DadosLogScore): ItemEquipe[] {
  const obras = obrasValidas(d);
  const itens: ItemEquipe[] = [];
  const replanTarefa = d.geral
    ? replanejamentosPorEventos(
        semRepetidos(d.eventosTarefa).map(
          (e): EventoReplanejamento => ({
            id: e.id,
            itemId: e.tarefa_id,
            tipo: e.tipo,
            depois: e.depois,
          }),
        ),
      )
    : null;
  for (const t of d.tarefas) {
    const o = obras.get(t.obra_id);
    const nome = nomeResponsavelTarefa(t);
    if (!o || !nome) continue;
    itens.push({
      id: t.id,
      origem: 'tarefa',
      obraId: o.id,
      obraNome: o.nome,
      texto: normalizarTextoProvidencia(t.texto),
      chavePessoa: t.responsavel_id ?? `nome:${normalizarNome(nome)}`,
      nomePessoa: nome,
      prazo: t.prazo,
      prazoOriginal: t.prazo_original ?? t.prazo,
      concluidaEm: t.status === 'aberta' ? null : t.feita_em,
      replanejamentos: replanTarefa ? (replanTarefa[t.id] ?? 0) : t.replanejamentos,
      excluida: false,
    });
  }
  for (const p of d.pendencias) {
    const o = obras.get(p.obra_id);
    if (!o || !p.responsavel_id) continue;
    const prazo = prazoDaPendencia(p, d);
    itens.push({
      id: p.id,
      origem: 'pendencia',
      obraId: o.id,
      obraNome: o.nome,
      texto: p.titulo,
      chavePessoa: p.responsavel_id,
      nomePessoa: p.responsavel?.nome ?? '',
      prazo,
      prazoOriginal: prazo,
      concluidaEm: pendenciaAberta(p) ? null : p.resolvida_em,
      replanejamentos: 0,
      excluida: false,
    });
  }
  if (d.geral) {
    // Só os eventos das atividades carregadas (não excluídas), por obra; a carga
    // já traz só os da janela.
    const porObra = atividadesGeraisPorObra(d.geral);
    const obraDaAtividade = new Map(d.geral.atividades.map((a) => [a.id, a.obra_id]));
    const eventosPorObra = new Map<string, EventoReplanejamento[]>();
    for (const e of semRepetidos(d.eventosAtividade)) {
      const obraId = obraDaAtividade.get(e.atividade_id);
      if (!obraId) continue;
      const lista = eventosPorObra.get(obraId) ?? [];
      lista.push({ id: e.id, itemId: e.atividade_id, tipo: e.tipo, depois: e.depois });
      eventosPorObra.set(obraId, lista);
    }
    for (const o of obras.values()) {
      itens.push(
        ...itensEquipeObraGeral({
          obraId: o.id,
          obraNome: o.nome,
          atividades: porObra.get(o.id) ?? [],
          nomes: d.geral.nomes,
          eventos: eventosPorObra.get(o.id) ?? [],
        }),
      );
    }
  }
  return itens;
}

/** Itens do score dos prestadores: atividades de topo com prestador e fim previsto. */
export function itensPrestador(d: DadosLogScore): ItemPrestador[] {
  const obras = obrasValidas(d);
  const itens: ItemPrestador[] = [];
  for (const a of d.atividades) {
    const o = obras.get(a.obra_id);
    const fim = d.fimPrevisto[a.id];
    if (!o || a.pai_id || vazio(a.prestador) || !fim) continue;
    itens.push({
      id: a.id,
      obraId: o.id,
      obraNome: o.nome,
      texto: a.nome,
      prestador: a.prestador,
      fimPrevisto: fim,
      concluidaEm: a.concluida_em,
      comFoto: a.foto_conclusao_id != null,
      excluida: false,
    });
  }
  return itens;
}
