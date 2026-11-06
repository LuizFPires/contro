import { useState } from 'react';
import { textoBoletimWhatsapp, type BoletimDados } from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import { pdfServiceConfigurado } from '../../lib/env';
import { baixarPdf } from '../../lib/pdf';
import { hojeISO } from './api';
import styles from './BoletimView.module.css';

/** Boletim da semana já calculado (Contorno e obras gerais): ações, indicadores e prévia. */
export function BoletimTela({ dados }: { dados: BoletimDados }) {
  const texto = textoBoletimWhatsapp(dados, hojeISO());
  const wa = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  const { showToast } = useToast();
  const [baixando, setBaixando] = useState(false);

  // Com o pdf-service configurado, baixa o PDF real; senão, imprime pelo navegador.
  async function baixar() {
    if (!pdfServiceConfigurado) {
      window.print();
      return;
    }
    setBaixando(true);
    try {
      await baixarPdf('boletim', dados, `boletim-${dados.obra}.pdf`);
    } catch {
      showToast({ message: 'Não foi possível gerar o PDF. Abrindo a impressão.' });
      window.print();
    } finally {
      setBaixando(false);
    }
  }

  const iniciais = (nome: string) =>
    nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');

  return (
    <div className={styles.boletim}>
      <div>
        <h2 className={styles.titulo}>Boletim da semana</h2>
        <div className={styles.periodo}>{dados.semanaFmt}</div>
      </div>

      <div className={styles.acoes}>
        <a className={styles.wa} href={wa} target="_blank" rel="noreferrer">
          <Icon name="whatsapp" size={18} strokeWidth={2} />
          WhatsApp
        </a>
        <button type="button" className={styles.pdf} onClick={baixar} disabled={baixando}>
          <Icon name="baixar" size={18} strokeWidth={2} />
          {baixando ? 'Gerando…' : 'Baixar PDF'}
        </button>
      </div>

      <div className={styles.ind}>
        Real {Math.round(dados.realPct * 100)}% · previsto até sexta{' '}
        {Math.round(dados.previstoSextaPct * 100)}% ·{' '}
        <span className={dados.ritmoAtrasado ? styles.indAtraso : ''}>{dados.ritmoTexto}</span>
      </div>

      {dados.atrasos.length > 0 ? (
        <div className={styles.atencao}>
          <div className={styles.atencaoTopo}>
            <Icon name="alert" size={18} strokeWidth={2.2} />
            Atenção · {dados.atrasos.length} em atraso
          </div>
          <div className={styles.atencaoLista}>
            {dados.atrasos.map((a, i) => (
              <div key={i} className={styles.atencaoItem}>
                {a}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {dados.quemFazOQue.length > 0 ? (
        <div className={styles.cartao}>
          <div className={styles.cartaoTitulo}>Quem faz o quê nesta semana</div>
          {dados.quemFazOQue.map((g) => (
            <div key={g.pessoa} className={styles.pessoa}>
              <div className={styles.pessoaTopo}>
                <span className={styles.avatar} aria-hidden="true">
                  {iniciais(g.pessoa)}
                </span>
                <b>{g.pessoa}</b>
              </div>
              {g.itens.map((it, i) => (
                <div key={i} className={styles.tarefa}>
                  <span className={styles.quando}>{it.dataFmt ?? ''}</span>
                  <span>{it.texto}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div className={`${styles.cartao} ${styles.previaCartao}`}>
        <div className={styles.rotulo}>Prévia da mensagem no WhatsApp</div>
        <div className={styles.previa}>{texto}</div>
      </div>
    </div>
  );
}
