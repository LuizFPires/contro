import { Fragment, useEffect, useMemo, useState } from 'react';
import { horaCurta, nomeCurto, textoAtaWhatsapp, textosTotais, type LinhaAta } from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { formatarDataCompleta } from '../../lib/datas';
import { pdfServiceConfigurado } from '../../lib/env';
import { baixarPdf } from '../../lib/pdf';
import { usePerfil } from '../perfil/usePerfil';
import { montarAta } from './ataDados';
import type { ReuniaoCompleta } from './reuniaoApi';
import { hojeISO } from '../obras/api';
import styles from './AtaView.module.css';

type Formato = 'resumo' | 'lista';

/**
 * Ata da reunião (decisão do usuário, 29/10/2026): por obra, o que aconteceu,
 * o que não aconteceu (com a ação), a próxima semana, as providências e a
 * cobrança; no fim, quem faz o quê. Quem tem ações abertas vê "Minhas ações".
 * O PDF pode começar pelo resumo em tabela (paisagem), que só existe no PDF.
 */
export function AtaView({
  reuniao,
  onVoltar,
  onMinhas,
}: {
  reuniao: ReuniaoCompleta;
  onVoltar: () => void;
  onMinhas: () => void;
}) {
  const { data: pessoa } = usePerfil();
  const { showToast } = useToast();
  const [baixando, setBaixando] = useState(false);
  const [formatoAberto, setFormatoAberto] = useState(false);
  const [formato, setFormato] = useState<Formato>('resumo');
  const [imprimindo, setImprimindo] = useState<Formato | null>(null);

  const dataFmt = formatarDataCompleta(reuniao.data);
  const horaFmt = horaCurta(reuniao.hora);
  const ata = useMemo(() => montarAta(reuniao), [reuniao]);
  const totais = textosTotais(ata.totais);
  const wa = `https://wa.me/?text=${encodeURIComponent(
    textoAtaWhatsapp(dataFmt, horaFmt, ata.obras, ata.pessoas, hojeISO()),
  )}`;

  // Minhas ações abertas (em todas as obras da reunião).
  const minhas = reuniao.tarefas.filter(
    (t) => pessoa && t.responsavelId === pessoa.id && !t.concluido,
  );
  const minhasAtrasadas = minhas.filter((t) => t.atrasado).length;
  const meuNome = nomeCurto(pessoa?.nome ?? '');

  // Impressão (sem pdf-service): o resumo em tabela pede a página em paisagem.
  useEffect(() => {
    if (!imprimindo) return;
    const fim = () => setImprimindo(null);
    window.addEventListener('afterprint', fim);
    const t = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', fim);
    };
  }, [imprimindo]);

  async function baixar() {
    setFormatoAberto(false);
    if (!pdfServiceConfigurado) {
      setImprimindo(formato);
      return;
    }
    setBaixando(true);
    try {
      await baixarPdf(
        'ata',
        {
          dataFmt,
          horaFmt,
          obras: ata.obras,
          pessoas: ata.pessoas,
          totais,
          resumo: formato === 'resumo',
        },
        `ata-${reuniao.data}.pdf`,
      );
    } catch {
      showToast({ message: 'Não foi possível gerar o PDF. Abrindo a impressão.' });
      setImprimindo(formato);
    } finally {
      setBaixando(false);
    }
  }

  const destaque = (texto: string) => <Destaque texto={texto} nome={meuNome} />;

  return (
    <div className={styles.screen}>
      {imprimindo === 'resumo' ? (
        <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>
      ) : null}
      <header className={styles.cabecalho}>
        <button
          type="button"
          className={styles.voltar}
          aria-label="Voltar para a reunião"
          onClick={onVoltar}
        >
          <Icon name="chevronLeft" size={22} />
        </button>
        <div>
          <h1 className={styles.titulo}>Ata da reunião</h1>
          <div className={styles.sub}>
            {dataFmt} · {horaFmt}
          </div>
        </div>
      </header>

      {imprimindo === 'resumo' ? (
        <ResumoTabela dataFmt={dataFmt} horaFmt={horaFmt} totais={totais} ata={ata} />
      ) : null}

      <div className={styles.fundo}>
        {minhas.length > 0 ? (
          <button type="button" className={styles.minhas} onClick={onMinhas}>
            <Icon name="pessoa" size={20} />
            <span className={styles.minhasTexto}>Minhas ações · {minhas.length}</span>
            {minhasAtrasadas ? (
              <span className={styles.minhasAtraso}>
                <Icon name="relogio" size={13} strokeWidth={2.4} />
                {minhasAtrasadas} {minhasAtrasadas === 1 ? 'atrasada' : 'atrasadas'}
              </span>
            ) : null}
            <Icon name="chevronRight" size={18} />
          </button>
        ) : null}

        <article className={`${styles.folha} ${imprimindo === 'resumo' ? styles.quebraAntes : ''}`}>
          <div className={styles.folhaTopo}>
            <div className={styles.folhaTitulo}>CONTRO · ata da reunião semanal de obras</div>
            <div className={styles.folhaData}>
              {dataFmt} · {horaFmt} · {ata.obras.length} {ata.obras.length === 1 ? 'obra' : 'obras'}
            </div>
            <div className={styles.totais}>
              {totais.map((t) => (
                <span
                  key={t}
                  className={
                    t.includes('não aconte') && !t.startsWith('0 ')
                      ? styles.totalAtraso
                      : styles.total
                  }
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {ata.obras.map((o) => (
            <section key={o.nome} className={styles.obra}>
              <div className={styles.obraTopo}>
                <span>{o.nome}</span>
                <span className={o.atrasada ? styles.txtAtraso : styles.ritmo}>{o.indicador}</span>
              </div>
              <div className={styles.situacao}>{o.situacao}</div>
              <Bloco titulo="1 · Planejado e aconteceu" linhas={o.aconteceu} destaque={destaque} />
              <Bloco
                titulo="2 · Planejado e não aconteceu"
                linhas={o.naoAconteceu}
                destaque={destaque}
              />
              <Bloco titulo="3 · Próxima semana" linhas={o.proximaSemana} destaque={destaque} />
              <Bloco titulo="Providências" linhas={o.providencias} destaque={destaque} />
              <Bloco
                titulo="4 · Cobrança da reunião anterior"
                linhas={o.cobranca}
                destaque={destaque}
              />
              {[o.aconteceu, o.naoAconteceu, o.proximaSemana, o.providencias, o.cobranca].every(
                (x) => x.length === 0,
              ) ? (
                <div className={styles.situacao}>Nada previsto nem cobrado nesta obra.</div>
              ) : null}
              {o.observacoes ? (
                <>
                  <h3 className={styles.secao}>Observações</h3>
                  <div className={styles.linha}>{o.observacoes}</div>
                </>
              ) : null}
            </section>
          ))}

          {ata.pessoas.length > 0 ? (
            <div className={styles.pessoas}>
              <div className={styles.pessoasTitulo}>Quem faz o quê</div>
              {ata.pessoas.map((g) => {
                const atr = g.itens.filter((it) => it.atrasado).length;
                return (
                  <div
                    key={g.pessoa}
                    className={`${styles.pessoa} ${g.pessoa === meuNome ? styles.pessoaEu : ''}`}
                  >
                    <div className={styles.pessoaNome}>
                      {g.pessoa}{' '}
                      <span>
                        · {g.itens.length} {g.itens.length === 1 ? 'aberta' : 'abertas'}
                        {atr ? ` · ${atr} ${atr === 1 ? 'atrasada' : 'atrasadas'}` : ''}
                      </span>
                    </div>
                    {g.itens.map((it, i) => (
                      <div key={i} className={it.atrasado ? styles.itemAtraso : styles.item}>
                        • {it.texto}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : null}
        </article>
      </div>

      <div className={styles.rodape}>
        <a className={styles.wa} href={wa} target="_blank" rel="noreferrer">
          <Icon name="whatsapp" size={18} strokeWidth={2} />
          WhatsApp
        </a>
        <button
          type="button"
          className={styles.pdf}
          onClick={() => setFormatoAberto(true)}
          disabled={baixando}
        >
          <Icon name="baixar" size={18} strokeWidth={2} />
          {baixando ? 'Gerando…' : 'Baixar PDF'}
        </button>
      </div>

      <BottomSheet open={formatoAberto} title="Baixar PDF" onClose={() => setFormatoAberto(false)}>
        <div className={styles.formatos} role="radiogroup" aria-label="Formato do PDF">
          {(
            [
              [
                'resumo',
                'Resumo em tabela + ata',
                'Paisagem · 1ª página: obras × semana; depois a ata',
              ],
              ['lista', 'Só a ata', 'A ata em lista, como na tela'],
            ] as const
          ).map(([k, t, d]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={formato === k}
              className={`${styles.formato} ${formato === k ? styles.formatoOn : ''}`}
              onClick={() => setFormato(k)}
            >
              <Icon name={k === 'resumo' ? 'cronograma' : 'documento'} size={24} />
              <span className={styles.formatoTexto}>
                <b>{t}</b>
                <span>{d}</span>
              </span>
              <span className={styles.radio} aria-hidden="true">
                {formato === k ? <Icon name="checkGrosso" size={13} strokeWidth={3} /> : null}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className={styles.baixar} onClick={() => void baixar()}>
          Baixar PDF
        </button>
      </BottomSheet>
    </div>
  );
}

/** Destaca o nome de quem está vendo a ata (pedido do usuário: "pendências para mim"). */
function Destaque({ texto, nome }: { texto: string; nome: string }) {
  if (!nome) return <>{texto}</>;
  // Só a palavra inteira ("Ana" não marca "Análise").
  const seguro = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<!\\p{L})${seguro}(?!\\p{L})`, 'u');
  const partes = texto.split(re);
  if (partes.length === 1) return <>{texto}</>;
  return (
    <>
      {partes.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < partes.length - 1 ? <mark className={styles.eu}>{nome}</mark> : null}
        </Fragment>
      ))}
    </>
  );
}

function Bloco({
  titulo,
  linhas,
  destaque,
}: {
  titulo: string;
  linhas: LinhaAta[];
  destaque: (t: string) => React.ReactNode;
}) {
  if (linhas.length === 0) return null;
  return (
    <>
      <h3 className={styles.secao}>{titulo}</h3>
      {linhas.map((l, i) => (
        <div key={i} className={styles.marcado}>
          {l.ok ? (
            <span className={styles.icOk} role="img" aria-label="Feito">
              <Icon name="checkGrosso" size={14} strokeWidth={3} />
            </span>
          ) : l.nao ? (
            <span className={styles.icNao} role="img" aria-label="Não feito">
              <Icon name="close" size={12} strokeWidth={3} />
            </span>
          ) : l.atraso ? (
            <span className={styles.icNao} role="img" aria-label="Atrasada">
              <Icon name="relogio" size={14} strokeWidth={2.4} />
            </span>
          ) : (
            <span
              className={styles.icAberta}
              role="img"
              aria-label={l.semResposta ? 'Sem resposta' : 'Em aberto'}
            >
              <Icon name="relogio" size={14} strokeWidth={2.2} />
            </span>
          )}
          <span
            className={l.atraso ? styles.txtAtraso : l.semResposta ? styles.semResp : undefined}
          >
            {destaque(l.texto)}
            {l.acao ? <span className={styles.recupera}>→ {destaque(l.acao)}</span> : null}
          </span>
        </div>
      ))}
    </>
  );
}

/** Resumo em tabela (só na impressão/PDF, paisagem): obras × blocos da ata. */
function ResumoTabela({
  dataFmt,
  horaFmt,
  totais,
  ata,
}: {
  dataFmt: string;
  horaFmt: string;
  totais: string[];
  ata: ReturnType<typeof montarAta>;
}) {
  const celula = (ls: LinhaAta[]) =>
    ls.length === 0 ? (
      <span className={styles.tCinza}>—</span>
    ) : (
      ls.map((l, i) => (
        <div
          key={i}
          className={l.atraso ? styles.tAtraso : l.semResposta ? styles.tCinza : undefined}
        >
          {l.ok ? '✓ ' : l.nao ? '✗ ' : ''}
          {l.texto}
          {l.acao ? <div>→ {l.acao}</div> : null}
        </div>
      ))
    );
  return (
    <div className={styles.resumo}>
      <div className={styles.resumoTopo}>
        <div>
          <div className={styles.resumoTitulo}>CONTRO · resumo da reunião semanal de obras</div>
          <div className={styles.folhaData}>
            {dataFmt} · {horaFmt} · {ata.obras.length} {ata.obras.length === 1 ? 'obra' : 'obras'}
          </div>
        </div>
        <div className={styles.totais}>
          {totais.map((t) => (
            <span
              key={t}
              className={
                t.includes('não aconte') && !t.startsWith('0 ') ? styles.totalAtraso : styles.total
              }
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <table className={styles.tabela}>
        <thead>
          <tr>
            <th>Obra</th>
            <th>Semana passada · cumprido</th>
            <th>Semana passada · não cumprido → ação</th>
            <th>Próxima semana</th>
            <th>Providências</th>
            <th>Cobrança da reunião anterior</th>
          </tr>
        </thead>
        <tbody>
          {ata.obras.map((o) => (
            <tr key={o.nome}>
              <td>
                <b>{o.nome}</b>
                <div className={o.atrasada ? styles.tAtraso : styles.tCinza}>{o.indicador}</div>
              </td>
              <td>{celula(o.aconteceu)}</td>
              <td>{celula(o.naoAconteceu)}</td>
              <td>{celula(o.proximaSemana)}</td>
              <td>{celula(o.providencias)}</td>
              <td>{celula(o.cobranca)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {ata.pessoas.length > 0 ? (
        <div className={styles.resumoPessoas}>
          <b>Quem faz o quê</b>
          <div className={styles.resumoPessoasGrade}>
            {ata.pessoas.map((g) => (
              <div key={g.pessoa}>
                <b>{g.pessoa}</b> · {g.itens.length}
                {g.itens.map((it, i) => (
                  <div key={i} className={it.atrasado ? styles.tAtraso : undefined}>
                    • {it.texto}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
