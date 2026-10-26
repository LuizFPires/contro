import { supabase } from '../../lib/supabase';

// Edições granulares do modelo (só gestor, sob RLS + constraints/triggers).

export async function setDuracaoAtividade(id: string, duracao_du: number): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('modelo_atividade').update({ duracao_du }).eq('id', id);
  if (error) throw error;
}

export async function addDependencia(
  modeloId: string,
  atividadeId: string,
  predId: string,
): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('modelo_dependencia').insert({
    modelo_id: modeloId,
    atividade_id: atividadeId,
    predecessora_id: predId,
  });
  if (error) throw error; // trigger anti-ciclo rejeita ciclo
}

export async function removeDependencia(atividadeId: string, predId: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase
    .from('modelo_dependencia')
    .delete()
    .eq('atividade_id', atividadeId)
    .eq('predecessora_id', predId);
  if (error) throw error;
}

/** Exclui a atividade (cascata remove subitens, dependências e providências). */
export async function removeAtividade(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('modelo_atividade').delete().eq('id', id);
  if (error) throw error;
}

export async function renomearFase(id: string, titulo: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('modelo_fase').update({ titulo }).eq('id', id);
  if (error) throw error;
}

export async function criarFase(modeloId: string, titulo: string, ordem: number): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase
    .from('modelo_fase')
    .insert({ modelo_id: modeloId, titulo, ordem });
  if (error) throw error;
}

/** Exclui a fase do modelo (cascata remove as atividades dela). */
export async function excluirFase(id: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão');
  const { error } = await supabase.from('modelo_fase').delete().eq('id', id);
  if (error) throw error;
}

export interface AtividadeEditada {
  nome: string;
  duracaoDu: number;
  subitens: { nome: string; duracao_du: number; em_sequencia: boolean }[];
  predecessoras: string[];
  providencias: { tipo: string; descricao: string; antecedencia_du: number }[];
  /** Pré-obra: atividades que libera e quantos dias úteis antes da mais cedo termina. */
  mapaLibera?: string[];
  mapaAntecedenciaDu?: number | null;
}

/**
 * Edita uma atividade existente do modelo pelo assistente (regra 13). Sob RLS
 * (só gestor). As dependências vão primeiro: se o trigger anti-ciclo recusar,
 * nada mais é alterado.
 */
export async function atualizarAtividade(
  modeloId: string,
  atv: { id: string; fase_id: string },
  e: AtividadeEditada,
): Promise<void> {
  const sb = supabase;
  if (!sb) throw new Error('Sem conexão');
  const ok = (r: { error: unknown }) => {
    if (r.error) throw r.error;
  };

  // 1) Dependências (pode falhar por ciclo).
  ok(await sb.from('modelo_dependencia').delete().eq('atividade_id', atv.id));
  if (e.predecessoras.length) {
    ok(
      await sb.from('modelo_dependencia').insert(
        e.predecessoras.map((p) => ({
          modelo_id: modeloId,
          atividade_id: atv.id,
          predecessora_id: p,
        })),
      ),
    );
  }

  // 2) Nome e duração.
  ok(
    await sb
      .from('modelo_atividade')
      .update({
        nome: e.nome,
        duracao_du: e.duracaoDu,
        mapa_antecedencia_du: e.mapaLibera?.length ? (e.mapaAntecedenciaDu ?? 0) : null,
      })
      .eq('id', atv.id),
  );

  // Pré-obra: o que o mapa libera (troca a lista inteira).
  if (e.mapaLibera) {
    ok(await sb.from('modelo_mapa_libera').delete().eq('mapa_id', atv.id));
    if (e.mapaLibera.length)
      ok(
        await sb.from('modelo_mapa_libera').insert(
          e.mapaLibera.map((atividade_id) => ({
            modelo_id: modeloId,
            mapa_id: atv.id,
            atividade_id,
          })),
        ),
      );
  }

  // 3) Subitens (um nível só): troca a lista inteira.
  ok(await sb.from('modelo_atividade').delete().eq('pai_id', atv.id));
  if (e.subitens.length) {
    ok(
      await sb.from('modelo_atividade').insert(
        e.subitens.map((s, i) => ({
          modelo_id: modeloId,
          fase_id: atv.fase_id,
          pai_id: atv.id,
          ordem: i + 1,
          nome: s.nome,
          duracao_du: s.duracao_du,
          em_sequencia: s.em_sequencia,
        })),
      ),
    );
  }

  // 4) Providências: troca a lista inteira.
  ok(await sb.from('modelo_providencia').delete().eq('atividade_id', atv.id));
  if (e.providencias.length) {
    ok(
      await sb.from('modelo_providencia').insert(
        e.providencias.map((p) => ({
          modelo_id: modeloId,
          atividade_id: atv.id,
          tipo: p.tipo,
          descricao: p.descricao,
          antecedencia_du: p.antecedencia_du,
        })),
      ),
    );
  }
}
