import type {
  AtividadeGeral,
  BoletimDados,
  DataISO,
  PrazosPendencia,
  ProvidenciaAcaoGeral,
} from '@contro/core';
import { acoesCompletasObraGeral, montarBoletimGeral } from '@contro/core';
import { quemFazOQueBoletim } from '../../obras/boletimAcoes';
import type { PendenciaObra } from '../../obras/pendenciasObra';
import type { TarefaObra } from '../../obras/tarefasObra';

/**
 * Boletim da obra geral: o core calcula a semana pelas datas das atividades; o "quem faz o
 * quê" usa as mesmas ações das Ações da equipe (`acoesCompletasObraGeral`): tarefas e
 * pendências abertas e, como na obra geral a atividade de topo aberta com responsável é ação
 * dessa pessoa, também ela e as providências dela (a atividade com tarefa vinculada aberta
 * conta uma vez, pela tarefa). Atividade e providência sem responsável ficam fora.
 */
export function boletimDaObraGeral(e: {
  obra: { id?: string; nome: string; cidade: string | null };
  atividades: AtividadeGeral[];
  nomes: Record<string, string>;
  tarefas: TarefaObra[];
  pendencias: PendenciaObra[];
  providencias?: (Omit<ProvidenciaAcaoGeral, 'providenciar_ate'> & {
    providenciar_ate?: string | null;
  })[];
  prazosPendencia?: PrazosPendencia;
  hoje: DataISO;
}): BoletimDados {
  const acoes = acoesCompletasObraGeral({
    obraId: e.obra.id ?? '',
    atividades: e.atividades,
    tarefas: e.tarefas,
    pendencias: e.pendencias,
    providencias: (e.providencias ?? []).map((p) => ({
      ...p,
      providenciar_ate: p.providenciar_ate ?? null,
    })),
    nomes: e.nomes,
    prazosPendencia: e.prazosPendencia,
  })
    .filter((a) => (a.origem !== 'atividade' && a.origem !== 'providencia') || a.responsavelId)
    // O quem faz o quê da Contorno deixa atividade e providência de fora (lá não têm dono):
    // aqui elas entram como ação da pessoa.
    .map((a) => ({ ...a, origem: 'tarefa' as const }));
  return montarBoletimGeral({
    obra: e.obra,
    atividades: e.atividades,
    nomes: e.nomes,
    hoje: e.hoje,
    quemFazOQue: quemFazOQueBoletim(acoes, e.hoje),
  });
}
