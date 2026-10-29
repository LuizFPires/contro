import {
  classificarSemana,
  providenciaAtrasada,
  providenciarNaSemana,
  tarefaAtrasada,
  type AtividadeEntrada,
  type AtividadeSemana,
  type RespostaReuniao,
  type SecaoResposta,
  nomeCurto,
} from '@contro/core';
import { supabase } from '../../lib/supabase';
import { hojeISO } from '../obras/api';
import { loadObra, type ObraCompleta } from '../obras/detalhe';
import { montarTrilha } from '../obras/trilhaObra';

export async function abrirReuniao(data: string): Promise<string> {
  if (!supabase) throw new Error('Sem conexão');
  const { data: res, error } = await supabase.rpc('abrir_reuniao', { p_data: data });
  if (error) throw error;
  return res as string;
}

export async function salvarObservacao(
  reuniaoId: string,
  obraId: string,
  texto: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('salvar_observacao_reuniao', {
    p_reuniao_id: reuniaoId,
    p_obra_id: obraId,
    p_texto: texto,
  });
  if (error) throw error;
}

export interface SnapshotObra {
  obra_id: string;
  snapshot: { pct: number; ritmoDias: number; entrega: string };
}

/** Gestor reabre a pauta de uma reunião fechada (ela ganha as obras ativas de hoje). */
export async function reabrirReuniao(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('reabrir_reuniao', { p_id: id });
  if (error) throw error;
}

/** Chave da resposta no mapa da reunião (uma atividade pode estar em duas seções). */
export const chaveResposta = (secao: SecaoResposta, itemId: string) => `${secao}:${itemId}`;

/** Grava a resposta de um item da pauta; null apaga (Desfazer). */
export async function responderReuniao(v: {
  reuniaoId: string;
  obraId: string;
  secao: SecaoResposta;
  itemId: string;
  resposta: RespostaReuniao | null;
}): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('responder_reuniao', {
    p_reuniao_id: v.reuniaoId,
    p_obra_id: v.obraId,
    p_secao: v.secao,
    p_item_id: v.itemId,
    p_resposta: v.resposta,
  });
  if (error) throw error;
}

export async function fecharReuniao(id: string, snapshots: SnapshotObra[]): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('fechar_reuniao', { p_id: id, p_snapshots: snapshots });
  if (error) throw error;
}

export interface ItemAtv {
  nome: string;
  data: string; // ISO (fim ou início previsto)
  atividadeId: string;
  /** Prestador da atividade (ficha), se definido. */
  prestador?: string | null;
}
export interface ItemPassada {
  atividadeId: string;
  nome: string;
  tipo: 'concluir' | 'comecar';
  /** Data prevista (fim para concluir, início para começar). */
  data: string;
  ok: boolean; // concluída no app
  /** Avanço da atividade no app (0..100). */
  avancoPct: number;
  /** Liberada e ainda aberta: dá para concluir na reunião. */
  liberada: boolean;
  motivo: string | null;
}
export interface ItemProv {
  tipo: 'contratacao' | 'locacao' | 'compra';
  descricao: string;
  atividadeId: string;
  providenciaId: string;
  naObraEm: string | null;
}

export interface ReuniaoObraDados {
  obraId: string;
  nome: string;
  modeloRotulo: string;
  pct: number;
  previstoSexta: number;
  /** "Fase 3 · Fechamentos", ou "concluída". */
  faseAtual: string;
  ritmoDias: number;
  entrega: string;
  observacoes: string;
  passadaConcluir: ItemPassada[];
  passadaComecar: ItemPassada[];
  concluir: ItemAtv[];
  comecar: ItemAtv[];
  providenciar: ItemProv[];
  providenciasAtrasadas: ItemProv[];
  atividadesAtrasadas: ItemAtv[];
  /** Para simular o impacto de "Não feito" no cronograma (sem gravar). */
  inicio: string;
  entradaCronograma: AtividadeEntrada[];
}

export interface TarefaAtrib {
  id: string;
  obraId: string;
  /** "Reunião seg 26/10" quando veio de uma reunião. */
  origem: string | null;
  texto: string;
  pessoa: string;
  prazo: string | null;
  atrasado: boolean;
  concluido: boolean;
  responsavelId: string | null;
  /** Nome digitado (sem login), quando não há responsavelId. */
  responsavelNome: string | null;
  observacao: string | null;
  vinculoTipo: 'providencia' | 'atividade' | null;
  vinculoId: string | null;
  prazoOriginal: string | null;
  replanejamentos: number;
  /** Avanço e comentário informados por quem cuida (Minhas ações). */
  avancoPct: number;
  comentario: string | null;
  avancoEm: string | null;
  feitaEm: string | null;
}

