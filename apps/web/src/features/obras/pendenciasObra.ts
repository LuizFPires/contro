import type { Criticidade, StatusPendencia } from '@contro/core';
import { supabase } from '../../lib/supabase';

export interface PendenciaObra {
  id: string;
  obra_id: string;
  atividade_id: string | null;
  responsavel_id?: string | null;
  responsavelNome?: string | null;
  titulo: string;
  local: string | null;
  criticidade: Criticidade;
  status: StatusPendencia;
  ordem_fila: number;
  adiada_ate: string | null;
  motivo_adiamento: string | null;
  apontada_em: string;
  resolvida_por: string | null;
  resolvida_em: string | null;
  vistoriada_por: string | null;
  vistoriada_em: string | null;
  // derivados para a UI
  fotoAntesUrl: string | null;
  fotoDepoisUrl: string | null;
  apontouNome: string | null;
  resolveuNome: string | null;
  atividadeNome: string | null;
}

interface LinhaPendencia {
  responsavel_id: string | null;
  responsavel: { nome: string } | null;
  id: string;
  obra_id: string;
  atividade_id: string | null;
  titulo: string;
  local: string | null;
  criticidade: Criticidade;
  status: StatusPendencia;
  ordem_fila: number;
  adiada_ate: string | null;
  motivo_adiamento: string | null;
  apontada_em: string;
  resolvida_por: string | null;
  resolvida_em: string | null;
  vistoriada_por: string | null;
  vistoriada_em: string | null;
  antes: { storage_path: string } | null;
  depois: { storage_path: string } | null;
  apontou: { nome: string } | null;
  resolveu: { nome: string } | null;
  atividade: { nome: string } | null;
}

export async function loadPendencias(obraId: string): Promise<PendenciaObra[]> {
  if (!supabase) return [];
  const linhas: LinhaPendencia[] = [];
  for (let inicio = 0; ; inicio += 500) {
    const { data, error } = await supabase
      .from('pendencia')
      .select(
        'id,obra_id,atividade_id,responsavel_id,titulo,local,criticidade,status,ordem_fila,adiada_ate,motivo_adiamento,apontada_em,resolvida_por,resolvida_em,vistoriada_por,vistoriada_em,' +
          'responsavel:pessoa!responsavel_id(nome),antes:foto!foto_antes_id(storage_path),depois:foto!foto_depois_id(storage_path),' +
          'apontou:pessoa!apontada_por(nome),resolveu:pessoa!resolvida_por(nome),atividade:obra_atividade!atividade_id(nome)',
      )
      .eq('obra_id', obraId)
      .is('deleted_at', null)
      .order('id')
      .range(inicio, inicio + 499);

    if (error) throw error;
    linhas.push(...((data ?? []) as unknown as LinhaPendencia[]));
    if (!data || data.length < 500) break;
  }

  // Assina as fotos privadas em lote (uma URL por caminho).
  const caminhos = new Set<string>();
  for (const l of linhas) {
    if (l.antes?.storage_path) caminhos.add(l.antes.storage_path);
    if (l.depois?.storage_path) caminhos.add(l.depois.storage_path);
  }
  const url = new Map<string, string>();
  if (caminhos.size > 0) {
    const { data: assinadas } = await supabase.storage
      .from('fotos')
      .createSignedUrls([...caminhos], 3600);
    for (const a of assinadas ?? []) {
      if (a.signedUrl && a.path) url.set(a.path, a.signedUrl);
    }
  }

  return linhas.map((l) => ({
    id: l.id,
    responsavel_id: l.responsavel_id,
    responsavelNome: l.responsavel?.nome ?? null,
    obra_id: l.obra_id,
    atividade_id: l.atividade_id,
    titulo: l.titulo,
    local: l.local,
    criticidade: l.criticidade,
    status: l.status,
    ordem_fila: Number(l.ordem_fila),
    adiada_ate: l.adiada_ate,
    motivo_adiamento: l.motivo_adiamento,
    apontada_em: l.apontada_em,
    resolvida_por: l.resolvida_por,
    resolvida_em: l.resolvida_em,
    vistoriada_por: l.vistoriada_por,
    vistoriada_em: l.vistoriada_em,
    fotoAntesUrl: l.antes?.storage_path ? (url.get(l.antes.storage_path) ?? null) : null,
    fotoDepoisUrl: l.depois?.storage_path ? (url.get(l.depois.storage_path) ?? null) : null,
    apontouNome: l.apontou?.nome ?? null,
    resolveuNome: l.resolveu?.nome ?? null,
    atividadeNome: l.atividade?.nome ?? null,
  }));
}
