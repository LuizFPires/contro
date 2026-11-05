import { nomeCurto, type AtividadeGeral, type FaseGeralEntrada } from '@contro/core';
import { supabase } from '../../lib/supabase';
import type { ObraProv } from '../obras/detalhe';

/** Lembrete de contratação, locação ou compra: os mesmos campos que a obra Contorno lê. */
export type ProvidenciaGeral = ObraProv;

export interface PessoaDaObra {
  id: string;
  nome: string;
  papel: 'coordenador' | 'membro' | 'administrador';
}

export interface ObraGeral {
  id: string;
  nome: string;
  cidade: string | null;
  fases: (FaseGeralEntrada & { preliminar: false })[];
  /** Topo + subitens; sem mapa de coleta nem cronograma. */
  atividades: (AtividadeGeral & { mapa_antecedencia_du: null })[];
  /** Participantes da obra e Administradores (que sempre veem), sem repetir. */
  pessoas: PessoaDaObra[];
  providencias: ProvidenciaGeral[];
}

interface LinhaParticipante {
  pessoa: { id: string; nome: string; papel_geral: 'coordenador' | 'membro' | null } | null;
}

/** Une participantes e Administradores: quem é os dois sai como administrador. */
function montarPessoas(
  participantes: LinhaParticipante[],
  administradores: { id: string; nome: string }[],
): PessoaDaObra[] {
  const porId = new Map<string, PessoaDaObra>();
  for (const { pessoa } of participantes) {
    if (!pessoa) continue;
    porId.set(pessoa.id, {
      id: pessoa.id,
      nome: pessoa.nome,
      papel: pessoa.papel_geral ?? 'membro',
    });
  }
  for (const p of administradores)
    porId.set(p.id, { id: p.id, nome: p.nome, papel: 'administrador' });
  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Obra geral inteira em uma rodada de consultas (sem N+1). `null` se não existe ou não é visível. */
export async function carregarObraGeral(id: string): Promise<ObraGeral | null> {
  if (!supabase) return null;
  const [oRes, fRes, aRes, partRes, admRes, pRes] = await Promise.all([
    supabase
      .from('obra')
      .select('id,nome,cidade')
      .eq('id', id)
      .eq('ambiente', 'geral')
      .is('deleted_at', null)
      .maybeSingle(),
    supabase.from('obra_fase').select('id,ordem,titulo').eq('obra_id', id).order('ordem'),
    supabase
      .from('obra_atividade')
      .select(
        'id,fase_id,pai_id,ordem,nome,data_prevista,replanejamentos,responsavel_id,concluida_em,' +
          'avanco_pct,foto_conclusao_id,prestador',
      )
      .eq('obra_id', id)
      .is('deleted_at', null)
      .order('ordem'),
    supabase.from('obra_participante').select('pessoa(id,nome,papel_geral)').eq('obra_id', id),
    supabase
      .from('pessoa')
      .select('id,nome')
      .eq('administrador', true)
      .eq('ativo', true)
      .is('deleted_at', null),
    supabase
      .from('obra_providencia')
      .select(
        'id,atividade_id,tipo,descricao,status,antecedencia_du,duracao_du,na_obra_em,manual,feito_em,' +
          'feito:pessoa!feito_por(nome)',
      )
      .is('deleted_at', null)
      .eq('obra_id', id),
  ]);

  const o = oRes.data as { id: string; nome: string; cidade: string | null } | null;
  if (!o) return null;

  const providencias = (
    (pRes.data ?? []) as unknown as (Omit<ProvidenciaGeral, 'feito_por_nome'> & {
      feito: { nome: string } | null;
    })[]
  ).map(({ feito, ...resto }) => ({ ...resto, feito_por_nome: nomeCurto(feito?.nome) || null }));

  return {
    id: o.id,
    nome: o.nome,
    cidade: o.cidade,
    fases: ((fRes.data ?? []) as FaseGeralEntrada[]).map((f) => ({ ...f, preliminar: false })),
    atividades: ((aRes.data ?? []) as unknown as AtividadeGeral[]).map((a) => ({
      ...a,
      mapa_antecedencia_du: null,
    })),
    pessoas: montarPessoas(
      (partRes.data ?? []) as unknown as LinhaParticipante[],
      (admRes.data ?? []) as { id: string; nome: string }[],
    ),
    providencias,
  };
}
