import { formatarNumero, rotuloDia, textoDiasUteis } from '@contro/core';
import { formatarDataCompleta } from '../../lib/datas';
import { escreverPdf, larguraPdf } from '../../lib/pdfTexto';
import { geometriaCurva } from './geometria';
import type { AtividadeRelatorio, ObraRelatorio } from './api';

type RGB = [number, number, number];
const PRETO: RGB = [24, 24, 24];
const TURQUESA: RGB = [84, 180, 176];
const VERMELHO: RGB = [198, 40, 40];
const FUNDO_ATRASO: RGB = [251, 234, 234];
const CINZA: RGB = [246, 246, 246];
const SUAVE: RGB = [110, 110, 110];

/** PDF A4 do relatório de avanço físico (mesmo conteúdo da tela, todas as obras). */
export async function pdfAvancoFisico(obras: ObraRelatorio[], hoje: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 14;
  const W = 210 - 2 * M;
  const cor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const traco = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const fundo = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const txt = (
    t: string,
    x: number,
    y: number,
    o?: { align?: 'left' | 'center' | 'right'; maxWidth?: number },
  ) => escreverPdf(doc, t, x, y, o);
  const fonte = (tam: number, negrito = false) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal');
    doc.setFontSize(tam);
  };

  const todas = obras.flatMap((o) => o.atividades);
  const criticas = todas.filter((a) => a.impactoDu > 0).length;

  // ---- Cabeçalho
  let y = 16;
  cor(PRETO);
  fonte(9, true);
  txt('CONTRO', M, y);
  fonte(18, true);
  txt('Relatório de avanço físico', M, y + 8);
  fonte(9);
  cor(SUAVE);
  txt(`Obras em andamento com quantitativo · ${formatarDataCompleta(hoje)}`, M, y + 13.5);
  // Três cards do mesmo tamanho no canto direito.
  const cards: [string, string, boolean][] = [
    [String(obras.length), obras.length === 1 ? 'obra' : 'obras', false],
    [String(todas.length), 'atividades', false],
    [String(criticas), 'atrasam a inauguração', criticas > 0],
  ];
  const cw = 27;
  const ch = 16;
  cards.forEach(([n, l, red], i) => {
    const x = M + W - (3 - i) * cw - (2 - i) * 2;
    if (red) {
      fundo(VERMELHO);
      doc.roundedRect(x, y - 2, cw, ch, 2, 2, 'F');
      cor([255, 255, 255]);
    } else {
      traco([210, 210, 210]);
      doc.roundedRect(x, y - 2, cw, ch, 2, 2, 'S');
      cor(PRETO);
    }
    fonte(13, true);
    txt(n, x + cw / 2, y + 4.5, { align: 'center' });
    fonte(6.5);
    txt(l, x + cw / 2, y + 9.5, { align: 'center', maxWidth: cw - 2 });
  });
  y += 18;
  traco(TURQUESA);
  doc.setLineWidth(0.8);
  doc.line(M, y, M + W, y);
  y += 6;

  const novaPagina = () => {
    doc.addPage();
    y = 16;
  };

  // ---- Obras
  const colW = (W - 5) / 2;
  const boxH = 64;
  for (const o of obras) {
    if (y + 10 + boxH > 285) novaPagina();
    fundo(CINZA);
    doc.roundedRect(M, y, W, 8, 1.5, 1.5, 'F');
    cor(PRETO);
    fonte(10.5, true);
    txt(o.nome, M + 3, y + 5.4);
    fonte(8);
    const inaug = `Inauguração planejada ${formatarDataCompleta(o.entregaOriginal)}`;
    const ritmo =
      o.impactoDu > 0
        ? ` · no ritmo atual ${rotuloDia(o.entregaNoRitmo)} (+${textoDiasUteis(o.atrasoNoRitmoDu)})`
        : ' · mantida no ritmo atual';
    if (o.impactoDu > 0) {
      cor(VERMELHO);
      fonte(8, true);
    }
    const wRitmo = larguraPdf(doc, ritmo);
    txt(ritmo, M + W - 3, y + 5.4, { align: 'right' });
    cor(PRETO);
    fonte(8);
    txt(inaug, M + W - 4 - wRitmo, y + 5.4, { align: 'right' });
    y += 11;

    o.atividades.forEach((a, i) => {
      const col = i % 2;
      if (col === 0 && i > 0) y += boxH + 4;
      if (col === 0 && y + boxH > 285) novaPagina();
      caixa(a, M + col * (colW + 5), y, colW, boxH);
    });
    y += boxH + 8;
  }

  // ---- Rodapé em todas as páginas
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    fonte(7);
    cor(SUAVE);
    txt(
      'Tracejado cinza: planejado · turquesa: medido · tracejado: projeção no ritmo atual (vermelho quando passa do prazo). Dias úteis de segunda a sexta.',
      M,
      290,
      { maxWidth: W - 25 },
    );
    txt(`página ${p} de ${paginas}`, M + W, 290, { align: 'right' });
  }
  return doc.output('blob');

  function caixa(a: AtividadeRelatorio, x: number, y0: number, w: number, h: number) {
    const critica = a.impactoDu > 0;
    const un = a.unidade;
    doc.setLineWidth(critica ? 0.6 : 0.25);
    traco(critica ? VERMELHO : [210, 210, 210]);
    doc.roundedRect(x, y0, w, h, 2, 2, 'S');
    cor(PRETO);
    fonte(9.5, true);
    txt(a.nome, x + 3, y0 + 5.5, { maxWidth: w - 32 });
    fonte(6.5);
    cor(SUAVE);
    txt(
      `${a.fase ? `Fase ${a.fase}` : ''}${a.prestador ? ` · ${a.prestador}` : ''}`,
      x + 3,
      y0 + 9,
      {
        maxWidth: w - 32,
      },
    );
    // Situação
    const st =
      a.estado === 'concluida'
        ? 'Concluída'
        : a.estado === 'sem_medicao'
          ? 'Sem medição'
          : a.situacao.tom === 'atraso'
            ? `Atrasada ${formatarNumero(-a.situacao.diferenca)} ${un}`
            : a.situacao.diferenca > a.total * 0.01
              ? `Adiantada ${formatarNumero(a.situacao.diferenca)} ${un}`
              : 'Em dia';
    const atr = a.estado === 'andamento' && a.situacao.tom === 'atraso';
    fonte(6.5, true);
    const sw = larguraPdf(doc, st) + 4;
    fundo(atr ? FUNDO_ATRASO : [221, 240, 239]);
    doc.roundedRect(x + w - 3 - sw, y0 + 2.5, sw, 4.6, 1, 1, 'F');
    cor(atr ? VERMELHO : PRETO);
    txt(st, x + w - 3 - sw / 2, y0 + 5.7, { align: 'center' });
    // Números
    cor(PRETO);
    fonte(10.5, true);
    const real = `${formatarNumero(a.real)} ${un}`;
    txt(real, x + 3, y0 + 14.5);
    const wReal = larguraPdf(doc, real);
    fonte(7.5);
    txt(` de ${formatarNumero(a.total)} ${un} · ${a.pct}%`, x + 3 + wReal + 1, y0 + 14.5);
    // Gráfico (viewBox 320 × 132 → caixa da largura disponível)
    const gx = x + 3;
    const gy = y0 + 16;
    const gw = w - 6;
    const s = gw / 320;
    const P = (px: number, py: number) => [gx + px * s, gy + py * s] as const;
    const g = geometriaCurva(a.curva);
    doc.setLineWidth(0.2);
    traco([215, 215, 215]);
    doc.line(...P(g.X0, g.Y0), ...P(g.X1, g.Y0));
    doc.setLineDashPattern([0.6, 0.9], 0);
    doc.line(...P(g.X0, g.yTotal), ...P(g.X1, g.yTotal));
    // Planejado
    traco([150, 150, 150]);
    doc.setLineWidth(0.35);
    doc.setLineDashPattern([1.4, 1.1], 0);
    doc.line(...P(g.plano[0][0], g.plano[0][1]), ...P(g.plano[1][0], g.plano[1][1]));
    // Prazo
    traco(PRETO);
    doc.setLineWidth(0.25);
    doc.setLineDashPattern([0.3, 0.8], 0);
    doc.line(...P(g.xPrazo, 14), ...P(g.xPrazo, g.Y0));
    // Projeção
    if (g.projecao) {
      const c = a.atrasoDu > 0 ? VERMELHO : TURQUESA;
      traco(c);
      doc.setLineWidth(0.5);
      doc.setLineDashPattern([1.1, 1.1], 0);
      doc.line(...P(g.projecao[0][0], g.projecao[0][1]), ...P(g.projecao[1][0], g.projecao[1][1]));
      fundo(c);
      doc.circle(...P(g.projecao[1][0], g.projecao[1][1]), 1.1, 'F');
    }
    doc.setLineDashPattern([], 0);
    // Medido
    if (g.real.length > 1) {
      traco(TURQUESA);
      doc.setLineWidth(0.8);
      for (let k = 1; k < g.real.length; k++)
        doc.line(...P(g.real[k - 1][0], g.real[k - 1][1]), ...P(g.real[k][0], g.real[k][1]));
    }
    fonte(6);
    cor(SUAVE);
    txt(`${formatarNumero(a.total)} ${un}`, ...P(10, g.yTotal - 4));
    txt(rotuloDia(a.curva.x0), ...P(10, 126));
    cor(PRETO);
    fonte(6, true);
    txt(`prazo ${rotuloDia(a.fimPlanejado)}`, ...P(g.xPrazo, 126), { align: 'center' });
    // Ritmo e término
    const ly = y0 + 16 + 132 * s + 3;
    fonte(7);
    cor(PRETO);
    txt(
      `Ritmo · meta: ${a.ritmo !== null ? formatarNumero(a.ritmo, 1) : '-'} · ${formatarNumero(a.meta, 1)} ${un}/dia`,
      x + 3,
      ly,
    );
    const fim =
      a.estado === 'concluida'
        ? 'Concluída'
        : !a.fimProjetado
          ? `prazo ${rotuloDia(a.fimPlanejado)}`
          : `${rotuloDia(a.fimProjetado)}${a.atrasoDu ? ` (+${a.atrasoDu} d.u.)` : ''}`;
    if (a.atrasoDu) cor(VERMELHO);
    fonte(7, true);
    txt(`Término: ${fim}`, x + w - 3, ly, { align: 'right' });
    // Mensagem
    const msg = critica
      ? `Atrasa a inauguração em ${textoDiasUteis(a.impactoDu)}.${
          a.precisaPorDia !== null
            ? ` Para não atrasar: ${formatarNumero(a.precisaPorDia, 1)} ${un}/dia.`
            : ''
        }`
      : a.estado === 'sem_medicao'
        ? 'Ainda sem medição.'
        : a.estado === 'concluida'
          ? 'Concluída.'
          : a.atrasoDu
            ? `Passa ${textoDiasUteis(a.atrasoDu)} do prazo, dentro da folga.`
            : 'Não afeta a inauguração.';
    fundo(critica ? FUNDO_ATRASO : CINZA);
    doc.roundedRect(x + 3, y0 + h - 8.5, w - 6, 6, 1, 1, 'F');
    cor(critica ? VERMELHO : PRETO);
    fonte(7, critica);
    txt(msg, x + 5, y0 + h - 4.6, { maxWidth: w - 10 });
  }
}
