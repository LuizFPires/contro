// Ações do dia: tarefas e itens do check list (pendências) viram "ação" com
// prazo. Aqui ficam o prazo da pendência, a classificação por dia e os textos
// do aviso por push. Dias úteis de segunda a sexta, sem feriados.
import { addDU, diaUtilAPartir, type DataISO } from './calendar';
import type { Criticidade } from './pendencias';
import { nomeCurto } from './nomes';

export type OrigemAcao = 'tarefa' | 'pendencia';
export type EstadoAcao = 'atrasada' | 'hoje' | 'proxima' | 'concluida';

export interface Acao {
  origem: OrigemAcao;
  id: string;
  obraId: string;
  texto: string;
  prazo: DataISO;
  aberta: boolean;
  responsavelId: string | null;
  /** Nome digitado (tarefa sem pessoa do app) ou nome da pessoa. */
  responsavelNome: string | null;
  concluidaEm?: string | null; // ISO timestamp
}

/** Dias úteis para resolver a pendência, por criticidade. */
export interface PrazosPendencia {
  alta: number;
  media: number;
  baixa: number;
}

export const PRAZOS_PENDENCIA_PADRAO: PrazosPendencia = { alta: 2, media: 4, baixa: 6 };

/**
 * Prazo da pendência: dias úteis da criticidade contados a partir do dia em
 * que foi apontada (apontada em fim de semana conta a partir da segunda).
 */
export function prazoPendencia(
  criticidade: Criticidade,
  apontadaEm: DataISO,
  cfg: PrazosPendencia = PRAZOS_PENDENCIA_PADRAO,
): DataISO {
  return addDU(diaUtilAPartir(apontadaEm), cfg[criticidade]);
}

/** Datas ISO comparam lexicograficamente. */
export function estadoAcao(a: Pick<Acao, 'aberta' | 'prazo'>, hoje: DataISO): EstadoAcao {
  if (!a.aberta) return 'concluida';
  if (a.prazo < hoje) return 'atrasada';
  if (a.prazo === hoje) return 'hoje';
  return 'proxima';
}

export interface AcoesClassificadas<T extends Acao> {
  atrasadas: T[]; // por prazo
  hoje: T[];
  proximas: T[]; // por prazo
  concluidas: T[]; // da mais recente
}

export function classificarAcoes<T extends Acao>(acoes: T[], hoje: DataISO): AcoesClassificadas<T> {
  const r: AcoesClassificadas<T> = { atrasadas: [], hoje: [], proximas: [], concluidas: [] };
  for (const a of acoes) {
    const e = estadoAcao(a, hoje);
    if (e === 'atrasada') r.atrasadas.push(a);
    else if (e === 'hoje') r.hoje.push(a);
    else if (e === 'proxima') r.proximas.push(a);
    else r.concluidas.push(a);
  }
  const porPrazo = (a: T, b: T) => a.prazo.localeCompare(b.prazo);
  r.atrasadas.sort(porPrazo);
  r.hoje.sort(porPrazo);
  r.proximas.sort(porPrazo);
  r.concluidas.sort((a, b) => (b.concluidaEm ?? '').localeCompare(a.concluidaEm ?? ''));
  return r;
}

export interface ResumoAcoes {
  atrasadas: number;
  hoje: number;
}

/** Conta só ações abertas. */
export function resumoAcoesDia(
  acoes: Pick<Acao, 'aberta' | 'prazo'>[],
  hoje: DataISO,
): ResumoAcoes {
  let atrasadas = 0;
  let venceHoje = 0;
  for (const a of acoes) {
    const e = estadoAcao(a, hoje);
    if (e === 'atrasada') atrasadas += 1;
    else if (e === 'hoje') venceHoje += 1;
  }
  return { atrasadas, hoje: venceHoje };
}

export interface LinhaEquipe extends ResumoAcoes {
  /** responsavelId | `nome:${nome}` | 'sem' */
  chave: string;
  nome: string;
}

export interface ResumoEquipe extends ResumoAcoes {
  /** Por pessoa; "Sem responsável" sempre por último. */
  pessoas: LinhaEquipe[];
}

const CHAVE_SEM = 'sem';

