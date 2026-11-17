// Check-in por obra (17/11/2026, protótipo aprovado "CONTRO · Check-in por obra").
// Localização (ponto da obra = primeiro check-in, raio de 200 m), carimbo das
// fotos, frequência esperada por pessoa e a Presença na obra do Score.
import { addDU, diaUtilAPartir, type DataISO } from './calendar';

export const RAIO_CHECKIN_M = 200;
/** Mínimo de fotos por check-in (17/11/2026). */
export const MINIMO_FOTOS_CHECKIN = 4;
/** Diferença de relógio (aparelho × servidor) a partir da qual a hora é ajustada. */
export const TOLERANCIA_RELOGIO_S = 120;

export interface Coordenada {
  lat: number;
  lng: number;
}

/** Distância em metros entre dois pontos (haversine). */
export function distanciaMetros(a: Coordenada, b: Coordenada): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type SituacaoLocal = 'ponto' | 'na_obra' | 'fora' | 'sem_local';

/**
 * Onde o check-in foi feito: sem ponto da obra, este vira o ponto; sem
 * localização, precisa do Gestor; além do raio, "fora".
 */
export function situacaoLocal(
  ponto: Coordenada | null,
  local: Coordenada | null,
  raio = RAIO_CHECKIN_M,
): { situacao: SituacaoLocal; distancia: number | null } {
  if (!local) return { situacao: 'sem_local', distancia: null };
  if (!ponto) return { situacao: 'ponto', distancia: 0 };
  const distancia = Math.round(distanciaMetros(ponto, local));
  return { situacao: distancia > raio ? 'fora' : 'na_obra', distancia };
}

