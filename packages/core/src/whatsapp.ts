// Mensagens de WhatsApp legíveis (decisão do usuário, 31/10/2026, opção A): obra
// em destaque, seções com ícone, um item por linha ("- ", que o WhatsApp mostra
// como lista) e a bolinha da temperatura do prazo. Exceção aprovada à regra
// "sem emoji": vale SÓ para o texto do WhatsApp; o app e os PDFs seguem sem.
import type { DataISO } from './calendar';

export type Temperatura = 'feito' | 'atrasado' | 'alerta' | 'em_dia' | 'sem_resposta';

export const BOLINHA: Record<Temperatura, string> = {
  feito: '🟢',
  atrasado: '🔴',
  alerta: '🟡',
  em_dia: '🔵',
  sem_resposta: '⚪',
};

/** Janela do amarelo: vence ou começa em até 7 dias (corridos) a partir de hoje. */
export const DIAS_ALERTA = 7;

function somarDias(data: DataISO, dias: number): DataISO {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Temperatura do prazo: feito (verde), atrasado (vermelho: marcado ou data já
 * passou), alerta (amarelo: até 7 dias) ou em dia (azul). Sem data e sem
 * atraso, em dia.
 */
export function temperaturaPrazo(
  p: { feito?: boolean; atraso?: boolean; data?: DataISO | null; semResposta?: boolean },
  hoje: DataISO,
): Temperatura {
  if (p.feito) return 'feito';
  if (p.atraso || (p.data && p.data < hoje)) return 'atrasado';
  if (p.semResposta) return 'sem_resposta';
  if (p.data && p.data <= somarDias(hoje, DIAS_ALERTA)) return 'alerta';
  return 'em_dia';
}

export const bolinha = (...a: Parameters<typeof temperaturaPrazo>) =>
  BOLINHA[temperaturaPrazo(...a)];

export const LEGENDA_PRAZOS = '_🔴 atrasado · 🟡 vence em até 7 dias · 🔵 em dia_';
export const SEPARADOR = '━━━━━━━━━━━━━━';

/** Cabeçalho da obra: "*🏗 CDC - RESSACA*" e, abaixo, o indicador em itálico. */
export function cabecalhoObra(nome: string, indicador: string): string[] {
  return [`*🏗 ${nome.toLocaleUpperCase('pt-BR')}*`, `_${indicador}_`];
}

/** Seção com título em negrito e um item por linha; vazia não entra. */
export function secao(titulo: string, linhas: string[]): string[] {
  return linhas.length ? ['', `*${titulo}*`, ...linhas] : [];
}
