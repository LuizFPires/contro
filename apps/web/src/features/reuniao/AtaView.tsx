import { useState } from 'react';
import {
  horaCurta,
  compilarPorPessoa,
  derivarAtribuicoes,
  origemReuniao,
  deReuniaoAnterior,
  voltaNaProximaReuniao,
  ritmoTexto,
  textoAtaWhatsapp,
  type ObraAta,
} from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import { hojeISO } from '../obras/api';
import { formatarDataCompleta, formatarDataCurta } from '../../lib/datas';
import { pdfServiceConfigurado } from '../../lib/env';
import { baixarPdf } from '../../lib/pdf';
import type { ReuniaoCompleta } from './reuniaoApi';
import styles from './AtaView.module.css';

const TIPO: Record<string, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};

/** Ata da reunião (protótipo · ATA): folha com indicadores, obras e responsáveis. */
export function AtaView({ reuniao, onVoltar }: { reuniao: ReuniaoCompleta; onVoltar: () => void }) {
  const dataFmt = formatarDataCompleta(reuniao.data);

  const obrasAta: ObraAta[] = reuniao.obras.map((o) => ({
    nome: o.nome,
    indicador: `${Math.round(o.pct * 100)}% · ${ritmoTexto(o.ritmoDias).texto}`,
    atrasos: o.atividadesAtrasadas.map((a) => a.nome),
    concluir: o.concluir.map((a) => a.nome),
    comecar: o.comecar.map((a) => a.nome),
    providenciar: o.providenciar.map((p) => `${TIPO[p.tipo]}: ${p.descricao}`),
    observacoes: o.observacoes,
  }));
  const wa = `https://wa.me/?text=${encodeURIComponent(textoAtaWhatsapp(dataFmt, obrasAta))}`;
  const { showToast } = useToast();
  const [baixando, setBaixando] = useState(false);

  async function baixar() {
    if (!pdfServiceConfigurado) {
      window.print();
      return;
    }
    setBaixando(true);
    try {
      await baixarPdf('ata', { dataFmt, obras: obrasAta }, `ata-${reuniao.data}.pdf`);
    } catch {
      showToast({ message: 'Não foi possível gerar o PDF. Abrindo a impressão.' });
      window.print();
    } finally {
      setBaixando(false);
    }
  }

  const nomeObra = new Map(reuniao.obras.map((o) => [o.obraId, o.nome]));
  const origemAtual = origemReuniao(formatarDataCurta(reuniao.data));
  // Por responsável, com a obra entre parênteses (protótipo).
  const porPessoa = compilarPorPessoa(
    derivarAtribuicoes(
      {
        tarefas: reuniao.tarefas
          .filter((t) => !t.concluido)
          .map((t) => ({ ...t, texto: `${t.texto} (${nomeObra.get(t.obraId) ?? ''})` })),
        engenheiroNome: null,
        comprasNome: null,
        atividadesAtrasadas: [],
        concluirSemana: [],
        comecarSemana: [],
        providenciasAtrasadas: [],
        providenciarSemana: [],
      },
      hojeISO(),
    ),
  );

  return (
    <div className={styles.screen}>
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
            {formatarDataCompleta(reuniao.data)} · {horaCurta(reuniao.hora)}
          </div>
        </div>
      </header>

      <div className={styles.fundo}>
        <article className={styles.folha}>
          <div className={styles.folhaTopo}>
            <div className={styles.folhaTitulo}>CONTRO · ata da reunião semanal de obras</div>
            <div className={styles.folhaData}>
              {dataFmt} · {horaCurta(reuniao.hora)}
            </div>
          </div>

          {reuniao.obras.map((o) => {
            const ritmo = ritmoTexto(o.ritmoDias, true);
            const daObra = reuniao.tarefas.filter((t) => t.obraId === o.obraId);
            const novas = daObra.filter((t) => t.origem === origemAtual);
            const anteriores = daObra.filter((t) => deReuniaoAnterior(t, origemAtual));
            const passada = [...o.passadaConcluir, ...o.passadaComecar];
            const provDe = (id: string) => novas.find((t) => t.vinculoId === id);
            const pedir = o.providenciar.map((p) => `${TIPO[p.tipo]}: ${p.descricao}`);
            return (
              <section key={o.obraId} className={styles.obra}>
                <div className={styles.obraTopo}>
                  <span>{o.nome}</span>
                  <span className={ritmo.atrasada ? styles.txtAtraso : styles.ritmo}>
                    {ritmo.texto}
                  </span>
                </div>
                <div className={styles.situacao}>
                  {o.faseAtual} · real {Math.round(o.pct * 100)}% · previsto sexta{' '}
                  {Math.round(o.previstoSexta * 100)}% · inauguração {formatarDataCurta(o.entrega)}
                </div>

                <h3 className={styles.secao}>Semana passada</h3>
                {passada.length === 0 ? (
                  <div className={styles.situacao}>Nada previsto.</div>
                ) : null}
                {passada.map((p) => {
                  const prov = provDe(p.atividadeId);
                  const ok = p.ok && !prov;
                  return (
                    <div key={`${p.tipo}-${p.atividadeId}`} className={styles.marcado}>
                      <span
                        className={ok ? styles.icOk : styles.icNao}
                        role="img"
                        aria-label={ok ? 'Feito' : 'Não feito'}
                      >
                        <Icon
                          name={ok ? 'checkGrosso' : 'close'}
                          size={ok ? 14 : 12}
                          strokeWidth={3}
                        />
                      </span>
                      <span>
                        {p.nome}
                        {prov ? (
                          <span className={styles.recupera}>
                            → {prov.texto} — <b>{prov.pessoa}</b>, até{' '}
                            {prov.prazo ? formatarDataCurta(prov.prazo) : '—'}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}

                <h3 className={styles.secao}>Esta semana</h3>
                <div className={styles.linha}>
                  <b>Concluir:</b> {o.concluir.map((a) => a.nome).join(', ') || 'nada previsto'}
                </div>
                <div className={styles.linha}>
                  <b>Começar:</b> {o.comecar.map((a) => a.nome).join(', ') || 'nada previsto'}
                </div>
                <div className={styles.linha}>
                  <b>Contratar/comprar:</b> {pedir.join(', ') || 'nada a fechar'}
                </div>

                {anteriores.length > 0 ? (
                  <>
                    <h3 className={styles.secao}>Providências da reunião anterior</h3>
                    {anteriores.map((t) => (
                      <div key={t.id} className={styles.marcado}>
                        {t.concluido ? (
                          <span className={styles.icOk} role="img" aria-label="Feita">
                            <Icon name="checkGrosso" size={14} strokeWidth={3} />
                          </span>
                        ) : t.atrasado ? (
                          <span className={styles.icNao} role="img" aria-label="Atrasada">
                            <Icon name="relogio" size={14} strokeWidth={2.4} />
                          </span>
                        ) : (
                          <span className={styles.icAberta} role="img" aria-label="No prazo">
                            <Icon name="relogio" size={14} strokeWidth={2.2} />
                          </span>
                        )}
                        <span
                          className={
                            t.concluido ? styles.riscado : t.atrasado ? styles.txtAtraso : undefined
                          }
                        >
                          {t.texto} — {t.pessoa}
                          {!t.concluido && t.prazo ? `, até ${formatarDataCurta(t.prazo)}` : ''}
                        </span>
                      </div>
                    ))}
                  </>
                ) : null}

                {novas.length > 0 ? (
                  <>
                    <h3 className={styles.secao}>Novas providências</h3>
                    {novas.map((t) => (
                      <div key={t.id} className={styles.prov}>
                        {t.texto} — <b>{t.pessoa}</b>, até{' '}
                        {t.prazo ? formatarDataCurta(t.prazo) : '—'}
                        {t.prazo && voltaNaProximaReuniao(reuniao.data, t.prazo) ? (
                          <span className={styles.volta}> (volta na próxima reunião)</span>
                        ) : null}
                        {t.observacao ? (
                          <span className={styles.recupera}>{t.observacao}</span>
                        ) : null}
                      </div>
                    ))}
                  </>
                ) : null}

                {o.observacoes.trim() ? (
                  <>
                    <h3 className={styles.secao}>Observações</h3>
                    <div className={styles.linha}>{o.observacoes.trim()}</div>
                  </>
                ) : null}
              </section>
            );
          })}

          {porPessoa.length > 0 ? (
            <div className={styles.pessoas}>
              <div className={styles.pessoasTitulo}>Quem faz o quê</div>
              {porPessoa.map((g) => {
                const atr = g.itens.filter((it) => it.atrasado).length;
                return (
                  <div key={g.pessoa} className={styles.pessoa}>
                    <div className={styles.pessoaNome}>
                      {g.pessoa}{' '}
                      <span>
                        · {g.itens.length} {g.itens.length === 1 ? 'aberta' : 'abertas'}
                        {atr ? ` · ${atr} ${atr === 1 ? 'atrasada' : 'atrasadas'}` : ''}
                      </span>
                    </div>
                    {g.itens.map((it, i) => (
                      <div key={i} className={it.atrasado ? styles.itemAtraso : styles.item}>
                        • {it.prazo ? formatarDataCurta(it.prazo) : 'sem prazo'} · {it.texto}
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
        <button type="button" className={styles.pdf} onClick={baixar} disabled={baixando}>
          <Icon name="baixar" size={18} strokeWidth={2} />
          {baixando ? 'Gerando…' : 'Baixar PDF'}
        </button>
      </div>
    </div>
  );
}
