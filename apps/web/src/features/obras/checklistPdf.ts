import { classificarPendencias } from '@contro/core';
import type { jsPDF as JsPDF } from 'jspdf';
import { escreverPdf } from '../../lib/pdfTexto';
import type { PendenciaObra } from './pendenciasObra';

/**
 * Chave do responsável no filtro do PDF: o id da pessoa do app, `nome:<nome>`
 * para o nome digitado (prestador) e '' para sem responsável.
 */
export function chaveResponsavel(p: Pick<PendenciaObra, 'responsavel_id' | 'responsavelNome'>) {
  if (p.responsavel_id) return p.responsavel_id;
  const nome = p.responsavelNome?.trim();
  return nome ? `nome:${nome}` : '';
}

export function pendenciasParaPdf(
  lista: PendenciaObra[],
  responsavel: string,
  atividadeId?: string,
) {
  return classificarPendencias(
    lista.filter(
      (p) =>
        (!atividadeId || p.atividade_id === atividadeId) &&
        (responsavel === 'todos' || chaveResponsavel(p) === responsavel),
    ),
  ).pendentes;
}

export interface FotoPdf {
  data: string;
  largura: number;
  altura: number;
}
export async function fotoParaPdf(url: string): Promise<FotoPdf> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error('Falha ao carregar foto');
  const blobUrl = URL.createObjectURL(await resp.blob());
  try {
    const img = new Image();
    img.src = blobUrl;
    await img.decode();
    // 1200 px no lado maior: nítida na foto de 8 × 10,6 cm e o PDF fica leve.
    const escala = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar a foto');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return {
      data: canvas.toDataURL('image/jpeg', 0.82),
      largura: canvas.width,
      altura: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

type Peso = 400 | 700 | 900;

/** Nunito Sans (a fonte do app) em TTF, servida em /fonts. Null se não carregar. */
export async function fonteParaPdf(peso: Peso): Promise<string | null> {
  try {
    const resp = await fetch(`/fonts/NunitoSans-${peso}.ttf`);
    if (!resp.ok) return null;
    const bytes = new Uint8Array(await resp.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  } catch {
    return null;
  }
}

export interface OpcoesChecklistPdf {
  /** Momento da emissão (padrão: agora). */
  agora?: Date;
  carregarFonte?: (peso: Peso) => Promise<string | null>;
}

type RGB = readonly [number, number, number];
const PRETO: RGB = [24, 24, 24];
const BRANCO: RGB = [255, 255, 255];
const TURQUESA: RGB = [84, 180, 176];
const VERMELHO: RGB = [198, 40, 40];
const AMBAR: RGB = [180, 83, 9];
const FUNDO: RGB = [246, 246, 246];
const ZEBRA: RGB = [250, 250, 250];
const CINZA: RGB = [110, 110, 110]; // rótulos (≥ 4,5:1 no branco)
const CINZA2: RGB = [98, 98, 98]; // texto secundário
const SUAVE: RGB = [128, 128, 128]; // "não informado"
const LINHA: RGB = [228, 228, 228];
const LINHA_ESC: RGB = [56, 56, 56]; // linha na faixa preta
const ROTULO_ESC: RGB = [167, 167, 167]; // rótulo na faixa preta

const DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const p2 = (n: number) => String(n).padStart(2, '0');
const dataDe = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d);
};
const isoLocal = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const diasEntre = (de: string, ate: string) =>
  Math.round((dataDe(ate).getTime() - dataDe(de).getTime()) / 864e5);

const CRIT = {
  alta: { rotulo: 'Alta', barras: 4, fundo: PRETO, texto: BRANCO, contorno: false },
  media: { rotulo: 'Média', barras: 3, fundo: TURQUESA, texto: PRETO, contorno: false },
  baixa: { rotulo: 'Baixa', barras: 2, fundo: BRANCO, texto: PRETO, contorno: true },
} as const;

const POR_RESUMO = 21;

/**
 * Check list de pendências em PDF A4 (protótipo aprovado em 17/11/2026):
 * capa com os números da obra, resumo de todas as pendências e duas
 * pendências por página com a foto grande. Texto selecionável e fotos
 * incorporadas; nunca omite uma foto silenciosamente.
 */
