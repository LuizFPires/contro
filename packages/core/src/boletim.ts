// Texto do boletim para WhatsApp (SPEC §8.1). Sem emoji; *negrito* e _itálico_
// do WhatsApp. Datas chegam já formatadas pela UI. Trunca acima de ~4000 chars
// (limite prático do WhatsApp), remetendo ao PDF.
const LIMITE = 4000;

export interface ItemData {
  dataFmt: string;
  nome: string;
  motivo?: string | null;
}

export interface GrupoPessoa {
  pessoa: string;
  itens: { dataFmt: string | null; texto: string }[];
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

const RODAPE = '\n\nPDF completo com fotos e cronograma no app CONTRO.';

export function textoBoletimWhatsapp(d: BoletimDados): string {
  const L: string[] = [];
  L.push('*CONTRO · Boletim da semana*');
  L.push(`*${d.obra}* · ${d.semanaFmt}`);
  L.push(
    `Avanço real ${Math.round(d.realPct * 100)}% · previsto até sexta ${Math.round(
      d.previstoSextaPct * 100,
    )}% · ${d.ritmoTexto}`,
  );

  if (d.atrasos.length) {
    L.push('');
    L.push(`*ATENÇÃO · ${d.atrasos.length} em atraso*`);
    for (const a of d.atrasos) L.push(`• ${a}`);
  }
  if (d.concluir.length) {
    L.push('');
    L.push('*Concluir nesta semana*');
    for (const c of d.concluir) L.push(`• ${c.dataFmt} · ${c.nome}`);
  }
  if (d.comecar.length) {
    L.push('');
    L.push('*Começar nesta semana*');
    for (const c of d.comecar)
      L.push(`• ${c.dataFmt} · ${c.nome}${c.motivo ? ` (${c.motivo})` : ''}`);
  }
  const base = L.join('\n');

  const Q: string[] = [];
  if (d.quemFazOQue.length) {
    Q.push('');
    Q.push('*Quem faz o quê*');
    for (const g of d.quemFazOQue) {
      Q.push(`_${g.pessoa}_`);
      for (const it of g.itens) Q.push(`• ${it.dataFmt ? `${it.dataFmt} · ` : ''}${it.texto}`);
    }
  }

  const completo = base + Q.join('\n') + RODAPE;
  if (completo.length <= LIMITE) return completo;
  // Trunca "Quem faz o quê" e remete ao PDF (SPEC §8.1).
  const truncado = `${base}\n\n_Quem faz o quê_ e o restante no PDF completo.${RODAPE}`;
  // Caso-limite: se até as seções curtas já passam do limite, corta no limite.
  return truncado.length <= LIMITE ? truncado : truncado.slice(0, LIMITE);
}
