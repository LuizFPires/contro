// Carga do Log e do Score das obras gerais (sem cronograma): obras gerais ativas
// e concluídas com algo na janela, todas as atividades não excluídas delas (topo
// e subitens: a data dos subitens forma o prazo do topo), tarefas, pendências
// (prazo pela config de cada obra, como no resumo das obras gerais), eventos e
// os nomes das pessoas (participantes e Administradores). A RLS limita às obras
// em que a pessoa participa (Administrador: todas). Duas rodadas e, só se alguma
// obra não tiver config própria, a leitura da global. Sem N+1.
import {
  obrasDoAmbiente,
  PRAZOS_PENDENCIA_PADRAO,
  type Ambiente,
  type DataISO,
  type PrazosPendencia,
} from '@contro/core';
import { lerEventosLog, lerPendenciasLog, lerTarefasLog, type Sb } from './consultasLog';
import type { DadosLogScore, LinhaAtividadeGeralLog, ObraLog } from './itensLog';
import { obrasNaJanela } from './itensLog';
import { todasAsPaginas } from './paginas';

interface PrazosLinha {
  obra_id?: string;
  pend_alta_du: number;
  pend_media_du: number;
  pend_baixa_du: number;
}

const prazosDaLinha = (l: PrazosLinha): PrazosPendencia => ({
  alta: l.pend_alta_du,
  media: l.pend_media_du,
  baixa: l.pend_baixa_du,
});

const ATIVIDADE_GERAL =
  'id,obra_id,fase_id,pai_id,ordem,nome,data_prevista,data_prevista_original,replanejamentos,' +
  'responsavel_id,concluida_em,avanco_pct,foto_conclusao_id,prestador';

export function dadosLogGeralVazios(): DadosLogScore {
  return {
    obras: [],
    atividades: [],
    tarefas: [],
    pendencias: [],
    fimPrevisto: {},
    prazos: PRAZOS_PENDENCIA_PADRAO,
    eventosTarefa: [],
    eventosPendencia: [],
    eventosAtividade: [],
    geral: { atividades: [], prazosPorObra: {}, nomes: {} },
  };
}

export async function loadDadosLogGeral(sb: Sb, desde: DataISO): Promise<DadosLogScore> {
  // 1ª rodada: as obras gerais (o resto é filtrado pelos ids delas).
  type LinhaObra = ObraLog & { inicio: string; ambiente: Ambiente };
  const lidas = await todasAsPaginas<LinhaObra>((de, ate) =>
    sb
      .from('obra')
      .select('id,nome,inicio,status,ambiente')
      .in('status', ['ativa', 'concluida'])
      .eq('ambiente', 'geral')
      .is('deleted_at', null)
      .order('id')
      .range(de, ate)
      .returns<LinhaObra[]>(),
  );
  const todas = obrasDoAmbiente(lidas, 'geral');
  if (todas.length === 0) return dadosLogGeralVazios();
  const ids = todas.map((o) => o.id);

  // 2ª rodada: tudo o mais em paralelo.
  const [atividades, tarefas, pendencias, [evT, evP, evA], participantes, admins, cfgObra] =
    await Promise.all([
      todasAsPaginas<LinhaAtividadeGeralLog>((de, ate) =>
        sb
          .from('obra_atividade')
          .select(ATIVIDADE_GERAL)
          .in('obra_id', ids)
          .is('deleted_at', null)
          .order('id')
          .range(de, ate)
          .returns<LinhaAtividadeGeralLog[]>(),
      ),
      lerTarefasLog(sb, ids, desde),
      lerPendenciasLog(sb, ids, desde),
      lerEventosLog(sb, desde),
      todasAsPaginas<{ obra_id: string; pessoa: { id: string; nome: string } | null }>((de, ate) =>
        sb
          .from('obra_participante')
          .select('obra_id,pessoa(id,nome)')
          .in('obra_id', ids)
          .order('obra_id')
          .order('pessoa_id')
          .range(de, ate)
          .returns<{ obra_id: string; pessoa: { id: string; nome: string } | null }[]>(),
      ),
      todasAsPaginas<{ id: string; nome: string }>((de, ate) =>
        sb
          .from('pessoa')
          .select('id,nome')
          .eq('administrador', true)
          .order('id')
          .range(de, ate)
          .returns<{ id: string; nome: string }[]>(),
      ),
      todasAsPaginas<PrazosLinha>((de, ate) =>
        sb
          .from('config_avisos_obra')
          .select('obra_id,pend_alta_du,pend_media_du,pend_baixa_du')
          .in('obra_id', ids)
          .order('obra_id')
          .range(de, ate)
          .returns<PrazosLinha[]>(),
      ),
    ]);

  // Concluídas sem nenhum item na janela ficam fora.
  const naJanela = atividades.filter((a) => a.concluida_em === null || a.concluida_em >= desde);
  const obras = obrasNaJanela(todas, [...tarefas, ...pendencias, ...naJanela]);
  const naCarga = new Set(obras.map((o) => o.id));

  // Prazos de pendência: a config da obra; sem ela, a global (uma leitura só).
  const proprios = new Map<string, PrazosPendencia>();
  for (const l of cfgObra) if (l.obra_id) proprios.set(l.obra_id, prazosDaLinha(l));
  let globais = PRAZOS_PENDENCIA_PADRAO;
  const semLinha = obras.find((o) => !proprios.has(o.id));
  if (semLinha) {
    const { data, error } = await sb.rpc('config_avisos_da_obra', { p_obra_id: semLinha.id });
    if (error) throw error;
    if (data) globais = prazosDaLinha(data as PrazosLinha);
  }
  const prazosPorObra: Record<string, PrazosPendencia> = {};
  for (const o of obras) prazosPorObra[o.id] = proprios.get(o.id) ?? globais;

  const nomes: Record<string, string> = {};
  for (const a of admins) nomes[a.id] = a.nome;
  for (const { pessoa: p } of participantes) if (p) nomes[p.id] = p.nome;

  return {
    obras: obras.map((o) => ({ id: o.id, nome: o.nome, status: o.status, inicio: o.inicio })),
    atividades: [],
    tarefas: tarefas.filter((t) => naCarga.has(t.obra_id)),
    pendencias: pendencias.filter((p) => naCarga.has(p.obra_id)),
    fimPrevisto: {},
    prazos: globais,
    eventosTarefa: evT,
    eventosPendencia: evP,
    eventosAtividade: evA,
    geral: {
      atividades: atividades.filter((a) => naCarga.has(a.obra_id)),
      prazosPorObra,
      nomes,
    },
  };
}
