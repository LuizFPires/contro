import { useMemo, useState } from 'react';
import { formatarNumero, rotuloDia, textoDiasUteis } from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import { formatarDataCompleta } from '../../lib/datas';
import { baixarArquivo } from '../obras/quantitativoObra';
import { hojeISO } from '../obras/api';
import { CurvaAvanco } from './CurvaAvanco';
import { geometriaCurva } from './geometria';
import { useAvancoFisico, type AtividadeRelatorio, type ObraRelatorio } from './api';
import { pdfAvancoFisico } from './pdfAvancoFisico';
import styles from './RelatorioAvancoFisico.module.css';

type Filtro = 'todas' | 'criticas' | 'atrasadas';

const atrasada = (a: AtividadeRelatorio) => a.estado === 'andamento' && a.situacao.tom === 'atraso';

/** Relatório de avanço físico (protótipo aprovado em 16/11/2026), aberto pelo menu de perfil. */
export function RelatorioAvancoFisico({
  onVoltar,
  onAbrirAtividade,
}: {
  onVoltar: () => void;
  onAbrirAtividade: (obraId: string, atividadeId: string) => void;
}) {
  const { data, isLoading, isError } = useAvancoFisico();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [gerando, setGerando] = useState(false);
  const { showToast } = useToast();
  const hoje = hojeISO();
  const obras = useMemo(() => data ?? [], [data]);

  const todas = obras.flatMap((o) => o.atividades);
  const nCriticas = todas.filter((a) => a.impactoDu > 0).length;
  const nAtrasadas = todas.filter(atrasada).length;

  const visiveis = useMemo(
    () =>
      obras
        .map((o) => ({
          ...o,
          atividades: o.atividades.filter((a) =>
            filtro === 'criticas' ? a.impactoDu > 0 : filtro === 'atrasadas' ? atrasada(a) : true,
          ),
        }))
        .filter((o) => o.atividades.length),
    [obras, filtro],
  );

  const baixar = async () => {
    if (!obras.length || gerando) return;
    setGerando(true);
    try {
      const blob = await pdfAvancoFisico(obras, hoje);
      baixarArquivo(blob, `avanco-fisico-${hoje}.pdf`);
    } catch {
      showToast({ message: 'Não foi possível gerar o PDF. Tente de novo.' });
    } finally {
      setGerando(false);
    }
  };

  const filtros: { k: Filtro; l: string }[] = [
    { k: 'todas', l: `Todas (${todas.length})` },
    { k: 'criticas', l: `Atrasam a inauguração (${nCriticas})` },
    { k: 'atrasadas', l: `Atrasadas (${nAtrasadas})` },
  ];

  return (
    <div className={styles.tela}>
      <header className={styles.cabecalho}>
        <div className={styles.linhaTopo}>
          <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
            <Icon name="chevronLeft" size={22} />
          </button>
          <div className={styles.titulos}>
            <h1>Avanço físico</h1>
            <span>Obras em andamento · {rotuloDia(hoje)}</span>
          </div>
          <button
            type="button"
            className={styles.pdf}
            onClick={() => void baixar()}
            disabled={!obras.length || gerando}
          >
            <Icon name="baixar" size={18} />
            {gerando ? 'Gerando…' : 'Baixar PDF'}
          </button>
        </div>
        <div className={styles.resumo}>
          <div>
            <b>{obras.length}</b>
            <span>{obras.length === 1 ? 'obra' : 'obras'}</span>
          </div>
          <div>
            <b>{todas.length}</b>
            <span>atividades medidas</span>
          </div>
          <div className={nCriticas ? styles.resumoCritico : undefined}>
            <b>{nCriticas}</b>
            <span>atrasam a inauguração</span>
          </div>
        </div>
      </header>

      {obras.length ? (
        <div className={styles.filtros} role="tablist" aria-label="Filtrar atividades">
          {filtros.map((f) => (
            <button
              key={f.k}
              type="button"
              role="tab"
              aria-selected={filtro === f.k}
              className={filtro === f.k ? styles.filtroOn : styles.filtro}
              onClick={() => setFiltro(f.k)}
            >
              {f.l}
            </button>
          ))}
        </div>
      ) : null}

      <main className={styles.lista}>
        {isLoading ? (
          <p className={styles.vazio}>Carregando…</p>
        ) : isError ? (
          <p className={styles.vazio} role="alert">
            Não foi possível carregar o relatório.
          </p>
        ) : !obras.length ? (
          <div className={styles.vazio}>
            <Icon name="curva" size={40} />
            <h2>Nenhuma obra com quantitativo</h2>
            <p>
              O relatório mostra as obras em andamento com alguma atividade com quantitativo. Abra a
              ficha de uma atividade e toque em “+ Quantitativo”.
            </p>
          </div>
        ) : !visiveis.length ? (
          <p className={styles.vazio}>Nenhuma atividade neste filtro.</p>
        ) : (
          visiveis.map((o) => (
            <BlocoObra key={o.id} obra={o} onAbrir={(id) => onAbrirAtividade(o.id, id)} />
          ))
        )}
        {obras.length ? (
          <p className={styles.nota}>
            Entram só as obras em andamento com pelo menos uma atividade com quantitativo. Ritmo
            atual = medido ÷ dias úteis desde o início. A projeção refaz o cronograma da obra com o
            término previsto dessas atividades; o atraso na inauguração já desconta a folga de cada
            uma.
          </p>
        ) : null}
      </main>
    </div>
  );
}

