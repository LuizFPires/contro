import { providenciarAte, type TipoProvidencia } from '@contro/core';

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
