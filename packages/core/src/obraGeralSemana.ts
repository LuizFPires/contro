import type { BoletimDados } from './boletim';
import { deslocarDU, type DataISO } from './calendar';
import { atrasoDU, diaLocal } from './datas';
import {
  diaCurto,
  eficienciaObraGeral,
  filhosPorPai,
  prazoAtividadeGeral,
  prazoOriginalAtividadeGeral,
  textoEficiencia,
  type AtividadeGeral,
} from './obraGeral';

// Semana, boletim e providência da obra geral: tudo por datas digitadas, sem cronograma.

function somaDias(iso: DataISO, n: number): DataISO {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Segunda e sexta da semana da data (sábado e domingo contam na semana que termina). */
function segundaESexta(dia: DataISO): { segunda: DataISO; sexta: DataISO } {
  const [y, m, d] = dia.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const segunda = somaDias(dia, -((dow + 6) % 7));
  return { segunda, sexta: somaDias(segunda, 4) };
}

export interface SemanaReuniaoGeral {
  passadaNoPrazo: AtividadeGeral[];
  passadaComAtraso: AtividadeGeral[];
  atrasadasAbertas: AtividadeGeral[];
  daSemana: AtividadeGeral[];
}

/**
 * Pauta por datas: semana passada (prazo na semana anterior à da reunião) e
 * esta semana (prazo de segunda a sexta da reunião). Só atividades de topo.
 */
export function semanaDaReuniaoGeral(e: {
  atividades: AtividadeGeral[];
  dataReuniao: DataISO;
  hoje: DataISO;
}): SemanaReuniaoGeral {
  const { segunda, sexta } = segundaESexta(e.dataReuniao);
  const passadaSeg = somaDias(segunda, -7);
  const passadaSex = somaDias(sexta, -7);
  const filhos = filhosPorPai(e.atividades);
  const r: SemanaReuniaoGeral = {
    passadaNoPrazo: [],
    passadaComAtraso: [],
    atrasadasAbertas: [],
    daSemana: [],
  };
  const prazos = new Map<string, DataISO>();

  for (const a of e.atividades) {
    if (a.pai_id !== null) continue;
    const subs = filhos.get(a.id) ?? [];
    const prazo = prazoAtividadeGeral(a, subs);
    if (!prazo) continue;
    prazos.set(a.id, prazo);
    if (prazo >= segunda && prazo <= sexta) r.daSemana.push(a);
    if (a.concluida_em === null) {
      // Toda aberta atrasada de antes da semana da reunião entra na cobrança.
      if (prazo < segunda && atrasoDU(prazo, e.hoje) > 0) r.atrasadasAbertas.push(a);
      continue;
    }
    if (prazo < passadaSeg || prazo > passadaSex) continue;
    const original = prazoOriginalAtividadeGeral(a, subs) ?? prazo;
    const noPrazo = atrasoDU(original, diaLocal(a.concluida_em)) === 0;
    (noPrazo ? r.passadaNoPrazo : r.passadaComAtraso).push(a);
  }
  const porPrazo = (a: AtividadeGeral, b: AtividadeGeral) =>
    (prazos.get(a.id) ?? '').localeCompare(prazos.get(b.id) ?? '') || a.ordem - b.ordem;
  r.passadaNoPrazo.sort(porPrazo);
  r.passadaComAtraso.sort(porPrazo);
  r.atrasadasAbertas.sort(porPrazo);
  r.daSemana.sort(porPrazo);
  return r;
}

/** Boletim da semana de `hoje` no mesmo formato da Contorno (alimenta texto e PDF). */
export function montarBoletimGeral(e: {
  obra: { nome: string; cidade: string | null };
  atividades: AtividadeGeral[];
  nomes: Record<string, string>;
  hoje: DataISO;
  quemFazOQue: BoletimDados['quemFazOQue'];
}): BoletimDados {
  const { segunda, sexta } = segundaESexta(e.hoje);
  const filhos = filhosPorPai(e.atividades);
  const topo = e.atividades.filter((a) => a.pai_id === null);
  const prazoDe = (a: AtividadeGeral) => prazoAtividadeGeral(a, filhos.get(a.id) ?? []);
  const concluidas = topo.filter((a) => a.concluida_em !== null).length;
  const ateSexta = topo.filter((a) => {
    const p = prazoDe(a);
    return p !== null && p <= sexta;
  }).length;

  const atrasos: string[] = [];
  const concluir: BoletimDados['concluir'] = [];
  for (const a of topo) {
    const prazo = prazoDe(a);
    if (a.concluida_em !== null || !prazo) continue;
    if (atrasoDU(prazo, e.hoje) > 0) {
      atrasos.push(`${a.nome} · era para ${diaCurto(prazo)}`);
    }
    if (prazo >= segunda && prazo <= sexta) {
      concluir.push({ dataFmt: diaCurto(prazo), nome: a.nome, data: prazo });
    }
  }
  concluir.sort((x, y) => (x.data ?? '').localeCompare(y.data ?? ''));

  return {
    obra: e.obra.cidade ? `${e.obra.nome} · ${e.obra.cidade}` : e.obra.nome,
    semanaFmt: `${diaCurto(segunda)} a ${diaCurto(sexta)}`,
    realPct: topo.length === 0 ? 0 : concluidas / topo.length,
    previstoSextaPct: topo.length === 0 ? 0 : ateSexta / topo.length,
    ritmoTexto: textoEficiencia(eficienciaObraGeral(e.atividades, e.hoje)) ?? '',
    ritmoAtrasado: false,
    atrasos,
    concluir,
    comecar: [],
    quemFazOQue: e.quemFazOQue,
  };
}

/** Prazo da providência: a data prevista menos a antecedência em dias úteis (0 = a própria data). */
export function providenciarAteGeral(dataPrevista: DataISO, antecedenciaDu: number): DataISO {
  return deslocarDU(dataPrevista, -Math.max(0, antecedenciaDu));
}

/**
 * Situação do lembrete na obra geral: data limite (data prevista da atividade menos a
 * antecedência), atrasado (pendente, atividade aberta e limite já passou) e vence hoje.
 * Atividade sem data não tem limite nem atraso.
 */
export function situacaoProvidenciaGeral(e: {
  status: 'pendente' | 'feito';
  atividadeConcluida: boolean;
  prazoAtividade: DataISO | null;
  antecedenciaDu: number;
  hoje: DataISO;
}): { ate: DataISO | null; atrasada: boolean; venceHoje: boolean } {
  const ate = e.prazoAtividade ? providenciarAteGeral(e.prazoAtividade, e.antecedenciaDu) : null;
  const aberta = e.status === 'pendente' && !e.atividadeConcluida && ate !== null;
  return { ate, atrasada: aberta && ate! < e.hoje, venceHoje: aberta && ate === e.hoje };
}

/**
 * Cobrança da reunião da obra geral (decisão 2): toda tarefa aberta da obra, venha ou não
 * de uma reunião, menos as criadas nesta; as feitas desde a reunião anterior (7 dias antes)
 * continuam na pauta para a resposta. As feitas antes disso já foram cobradas.
 */
export function entraNaCobrancaGeral(
  t: { origem: string | null; concluido: boolean; feitaEm: string | null },
  origemAtual: string,
  dataReuniao: DataISO,
): boolean {
  if (t.origem === origemAtual) return false;
  if (!t.concluido) return true;
  if (!t.feitaEm) return false;
  // Feita no dia da reunião anterior já foi cobrada lá.
  return t.feitaEm.slice(0, 10) > somaDias(dataReuniao, -7);
}
