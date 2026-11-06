import {
  atividadeParaAcaoBase,
  nomeCurto,
  prazoPendencia,
  providenciaParaAcaoBase,
  type Acao,
  type AcoesClassificadas,
  type AtividadeSemDono,
  type EstadoAcao,
  type PrazosPendencia,
  type ProvidenciaSemDono,
} from '@contro/core';
import type { IconName } from '@contro/ui';
import { dataLocal } from './api';
import type { PendenciaObra } from './pendenciasObra';
import type { TarefaObra } from './tarefasObra';

/**
 * Ação (tarefa, pendência, providência ou atividade sem dono) com o original à
 * mão para abrir o detalhe.
 */
export type AcaoObra =
  | (Acao & { origem: 'tarefa'; tarefa: TarefaObra })
  | (Acao & { origem: 'pendencia'; pendencia: PendenciaObra })
  | (Acao & { origem: 'providencia'; providencia: ProvidenciaSemDono })
  | (Acao & { origem: 'atividade'; atividade: AtividadeSemDono });

export function tarefaParaAcao(t: TarefaObra): AcaoObra {
  return {
    origem: 'tarefa',
    id: t.id,
    obraId: t.obra_id,
    texto: t.texto,
    prazo: t.prazo,
    aberta: t.status === 'aberta',
    responsavelId: t.responsavel_id,
    responsavelNome: t.responsavelNome,
    concluidaEm: t.feita_em,
    tarefa: t,
  };
}

export function pendenciaParaAcao(p: PendenciaObra, prazos: PrazosPendencia): AcaoObra {
  const aberta = p.status === 'aberta';
  return {
    origem: 'pendencia',
    id: p.id,
    obraId: p.obra_id,
    texto: p.titulo,
    // Data local: o instante em UTC pode cair no dia seguinte à noite.
    prazo: prazoPendencia(p.criticidade, dataLocal(p.apontada_em), prazos),
    aberta,
    responsavelId: p.responsavel_id ?? null,
    // Nome curto, como nas tarefas: o chip e o card mostram o mesmo nome.
    responsavelNome: nomeCurto(p.responsavelNome) || null,
    concluidaEm: aberta ? undefined : p.resolvida_em,
    pendencia: p,
  };
}

/** Providência sem dono vira ação aberta, sem responsável ("Comprar Cabos"). */
export function providenciaParaAcao(p: ProvidenciaSemDono): AcaoObra {
  const { id, obraId, tipo, descricao, prazo } = p;
  return {
    ...providenciaParaAcaoBase({ id, obraId, tipo, descricao, prazo }),
    origem: 'providencia',
    providencia: p,
  };
}

/** Atividade sem dono vira ação aberta, sem responsável ("Atividade: Pintura"). */
export function atividadeParaAcao(a: AtividadeSemDono): AcaoObra {
  const { id, obraId, nome, prazo } = a;
  return {
    ...atividadeParaAcaoBase({ id, obraId, nome, prazo }),
    origem: 'atividade',
    atividade: a,
  };
}

/** Dias corridos que uma pendência resolvida continua em Concluídas. */
export const DIAS_PENDENCIA_CONCLUIDA = 30;

/**
 * Lista das telas de ações: pendências resolvidas só dos últimos 30 dias
 * corridos (a do Check list que acabou de ser resolvida, ainda sem data, fica).
 * Tarefas feitas continuam todas.
 */
export function acoesVisiveis(acoes: AcaoObra[], hoje: string): AcaoObra[] {
  const d = new Date(`${hoje}T12:00:00`);
  d.setDate(d.getDate() - DIAS_PENDENCIA_CONCLUIDA);
  const limite = dataLocal(d);
  return acoes.filter(
    (a) =>
      a.origem === 'tarefa' || a.aberta || !a.concluidaEm || dataLocal(a.concluidaEm) >= limite,
  );
}

export interface SecaoAcoes {
  estado: EstadoAcao;
  titulo: string;
  icone: IconName;
  itens: AcaoObra[];
}

/** As quatro seções na ordem fixa; some a seção vazia. */
export function secoesAcoes(c: AcoesClassificadas<AcaoObra>): SecaoAcoes[] {
  const todas: SecaoAcoes[] = [
    { estado: 'atrasada', titulo: 'Atrasadas', icone: 'alert', itens: c.atrasadas },
    { estado: 'hoje', titulo: 'Vencem hoje', icone: 'atencao', itens: c.hoje },
    { estado: 'proxima', titulo: 'Próximos 5 dias', icone: 'calendario', itens: c.proximas },
    { estado: 'concluida', titulo: 'Concluídas', icone: 'checkCirculo', itens: c.concluidas },
  ];
  return todas.filter((s) => s.itens.length);
}

/** Janela do "Desfazer" da conclusão para reabrir as tarefas que ela fechou. */
export const JANELA_DESFAZER_MS = 5 * 60 * 1000;

/**
 * Tarefas vinculadas à atividade que a conclusão dela fechou: feitas dentro da
 * janela do Desfazer (concluir a atividade fecha as tarefas abertas vinculadas).
 */
export function tarefasFechadasPelaAtividade(
  tarefas: Pick<TarefaObra, 'id' | 'vinculo_tipo' | 'vinculo_id' | 'status' | 'feita_em'>[],
  atividadeId: string,
  agora: number,
  janelaMs: number = JANELA_DESFAZER_MS,
): string[] {
  return tarefas
    .filter(
      (t) =>
        t.vinculo_tipo === 'atividade' &&
        t.vinculo_id === atividadeId &&
        t.status === 'feita' &&
        t.feita_em !== null &&
        agora - new Date(t.feita_em).getTime() <= janelaMs,
    )
    .map((t) => t.id);
}
