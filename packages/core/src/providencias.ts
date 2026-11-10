// Lembretes de providência (SPEC 4.4). Sem valor e sem fornecedor (decisão do
// produto). O limite é relativo ao início da atividade (ES) e à antecedência.
import { addDU, deslocarDU, type DataISO } from './calendar';
import type { TipoProvidencia } from './trilha';

/** Dia (em du, relativo ao início da obra) até quando a providência deve estar pronta. */
export function limiteProvidencia(esAtividade: number, antecedenciaDu: number): number {
  return esAtividade - antecedenciaDu;
}

/** Data (ISO) até quando providenciar. */
export function providenciarAte(
  inicio: DataISO,
  esAtividade: number,
  antecedenciaDu: number,
): DataISO {
  return addDU(inicio, Math.max(limiteProvidencia(esAtividade, antecedenciaDu), 0));
}

/**
 * Quando começar a providenciar: o prazo menos o tempo que leva (ex.: tomada de
 * preço de 5 du para contratar até o dia 10 → começar no dia 5). Sem duração,
 * é o próprio prazo.
 */
export function comecarProvidencia(
  inicio: DataISO,
  esAtividade: number,
  antecedenciaDu: number,
  duracaoDu: number,
): DataISO {
  return deslocarDU(providenciarAte(inicio, esAtividade, antecedenciaDu), -Math.max(duracaoDu, 0));
}

/** Quando precisa estar na obra: override, senão o início previsto da atividade. */
export function naObraEm(inicio: DataISO, esAtividade: number, override?: DataISO | null): DataISO {
  return override ?? addDU(inicio, esAtividade);
}

export interface ProvidenciaAtrasadaArgs {
  status: 'pendente' | 'feito';
  atividadeConcluida: boolean;
  obraIniciada: boolean;
  decorridos: number;
  esAtividade: number;
  antecedenciaDu: number;
  /**
   * Replanejada: a providência tem tarefa aberta vinculada ("Quem cuida · até").
   * O prazo da tarefa é o compromisso vigente e vale no lugar do cronograma.
   */
  replanejada?: PrazoReplanejado | null;
}

/** Prazo da tarefa aberta vinculada e o dia de referência (hoje ou a data da reunião). */
export interface PrazoReplanejado {
  prazo: DataISO;
  hoje: DataISO;
}

/**
 * Providência atrasada: pendente, atividade não concluída, obra iniciada e o dia
 * limite já passou ("providenciar até sex" ainda vale na sexta). Com tarefa aberta
 * vinculada, o limite é o prazo da tarefa (replanejar tira do atraso).
 */
export function providenciaAtrasada(a: ProvidenciaAtrasadaArgs): boolean {
  if (a.status !== 'pendente' || a.atividadeConcluida) return false;
  if (a.replanejada) return a.replanejada.hoje > a.replanejada.prazo;
  return (
    a.obraIniciada && a.decorridos > Math.max(limiteProvidencia(a.esAtividade, a.antecedenciaDu), 0)
  );
}

/**
 * Prazo vigente da providência: o da tarefa aberta vinculada, se houver; senão o
 * do cronograma. `original` só vem quando o prazo mudou (para "era dd/mm").
 */
export function prazoVigenteProvidencia(
  doCronograma: DataISO,
  prazoTarefa: DataISO | null | undefined,
): { ate: DataISO; original: DataISO | null } {
  if (!prazoTarefa || prazoTarefa === doCronograma) return { ate: doCronograma, original: null };
  return { ate: prazoTarefa, original: doCronograma };
}

/** Prazo da tarefa aberta vinculada a cada providência (id da providência → prazo). */
export function prazosTarefaPorProvidencia(
  tarefas: {
    status: string;
    vinculo_tipo?: string | null;
    vinculo_id?: string | null;
    prazo: DataISO | null;
  }[],
): Map<string, DataISO> {
  const m = new Map<string, DataISO>();
  for (const t of tarefas)
    if (t.status === 'aberta' && t.vinculo_tipo === 'providencia' && t.vinculo_id && t.prazo)
      m.set(t.vinculo_id, t.prazo);
  return m;
}