export function resumoEquipeDia(acoes: Acao[], hoje: DataISO): ResumoEquipe {
  const linhas = new Map<string, LinhaEquipe>();
  let atrasadas = 0;
  let venceHoje = 0;
  for (const a of acoes) {
    const e = estadoAcao(a, hoje);
    if (e !== 'atrasada' && e !== 'hoje') continue;
    const chave = a.responsavelId ?? (a.responsavelNome ? `nome:${a.responsavelNome}` : CHAVE_SEM);
    let l = linhas.get(chave);
    if (!l) {
      l = {
        chave,
        nome: chave === CHAVE_SEM ? 'Sem responsável' : (a.responsavelNome ?? ''),
        atrasadas: 0,
        hoje: 0,
      };
      linhas.set(chave, l);
    }
    if (e === 'atrasada') {
      l.atrasadas += 1;
      atrasadas += 1;
    } else {
      l.hoje += 1;
      venceHoje += 1;
    }
  }
  const todas = [...linhas.values()];
  const pessoas = todas
    .filter((l) => l.chave !== CHAVE_SEM)
    .sort((a, b) => b.atrasadas - a.atrasadas || b.hoje - a.hoje || a.nome.localeCompare(b.nome));
  const sem = todas.find((l) => l.chave === CHAVE_SEM);
  if (sem) pessoas.push(sem);
  return { atrasadas, hoje: venceHoje, pessoas };
}

function rotuloAtrasadas(n: number): string {
  return n === 1 ? '1 atrasada' : `${n} atrasadas`;
}

function rotuloHoje(n: number): string {
  return n === 1 ? '1 vence hoje' : `${n} vencem hoje`;
}

/** "3 atrasadas e 4 vencem hoje"; omite a parte zerada. */
function totais(r: ResumoAcoes): string {
  const partes: string[] = [];
  if (r.atrasadas > 0) partes.push(rotuloAtrasadas(r.atrasadas));
  if (r.hoje > 0) partes.push(rotuloHoje(r.hoje));
  return partes.join(' e ');
}

export function textoAvisoAcoes(r: ResumoAcoes): { titulo: string; corpo: string } | null {
  if (r.atrasadas === 0 && r.hoje === 0) return null;
  return {
    titulo: 'CONTRO · Ações de hoje',
    corpo: `${totais(r)}. Toque para ver a lista.`,
  };
}

const LIMITE_CORPO_EQUIPE = 120;
const VAGAS_EQUIPE = 3;

export function textoAvisoEquipe(r: ResumoEquipe): { titulo: string; corpo: string } | null {
  if (r.atrasadas === 0 && r.hoje === 0) return null;
  const titulo = 'CONTRO · Equipe hoje';
  const tot = totais(r);
  const pessoas = r.pessoas.filter((p) => p.chave !== CHAVE_SEM);

  // Tira a última pessoa listada até caber; nunca fatia nome.
  for (let n = Math.min(VAGAS_EQUIPE, pessoas.length); n > 0; n--) {
    const lista = pessoas
      .slice(0, n)
      .map((p) => `${nomeCurto(p.nome)} ${p.atrasadas}+${p.hoje}`)
      .join(', ');
    const resto = pessoas.length - n;
    const corpo = `${tot} · ${lista}${resto > 0 ? ` e mais ${resto}` : ''}.`;
    if (corpo.length <= LIMITE_CORPO_EQUIPE) return { titulo, corpo };
  }

  const so = `${tot}.`;
  const corpo = so.length <= LIMITE_CORPO_EQUIPE ? so : `${so.slice(0, LIMITE_CORPO_EQUIPE - 1)}…`;
  return { titulo, corpo };
}

/** "1 atrasada · 7 vencem hoje · 43 próximas · 2 concluídas". */
export function textoResumoSecoes(c: {
  atrasadas: number;
  hoje: number;
  proximas: number;
  concluidas: number;
}): string {
  return [
    rotuloAtrasadas(c.atrasadas),
    rotuloHoje(c.hoje),
    c.proximas === 1 ? '1 próxima' : `${c.proximas} próximas`,
    c.concluidas === 1 ? '1 concluída' : `${c.concluidas} concluídas`,
  ].join(' · ');
}
