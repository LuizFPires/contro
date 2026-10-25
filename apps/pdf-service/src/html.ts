// Templates HTML (A4, Nunito Sans, design system CONTRO) para o boletim e a ata.
// Puros e testáveis; o pdf.ts renderiza para PDF com Playwright. O domínio e os
// dados vêm do @contro/core (mesmo código do front).
import type { BoletimDados, ObraAta } from '@contro/core';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

// Cores e tipografia do design system (turquesa, preto, branco; vermelho só
// para atraso). A4 com margens; Nunito Sans com fallback do sistema.
function pagina(titulo: string, corpo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${esc(titulo)}</title>
<style>
  /* Sem fonte externa: o PDF não pode depender de CDN (travaria offline).
     Usa Nunito Sans se instalada no host; senão, cai no stack do sistema. */
  :root {
    --turquesa: #54b4b0;
    --preto: #181818;
    --branco: #ffffff;
    --bg: #f6f6f6;
    --atraso: #c62828;
    --muted: #5a5a5a;
  }
  * { box-sizing: border-box; }
  @page { size: A4; margin: 16mm 14mm; }
  body {
    font-family: 'Nunito Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    color: var(--preto);
    font-size: 12px;
    margin: 0;
    background: var(--branco);
  }
  .marca { display: flex; align-items: center; gap: 8px; border-bottom: 2px solid var(--turquesa); padding-bottom: 8px; margin-bottom: 14px; }
  .marca .logo { width: 22px; height: 22px; background: var(--preto); border-radius: 5px; display: inline-block; position: relative; }
  .marca .logo::after { content: ''; position: absolute; inset: 5px; border-left: 3px solid var(--turquesa); border-bottom: 3px solid var(--turquesa); transform: rotate(45deg); }
  .marca .nome { font-weight: 800; letter-spacing: 0.5px; }
  .marca .doc { margin-left: auto; color: var(--muted); font-weight: 700; }
  h1 { font-size: 20px; font-weight: 800; margin: 0 0 2px; }
  .semana { color: var(--muted); font-weight: 600; margin: 0 0 10px; }
  .ind { font-weight: 700; margin: 0 0 16px; }
  .ind .num { font-weight: 800; }
  .atraso { color: var(--atraso); }
  .bloco { margin: 0 0 14px; break-inside: avoid; }
  .bloco-titulo { font-weight: 800; font-size: 13px; margin: 0 0 6px; padding-bottom: 3px; border-bottom: 1px solid #e3e3e3; }
  ul { margin: 0; padding-left: 18px; }
  li { margin: 2px 0; }
  .data { color: var(--muted); font-weight: 700; }
  .motivo { color: var(--muted); }
  .pessoa { font-weight: 800; margin-top: 6px; }
  .vazio { color: var(--muted); }
  .obra-ata { break-inside: avoid; margin-bottom: 16px; }
  .obra-faixa { background: #4a4a4a; color: var(--branco); font-weight: 800; padding: 6px 10px; border-radius: 6px; }
  .obra-ind { color: var(--muted); font-weight: 700; margin: 6px 0; }
  .obs { margin-top: 6px; }
</style>
</head>
<body>
${corpo}
</body>
</html>`;
}

function marca(doc: string): string {
  return `<div class="marca"><span class="logo"></span><span class="nome">CONTRO</span><span class="doc">${esc(
    doc,
  )}</span></div>`;
}

function blocoLista(titulo: string, itens: string[], atraso = false): string {
  if (itens.length === 0) return '';
  const cls = atraso ? 'bloco-titulo atraso' : 'bloco-titulo';
  return `<div class="bloco"><p class="${cls}">${esc(titulo)}</p><ul>${itens.join('')}</ul></div>`;
}

/** Boletim semanal de UMA obra em PDF (A4), a partir dos dados do core. */
export function boletimHtml(d: BoletimDados): string {
  const ind = `<p class="ind">Real <span class="num">${pct(d.realPct)}</span> · previsto até sexta <span class="num">${pct(
    d.previstoSextaPct,
  )}</span> · <span class="${d.ritmoAtrasado ? 'atraso' : ''}">${esc(d.ritmoTexto)}</span></p>`;

  const atrasos = blocoLista(
    `Atenção · ${d.atrasos.length} em atraso`,
    d.atrasos.map((a) => `<li>${esc(a)}</li>`),
    true,
  );
  const concluir = blocoLista(
    'Concluir esta semana',
    d.concluir.map((i) => `<li><span class="data">${esc(i.dataFmt)}</span> · ${esc(i.nome)}</li>`),
  );
  const comecar = blocoLista(
    'Começar esta semana',
    d.comecar.map(
      (i) =>
        `<li><span class="data">${esc(i.dataFmt)}</span> · ${esc(i.nome)}${
          i.motivo ? ` <span class="motivo">(${esc(i.motivo)})</span>` : ''
        }</li>`,
    ),
  );
  const quem =
    d.quemFazOQue.length === 0
      ? ''
      : `<div class="bloco"><p class="bloco-titulo">Quem faz o quê</p>${d.quemFazOQue
          .map(
            (g) =>
              `<p class="pessoa">${esc(g.pessoa)}</p><ul>${g.itens
                .map(
                  (it) =>
                    `<li>${it.dataFmt ? `<span class="data">${esc(it.dataFmt)}</span> · ` : ''}${esc(
                      it.texto,
                    )}</li>`,
                )
                .join('')}</ul>`,
          )
          .join('')}</div>`;

  const corpo = `${marca('Boletim da semana')}
  <h1>${esc(d.obra)}</h1>
  <p class="semana">${esc(d.semanaFmt)}</p>
  ${ind}
  ${atrasos}${concluir}${comecar}${quem}`;
  return pagina(`Boletim · ${d.obra}`, corpo);
}

/** Ata da reunião de segunda (várias obras) em PDF (A4). */
export function ataHtml(dataFmt: string, obras: ObraAta[]): string {
  const corpoObras = obras
    .map((o) => {
      const atrasos = blocoLista(
        'Atrasos',
        o.atrasos.map((a) => `<li>${esc(a)}</li>`),
        true,
      );
      const concluir = blocoLista(
        'Concluir',
        o.concluir.map((a) => `<li>${esc(a)}</li>`),
      );
      const comecar = blocoLista(
        'Começar',
        o.comecar.map((a) => `<li>${esc(a)}</li>`),
      );
      const providenciar = blocoLista(
        'Providenciar',
        o.providenciar.map((a) => `<li>${esc(a)}</li>`),
      );
      const obs = o.observacoes.trim()
        ? `<p class="obs"><strong>Obs:</strong> ${esc(o.observacoes.trim())}</p>`
        : '';
      return `<div class="obra-ata"><p class="obra-faixa">${esc(o.nome)}</p><p class="obra-ind">${esc(
        o.indicador,
      )}</p>${atrasos}${concluir}${comecar}${providenciar}${obs}</div>`;
    })
    .join('');

  const corpo = `${marca('Ata da semana · 16h')}
  <h1>Ata da reunião</h1>
  <p class="semana">${esc(dataFmt)} · ${obras.length} ${obras.length === 1 ? 'obra' : 'obras'}</p>
  ${corpoObras || '<p class="vazio">Sem obras nesta ata.</p>'}`;
  return pagina(`Ata · ${dataFmt}`, corpo);
}
