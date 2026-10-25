import {
  classificarSemana,
  providenciaAtrasada,
  providenciarNaSemana,
  type AtividadeSemana,
} from '@obdc/core';
import { supabase } from '../../lib/supabase';
import { hojeISO } from '../obras/api';
import { loadObra, type ObraCompleta } from '../obras/detalhe';

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

export async function fecharReuniao(id: string, snapshots: SnapshotObra[]): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.rpc('fechar_reuniao', { p_id: id, p_snapshots: snapshots });
  if (error) throw error;
}

export interface ItemAtv {
  nome: string;
  data: string; // ISO (fim ou início previsto)
  atividadeId: string;
}
export interface ItemPassada {
  nome: string;
  ok: boolean; // concluída (concluir) ou começou/liberada (começar)
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
}

export interface ReuniaoCompleta {
  id: string;
  data: string;
  status: 'pauta' | 'em_andamento' | 'fechada';
  obras: ReuniaoObraDados[];
}

function motivoAtividade(obra: ObraCompleta, id: string): string | null {
  const e = obra.estados[id];
  if (!e) return null;
  if (e.concluida) return null;
  if (e.liberada) return 'liberada';
  if (!e.predsOk) return 'aguarda predecessoras';
  if (!e.provOk) return 'aguarda providências';
  return null;
}

function derivarObra(obra: ObraCompleta, observacoes: string): ReuniaoObraDados {
  const dec = obra.decorridos;
  const iniciada = dec > 0 || hojeISO() >= obra.inicio;
  const topo = obra.atividades.filter((a) => !a.pai_id);
  const nomePorId = new Map(obra.atividades.map((a) => [a.id, a.nome]));

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
  }));
  const comecar: ItemAtv[] = sem.comecar.map((a) => ({
    nome: a.nome,
    data: cronOf(a.id)?.inicio_previsto ?? obra.inicio,
    atividadeId: a.id,
  }));
  const passadaConcluir: ItemPassada[] = sem.passadaConcluir.map((a) => ({
    nome: a.nome,
    ok: a.concluida,
    motivo: a.concluida ? null : motivoAtividade(obra, a.id),
  }));
  const passadaComecar: ItemPassada[] = sem.passadaComecar.map((a) => ({
    nome: a.nome,
    ok: a.concluida || a.liberada,
    motivo: a.concluida || a.liberada ? null : motivoAtividade(obra, a.id),
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

  return {
    obraId: obra.id,
    nome: obra.nome,
    modeloRotulo: obra.modelo_rotulo,
    pct: obra.pct,
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
  };
}

export async function loadReuniao(data: string): Promise<ReuniaoCompleta | null> {
  if (!supabase) return null;
  const id = await abrirReuniao(data);
  const [rRes, roRes] = await Promise.all([
    supabase.from('reuniao').select('id,data,status').eq('id', id).maybeSingle(),
    supabase.from('reuniao_obra').select('obra_id,observacoes').eq('reuniao_id', id),
  ]);
  const r = rRes.data as { id: string; data: string; status: ReuniaoCompleta['status'] } | null;
  if (!r) return null;
  const ro = (roRes.data ?? []) as { obra_id: string; observacoes: string | null }[];

  const obras = (await Promise.all(ro.map((x) => loadObra(x.obra_id)))).filter(
    (o): o is ObraCompleta => Boolean(o),
  );
  const obsPorObra = new Map(ro.map((x) => [x.obra_id, x.observacoes ?? '']));

  return {
    id: r.id,
    data: r.data,
    status: r.status,
    obras: obras.map((o) => derivarObra(o, obsPorObra.get(o.id) ?? '')),
  };
}