/** "1,2 km" / "350 m". */
export function textoDistancia(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

export type ValidacaoCheckin = 'validado' | 'nao_validado' | null;

/** Precisa do Gestor? (fora da obra ou sem localização, ainda sem decisão) */
export function aguardaGestor(c: {
  situacao: SituacaoLocal;
  validacao: ValidacaoCheckin;
}): boolean {
  return (c.situacao === 'fora' || c.situacao === 'sem_local') && c.validacao == null;
}

/** Conta na Presença? Na obra (ou o ponto) sempre; fora/sem local só validado. */
export function checkinValido(c: {
  situacao: SituacaoLocal;
  validacao: ValidacaoCheckin;
}): boolean {
  if (c.situacao === 'ponto' || c.situacao === 'na_obra') return true;
  return c.validacao === 'validado';
}

// ---------------------------------------------------------------- frequência

export type FrequenciaCheckin = 'diario' | '3' | '2' | '1' | 'nao';

export const FREQUENCIAS: { valor: FrequenciaCheckin; curto: string; longo: string }[] = [
  { valor: 'diario', curto: 'Todo dia', longo: 'todo dia útil' },
  { valor: '3', curto: '3×/sem', longo: '3× por semana' },
  { valor: '2', curto: '2×/sem', longo: '2× por semana' },
  { valor: '1', curto: '1×/sem', longo: '1× por semana' },
  { valor: 'nao', curto: 'Não precisa', longo: 'não precisa' },
];

export function textoFrequencia(f: FrequenciaCheckin): string {
  return FREQUENCIAS.find((x) => x.valor === f)?.longo ?? 'não precisa';
}

export interface MudancaFrequencia {
  desde: DataISO;
  frequencia: FrequenciaCheckin;
}

/** Frequência vigente num dia (a última mudança com `desde` ≤ dia). */
export function frequenciaEm(historico: MudancaFrequencia[], dia: DataISO): FrequenciaCheckin {
  let atual: FrequenciaCheckin = 'nao';
  for (const m of [...historico].sort((a, b) => a.desde.localeCompare(b.desde)))
    if (m.desde <= dia) atual = m.frequencia;
  return atual;
}

/** Segunda-feira da semana do dia (ISO). */
export function segundaDa(dia: DataISO): DataISO {
  const d = new Date(`${dia}T12:00:00Z`);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------ presença

export interface PresencaObraEntrada {
  chavePessoa: string;
  obraId: string;
  obraNome: string;
  frequencias: MudancaFrequencia[];
  /** Dias (locais) com check-in válido nesta obra. */
  dias: DataISO[];
}

export type FaltaPresenca =
  | { tipo: 'dia'; dia: DataISO }
  | { tipo: 'semana'; segunda: DataISO; feitos: number; pedidos: number };

export interface PresencaObra {
  obraId: string;
  obraNome: string;
  frequencia: FrequenciaCheckin;
  esperados: number;
  feitos: number;
  faltas: FaltaPresenca[];
}

export interface Presenca {
  esperados: number;
  feitos: number;
  nota: number | null;
  obras: PresencaObra[];
}

/**
 * Presença de uma pessoa entre `inicio` e `hoje`: dias com check-in contra a
 * frequência definida pelo Gestor em cada obra. Todo dia útil: cada dia útil
 * passado conta (hoje só se já fez). Por semana: semanas fechadas pedem até N
 * dias com check-in; a semana corrente só soma o que já foi feito.
 */
export function presencaDaPessoa(
  obras: PresencaObraEntrada[],
  inicio: DataISO,
  hoje: DataISO,
): Presenca {
  const porObra: PresencaObra[] = [];
  for (const o of obras) {
    const feitosDias = new Set(o.dias);
    let esperados = 0;
    let feitos = 0;
    const faltas: FaltaPresenca[] = [];
    const semanas = new Map<DataISO, { n: number; dias: DataISO[] }>();
    for (let d = diaUtilAPartir(inicio); d <= hoje; d = addDU(d, 1)) {
      const f = frequenciaEm(o.frequencias, d);
      if (f === 'nao') continue;
      if (f === 'diario') {
        if (d < hoje) {
          esperados++;
          if (feitosDias.has(d)) feitos++;
          else faltas.push({ tipo: 'dia', dia: d });
        } else if (feitosDias.has(d)) {
          esperados++;
          feitos++;
        }
        continue;
      }
      const seg = segundaDa(d);
      const s = semanas.get(seg) ?? { n: 0, dias: [] };
      s.n = Math.max(s.n, Number(f));
      s.dias.push(d);
      semanas.set(seg, s);
    }
    for (const [seg, s] of semanas) {
      const sexta = addDU(seg, 4);
      const feitosSem = s.dias.filter((d) => feitosDias.has(d)).length;
      const pedidos = Math.min(s.n, s.dias.length);
      if (sexta < hoje) {
        esperados += pedidos;
        const ok = Math.min(pedidos, feitosSem);
        feitos += ok;
        if (ok < pedidos) faltas.push({ tipo: 'semana', segunda: seg, feitos: ok, pedidos });
      } else {
        const ok = Math.min(pedidos, feitosSem);
        esperados += ok;
        feitos += ok;
      }
    }
    if (esperados > 0 || o.frequencias.some((m) => m.frequencia !== 'nao'))
      porObra.push({
        obraId: o.obraId,
        obraNome: o.obraNome,
        frequencia: frequenciaEm(o.frequencias, hoje),
        esperados,
        feitos,
        faltas: faltas.sort((a, b) =>
          (a.tipo === 'dia' ? a.dia : a.segunda).localeCompare(
            b.tipo === 'dia' ? b.dia : b.segunda,
          ),
        ),
      });
  }
  const esperados = porObra.reduce((s, o) => s + o.esperados, 0);
  const feitos = porObra.reduce((s, o) => s + o.feitos, 0);
  return {
    esperados,
    feitos,
    nota: esperados > 0 ? feitos / esperados : null,
    obras: porObra.filter((o) => o.esperados > 0),
  };
}

// ------------------------------------------------------------------- carimbo

/** Linhas do carimbo gravado na foto. */
export function linhasCarimbo(obra: string, pessoa: string, quando: Date): string[] {
  const DL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const p2 = (n: number) => String(n).padStart(2, '0');
  return [
    `${p2(quando.getHours())}:${p2(quando.getMinutes())} · ${DL[quando.getDay()]}, ${p2(quando.getDate())}/${p2(quando.getMonth() + 1)}/${quando.getFullYear()}`,
    `${obra} · ${pessoa}`,
  ];
}
