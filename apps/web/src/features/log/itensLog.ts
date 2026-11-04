// Adaptadores puros do Log e do Score: linhas cruas do banco (já carregadas por
// loadDadosLogScore) → itens e eventos no formato do core. Sem React, sem
// regra de domínio: prazos de pendência e normalização de nome vêm do core.
import {
  normalizarNome,
  prazoPendencia,
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

function prazoDaPendencia(p: LinhaPendenciaLog, prazos: PrazosPendencia): DataISO {
  return prazoPendencia(p.criticidade, dataLocal(p.apontada_em), prazos);
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
      texto: t.texto,
      prazo: t.prazo,
      prazoOriginal: t.prazo_original ?? t.prazo,
      aberta: t.status === 'aberta',
      concluidaEm: t.status === 'aberta' ? null : t.feita_em,
      responsavelNome: nomeResponsavelTarefa(t),
      excluida: false,
      ...(t.vinculo_tipo === 'providencia' ? { vinculoProvidencia: true } : {}),
    });
  }
  for (const p of d.pendencias) {
    const o = obras.get(p.obra_id);
    if (!o) continue;
    const prazo = prazoDaPendencia(p, d.prazos);
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
      responsavelNome: p.responsavel?.nome ?? null,
      excluida: false,
    });
  }
  for (const a of d.atividades) {
    const o = obras.get(a.obra_id);
    if (!o || a.pai_id) continue;
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
      excluida: false,
    });
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

/** Eventos das três tabelas no formato do core, com a origem de cada um. */
export function eventosDoLog(d: DadosLogScore): { origem: OrigemLog; evento: EventoBruto }[] {
  return [
    ...d.eventosTarefa.map((e) => ({
      origem: 'tarefa' as const,
      evento: evento(e, e.tarefa_id, e.antes, e.depois),
    })),
    ...d.eventosPendencia.map((e) => ({
      origem: 'pendencia' as const,
      evento: evento(e, e.pendencia_id, null, e.dados),
    })),
    ...d.eventosAtividade.map((e) => ({
      origem: 'atividade' as const,
      evento: evento(e, e.atividade_id, e.antes, e.depois),
    })),
  ];
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

/** Itens do score da equipe: tarefas e pendências com responsável. */
export function itensEquipe(d: DadosLogScore): ItemEquipe[] {
  const obras = obrasValidas(d);
  const itens: ItemEquipe[] = [];
  for (const t of d.tarefas) {
    const o = obras.get(t.obra_id);
    const nome = nomeResponsavelTarefa(t);
    if (!o || !nome) continue;
    itens.push({
      id: t.id,
      origem: 'tarefa',
      obraId: o.id,
      obraNome: o.nome,
      texto: t.texto,
      chavePessoa: t.responsavel_id ?? `nome:${normalizarNome(nome)}`,
      nomePessoa: nome,
      prazo: t.prazo,
      prazoOriginal: t.prazo_original ?? t.prazo,
      concluidaEm: t.status === 'aberta' ? null : t.feita_em,
      replanejamentos: t.replanejamentos,
      excluida: false,
    });
  }
  for (const p of d.pendencias) {
    const o = obras.get(p.obra_id);
    if (!o || !p.responsavel_id) continue;
    const prazo = prazoDaPendencia(p, d.prazos);
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
