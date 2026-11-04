// Atividades como ações: a atividade de topo aberta, fora do pré-obra e sem
// tarefa aberta vinculada fica "sem dono" (Tarefas da equipe, Hoje e Minhas
// ações). O prazo é o fim previsto pelo cronograma.
import type { DataISO } from './calendar';

/** Atividade aberta sem tarefa aberta vinculada: aparece como ação "Sem responsável". */
export interface AtividadeSemDono {
  id: string;
  obraId: string;
  obraNome: string;
  nome: string;
  faseNome: string;
  prestador: string | null;
  /** Fim previsto (cronograma). */
  prazo: DataISO;
}

/** Linha de atividade de topo como `listarObras` carrega. */
export interface LinhaAtividadeTopo {
  id: string;
  obra_id: string;
  fase_id: string;
  pai_id: string | null;
  nome: string;
  prestador: string | null;
  concluida_em: string | null;
  fim_previsto_calc: string | null;
}

interface CronFim {
  porId: Record<string, { fim_previsto: DataISO }>;
}

interface FaseLinha {
  id: string;
  preliminar: boolean;
  titulo: string;
}

/** Fase da atividade de topo, aberta e fora do pré-obra (null se não elegível). */
function faseElegivel(a: LinhaAtividadeTopo, fasePorId: Map<string, FaseLinha>): FaseLinha | null {
  if (a.pai_id || a.concluida_em) return null;
  const fase = fasePorId.get(a.fase_id);
  return fase && !fase.preliminar ? fase : null;
}

export function atividadesSemDono(
  atividades: LinhaAtividadeTopo[],
  fases: FaseLinha[],
  cron: CronFim,
  tarefasAbertas: { vinculo_tipo: string | null; vinculo_id: string | null }[],
  obraId: string,
  obraNome: string,
): AtividadeSemDono[] {
  const comTarefa = new Set(
    tarefasAbertas
      .filter((t) => t.vinculo_tipo === 'atividade' && t.vinculo_id)
      .map((t) => t.vinculo_id),
  );
  const fasePorId = new Map(fases.map((f) => [f.id, f]));
  const out: AtividadeSemDono[] = [];
  for (const a of atividades) {
    const fase = faseElegivel(a, fasePorId);
    if (!fase || comTarefa.has(a.id)) continue;
    const it = cron.porId[a.id];
    if (!it) continue;
    out.push({
      id: a.id,
      obraId,
      obraNome,
      nome: a.nome,
      faseNome: fase.titulo,
      prestador: a.prestador?.trim() ? a.prestador : null,
      prazo: it.fim_previsto,
    });
  }
  return out;
}

/**
 * Prazos a gravar em `fim_previsto_calc` (para o aviso do gestor): atividades de
 * topo abertas, fora do pré-obra, cujo fim previsto difere do gravado.
 */
export function prazosParaGravarAtividades(
  atividades: LinhaAtividadeTopo[],
  cron: CronFim,
  fases: FaseLinha[],
): { id: string; ate: DataISO }[] {
  const fasePorId = new Map(fases.map((f) => [f.id, f]));
  const out: { id: string; ate: DataISO }[] = [];
  for (const a of atividades) {
    if (!faseElegivel(a, fasePorId)) continue;
    const it = cron.porId[a.id];
    if (it && it.fim_previsto !== a.fim_previsto_calc) out.push({ id: a.id, ate: it.fim_previsto });
  }
  return out;
}

/**
 * Tira as atividades que já têm tarefa aberta vinculada no cache otimista de
 * tarefas (ex.: acabou de atribuir, ainda sem sync): evita mostrar as duas.
 */
export function semTarefaAbertaAtividade<T extends { id: string }>(
  atividades: T[],
  tarefas: { status: string; vinculo_tipo: string | null; vinculo_id: string | null }[],
): T[] {
  const vinculadas = new Set(
    tarefas
      .filter((t) => t.status === 'aberta' && t.vinculo_tipo === 'atividade' && t.vinculo_id)
      .map((t) => t.vinculo_id),
  );
  return vinculadas.size ? atividades.filter((a) => !vinculadas.has(a.id)) : atividades;
}