// Providências como ações: a providência pendente sem tarefa aberta vinculada
// fica "sem dono" (Tarefas da equipe, Hoje e Minhas ações).

/** Providência pendente sem tarefa aberta vinculada: aparece como ação "Sem responsável". */
export interface ProvidenciaSemDono {
  id: string;
  obraId: string;
  obraNome: string;
  tipo: TipoProvidencia;
  descricao: string;
  /** Providenciar até (data ISO). */
  prazo: string;
  atividadeNome: string;
}

/** Linha de `obra_providencia` como `listarObras` carrega. */
export interface LinhaProvidencia {
  id: string;
  obra_id: string;
  atividade_id: string;
  tipo: TipoProvidencia;
  descricao: string;
  status: 'pendente' | 'feito';
  antecedencia_du: number;
  providenciar_ate: string | null;
}

interface CronEs {
  porId: Record<string, { es: number }>;
}

/** Prazo da providência pelo cronograma (null se a atividade está fora dele). */
function prazoDe(p: LinhaProvidencia, cron: CronEs, inicio: string): string | null {
  const it = cron.porId[p.atividade_id];
  return it ? providenciarAte(inicio, it.es, p.antecedencia_du) : null;
}

/**
 * Providências da obra sem dono: pendentes, de atividade aberta e sem tarefa
 * aberta vinculada (a tarefa, quando existe, é quem a representa).
 */
export function providenciasSemDono(
  provs: LinhaProvidencia[],
  tarefasAbertas: { vinculo_tipo: string | null; vinculo_id: string | null }[],
  atividades: { id: string; nome: string; concluida_em: string | null }[],
  cron: CronEs,
  inicio: string,
  obraNome: string,
): ProvidenciaSemDono[] {
  const comTarefa = new Set(
    tarefasAbertas
      .filter((t) => t.vinculo_tipo === 'providencia' && t.vinculo_id)
      .map((t) => t.vinculo_id),
  );
  const atvPorId = new Map(atividades.map((a) => [a.id, a]));
  const out: ProvidenciaSemDono[] = [];
  for (const p of provs) {
    if (p.status !== 'pendente' || comTarefa.has(p.id)) continue;
    const atv = atvPorId.get(p.atividade_id);
    if (!atv || atv.concluida_em) continue;
    const prazo = prazoDe(p, cron, inicio);
    if (!prazo) continue;
    out.push({
      id: p.id,
      obraId: p.obra_id,
      obraNome,
      tipo: p.tipo,
      descricao: p.descricao,
      prazo,
      atividadeNome: atv.nome,
    });
  }
  return out;
}

/**
 * Prazos a gravar em `providenciar_ate` (para o aviso do gestor): pendentes cujo
 * prazo calculado difere do gravado, com ou sem tarefa (a data é da providência).
 */
export function prazosParaGravar(
  provs: LinhaProvidencia[],
  cron: CronEs,
  inicio: string,
): { id: string; ate: string }[] {
  const out: { id: string; ate: string }[] = [];
  for (const p of provs) {
    if (p.status !== 'pendente') continue;
    const ate = prazoDe(p, cron, inicio);
    if (ate && ate !== p.providenciar_ate) out.push({ id: p.id, ate });
  }
  return out;
}

/**
 * Tira as providências que já têm tarefa aberta vinculada no cache otimista de
 * tarefas (ex.: acabou de atribuir, ainda sem sync): evita mostrar as duas.
 */
export function semTarefaAberta(
  providencias: ProvidenciaSemDono[],
  tarefas: { status: string; vinculo_tipo: string | null; vinculo_id: string | null }[],
): ProvidenciaSemDono[] {
  const vinculadas = new Set(
    tarefas
      .filter((t) => t.status === 'aberta' && t.vinculo_tipo === 'providencia' && t.vinculo_id)
      .map((t) => t.vinculo_id),
  );
  return vinculadas.size ? providencias.filter((p) => !vinculadas.has(p.id)) : providencias;
}
