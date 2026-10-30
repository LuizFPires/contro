import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BLOCOS_FOLHA,
  FORMATOS_PREPARO,
  formatosEmOrdem,
  preparoPorPessoa,
  textoBotaoPreparo,
  textoPreparoWhatsapp,
  totaisPreparo,
  type FormatoPreparo,
  type ItemPreparo,
  type ObraPreparo,
} from '@contro/core';
import { BottomSheet, Icon } from '@contro/ui';
import { formatarDataCompleta, formatarDataCurta } from '../../lib/datas';
import { montarPreparo } from './ataDados';
import { useReuniao } from './useReuniao';
import styles from './PrepararReuniao.module.css';

/**
 * Preparar a reunião (protótipo aprovado em 30/10/2026): a pauta antecipada da
 * próxima reunião, de todas as obras, em até três formatos num PDF só (a tabela
 * em paisagem; a folha e o por pessoa em retrato). Sai pela impressão do
 * aparelho ("Salvar como PDF"); o WhatsApp manda o resumo em texto.
 */
export function PrepararSheet({
  data,
  horaFmt,
  onFechar,
}: {
  data: string;
  horaFmt: string;
  onFechar: () => void;
}) {
  const { query } = useReuniao(data);
  const [marcados, setMarcados] = useState<FormatoPreparo[]>(['tabela']);
  const [imprimindo, setImprimindo] = useState<FormatoPreparo[] | null>(null);
  const obras = useMemo(() => (query.data ? montarPreparo(query.data) : []), [query.data]);
  const dataFmt = formatarDataCurta(data);
  const wa = `https://wa.me/?text=${encodeURIComponent(textoPreparoWhatsapp(dataFmt, horaFmt, obras))}`;

  // Imprime só a pauta (o app some na impressão) e volta ao normal depois.
  useEffect(() => {
    if (!imprimindo) return;
    document.body.classList.add('preparo-imprimindo');
    const fim = () => setImprimindo(null);
    window.addEventListener('afterprint', fim);
    const t = window.setTimeout(() => window.print(), 80);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', fim);
      document.body.classList.remove('preparo-imprimindo');
    };
  }, [imprimindo]);

  const alternar = (f: FormatoPreparo) =>
    setMarcados((m) => (m.includes(f) ? m.filter((x) => x !== f) : [...m, f]));

  return (
    <>
      <BottomSheet open title={`Preparar a reunião de ${dataFmt}`} onClose={onFechar}>
        <p className={styles.dica}>
          Todas as obras · o que vai ser cobrado e perguntado. Marque um, dois ou os três formatos.
        </p>
        <div className={styles.formatos} role="group" aria-label="Formatos do PDF">
          {FORMATOS_PREPARO.map((f) => {
            const on = marcados.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                className={`${styles.formato} ${on ? styles.formatoOn : ''}`}
                onClick={() => alternar(f.id)}
              >
                <span className={styles.formatoTexto}>
                  <b>{f.titulo}</b>
                  <span>{f.desc}</span>
                </span>
                <span className={styles.caixa} aria-hidden="true">
                  {on ? <Icon name="checkGrosso" size={13} strokeWidth={3} /> : null}
                </span>
              </button>
            );
          })}
        </div>
        {query.isLoading ? <p className={styles.dica}>Montando a pauta…</p> : null}
        {query.isError ? (
          <p className={styles.dica}>Não foi possível montar a pauta. Tente de novo.</p>
        ) : null}
        <div className={styles.botoes}>
          <a
            className={`${styles.wa} ${!obras.length ? styles.desligado : ''}`}
            href={obras.length ? wa : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!obras.length}
          >
            <Icon name="whatsapp" size={18} strokeWidth={2} />
            WhatsApp
          </a>
          <button
            type="button"
            className={styles.baixar}
            disabled={!marcados.length || !obras.length}
            onClick={() => setImprimindo(formatosEmOrdem(marcados))}
          >
            <Icon name="baixar" size={18} strokeWidth={2} />
            {textoBotaoPreparo(marcados.length)}
          </button>
        </div>
        {marcados.length > 1 ? (
          <p className={styles.miuda}>
            Sai um PDF só
            {marcados.includes('tabela')
              ? ': a tabela em paisagem e as outras páginas em retrato'
              : ''}
            .
          </p>
        ) : null}
        <p className={styles.miuda}>Na tela de impressão, escolha “Salvar como PDF”.</p>
      </BottomSheet>

      {imprimindo
        ? createPortal(
            <div className={styles.impressao}>
              {imprimindo.map((f) =>
                f === 'tabela' ? (
                  <Tabela key={f} obras={obras} data={data} horaFmt={horaFmt} />
                ) : f === 'folha' ? (
                  <Folha key={f} obras={obras} data={data} horaFmt={horaFmt} />
                ) : (
                  <PorPessoa key={f} obras={obras} data={data} horaFmt={horaFmt} />
                ),
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

interface Props {
  obras: ObraPreparo[];
  data: string;
  horaFmt: string;
}

function Topo({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <div className={styles.topo}>
      <div className={styles.topoTitulo}>{titulo}</div>
      <div className={styles.topoSub}>{sub}</div>
    </div>
  );
}

function Itens({ itens }: { itens: (ItemPreparo & { pessoa?: string })[] }) {
  if (!itens.length) return <span className={styles.cinza}>—</span>;
  return (
    <>
      {itens.map((i, k) => (
        <div key={k} className={i.atraso ? styles.atraso : undefined}>
          {i.texto}
          {i.pessoa ? (
            <>
              {' '}
              — <b>{i.pessoa}</b>
            </>
          ) : null}{' '}
          · {i.prazo}
        </div>
      ))}
    </>
  );
}

/** A · Tabela da pauta (paisagem): uma linha por obra. */
function Tabela({ obras, data, horaFmt }: Props) {
  const t = totaisPreparo(obras);
  return (
    <section className={`${styles.pagina} ${styles.paisagem}`}>
      <div className={styles.topoLinha}>
        <Topo
          titulo={`CONTRO · pauta da reunião de ${formatarDataCompleta(data)} · ${horaFmt}`}
          sub="Para se preparar: o que vai ser cobrado e perguntado em cada obra"
        />
        <div className={styles.totais}>
          <span>
            {t.cobrar} {t.cobrar === 1 ? 'ação' : 'ações'} a cobrar
          </span>
          {t.atrasadas ? (
            <span className={styles.atraso}>
              {t.atrasadas} {t.atrasadas === 1 ? 'atrasada' : 'atrasadas'}
            </span>
          ) : null}
          <span>
            {t.providencias} {t.providencias === 1 ? 'providência' : 'providências'}
          </span>
        </div>
      </div>
      <table className={styles.tabela}>
        <thead>
          <tr>
            <th>Obra</th>
            <th>1 · Cobrança · ações abertas</th>
            <th>2 · Previsto para esta semana · vai perguntar se aconteceu</th>
            <th>3 · Semana que vem · segue o plano ou precisa de ação?</th>
            <th>4 · Providências · contratar, alugar, comprar</th>
          </tr>
        </thead>
        <tbody>
          {obras.map((o) => (
            <tr key={o.nome}>
              <td>
                <b>{o.nome}</b>
                <div className={o.atrasada ? styles.atraso : styles.cinza}>{o.indicador}</div>
              </td>
              <td>
                <Itens itens={o.cobranca} />
              </td>
              <td>
                <Itens itens={o.previstos} />
              </td>
              <td>
                <Itens itens={o.semanaQueVem} />
              </td>
              <td>
                <Itens itens={o.providencias} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.rodape}>Atrasos em vermelho. As colunas seguem os passos da reunião.</p>
    </section>
  );
}

/** B · Folha para preencher (retrato): por obra, colunas fixas e caixinhas alinhadas. */
function Folha({ obras, data, horaFmt }: Props) {
  return (
    <section className={`${styles.pagina} ${styles.retrato}`}>
      <Topo
        titulo={`CONTRO · folha de preparação · reunião de ${formatarDataCurta(data)} · ${horaFmt}`}
        sub="Marque durante a semana; na reunião é só confirmar no app."
      />
      {obras.map((o) => (
        <div key={o.nome} className={styles.obraFolha}>
          <div className={styles.faixa}>
            <span>{o.nome}</span>
            <span>{o.indicador}</span>
          </div>
          <table className={styles.folha}>
            <colgroup>
              <col className={styles.cItem} />
              <col className={styles.cPrazo} />
              <col className={styles.cCaixa} />
              <col className={styles.cCaixa} />
              <col className={styles.cAnot} />
            </colgroup>
            <tbody>
              {BLOCOS_FOLHA.map((b) => {
                const itens: (ItemPreparo & { pessoa?: string })[] = o[b.chave];
                return <FolhaBloco key={b.chave} bloco={b} itens={itens} />;
              })}
            </tbody>
          </table>
          <div className={styles.obs}>
            Observações: ____________________________________________
          </div>
        </div>
      ))}
    </section>
  );
}

function FolhaBloco({
  bloco,
  itens,
}: {
  bloco: (typeof BLOCOS_FOLHA)[number];
  itens: (ItemPreparo & { pessoa?: string })[];
}) {
  return (
    <>
      <tr className={styles.blocoCab}>
        <td colSpan={2}>{bloco.titulo}</td>
        <td>{bloco.sim}</td>
        <td>{bloco.nao}</td>
        <td>{bloco.anotacao}</td>
      </tr>
      {itens.length === 0 ? (
        <tr>
          <td colSpan={5} className={styles.cinza}>
            —
          </td>
        </tr>
      ) : (
        itens.map((i, k) => (
          <tr key={k} className={i.atraso ? styles.atraso : undefined}>
            <td>
              {i.texto}
              {i.pessoa ? ` — ${i.pessoa}` : ''}
            </td>
            <td>{i.prazo}</td>
            <td className={styles.meio}>
              <span className={styles.box} />
            </td>
            <td className={styles.meio}>
              <span className={styles.box} />
            </td>
            <td className={styles.linhaAnot} />
          </tr>
        ))
      )}
    </>
  );
}

/** C · Por pessoa (retrato): o que cada um vai ser cobrado. */
function PorPessoa({ obras, data, horaFmt }: Props) {
  const { pessoas, semDono } = preparoPorPessoa(obras);
  return (
    <section className={`${styles.pagina} ${styles.retrato}`}>
      <Topo
        titulo={`CONTRO · quem prepara o quê · reunião de ${formatarDataCurta(data)} · ${horaFmt}`}
        sub="O que cada pessoa vai ser cobrada e o que precisa de dono na reunião."
      />
      {pessoas.map((p) => {
        const atr = p.itens.filter((i) => i.atraso).length;
        return (
          <div key={p.pessoa} className={styles.pessoa}>
            <div className={styles.pessoaNome}>
              {p.pessoa} · {p.itens.length} {p.itens.length === 1 ? 'ação' : 'ações'}
              {atr ? ` · ${atr} ${atr === 1 ? 'atrasada' : 'atrasadas'}` : ''}
            </div>
            {p.itens.map((i, k) => (
              <div key={k} className={i.atraso ? styles.atraso : undefined}>
                <span className={styles.box} /> {i.texto} · {i.prazo}
              </div>
            ))}
          </div>
        );
      })}
      {semDono.length ? (
        <div className={styles.pessoa}>
          <div className={styles.pessoaNome}>Providências · decidir quem cuida na reunião</div>
          {semDono.map((i, k) => (
            <div key={k} className={i.atraso ? styles.atraso : undefined}>
              <span className={styles.box} /> {i.texto} · {i.prazo}
            </div>
          ))}
        </div>
      ) : null}
      {!pessoas.length && !semDono.length ? (
        <p className={styles.cinza}>Nenhuma ação aberta para cobrar.</p>
      ) : null}
    </section>
  );
}
