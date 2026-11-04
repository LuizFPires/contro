import { prazoPendencia, type Acao, type PrazosPendencia } from '@contro/core';
import { dataLocal } from './api';
import type { PendenciaObra } from './pendenciasObra';
import type { TarefaObra } from './tarefasObra';

/** Ação (tarefa ou pendência) com o original à mão para abrir o detalhe. */
export type AcaoObra =
  | (Acao & { origem: 'tarefa'; tarefa: TarefaObra })
  | (Acao & { origem: 'pendencia'; pendencia: PendenciaObra });

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
    responsavelNome: p.responsavelNome ?? null,
    concluidaEm: aberta ? undefined : p.resolvida_em,
    pendencia: p,
  };
}
