// Texto do boletim para WhatsApp (SPEC §8.1), no padrão legível de whatsapp.ts
// (seções com ícone, um item por linha e a bolinha do prazo). Datas chegam já
// formatadas pela UI. Trunca acima de ~4000 chars (limite prático do WhatsApp),
// remetendo ao PDF.
import type { DataISO } from './calendar';
import { BOLINHA, SEPARADOR, bolinha, cabecalhoObra, secao } from './whatsapp';
const LIMITE = 4000;

export interface ItemData {
  dataFmt: string;
  nome: string;
  motivo?: string | null;
  /** Data (ISO) para a bolinha amarela/azul. */
  data?: DataISO | null;
}

export interface GrupoPessoa {
  pessoa: string;
  itens: { dataFmt: string | null; texto: string; data?: DataISO | null; atrasado?: boolean }[];
}

export interface BoletimDados {
  obra: string;
  semanaFmt: string; // "seg 26/10 a sex 30/10"
  realPct: number; // 0..1
  previstoSextaPct: number; // 0..1
  ritmoTexto: string;
  ritmoAtrasado: boolean; // ritmo em atraso (decide o vermelho; vem do core)
  atrasos: string[]; // tipo/atividade em atraso
  concluir: ItemData[];
  comecar: ItemData[];
  quemFazOQue: GrupoPessoa[];
}

const RODAPE = '\n\n_PDF completo com fotos e cronograma no app CONTRO._';

export function textoBoletimWhatsapp(d: BoletimDados, hoje: DataISO = '9999-12-31'): string {
  const real = Math.round(d.realPct * 100);
  const prev = Math.round(d.previstoSextaPct * 100);
  const L: string[] = [
    '*CONTRO · Boletim da semana*',
    `_${d.semanaFmt}_`,
    '_🔴 atrasado · 🟡 vence em até 7 dias · 🔵 em dia_',
    '',
    ...cabecalhoObra(d.obra, `real ${real}% · previsto até sexta ${prev}% · ${d.ritmoTexto}`),
    ...secao(
      `🚨 Atenção · ${d.atrasos.length} em atraso`,
      d.atrasos.map((a) => `- ${BOLINHA.atrasado} ${a}`),
    ),
    ...secao(
      '🏁 Concluir nesta semana',
      d.concluir.map((c) => `- ${bolinha({ data: c.data }, hoje)} ${c.nome} · ${c.dataFmt}`),
    ),
    ...secao(
      '▶️ Começar nesta semana',
      d.comecar.map(
        (c) =>
          `- ${bolinha({ data: c.data }, hoje)} ${c.nome} · ${c.dataFmt}${c.motivo ? ` (${c.motivo})` : ''}`,
      ),
    ),
  ];
  const base = L.join('\n');

  const Q: string[] = [];
  if (d.quemFazOQue.length) {
    Q.push('', SEPARADOR, '*👥 Quem faz o quê*');
    for (const g of d.quemFazOQue) {
      Q.push('', `*${g.pessoa}*`);
      for (const it of g.itens)
        Q.push(
          `- ${bolinha({ atraso: it.atrasado, data: it.data }, hoje)} ${it.dataFmt ? `${it.dataFmt} · ` : ''}${it.texto}`,
        );
    }
  }

  const completo = base + Q.join('\n') + RODAPE;
  if (completo.length <= LIMITE) return completo;
  // Trunca "Quem faz o quê" e remete ao PDF (SPEC §8.1).
  const truncado = `${base}\n\n_Quem faz o quê_ e o restante no PDF completo.${RODAPE}`;
  // Caso-limite: se até as seções curtas já passam do limite, corta no limite.
  return truncado.length <= LIMITE ? truncado : truncado.slice(0, LIMITE);
}
