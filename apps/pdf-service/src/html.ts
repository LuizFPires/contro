// Templates HTML (A4, Nunito Sans, design system CONTRO) para o boletim e a ata.
// Puros e testáveis; o pdf.ts renderiza para PDF com Playwright. O domínio e os
// dados vêm do @contro/core (mesmo código do front).
import type { BoletimDados, LinhaAta, ObraAta, PessoaAta } from '@contro/core';

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
function pagina(titulo: string, corpo: string, paisagem = false): string {
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
  @page { size: A4${paisagem ? ' landscape' : ''}; margin: ${paisagem ? '10mm 10mm' : '16mm 14mm'}; }
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
  .totais { margin: 0 0 12px; display: flex; flex-wrap: wrap; gap: 6px; }
  .total { font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 5px; background: #ececec; }
  .quebra { break-before: page; }
  .tabela { width: 100%; border-collapse: collapse; font-size: 10.5px; line-height: 1.35; }
  .tabela th { text-align: left; padding: 6px 8px; background: var(--preto); color: var(--branco); font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  .tabela td { padding: 6px 8px; vertical-align: top; border-top: 1px solid #d6d6d6; border-left: 1px solid #ececec; }
  .tabela tr { break-inside: avoid; }
  .quem { margin-top: 12px; }
  .grade .quem-itens { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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

/** Dados da ata (montados no core, pela tela) para o PDF. */
export interface AtaDados {
  dataFmt: string;
  horaFmt: string;
  obras: ObraAta[];
  pessoas: PessoaAta[];
  /** "18 aconteceram", "2 não aconteceram"… (textosTotais do core). */
  totais: string[];
  /** Começa pelo resumo em tabela (paisagem). */
  resumo: boolean;
}

function linhaHtml(l: LinhaAta): string {
  const marca = l.ok ? '✓ ' : l.atraso ? '✗ ' : '';
  const cls = l.atraso ? ' class="atraso"' : l.semResposta ? ' class="motivo"' : '';
  const acao = l.acao ? `<br><span class="data">→</span> ${esc(l.acao)}` : '';
  return `<li${cls}>${marca}${esc(l.texto)}${acao}</li>`;
}

function blocoAta(titulo: string, ls: LinhaAta[]): string {
  return blocoLista(titulo, ls.map(linhaHtml));
}

function totaisHtml(totais: string[]): string {
  return `<p class="totais">${totais
    .map(
      (t) =>
        `<span class="${t.includes('não aconte') ? 'total atraso' : 'total'}">${esc(t)}</span>`,
    )
    .join('')}</p>`;
}

function quemFazHtml(pessoas: PessoaAta[], grade = false): string {
  if (pessoas.length === 0) return '';
  const itens = pessoas
    .map(
      (p) =>
        `<div class="pessoa-bloco"><p class="pessoa">${esc(p.pessoa)} · ${p.itens.length}</p><ul>${p.itens
          .map((i) => `<li${i.atrasado ? ' class="atraso"' : ''}>${esc(i.texto)}</li>`)
          .join('')}</ul></div>`,
    )
    .join('');
  return `<div class="bloco quem${grade ? ' grade' : ''}"><p class="bloco-titulo">Quem faz o quê</p><div class="quem-itens">${itens}</div></div>`;
}

function celula(ls: LinhaAta[]): string {
  if (ls.length === 0) return '<td class="motivo">—</td>';
  return `<td>${ls
    .map((l) => {
      const cls = l.atraso ? ' class="atraso"' : l.semResposta ? ' class="motivo"' : '';
      const marca = l.ok ? '✓ ' : l.atraso ? '✗ ' : '';
      return `<div${cls}>${marca}${esc(l.texto)}${l.acao ? `<br>→ ${esc(l.acao)}` : ''}</div>`;
    })
    .join('')}</td>`;
}

/** Resumo em tabela (paisagem): linhas = obras; colunas = blocos da ata. */
export function resumoTabelaHtml(d: AtaDados): string {
  const linhas = d.obras
    .map(
      (o) =>
        `<tr><td><strong>${esc(o.nome)}</strong><br><span class="${o.atrasada ? 'atraso' : 'motivo'}">${esc(
          o.indicador,
        )}</span></td>${celula(o.aconteceu)}${celula(o.naoAconteceu)}${celula(o.proximaSemana)}${celula(
          o.providencias,
        )}${celula(o.cobranca)}</tr>`,
    )
    .join('');
  return `<section class="resumo">
  ${marca(`Resumo da reunião · ${d.horaFmt}`)}
  <h1>Resumo da reunião semanal de obras</h1>
  <p class="semana">${esc(d.dataFmt)} · ${d.obras.length} ${d.obras.length === 1 ? 'obra' : 'obras'}</p>
  ${totaisHtml(d.totais)}
  <table class="tabela"><thead><tr><th>Obra</th><th>Semana passada · cumprido</th><th>Semana passada · não cumprido → ação</th><th>Próxima semana</th><th>Providências</th><th>Cobrança da reunião anterior</th></tr></thead><tbody>${
    linhas || '<tr><td colspan="6" class="vazio">Sem obras nesta ata.</td></tr>'
  }</tbody></table>
  ${quemFazHtml(d.pessoas, true)}
</section>`;
}

/** Ata da reunião (várias obras) em PDF; com `resumo`, abre com a tabela em paisagem. */
export function ataHtml(d: AtaDados): string {
  const corpoObras = d.obras
    .map((o) => {
      const obs = o.observacoes
        ? `<p class="obs"><strong>Obs:</strong> ${esc(o.observacoes)}</p>`
        : '';
      return `<div class="obra-ata"><p class="obra-faixa">${esc(o.nome)}</p><p class="obra-ind"><span class="${
        o.atrasada ? 'atraso' : ''
      }">${esc(o.indicador)}</span> · ${esc(o.situacao)}</p>${blocoAta(
        '1 · Planejado e aconteceu',
        o.aconteceu,
      )}${blocoAta('2 · Planejado e não aconteceu', o.naoAconteceu)}${blocoAta(
        '3 · Próxima semana',
        o.proximaSemana,
      )}${blocoAta('Providências', o.providencias)}${blocoAta(
        '4 · Cobrança da reunião anterior',
        o.cobranca,
      )}${obs}</div>`;
    })
    .join('');

  const ata = `<section class="${d.resumo ? 'ata quebra' : 'ata'}">
  ${marca(`Ata da semana · ${d.horaFmt}`)}
  <h1>Ata da reunião</h1>
  <p class="semana">${esc(d.dataFmt)} · ${d.obras.length} ${d.obras.length === 1 ? 'obra' : 'obras'}</p>
  ${totaisHtml(d.totais)}
  ${corpoObras || '<p class="vazio">Sem obras nesta ata.</p>'}
  ${quemFazHtml(d.pessoas)}
</section>`;
  return pagina(`Ata · ${d.dataFmt}`, `${d.resumo ? resumoTabelaHtml(d) : ''}${ata}`, d.resumo);
}
