// Plano de recuperação (opção A): quando um atraso empurra a inauguração, propõe
// paralelismo ou redução de prazo nas próximas atividades críticas para voltar
// à data original. Só simula; quem grava é o RPC aplicar_plano_recuperacao.
import { addDU, duEntre, type DataISO } from './calendar';
import { calcularCronograma, type AtividadeEntrada, type Cronograma } from './schedule';

export interface EntradaRecuperacao {
  inicio: DataISO;
  hoje: DataISO;
  atividades: AtividadeEntrada[];
  /** Atividades de topo já concluídas. */
  concluidas: Set<string>;
  nomes: Record<string, string>;
  /** Inauguração planejada (fixada na obra); sem ela, vale a do cronograma atual. */
  entregaOriginal: DataISO | null;
}

export interface Previsao {
  cronograma: Cronograma;
  entregaOriginal: DataISO;
  entregaPrevista: DataISO;
  /** Dias úteis além da data original (0 = no prazo). */
  atrasoDu: number;
}

export type TipoSugestao = 'paralelismo' | 'reducao';

export interface Sugestao {
  chave: string;
  tipo: TipoSugestao;
  atividadeId: string;
  /** Paralelismo: a predecessora com quem passa a se sobrepor. */
  predecessoraId: string | null;
  titulo: string;
  detalhe: string;
  /** O que precisa acontecer (vira providência ao aplicar). */
  precisa: string;
  risco: 'baixo' | 'médio';
  /** Dias úteis que recupera sozinha. */
  ganhoDu: number;
  /** Nova duração (redução) ou nova defasagem (paralelismo, ≤ 0). */
  duracaoDu: number | null;
  defasagemDu: number | null;
}

export interface PlanoRecuperacao {
  previsao: Previsao;
  sugestoes: Sugestao[];
  /** Chaves pré-selecionadas: o mínimo que volta à data original (ou o máximo possível). */
  recomendadas: string[];
}

const temSubitens = (atvs: AtividadeEntrada[], id: string) => atvs.some((x) => x.pai_id === id);

/**
 * Cronograma "realista": atividade aberta que já devia ter terminado passa a
 * terminar hoje, e empurra as que dependem dela.
 */
export function previsaoEntrega(e: EntradaRecuperacao): Previsao {
  const decorridos = duEntre(e.inicio, e.hoje);
  const plano = calcularCronograma({ inicio: e.inicio, atividades: e.atividades });
  // O que ainda não começou não pode começar antes de hoje (nem com paralelismo).
  const hojeDU = addDU(e.inicio, decorridos);
  let atvs = e.atividades.map((a) => {
    const it = plano.porId[a.id];
    if (!it || a.pai_id || e.concluidas.has(a.id)) return a;
    // Já em andamento só se o plano a fazia começar antes de hoje E nada antes dela está aberto.
    const predAberta = (a.predecessoras ?? []).some((p) => !e.concluidas.has(p));
    if (it.es < decorridos && !predAberta) return a;
    if (a.inicio_manual && a.inicio_manual >= hojeDU) return a;
    return { ...a, inicio_manual: hojeDU };
  });
  let cron = plano;
  for (let i = 0; i < 10; i++) {
    let mudou = false;
    atvs = atvs.map((a) => {
      const it = cron.porId[a.id];
      if (!it || a.pai_id || e.concluidas.has(a.id) || it.ef > decorridos) return a;
      if (temSubitens(atvs, a.id)) return a;
      mudou = true;
      return { ...a, duracao_du: decorridos + 1 - it.es };
    });
    if (!mudou) break;
    cron = calcularCronograma({ inicio: e.inicio, atividades: atvs });
  }
  const entregaOriginal = e.entregaOriginal ?? plano.entrega;
  const prevista = cron.entrega;
  return {
    cronograma: cron,
    entregaOriginal,
    entregaPrevista: prevista,
    atrasoDu: prevista > entregaOriginal ? duEntre(entregaOriginal, prevista) : 0,
  };
}

/** Aplica sugestões às atividades (sem gravar nada). */
export function aplicarSugestoes(
  atvs: AtividadeEntrada[],
  sugestoes: Sugestao[],
): AtividadeEntrada[] {
  return atvs.map((a) => {
    let b = a;
    for (const s of sugestoes) {
      if (s.atividadeId !== a.id) continue;
      if (s.tipo === 'reducao' && s.duracaoDu !== null) b = { ...b, duracao_du: s.duracaoDu };
      if (s.tipo === 'paralelismo' && s.predecessoraId && s.defasagemDu !== null)
        b = { ...b, defasagens: { ...b.defasagens, [s.predecessoraId]: s.defasagemDu } };
    }
    return b;
  });
}

/** Previsão com um conjunto de sugestões aplicado. */
export function simularPlano(e: EntradaRecuperacao, sugestoes: Sugestao[]): Previsao {
  const base = previsaoEntrega(e);
  const p = previsaoEntrega({
    ...e,
    atividades: aplicarSugestoes(e.atividades, sugestoes),
    entregaOriginal: base.entregaOriginal,
  });
  return p;
}