export async function gerarChecklistPdf(
  obra: string,
  filtro: string,
  pendencias: PendenciaObra[],
  carregarFoto = fotoParaPdf,
  opcoes: OpcoesChecklistPdf = {},
): Promise<Blob> {
  if (!pendencias.length) throw new Error('Não há pendências abertas para este responsável.');

  // ---- Fotos primeiro: sem uma delas, não sai PDF incompleto.
  const fotos = new Map<string, { antes: FotoPdf | null; depois: FotoPdf | null }>();
  for (const p of pendencias) {
    if (p.temFotoAntes === false) {
      fotos.set(p.id, { antes: null, depois: null });
      continue;
    }
    if (!p.fotoAntesUrl)
      throw new Error(
        `A foto de "${p.titulo}" ainda não está disponível. Aguarde a sincronização e tente novamente.`,
      );
    try {
      fotos.set(p.id, {
        antes: await carregarFoto(p.fotoAntesUrl),
        depois: p.fotoDepoisUrl ? await carregarFoto(p.fotoDepoisUrl) : null,
      });
    } catch {
      throw new Error(
        `Não foi possível carregar a foto de "${p.titulo}". Confira a conexão e tente novamente.`,
      );
    }
  }

  const { jsPDF } = await import('jspdf');
  const doc: JsPDF = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  // ---- Fonte do app (Nunito Sans); sem ela, Helvetica.
  const carregarFonte = opcoes.carregarFonte ?? fonteParaPdf;
  const fontes = await Promise.all(([400, 700, 900] as const).map((p) => carregarFonte(p)));
  let nunito = fontes.every(Boolean);
  if (nunito) {
    try {
      ([400, 700, 900] as const).forEach((peso, i) => {
        doc.addFileToVFS(`NunitoSans-${peso}.ttf`, fontes[i] as string);
        doc.addFont(`NunitoSans-${peso}.ttf`, `Nunito${peso}`, 'normal');
      });
    } catch {
      nunito = false;
    }
  }
  const fonte = (peso: Peso, tam: number) => {
    if (nunito) doc.setFont(`Nunito${peso}`, 'normal');
    else doc.setFont('helvetica', peso === 400 ? 'normal' : 'bold');
    doc.setFontSize(tam);
  };
  const cor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const preenche = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const traco = (c: RGB, w = 0.2) => {
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.setLineWidth(w);
  };
  const largura = (t: string) => doc.getTextWidth(t);
  const txt = (
    t: string,
    x: number,
    y: number,
    o: { align?: 'left' | 'center' | 'right'; charSpace?: number } = {},
  ) => {
    if (nunito) doc.text(t, x, y, { align: o.align, charSpace: o.charSpace });
    else escreverPdf(doc, t, x, y, { align: o.align });
  };
  /** Corta com reticências para caber em `max` mm. */
  const caber = (t: string, max: number) => {
    if (largura(t) <= max) return t;
    let s = t;
    while (s.length > 1 && largura(`${s}…`) > max) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  };
  const linhas = (t: string, max: number, n: number) => {
    const ls = doc.splitTextToSize(t, max) as string[];
    if (ls.length <= n) return ls;
    return [...ls.slice(0, n - 1), caber(ls.slice(n - 1).join(' '), max)];
  };

  // ---- Derivados
  const agora = opcoes.agora ?? new Date();
  const hoje = isoLocal(agora);
  const emitido = `${DL[agora.getDay()]}, ${p2(agora.getDate())}/${p2(agora.getMonth() + 1)}/${agora.getFullYear()} · ${p2(agora.getHours())}:${p2(agora.getMinutes())}`;
  const emitidoCurto = `${p2(agora.getDate())}/${p2(agora.getMonth() + 1)}/${agora.getFullYear()}, ${p2(agora.getHours())}:${p2(agora.getMinutes())}`;
  const n = pendencias.length;
  const paginasResumo = Math.ceil(n / POR_RESUMO);
  const totalPaginas = 1 + paginasResumo + Math.ceil(n / 2);
  const paginaDoItem = (i: number) => 2 + paginasResumo + Math.floor(i / 2);
  const prazoInfo = (prazo: string | null | undefined) => {
    if (!prazo) return null;
    const dias = diasEntre(hoje, prazo);
    const d = dataDe(prazo);
    return {
      curta: `${DS[d.getDay()]} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}`,
      longa: `${DL[d.getDay()]}, ${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`,
      quando:
        dias < 0
          ? `vencida há ${-dias} ${-dias === 1 ? 'dia' : 'dias'}`
          : dias === 0
            ? 'vence hoje'
            : `em ${dias} ${dias === 1 ? 'dia' : 'dias'}`,
      cor: dias < 0 ? VERMELHO : dias === 0 ? AMBAR : PRETO,
      dias,
    };
  };
  const quandoApontou = (iso: string) => {
    const d = new Date(iso);
    return `${DS[d.getDay()]} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}, ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  };

  // ---- Peças
  const barras = (x: number, yBase: number, nivel: number, c: RGB, h = 3) => {
    preenche(c);
    for (let k = 0; k < nivel; k++) {
      const bh = (h * (k + 1)) / 4;
      doc.roundedRect(x + k * 1.05, yBase - bh, 0.6, bh, 0.25, 0.25, 'F');
    }
  };
  /** Pílula da criticidade (texto e ícone de barras); devolve a largura. */
  const pilula = (
    crit: PendenciaObra['criticidade'],
    x: number,
    y: number,
    rotulo: string,
    tam = 7,
  ) => {
    const c = CRIT[crit];
    fonte(900, tam);
    const h = tam * 0.62;
    const w = largura(rotulo) + 10;
    if (c.contorno) {
      traco(PRETO, 0.35);
      preenche(BRANCO);
      doc.roundedRect(x, y, w, h, h / 2, h / 2, 'FD');
    } else {
      preenche(c.fundo);
      doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');
    }
    barras(x + 2, y + h * 0.74, c.barras, c.texto, h * 0.5);
    cor(c.texto);
    txt(rotulo, x + 7.6, y + h * 0.7);
    return w;
  };
  const fotoCapa = (
    f: FotoPdf,
    alias: string,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) => {
    doc.saveGraphicsState();
    doc.roundedRect(x, y, w, h, r, r, null);
    doc.clip();
    doc.discardPath();
    const s = Math.max(w / f.largura, h / f.altura);
    const iw = f.largura * s;
    const ih = f.altura * s;
    doc.addImage(f.data, 'JPEG', x + (w - iw) / 2, y + (h - ih) / 2, iw, ih, alias, 'FAST');
    doc.restoreGraphicsState();
  };
  const semFoto = (x: number, y: number, w: number, h: number, r: number, tam: number) => {
    preenche(FUNDO);
    doc.roundedRect(x, y, w, h, r, r, 'F');
    cor(CINZA);
    fonte(700, tam);
    txt('Sem foto do antes', x + w / 2, y + h / 2 + 1, { align: 'center' });
  };
  const cabecalho = () => {
    cor(PRETO);
    fonte(900, 9);
    txt('CONTRO', 13, 13, { charSpace: 0.7 });
    const wMarca = largura('CONTRO') + 6 * 0.7;
    fonte(700, 8);
    cor(CINZA);
    txt('Check list de pendências', 13 + wMarca + 3, 13);
    cor(PRETO);
    fonte(900, 8);
    txt(caber(obra, 90), 197, 13, { align: 'right' });
    traco(TURQUESA, 0.6);
    doc.line(13, 16.2, 197, 16.2);
  };
  const rodape = (pagina: number) => {
    traco(LINHA, 0.25);
    doc.line(13, 283, 197, 283);
    fonte(400, 7.5);
    cor(CINZA);
    txt(caber(`Gerado pelo CONTRO · ${emitidoCurto} · ${filtro}`, 150), 13, 288);
    fonte(900, 7.5);
    cor(PRETO);
    txt(`${pagina} / ${totalPaginas}`, 197, 288, { align: 'right' });
  };
  const rotulo = (t: string, x: number, y: number, c: RGB = CINZA, tam = 6.8) => {
    fonte(900, tam);
    cor(c);
    txt(t, x, y, { charSpace: 0.35 });
  };

  // =============== CAPA ===============
  preenche(PRETO);
  doc.rect(0, 0, 210, 111, 'F');
  cor(BRANCO);
  fonte(900, 12);
  txt('CONTRO', 15, 18, { charSpace: 1.2 });
  cor(TURQUESA);
  fonte(900, 7.5);
  txt('CHECK LIST DE PENDÊNCIAS', 195, 18, { align: 'right', charSpace: 0.7 });
  traco(LINHA_ESC, 0.25);
  doc.line(15, 23, 195, 23);
  rotulo('OBRA', 15, 40, ROTULO_ESC, 8);
  cor(BRANCO);
  let tamObra = 34;
  fonte(900, tamObra);
  let lObra = doc.splitTextToSize(obra, 165) as string[];
  if (lObra.length > 2) {
    tamObra = 25;
    fonte(900, tamObra);
    lObra = linhas(obra, 165, 2);
  }
  lObra.forEach((l, i) => txt(l, 15, 53 + i * tamObra * 0.3528 * 1.04));
  const semResp = pendencias.filter((p) => !chaveResponsavel(p)).length;
  [
    ['EMITIDO EM', emitido],
    ['RESPONSÁVEL', filtro],
    ['SITUAÇÃO', 'Pendências abertas'],
  ].forEach(([r, v], i) => {
    const x = 15 + i * 60;
    rotulo(r, x, 78, ROTULO_ESC, 7);
    cor(BRANCO);
    fonte(700, 10);
    txt(caber(v, 55), x, 83.5);
  });
  // Total sobre a faixa
  preenche(TURQUESA);
  doc.roundedRect(15, 92, 180, 35, 4.5, 4.5, 'F');
  cor(PRETO);
  fonte(900, 58);
  const totalTxt = String(n);
  txt(totalTxt, 24, 118.5);
  const xTot = 24 + largura(totalTxt) + 7;
  fonte(900, 17);
  txt(n === 1 ? 'pendência aberta' : 'pendências abertas', xTot, 107.5);
  const porCrit = { alta: 0, media: 0, baixa: 0 };
  for (const p of pendencias) porCrit[p.criticidade]++;
  fonte(700, 10);
  txt(`${porCrit.alta} alta · ${porCrit.media} média · ${porCrit.baixa} baixa`, xTot, 114.5);
  preenche(PRETO);
  doc.circle(178, 109.5, 10, 'F');
  traco(TURQUESA, 0.55);
  doc.roundedRect(173.5, 103.5, 9, 12, 1, 1, 'S');
  doc.lines(
    [
      [1.6, 1.6],
      [3.2, -3.4],
    ],
    175.7,
    109.2,
  );
  doc.line(175.7, 113, 180.3, 113);

  // Indicadores
  const vencidas = pendencias.filter((p) => (prazoInfo(p.prazo)?.dias ?? 0) < 0).length;
  const em7 = pendencias.filter((p) => {
    const d = prazoInfo(p.prazo)?.dias;
    return d !== undefined && d >= 0 && d <= 7;
  }).length;
  const kpis: { r: string; v: number; nivel?: number; cor?: RGB }[] = [
    { r: 'ALTA', v: porCrit.alta, nivel: 4 },
    { r: 'MÉDIA', v: porCrit.media, nivel: 3 },
    { r: 'BAIXA', v: porCrit.baixa, nivel: 2 },
    vencidas ? { r: 'VENCIDAS', v: vencidas, cor: VERMELHO } : { r: 'VENCEM EM 7 DIAS', v: em7 },
  ];
  const kw = (180 - 3 * 3) / 4;
  kpis.forEach((k, i) => {
    const x = 15 + i * (kw + 3);
    traco([220, 220, 220], 0.3);
    doc.roundedRect(x, 137, kw, 25, 3.5, 3.5, 'S');
    if (k.nivel) barras(x + 4, 144.2, k.nivel, CINZA2, 3.2);
    else {
      traco(k.cor ?? CINZA2, 0.45);
      doc.circle(x + 5.6, 142.6, 1.6, 'S');
      doc.line(x + 5.6, 141.7, x + 5.6, 142.7);
      doc.line(x + 5.6, 142.7, x + 6.4, 143.2);
    }
    rotulo(k.r, x + 9.5, 144, k.cor ?? CINZA2, 6.8);
    cor(k.cor ?? PRETO);
    fonte(900, 24);
    txt(String(k.v), x + 4, 157.5);
  });

  // Onde estão
  rotulo('ONDE ESTÃO', 15, 174, CINZA, 7);
  const porLocal = new Map<string, number>();
  for (const p of pendencias) {
    const l = p.local?.trim() || '';
    porLocal.set(l, (porLocal.get(l) ?? 0) + 1);
  }
  const locais = [...porLocal.entries()].sort(
    (a, b) => b[1] - a[1] || Number(!a[0]) - Number(!b[0]) || a[0].localeCompare(b[0]),
  );
  const topo = locais
    .slice(0, 6)
    .map(([l, q]) => ({ nome: l || 'Local não informado', q, apagado: !l }));
  const resto = locais.slice(6);
  if (resto.length)
    topo.push({
      nome: `Outros ${resto.length} ${resto.length === 1 ? 'local' : 'locais'}`,
      q: resto.reduce((s, [, q]) => s + q, 0),
      apagado: true,
    });
  const maxLocal = Math.max(...topo.map((t) => t.q));
  topo.forEach((t, i) => {
    const y = 182 + i * 6.6;
    fonte(700, 8.5);
    cor(t.apagado ? SUAVE : PRETO);
    txt(caber(t.nome, 38), 15, y);
    preenche([238, 238, 238]);
    doc.roundedRect(56, y - 2.4, 48, 2.7, 1.35, 1.35, 'F');
    preenche(t.apagado ? [178, 178, 178] : TURQUESA);
    doc.roundedRect(56, y - 2.4, Math.max(2.7, (48 * t.q) / maxLocal), 2.7, 1.35, 1.35, 'F');
    fonte(900, 8.5);
    cor(PRETO);
    txt(String(t.q), 112, y, { align: 'right' });
  });

  // Prazos
  rotulo('PRAZOS', 122, 174, CINZA, 7);
  const grupos = new Map<string, number>();
  for (const p of pendencias) {
    const info = prazoInfo(p.prazo);
    const k = !info ? 'sem' : info.dias < 0 ? 'vencidas' : (p.prazo as string);
    grupos.set(k, (grupos.get(k) ?? 0) + 1);
  }
  const datas = [...grupos.keys()].filter((k) => k !== 'sem' && k !== 'vencidas').sort();
  const linhasPrazo: { r: string; extra: string; q: number; c: RGB; tc: RGB }[] = [];
  if (grupos.has('vencidas'))
    linhasPrazo.push({
      r: 'Vencidas',
      extra: '',
      q: grupos.get('vencidas') ?? 0,
      c: VERMELHO,
      tc: VERMELHO,
    });
  const visiveis = datas.slice(0, grupos.has('vencidas') ? 2 : 3);
  visiveis.forEach((k, i) => {
    const info = prazoInfo(k);
    linhasPrazo.push({
      r: info?.curta ?? k,
      extra: info ? `· ${info.quando}` : '',
      q: grupos.get(k) ?? 0,
      c: i === 0 ? PRETO : TURQUESA,
      tc: info?.dias === 0 ? AMBAR : PRETO,
    });
  });
  const depois = datas.slice(visiveis.length);
  if (depois.length)
    linhasPrazo.push({
      r: 'Depois',
      extra: `· até ${prazoInfo(depois[depois.length - 1])?.curta ?? ''}`,
      q: depois.reduce((s, k) => s + (grupos.get(k) ?? 0), 0),
      c: [150, 210, 207],
      tc: PRETO,
    });
  if (grupos.has('sem'))
    linhasPrazo.push({
      r: 'Sem prazo',
      extra: '',
      q: grupos.get('sem') ?? 0,
      c: [214, 214, 214],
      tc: SUAVE,
    });
  let xb = 122;
  linhasPrazo.forEach((l) => {
    const w = (73 * l.q) / n;
    preenche(l.c);
    doc.rect(xb, 177.5, Math.max(0.3, w - 0.5), 3.6, 'F');
    xb += w;
  });
  linhasPrazo.forEach((l, i) => {
    const y = 188.5 + i * 6.4;
    preenche(l.c);
    doc.roundedRect(122, y - 2.8, 3, 3, 0.7, 0.7, 'F');
    fonte(900, 8.5);
    cor(l.tc);
    txt(l.r, 127.5, y);
    if (l.extra) {
      const wr = largura(l.r);
      fonte(400, 8.5);
      cor(CINZA2);
      txt(l.extra, 127.5 + wr + 1.2, y);
    }
    fonte(900, 8.5);
    cor(PRETO);
    txt(String(l.q), 195, y, { align: 'right' });
  });
  // Responsáveis
  const yResp = 188.5 + linhasPrazo.length * 6.4 + 1;
  preenche(FUNDO);
  doc.roundedRect(122, yResp, 73, 13, 3, 3, 'F');
  traco(PRETO, 0.4);
  doc.circle(127, yResp + 4.9, 1.5, 'S');
  doc.lines([[0.6, -2.4, 4.6, -2.4, 5.2, 0]], 124.4, yResp + 10);
  fonte(900, 7.8);
  cor(PRETO);
  const msgResp = semResp
    ? [`${semResp} sem responsável.`, 'Atribua no app para avisar quem resolve.']
    : ['Todas com responsável.', `Filtro: ${filtro}.`];
  txt(caber(msgResp[0], 62), 132, yResp + 5.3);
  fonte(400, 7.5);
  cor(CINZA2);
  txt(caber(msgResp[1], 62), 132, yResp + 9.6);

  // Fotos
  const comFoto = pendencias
    .map((p, i) => ({ p, i, f: fotos.get(p.id)?.antes ?? null }))
    .filter((x) => x.f)
    .slice(0, 6);
  if (comFoto.length) {
    rotulo('PRIMEIRAS PENDÊNCIAS', 15, 239, CINZA, 7);
    fonte(400, 7.5);
    cor(CINZA);
    txt(`em ordem de criticidade · detalhes a partir da página ${paginaDoItem(0)}`, 195, 239, {
      align: 'right',
    });
    const tw = (180 - 5 * 2) / 6;
    comFoto.forEach(({ p, i, f }, k) => {
      const x = 15 + k * (tw + 2);
      fotoCapa(f as FotoPdf, `antes-${p.id}`, x, 242.5, tw, 31, 2.5);
      preenche(PRETO);
      fonte(900, 7.5);
      const num = p2(i + 1);
      doc.roundedRect(x + 1.6, 244.1, largura(num) + 3, 4.6, 1.3, 1.3, 'F');
      cor(BRANCO);
      txt(num, x + 3.1, 247.4);
    });
  }
  rodape(1);

  // =============== RESUMO ===============
  for (let pg = 0; pg < paginasResumo; pg++) {
    doc.addPage();
    cabecalho();
    cor(PRETO);
    fonte(900, 19);
    txt(pg ? 'Resumo das pendências (continuação)' : 'Resumo das pendências', 13, 29);
    fonte(400, 8.5);
    cor(CINZA2);
    txt(`${n} ${n === 1 ? 'aberta' : 'abertas'} · ${filtro} · em ordem de criticidade`, 13, 35);
    // Legenda
    let xl = 197;
    (['baixa', 'media', 'alta'] as const).forEach((c) => {
      fonte(700, 7.5);
      const r = CRIT[c].rotulo;
      xl -= largura(r);
      cor(PRETO);
      txt(r, xl, 33.4);
      xl -= 6.2;
      const cc = CRIT[c];
      if (cc.contorno) {
        traco(PRETO, 0.35);
        preenche(BRANCO);
        doc.circle(xl + 2.3, 32.3, 2.3, 'FD');
      } else {
        preenche(cc.fundo);
        doc.circle(xl + 2.3, 32.3, 2.3, 'F');
      }
      barras(xl + 1.2, 33.5, cc.barras, cc.texto, 2.2);
      xl -= 4;
    });
    const C = { n: 13, t: 23, c: 114, p: 139, r: 166, g: 197 };
    [
      ['Nº', C.n],
      ['PENDÊNCIA E LOCAL', C.t],
      ['CRITICIDADE', C.c],
      ['RESOLVER ATÉ', C.p],
      ['RESPONSÁVEL', C.r],
    ].forEach(([r, x]) => rotulo(r as string, x as number, 46, CINZA, 6.5));
    rotulo('PÁG.', C.g - 6, 46, CINZA, 6.5);
    pendencias.slice(pg * POR_RESUMO, (pg + 1) * POR_RESUMO).forEach((p, k) => {
      const i = pg * POR_RESUMO + k;
      const y = 49 + k * 10.8;
      if (k % 2 === 0) {
        preenche(ZEBRA);
        doc.rect(13, y, 184, 10.8, 'F');
      }
      traco(LINHA, 0.2);
      doc.line(13, y, 197, y);
      cor(PRETO);
      fonte(900, 9.5);
      txt(p2(i + 1), C.n, y + 6.7);
      fonte(900, 9);
      txt(caber(p.titulo, 86), C.t, y + 4.7);
      fonte(400, 7.5);
      cor(p.local ? CINZA2 : SUAVE);
      txt(caber(p.local || 'Local não informado', 86), C.t, y + 8.6);
      pilula(p.criticidade, C.c, y + 3.2, CRIT[p.criticidade].rotulo, 6.6);
      const info = prazoInfo(p.prazo);
      if (info) {
        fonte(900, 8.5);
        cor(info.cor);
        txt(info.curta, C.p, y + 4.9);
        fonte(400, 7);
        cor(info.dias <= 0 ? info.cor : CINZA2);
        txt(info.quando, C.p, y + 8.6);
      } else {
        fonte(700, 8.5);
        cor(SUAVE);
        txt('Sem prazo', C.p, y + 6.6);
      }
      fonte(400, 8);
      cor(chaveResponsavel(p) ? PRETO : CINZA2);
      txt(caber(p.responsavelNome?.trim() || 'Sem responsável', 24), C.r, y + 6.6);
      fonte(900, 8.5);
      cor(PRETO);
      txt(String(paginaDoItem(i)), C.g, y + 6.6, { align: 'right' });
    });
    rodape(2 + pg);
  }

  // =============== PENDÊNCIAS (duas por página) ===============
  for (let i = 0; i < n; i += 2) {
    doc.addPage();
    cabecalho();
    [pendencias[i], pendencias[i + 1]].forEach((p, k) => {
      if (!p) return;
      const y0 = k ? 156.5 : 23.5;
      if (k) {
        traco(LINHA, 0.3);
        doc.line(13, 150.5, 197, 150.5);
      }
      // Foto
      const f = fotos.get(p.id);
      if (f?.antes) fotoCapa(f.antes, `antes-${p.id}`, 13, y0, 79, 105.8, 3.7);
      else semFoto(13, y0, 79, 105.8, 3.7, 9);
      if (f?.depois) {
        preenche(BRANCO);
        doc.roundedRect(64.5, y0 + 69.3, 25, 33, 2.4, 2.4, 'F');
        fotoCapa(f.depois, `depois-${p.id}`, 65.3, y0 + 70.1, 23.4, 31.4, 1.9);
        preenche(PRETO);
        fonte(900, 6.5);
        doc.roundedRect(66.6, y0 + 71.4, largura('Depois') + 3, 4, 1, 1, 'F');
        cor(BRANCO);
        txt('Depois', 68.1, y0 + 74.4);
      }
      const num = p2(i + k + 1);
      fonte(900, 15);
      preenche(PRETO);
      doc.roundedRect(16, y0 + 3, largura(num) + 5.2, 9.2, 2.6, 2.6, 'F');
      cor(BRANCO);
      txt(num, 18.6, y0 + 9.6);
      // Legenda da foto
      traco(CINZA, 0.35);
      doc.roundedRect(13.2, y0 + 108.6, 3.6, 2.8, 0.5, 0.5, 'S');
      doc.circle(15, y0 + 110, 0.75, 'S');
      fonte(400, 7.5);
      cor(CINZA);
      txt(
        caber(
          `${f?.antes ? 'Foto do apontamento' : 'Sem foto do antes'} · ${quandoApontou(p.apontada_em)}`,
          74,
        ),
        18.5,
        y0 + 111.2,
      );

      // Dados
      const x = 99;
      const w = 98;
      const wc = pilula(
        p.criticidade,
        x,
        y0,
        `Criticidade ${CRIT[p.criticidade].rotulo.toLowerCase()}`,
        7.4,
      );
      fonte(900, 7.2);
      const wp = largura('Pendente') + 5;
      traco([170, 170, 170], 0.3);
      preenche(BRANCO);
      doc.roundedRect(x + wc + 2, y0, wp, 4.6, 2.3, 2.3, 'FD');
      cor(CINZA2);
      txt('Pendente', x + wc + 4.5, y0 + 3.25);

      const tamT = p.titulo.length > 32 ? 16 : 20;
      fonte(900, tamT);
      cor(PRETO);
      const lt = linhas(p.titulo, w, 3);
      const lh = tamT * 0.3528 * 1.12;
      lt.forEach((l, j) => txt(l, x, y0 + 13 + j * lh));
      let y = y0 + 13 + (lt.length - 1) * lh + 6;

      const info = prazoInfo(p.prazo);
      const campos: { r: string; v: string; extra?: string; apagado?: boolean; c?: RGB }[] = [
        { r: 'LOCAL', v: p.local?.trim() || 'Local não informado', apagado: !p.local?.trim() },
        { r: 'ATIVIDADE', v: p.atividadeNome || 'Geral' },
        {
          r: 'RESPONSÁVEL',
          v: p.responsavelNome?.trim() || 'Sem responsável',
          apagado: !chaveResponsavel(p),
        },
        info
          ? { r: 'RESOLVER ATÉ', v: info.longa, extra: info.quando, c: info.cor }
          : { r: 'RESOLVER ATÉ', v: 'Sem prazo', apagado: true },
        {
          r: 'APONTADA POR',
          v: p.apontouNome || 'Não informado',
          extra: quandoApontou(p.apontada_em),
        },
      ];
      if (p.adiada_ate)
        campos.push({
          r: 'ADIADA ATÉ',
          v: prazoInfo(p.adiada_ate)?.longa ?? p.adiada_ate,
          extra: p.motivo_adiamento || undefined,
        });
      if (p.resolvida_em)
        campos.push({
          r: 'RESOLVIDA ANTES',
          v: quandoApontou(p.resolvida_em),
          extra: p.resolveuNome ? `por ${p.resolveuNome} · reaberta` : 'reaberta',
        });
      const passo = campos.length > 5 ? 8.6 : 9.6;
      campos.forEach((c) => {
        traco(LINHA, 0.25);
        doc.line(x, y, x + w, y);
        rotulo(c.r, x, y + 5.9, CINZA, 6.5);
        const xv = x + 30;
        fonte(c.apagado ? 400 : c.c && c.c !== PRETO ? 900 : 700, 10);
        cor(c.apagado ? SUAVE : (c.c ?? PRETO));
        const v = caber(c.v, w - 30);
        txt(v, xv, y + 6);
        if (c.extra) {
          const wv = largura(v);
          fonte(400, 8.3);
          cor(c.c && c.c !== PRETO ? c.c : CINZA2);
          const resto = w - 30 - wv - 2;
          if (resto > 12) txt(caber(`· ${c.extra}`, resto), xv + wv + 2, y + 6);
        }
        y += passo;
      });
      fonte(400, 6.5);
      cor(CINZA);
      txt(`Registro ${p.id.slice(0, 8)}`, x, y0 + 111.2);
    });
    rodape(paginaDoItem(i));
  }

  return doc.output('blob');
}
