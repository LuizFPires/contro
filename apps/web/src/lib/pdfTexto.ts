import type { jsPDF } from 'jspdf';

/**
 * Texto nas fontes padrão do jsPDF (Helvetica, WinAnsi). Elas não desenham
 * "²" e "³" (somem e o texto seguinte encavala): esses dois saem como "2"/"3"
 * menores e elevados. Setas e travessões viram hífen.
 */
export function limparPdf(t: string): string {
  return t.replace(/[→—–−]/g, '-').replace(/…/g, '...');
}

const SUP = /([²³])/;
const DIGITO: Record<string, string> = { '²': '2', '³': '3' };

function larguraLinha(doc: jsPDF, linha: string): number {
  const tam = doc.getFontSize();
  let w = 0;
  for (const parte of linha.split(SUP)) {
    if (!parte) continue;
    if (DIGITO[parte]) {
      doc.setFontSize(tam * 0.62);
      w += doc.getTextWidth(DIGITO[parte]);
      doc.setFontSize(tam);
    } else w += doc.getTextWidth(parte);
  }
  return w;
}

/** Largura do texto como `escreverPdf` desenha. */
export function larguraPdf(doc: jsPDF, texto: string): number {
  return larguraLinha(doc, limparPdf(texto));
}

/** doc.text com sobrescritos, alinhamento e quebra por largura. */
export function escreverPdf(
  doc: jsPDF,
  texto: string,
  x: number,
  y: number,
  opts: { align?: 'left' | 'center' | 'right'; maxWidth?: number } = {},
): void {
  const tam = doc.getFontSize();
  const mmPorPt = 0.3528;
  const entrelinha = tam * mmPorPt * 1.2;
  const limpo = limparPdf(texto);
  // Quebra medindo com os dígitos no lugar dos sobrescritos (largura parecida).
  const linhas: string[] = opts.maxWidth ? quebrar(doc, limpo, opts.maxWidth) : [limpo];
  linhas.forEach((linha, i) => {
    const ly = y + i * entrelinha;
    const w = larguraLinha(doc, linha);
    let cx = opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x;
    for (const parte of linha.split(SUP)) {
      if (!parte) continue;
      if (DIGITO[parte]) {
        doc.setFontSize(tam * 0.62);
        doc.text(DIGITO[parte], cx, ly - tam * mmPorPt * 0.36);
        cx += doc.getTextWidth(DIGITO[parte]);
        doc.setFontSize(tam);
      } else {
        doc.text(parte, cx, ly);
        cx += doc.getTextWidth(parte);
      }
    }
  });
}

function quebrar(doc: jsPDF, texto: string, max: number): string[] {
  const palavras = texto.split(' ');
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const tenta = atual ? `${atual} ${p}` : p;
    if (atual && larguraLinha(doc, tenta) > max) {
      linhas.push(atual);
      atual = p;
    } else atual = tenta;
  }
  if (atual) linhas.push(atual);
  return linhas;
}