/** Candidatas nas próximas atividades críticas (ainda não começadas). */
function candidatas(e: EntradaRecuperacao, prev: Previsao): Omit<Sugestao, 'ganhoDu'>[] {
  const decorridos = duEntre(e.inicio, e.hoje);
  const cron = prev.cronograma;
  const porId = new Map(e.atividades.map((a) => [a.id, a]));
  const nome = (id: string) => e.nomes[id] ?? '';
  const out: Omit<Sugestao, 'ganhoDu'>[] = [];
  for (const it of cron.itens) {
    const a = porId.get(it.id);
    if (!a || !it.critico || e.concluidas.has(a.id) || it.es <= decorridos) continue;
    // Redução de prazo: ~20% (mín. 1 dia), só em atividade sem subitens e com 3+ dias.
    if (!temSubitens(e.atividades, a.id) && a.duracao_du >= 3) {
      const r = Math.max(1, Math.floor(a.duracao_du * 0.2));
      out.push({
        chave: `reducao-${a.id}`,
        tipo: 'reducao',
        atividadeId: a.id,
        predecessoraId: null,
        titulo: `${nome(a.id)} de ${a.duracao_du} para ${a.duracao_du - r} dias úteis`,
        detalhe: 'Reforçando a equipe nessa atividade.',
        precisa: `Reforçar a equipe de ${nome(a.id)}`,
        risco: r === 1 && a.duracao_du >= 5 ? 'baixo' : 'médio',
        duracaoDu: a.duracao_du - r,
        defasagemDu: null,
      });
    }
    // Paralelismo: começar antes do fim de uma predecessora crítica.
    for (const p of a.predecessoras ?? []) {
      const ip = cron.porId[p];
      if (!ip || !ip.critico || e.concluidas.has(p) || (a.defasagens?.[p] ?? 0) < 0) continue;
      const k = Math.min(2, ip.dur - 1, it.dur - 1);
      if (k < 1) continue;
      out.push({
        chave: `paralelismo-${p}-${a.id}`,
        tipo: 'paralelismo',
        atividadeId: a.id,
        predecessoraId: p,
        titulo: `${nome(a.id)} começa ${k} ${k === 1 ? 'dia' : 'dias'} antes do fim de ${nome(p)}`,
        detalhe: `As duas em paralelo nos ambientes já liberados.`,
        precisa: `Mobilizar ${nome(a.id)} mais cedo, junto com ${nome(p)}`,
        risco: 'médio',
        duracaoDu: null,
        defasagemDu: -k,
      });
    }
  }
  return out;
}

export function planoRecuperacao(e: EntradaRecuperacao): PlanoRecuperacao {
  const previsao = previsaoEntrega(e);
  if (previsao.atrasoDu === 0) return { previsao, sugestoes: [], recomendadas: [] };
  const total = previsao.cronograma.total;
  const sugestoes: Sugestao[] = candidatas(e, previsao)
    .map((c) => {
      const p = simularPlano(e, [{ ...c, ganhoDu: 0 }]);
      return { ...c, ganhoDu: total - p.cronograma.total };
    })
    .filter((s) => s.ganhoDu > 0);

  // Escolha gulosa: a que mais recupera (menor risco no empate) até voltar à data.
  const escolhidas: Sugestao[] = [];
  let restantes = [...sugestoes];
  let atraso = previsao.atrasoDu;
  while (atraso > 0 && restantes.length) {
    let melhor: { s: Sugestao; atraso: number } | null = null;
    for (const s of restantes) {
      const a = simularPlano(e, [...escolhidas, s]).atrasoDu;
      const melhora = !melhor || a < melhor.atraso || (a === melhor.atraso && s.risco === 'baixo');
      if (a < atraso && melhora) melhor = { s, atraso: a };
    }
    if (!melhor) break;
    escolhidas.push(melhor.s);
    atraso = melhor.atraso;
    // Uma mudança por atividade: tira as outras da mesma atividade.
    restantes = restantes.filter((s) => s.atividadeId !== melhor!.s.atividadeId);
  }

  const rec = new Set(escolhidas.map((s) => s.chave));
  sugestoes.sort(
    (x, y) => Number(rec.has(y.chave)) - Number(rec.has(x.chave)) || y.ganhoDu - x.ganhoDu,
  );
  return { previsao, sugestoes, recomendadas: [...rec] };
}

/**
 * Providências do plano: uma por sugestão aplicada, com prazo 2 dias úteis antes
 * do novo início da atividade (nunca antes de hoje).
 */
export function tarefasDoPlano(
  e: EntradaRecuperacao,
  sugestoes: Sugestao[],
): { texto: string; atividadeId: string; prazo: DataISO }[] {
  const cron = simularPlano(e, sugestoes).cronograma;
  const decorridos = duEntre(e.inicio, e.hoje);
  return sugestoes.map((s) => {
    const es = cron.porId[s.atividadeId]?.es ?? decorridos;
    return {
      texto: s.precisa,
      atividadeId: s.atividadeId,
      prazo: addDU(e.inicio, Math.max(es - 2, decorridos)),
    };
  });
}