export interface ReuniaoCompleta {
  id: string;
  data: string;
  /** Horário da reunião ("16:00"), gravado quando a pauta abriu. */
  hora: string;
  status: 'pauta' | 'em_andamento' | 'fechada';
  obras: ReuniaoObraDados[];
  tarefas: TarefaAtrib[]; // para "Quem faz o quê" (por responsável) na ata
  /** Respostas da pauta, por chaveResposta(secao, item). */
  respostas: Record<string, RespostaReuniao>;
}

function motivoAtividade(obra: ObraCompleta, id: string): string | null {
  const e = obra.estados[id];
  if (!e) return null;
  if (e.concluida) return null;
  return e.lembretesPendentes ? 'falta providenciar' : null;
}

function derivarObra(obra: ObraCompleta, observacoes: string): ReuniaoObraDados {
  const dec = obra.decorridos;
  const iniciada = dec > 0 || hojeISO() >= obra.inicio;
  // Reunião: cronograma da obra (o pré-obra entra pela trilha e pelo Hoje).
  const topo = obra.atividades.filter((a) => !a.pai_id && !a.preObra);
  const nomePorId = new Map(obra.atividades.map((a) => [a.id, a.nome]));
  const prestadorDe = (id: string) => obra.atividades.find((a) => a.id === id)?.prestador ?? null;
  const avancoDe = (id: string) => obra.atividades.find((a) => a.id === id)?.avanco_pct ?? 0;

  const semanaEntrada: (AtividadeSemana & { nome: string })[] = topo.map((a) => {
    const c = obra.cron.porId[a.id];
    return {
      id: a.id,
      nome: a.nome,
      es: c?.es ?? 0,
      ef: c?.ef ?? 0,
      concluida: Boolean(a.concluida_em),
      liberada: Boolean(obra.estados[a.id]?.liberada),
    };
  });
  const sem = classificarSemana(semanaEntrada, dec);
  const cronOf = (id: string) => obra.cron.porId[id];

  const concluir: ItemAtv[] = sem.concluir.map((a) => ({
    nome: a.nome,
    data: cronOf(a.id)?.fim_previsto ?? obra.inicio,
    atividadeId: a.id,
    prestador: prestadorDe(a.id),
  }));
  const comecar: ItemAtv[] = sem.comecar.map((a) => ({
    nome: a.nome,
    data: cronOf(a.id)?.inicio_previsto ?? obra.inicio,
    atividadeId: a.id,
    prestador: prestadorDe(a.id),
  }));
  const passadaConcluir: ItemPassada[] = sem.passadaConcluir.map((a) => ({
    atividadeId: a.id,
    nome: a.nome,
    tipo: 'concluir',
    data: cronOf(a.id)?.fim_previsto ?? obra.inicio,
    ok: a.concluida,
    avancoPct: a.concluida ? 100 : avancoDe(a.id),
    liberada: a.liberada,
    motivo: a.concluida ? null : motivoAtividade(obra, a.id),
  }));
  const passadaComecar: ItemPassada[] = sem.passadaComecar.map((a) => ({
    atividadeId: a.id,
    nome: a.nome,
    tipo: 'comecar',
    data: cronOf(a.id)?.inicio_previsto ?? obra.inicio,
    // "Começou" vem da resposta na reunião (ou do avanço no app).
    ok: a.concluida,
    avancoPct: a.concluida ? 100 : avancoDe(a.id),
    liberada: a.liberada,
    motivo: a.concluida ? null : motivoAtividade(obra, a.id),
  }));

  const providenciar: ItemProv[] = [];
  const providenciasAtrasadas: ItemProv[] = [];
  for (const a of topo) {
    const es = cronOf(a.id)?.es ?? 0;
    for (const p of a.providencias) {
      const args = {
        status: p.status,
        atividadeConcluida: Boolean(a.concluida_em),
        obraIniciada: iniciada,
        decorridos: dec,
        esAtividade: es,
        antecedenciaDu: p.antecedencia_du,
      };
      const item: ItemProv = {
        tipo: p.tipo,
        descricao: p.descricao,
        atividadeId: a.id,
        providenciaId: p.id,
        naObraEm: p.na_obra_em,
      };
      if (providenciaAtrasada(args)) providenciasAtrasadas.push(item);
      else if (providenciarNaSemana(args)) providenciar.push(item);
    }
  }

  const atividadesAtrasadas: ItemAtv[] = topo
    .filter((a) => obra.estados[a.id]?.atrasada)
    .map((a) => ({
      nome: nomePorId.get(a.id) ?? '',
      data: cronOf(a.id)?.fim_previsto ?? obra.inicio,
      atividadeId: a.id,
    }));

  const faseAtual = montarTrilha(obra).find((f) => f.status === 'execucao');

  return {
    obraId: obra.id,
    nome: obra.nome,
    modeloRotulo: obra.modelo_rotulo,
    pct: obra.pct,
    previstoSexta: obra.previstoSexta,
    faseAtual: faseAtual ? `Fase ${faseAtual.n} · ${faseAtual.titulo}` : 'concluída',
    ritmoDias: obra.ritmoDias,
    entrega: obra.entrega,
    observacoes,
    passadaConcluir,
    passadaComecar,
    concluir,
    comecar,
    providenciar,
    providenciasAtrasadas,
    atividadesAtrasadas,
    inicio: obra.inicio,
    entradaCronograma: obra.atividades
      .filter((x) => !x.preObra)
      .map((x) => ({
        id: x.id,
        duracao_du: x.duracao_du,
        pai_id: x.pai_id,
        em_sequencia: x.em_sequencia,
        inicio_manual: x.inicio_manual,
        predecessoras: x.predecessoras,
        defasagens: x.defasagens,
      })),
  };
}

