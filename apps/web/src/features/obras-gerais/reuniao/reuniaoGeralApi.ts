import {
  nomeCurto,
  tarefaAtrasada,
  type DataISO,
  type RespostaReuniao,
  type SecaoResposta,
} from '@contro/core';
import { supabase } from '../../../lib/supabase';
import { dataLocal, hojeISO } from '../../obras/api';
import { chaveResposta, type ReuniaoCompleta, type TarefaAtrib } from '../../reuniao/reuniaoApi';
import { carregarObraGeral, type ObraGeral } from '../obraGeral';

/**
 * Reunião de uma obra geral (decisão 1): a reunião da obra na data, com a obra inteira, as
 * tarefas e as respostas. É uma `ReuniaoCompleta` sem a lista de obras da Contorno
 * (`obras` vazio): as funções de resposta e ação de `reuniao/ataDados` valem para ela.
 */
export interface ReuniaoGeral extends ReuniaoCompleta {
  obraId: string;
  obra: ObraGeral;
  observacoes: string;
}

/** Abre (ou devolve) a reunião da obra na data. Reunião fechada não muda. */
export async function abrirReuniaoGeral(obraId: string, data: DataISO): Promise<string> {
  if (!supabase) throw new Error('Sem conexão');
  const { data: id, error } = await supabase.rpc('abrir_reuniao_geral', {
    p_obra_id: obraId,
    p_data: data,
  });
  if (error) throw error;
  return id as string;
}

/** Quem planeja fecha a ata; o snapshot guarda como a obra estava. */
export async function fecharReuniaoGeral(
  id: string,
  snapshot: { eficienciaPct: number | null; atrasadas: number },
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('fechar_reuniao_geral', { p_id: id, p_snapshot: snapshot });
  if (error) throw error;
}

/** Quem planeja reabre a pauta de uma ata fechada. */
export async function reabrirReuniaoGeral(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('reabrir_reuniao_geral', { p_id: id });
  if (error) throw error;
}

interface LinhaTarefa {
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
  created_at: string;
}

/** Tarefa do banco no formato da reunião; o nome vem das pessoas da obra. */
export function tarefaDaReuniao(
  t: LinhaTarefa,
  nomes: Map<string, string>,
  hoje: DataISO,
): TarefaAtrib {
  const nome = (t.responsavel_id ? nomes.get(t.responsavel_id) : null) ?? t.responsavel_nome;
  return {
    id: t.id,
    obraId: t.obra_id,
    origem: t.origem_texto,
    texto: t.texto,
    pessoa: nomeCurto(nome) || 'Sem responsável',
    pessoaNomeCompleto: nome ?? 'Sem responsável',
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
  };
}

/**
 * Carrega a reunião da obra na data, numa rodada de consultas. `criar` abre a pauta se
 * ainda não existe (a que vem); sem `criar` (reunião anterior) só lê: null se não houve.
 */
export async function carregarReuniaoGeral(
  obraId: string,
  data: DataISO,
  criar: boolean,
): Promise<ReuniaoGeral | null> {
  if (!supabase) return null;
  let id: string;
  if (criar) {
    id = await abrirReuniaoGeral(obraId, data);
  } else {
    const { data: r, error } = await supabase
      .from('reuniao')
      .select('id')
      .eq('obra_id', obraId)
      .eq('data', data)
      .maybeSingle();
    if (error) throw error;
    if (!r) return null;
    id = (r as { id: string }).id;
  }
  const [rRes, roRes, respRes, tRes, obra] = await Promise.all([
    supabase.from('reuniao').select('id,data,hora,status').eq('id', id).maybeSingle(),
    supabase
      .from('reuniao_obra')
      .select('observacoes')
      .eq('reuniao_id', id)
      .eq('obra_id', obraId)
      .maybeSingle(),
    supabase
      .from('reuniao_resposta')
      .select('secao,item_id,resposta,tarefa_id')
      .eq('reuniao_id', id),
    supabase
      .from('tarefa')
      .select(
        'id,obra_id,origem_texto,texto,status,prazo,prazo_original,replanejamentos,responsavel_id,' +
          'responsavel_nome,observacao,vinculo_tipo,vinculo_id,avanco_pct,comentario,avanco_em,feita_em,created_at',
      )
      .eq('obra_id', obraId)
      .is('deleted_at', null),
    carregarObraGeral(obraId),
  ]);
  const falha = [rRes, roRes, respRes, tRes].find((x) => x.error)?.error;
  if (falha) throw new Error(falha.message);
  const r = rRes.data as {
    id: string;
    data: string;
    hora: string | null;
    status: ReuniaoGeral['status'];
  } | null;
  if (!r || !obra) return null;

  const respostas: Record<string, RespostaReuniao> = {};
  const acoesResposta: Record<string, string> = {};
  for (const x of (respRes.data ?? []) as {
    secao: SecaoResposta;
    item_id: string;
    resposta: RespostaReuniao;
    tarefa_id: string | null;
  }[]) {
    respostas[chaveResposta(x.secao, x.item_id)] = x.resposta;
    if (x.tarefa_id) acoesResposta[chaveResposta(x.secao, x.item_id)] = x.tarefa_id;
  }
  const nomes = new Map(obra.pessoas.map((p) => [p.id, p.nome]));
  const hoje = hojeISO();

  return {
    id: r.id,
    data: r.data,
    hora: (r.hora ?? '16:00').slice(0, 5),
    status: r.status,
    obras: [],
    // Só as tarefas que já existiam no dia da reunião: a ata de uma reunião passada não
    // ganha as ações criadas depois dela.
    tarefas: ((tRes.data ?? []) as unknown as LinhaTarefa[])
      .filter((t) => dataLocal(new Date(t.created_at)) <= r.data)
      .map((t) => tarefaDaReuniao(t, nomes, hoje)),
    respostas,
    acoesResposta,
    obraId,
    obra,
    observacoes: (roRes.data as { observacoes: string | null } | null)?.observacoes ?? '',
  };
}

export interface ReuniaoGeralLista {
  id: string;
  obraId: string;
  data: string;
  hora: string;
  status: 'pauta' | 'em_andamento' | 'fechada';
}

/** Reuniões das obras gerais (as mais recentes primeiro), numa consulta só. */
export async function listarReunioesGerais(obraIds: string[]): Promise<ReuniaoGeralLista[]> {
  if (!supabase || obraIds.length === 0) return [];
  const { data, error } = await supabase
    .from('reuniao')
    .select('id,obra_id,data,hora,status')
    .in('obra_id', obraIds)
    .order('data', { ascending: false })
    .limit(30 * obraIds.length);
  if (error) throw error;
  return (
    (data ?? []) as {
      id: string;
      obra_id: string;
      data: string;
      hora: string | null;
      status: ReuniaoGeralLista['status'];
    }[]
  ).map((x) => ({
    id: x.id,
    obraId: x.obra_id,
    data: x.data,
    hora: (x.hora ?? '16:00').slice(0, 5),
    status: x.status,
  }));
}
