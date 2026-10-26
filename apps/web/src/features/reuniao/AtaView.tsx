import { useState } from 'react';
import {
  compilarPorPessoa,
  derivarAtribuicoes,
  origemReuniao,
  resumoReuniao,
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
  const resumo = resumoReuniao(
    reuniao.tarefas.map((t) => ({
      origem: t.origem,
      concluida: t.concluido,
      atrasada: t.atrasado,
    })),
    origemAtual,
  );
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
            Segunda {formatarDataCurta(reuniao.data).split(' ')[1]}/{reuniao.data.slice(0, 4)} · 16h
          </div>
        </div>
      </header>

      <div className={styles.fundo}>
        <article className={styles.folha}>
          <div className={styles.folhaTopo}>
            <div className={styles.folhaTitulo}>CONTRO · ata da reunião semanal de obras</div>
            <div className={styles.folhaData}>{dataFmt} · 16h</div>
          </div>

          <div className={styles.kpis}>
            <div>
              <strong>{resumo.cumpridas}</strong>
              <span>cumpridas</span>
            </div>
            <div className={resumo.atrasadas ? styles.kpiAtraso : ''}>
              <strong>{resumo.atrasadas}</strong>
              <span>atrasadas</span>
            </div>
            <div className={styles.kpiNovas}>
              <strong>{resumo.novas}</strong>
              <span>novas</span>
            </div>
          </div>

          {reuniao.obras.map((o) => {
            const ritmo = ritmoTexto(o.ritmoDias, true);
            const naoFeitas = [...o.passadaConcluir, ...o.passadaComecar].filter((p) => !p.ok);
            const passadaTotal = o.passadaConcluir.length + o.passadaComecar.length;
            const novas = reuniao.tarefas.filter(
              (t) => t.obraId === o.obraId && t.origem === origemAtual,
            );
            return (
              <section key={o.obraId} className={styles.obra}>
                <div className={styles.obraTopo}>
                  <span>{o.nome}</span>
                  <span className={ritmo.atrasada ? styles.txtAtraso : styles.ritmo}>
                    {ritmo.texto}
                  </span>
                </div>
                <div className={styles.situacao}>
                  Real {Math.round(o.pct * 100)}% · previsto sexta{' '}
                  {Math.round(o.previstoSexta * 100)}% · {o.faseAtual} · entrega{' '}
                  {formatarDataCurta(o.entrega)}
                </div>
                <div className={naoFeitas.length ? styles.txtAtraso : styles.situacao}>
                  {passadaTotal === 0
                    ? 'Semana passada: nada previsto.'
                    : naoFeitas.length
                      ? `Semana passada: ${passadaTotal - naoFeitas.length} de ${passadaTotal} no prazo · não feitas: ${naoFeitas.map((p) => p.nome).join(', ')}`
                      : `Semana passada: tudo o que estava previsto foi feito (${passadaTotal}).`}
                </div>
                {o.atividadesAtrasadas.length ? (
                  <div className={styles.txtAtraso}>
                    Atrasos: {o.atividadesAtrasadas.map((a) => a.nome).join(', ')}
                  </div>
                ) : null}
                <div className={styles.linha}>
                  <b>Observações:</b> {o.observacoes.trim() || 'sem observações.'}
                </div>
                {novas.map((t) => (
                  <div
                    key={t.id}
                    className={`${styles.prov} ${t.atrasado ? styles.provAtraso : ''}`}
                  >
                    {t.texto} — <b>{t.pessoa}</b>, até {t.prazo ? formatarDataCurta(t.prazo) : '—'}
                  </div>
                ))}
              </section>
            );
          })}

          {porPessoa.length > 0 ? (
            <div className={styles.pessoas}>
              <div className={styles.pessoasTitulo}>Providências por responsável</div>
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