export async function loadReuniao(data: string): Promise<ReuniaoCompleta | null> {
  if (!supabase) return null;
  const id = await abrirReuniao(data);
  const [rRes, roRes, respRes] = await Promise.all([
    supabase.from('reuniao').select('id,data,hora,status').eq('id', id).maybeSingle(),
    supabase.from('reuniao_obra').select('obra_id,observacoes').eq('reuniao_id', id),
    supabase.from('reuniao_resposta').select('secao,item_id,resposta').eq('reuniao_id', id),
  ]);
  const respostas: Record<string, RespostaReuniao> = {};
  for (const x of (respRes.data ?? []) as {
    secao: SecaoResposta;
    item_id: string;
    resposta: RespostaReuniao;
  }[]) {
    respostas[chaveResposta(x.secao, x.item_id)] = x.resposta;
  }
  const r = rRes.data as {
    id: string;
    data: string;
    hora: string;
    status: ReuniaoCompleta['status'];
  } | null;
  if (!r) return null;
  const ro = (roRes.data ?? []) as { obra_id: string; observacoes: string | null }[];

  const obraIds = ro.map((x) => x.obra_id);
  const obras = (await Promise.all(obraIds.map((oid) => loadObra(oid)))).filter(
    (o): o is ObraCompleta => Boolean(o),
  );
  const obsPorObra = new Map(ro.map((x) => [x.obra_id, x.observacoes ?? '']));

  // Tarefas das obras da reunião → "Quem faz o quê" por responsável na ata.
  let tarefas: TarefaAtrib[] = [];
  if (obraIds.length > 0) {
    const hoje = hojeISO();
    const { data: tData } = await supabase
      .from('tarefa')
      .select(
        'id,obra_id,origem_texto,texto,status,prazo,prazo_original,replanejamentos,responsavel_id,' +
          'responsavel_nome,observacao,vinculo_tipo,vinculo_id,avanco_pct,comentario,avanco_em,feita_em,' +
          'responsavel:pessoa!responsavel_id(nome)',
      )
      .in('obra_id', obraIds)
      .is('deleted_at', null);
    tarefas = (
      (tData ?? []) as unknown as {
        id: string;
        obra_id: string;
        origem_texto: string | null;
        texto: string;
        status: 'aberta' | 'feita';
        prazo: string;
        prazo_original: string | null;
        replanejamentos: number;
        responsavel_id: string | null;
        responsavel_nome: string | null;
        observacao: string | null;
        vinculo_tipo: 'providencia' | 'atividade' | null;
        vinculo_id: string | null;
        avanco_pct: number | null;
        comentario: string | null;
        avanco_em: string | null;
        feita_em: string | null;
        responsavel: { nome: string } | null;
      }[]
    ).map((t) => ({
      id: t.id,
      obraId: t.obra_id,
      origem: t.origem_texto,
      texto: t.texto,
      pessoa: nomeCurto(t.responsavel?.nome ?? t.responsavel_nome) || 'Sem responsável',
      prazo: t.prazo,
      atrasado: tarefaAtrasada(t, hoje),
      concluido: t.status === 'feita',
      responsavelId: t.responsavel_id,
      responsavelNome: t.responsavel_nome,
      observacao: t.observacao,
      vinculoTipo: t.vinculo_tipo,
      vinculoId: t.vinculo_id,
      prazoOriginal: t.prazo_original,
      replanejamentos: t.replanejamentos,
      avancoPct: t.avanco_pct ?? 0,
      comentario: t.comentario,
      avancoEm: t.avanco_em,
      feitaEm: t.feita_em,
    }));
  }

  return {
    id: r.id,
    data: r.data,
    hora: (r.hora ?? '16:00').slice(0, 5),
    status: r.status,
    obras: obras.map((o) => derivarObra(o, obsPorObra.get(o.id) ?? '')),
    tarefas,
    respostas,
  };
}
