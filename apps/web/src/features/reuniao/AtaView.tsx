import { ritmoTexto, textoAtaWhatsapp, type ObraAta } from '@obdc/core';
import { Icon } from '@obdc/ui';
import { formatarDataCompleta, formatarDataCurta } from '../../lib/datas';
import type { ReuniaoCompleta } from './reuniaoApi';
import styles from './AtaView.module.css';

const TIPO: Record<string, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};

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

  return (
    <div className={styles.screen}>
      <div className={styles.barra}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronRight" size={22} />
        </button>
        <span className={styles.barraTitulo}>Ata</span>
        <div className={styles.acoes}>
          <a className={styles.wa} href={wa} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <button type="button" className={styles.print} onClick={() => window.print()}>
            Imprimir / PDF
          </button>
        </div>
      </div>

      <article className={styles.ata}>
        <header className={styles.cabecalho}>
          <h1>CONTRO · Ata da semana</h1>
          <p>{dataFmt} · 16h</p>
          <p className={styles.kpi}>
            {reuniao.obras.length} obras ·{' '}
            {reuniao.obras.reduce((s, o) => s + o.providenciar.length, 0)} a providenciar ·{' '}
            {reuniao.obras.reduce((s, o) => s + o.providenciasAtrasadas.length, 0)} atrasadas
          </p>
        </header>

        {reuniao.obras.map((o) => (
          <section key={o.obraId} className={styles.obra}>
            <div className={styles.faixa}>{o.nome}</div>
            <p className={styles.ind}>
              {Math.round(o.pct * 100)}% · {ritmoTexto(o.ritmoDias).texto} · entrega{' '}
              {formatarDataCurta(o.entrega)}
            </p>

            {o.atividadesAtrasadas.length > 0 ? (
              <Bloco titulo="Atrasos" atraso>
                {o.atividadesAtrasadas.map((a, i) => (
                  <li key={i}>
                    {a.nome} <em>(era {formatarDataCurta(a.data)})</em>
                  </li>
                ))}
              </Bloco>
            ) : null}

            {o.passadaConcluir.length + o.passadaComecar.length > 0 ? (
              <Bloco titulo="Semana passada">
                {o.passadaConcluir.map((p, i) => (
                  <li key={`c${i}`}>
                    {p.nome} — {p.ok ? 'concluída' : `não (${p.motivo ?? '—'})`}
                  </li>
                ))}
                {o.passadaComecar.map((p, i) => (
                  <li key={`b${i}`}>
                    {p.nome} — {p.ok ? 'começou' : `não (${p.motivo ?? '—'})`}
                  </li>
                ))}
              </Bloco>
            ) : null}

            <Bloco titulo="Esta semana">
              {o.concluir.map((a, i) => (
                <li key={`cc${i}`}>Concluir: {a.nome}</li>
              ))}
              {o.comecar.map((a, i) => (
                <li key={`bb${i}`}>Começar: {a.nome}</li>
              ))}
              {o.providenciar.map((p, i) => (
                <li key={`pp${i}`}>
                  {TIPO[p.tipo]}: {p.descricao}
                  {p.naObraEm ? ` (na obra ${formatarDataCurta(p.naObraEm)})` : ''}
                </li>
              ))}
              {o.concluir.length + o.comecar.length + o.providenciar.length === 0 ? (
                <li className={styles.nada}>Nada previsto.</li>
              ) : null}
            </Bloco>

            {o.observacoes.trim() ? (
              <p className={styles.obs}>
                <strong>Observações:</strong> {o.observacoes}
              </p>
            ) : null}
          </section>
        ))}
        <footer className={styles.rodape}>Gerada em {formatarDataCompleta(reuniao.data)}</footer>
      </article>
    </div>
  );
}

function Bloco({
  titulo,
  atraso,
  children,
}: {
  titulo: string;
  atraso?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.bloco}>
      <p className={`${styles.blocoTitulo} ${atraso ? styles.atraso : ''}`}>{titulo}</p>
      <ul>{children}</ul>
    </div>
  );
}