function BlocoObra({
  obra,
  onAbrir,
}: {
  obra: ObraRelatorio;
  onAbrir: (atividadeId: string) => void;
}) {
  const n = obra.atividades.length;
  return (
    <section className={styles.obra} aria-label={obra.nome}>
      <div className={styles.obraTopo}>
        <h2>{obra.nome}</h2>
        <span>{n} com quantitativo</span>
      </div>
      <p className={styles.obraInaug}>
        Inauguração planejada <b>{formatarDataCompleta(obra.entregaOriginal)}</b>
      </p>
      {obra.impactoDu > 0 ? (
        <p className={styles.faixaAtraso}>
          <Icon name="alert" size={18} />
          <span>
            No ritmo atual, a inauguração passa para {formatarDataCompleta(obra.entregaNoRitmo)} (+
            {textoDiasUteis(obra.atrasoNoRitmoDu)})
          </span>
        </p>
      ) : (
        <p className={styles.faixaOk}>
          <Icon name="checkGrosso" size={18} />
          <span>No ritmo atual, as medições não mexem na inauguração</span>
        </p>
      )}
      {obra.atividades.map((a) => (
        <CardAtividade key={a.id} a={a} onAbrir={() => onAbrir(a.id)} />
      ))}
    </section>
  );
}

function CardAtividade({ a, onAbrir }: { a: AtividadeRelatorio; onAbrir: () => void }) {
  const critica = a.impactoDu > 0;
  const un = a.unidade;
  const st =
    a.estado === 'concluida'
      ? { t: 'Concluída', c: styles.stOk, i: 'checkGrosso' as const }
      : a.estado === 'sem_medicao'
        ? { t: 'Sem medição', c: styles.stNeutro, i: 'calendario' as const }
        : a.situacao.tom === 'atraso'
          ? {
              t: `Atrasada ${formatarNumero(-a.situacao.diferenca)} ${un}`,
              c: styles.stAtraso,
              i: 'relogio' as const,
            }
          : a.situacao.diferenca > a.total * 0.01
            ? {
                t: `Adiantada ${formatarNumero(a.situacao.diferenca)} ${un}`,
                c: styles.stOk,
                i: 'seta' as const,
              }
            : { t: 'Em dia', c: styles.stOk, i: 'checkGrosso' as const };
  const fimTxt =
    a.estado === 'concluida'
      ? 'Concluída'
      : a.estado === 'sem_medicao' || !a.fimProjetado
        ? `prazo ${rotuloDia(a.fimPlanejado)}`
        : `${rotuloDia(a.fimProjetado)}${
            a.atrasoDu
              ? ` · +${textoDiasUteis(a.atrasoDu)}`
              : a.adiantaDu
                ? ` · ${textoDiasUteis(a.adiantaDu)} antes`
                : ' · no prazo'
          }`;
  // Posição do tip vermelho: acima do ponto de término projetado.
  const g = geometriaCurva(a.curva);
  const tipDir = g.projecao ? Math.max(0, 100 - (g.projecao[1][0] / 320) * 100 - 3) : 0;
  return (
    <button type="button" className={critica ? styles.cardCritico : styles.card} onClick={onAbrir}>
      <div className={styles.cardTopo}>
        <span className={styles.cardNome}>
          <b>{a.nome}</b>
          <span>
            {a.fase ? `Fase ${a.fase}` : ''}
            {a.prestador ? ` · ${a.prestador}` : ''}
          </span>
        </span>
        <span className={`${styles.st} ${st.c}`}>
          <Icon name={st.i} size={13} />
          {st.t}
        </span>
      </div>
      <p className={styles.numeros}>
        <b>
          {formatarNumero(a.real)} {un}
        </b>{' '}
        de {formatarNumero(a.total)} {un} · {a.pct}%
      </p>
      <div className={styles.grafico}>
        <CurvaAvanco
          curva={a.curva}
          unidade={un}
          prazo={a.fimPlanejado}
          atrasada={a.atrasoDu > 0}
          rotulo={`Curva de ${a.nome}: ${formatarNumero(a.real)} de ${formatarNumero(a.total)} ${un}${
            a.fimProjetado ? `, término previsto ${rotuloDia(a.fimProjetado)}` : ''
          }`}
        />
        {critica ? (
          <span className={styles.tip} style={{ right: `${tipDir}%` }}>
            Atrasa a inauguração em {textoDiasUteis(a.impactoDu)}
          </span>
        ) : null}
      </div>
      <div className={styles.legenda} aria-hidden="true">
        <span>
          <i className={styles.legPlano} />
          Planejado
        </span>
        <span>
          <i className={styles.legMedido} />
          Medido
        </span>
        <span>
          <i className={a.atrasoDu ? styles.legProjAtraso : styles.legProj} />
          Projeção no ritmo atual
        </span>
      </div>
      <div className={styles.metricas}>
        <div>
          <span>Ritmo · meta</span>
          <b>
            {a.ritmo !== null ? formatarNumero(a.ritmo, 1) : '—'} · {formatarNumero(a.meta, 1)} {un}
            /dia
          </b>
        </div>
        <div>
          <span>Término previsto</span>
          <b className={a.atrasoDu ? styles.vermelho : undefined}>{fimTxt}</b>
        </div>
      </div>
      {critica && a.fimProjetado && a.ritmo !== null ? (
        <p className={styles.alerta}>
          <Icon name="alert" size={16} />
          <span>
            No ritmo de {formatarNumero(a.ritmo, 1)} {un}/dia termina {rotuloDia(a.fimProjetado)},{' '}
            {textoDiasUteis(a.atrasoDu)} depois do prazo, e empurra a inauguração em{' '}
            {textoDiasUteis(a.impactoDu)}.
            {a.precisaPorDia !== null
              ? ` Para não atrasar: ${formatarNumero(a.precisaPorDia, 1)} ${un}/dia.`
              : ''}
          </span>
        </p>
      ) : a.estado === 'andamento' && a.atrasoDu > 0 ? (
        <p className={styles.nota2}>
          <Icon name="info" size={16} />
          <span>
            Termina {textoDiasUteis(a.atrasoDu)} depois do prazo, mas dentro da folga: a inauguração
            não muda.
          </span>
        </p>
      ) : a.estado === 'sem_medicao' ? (
        <p className={styles.nota2}>
          <Icon name="info" size={16} />
          <span>Ainda sem medição: a curva mostra só o planejado.</span>
        </p>
      ) : null}
    </button>
  );
}
