import { useEffect, useMemo, useState } from 'react';
import {
  classificarPendencias,
  diasUteisRestantes,
  previsaoEntrega,
  ritmoTexto,
  type FaseTrilha,
} from '@contro/core';
import { Icon, useToast, type IconName } from '@contro/ui';
import { formatarDataCompleta, formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import { BoletimView } from './BoletimView';
import { fixarEntregaOriginal } from './campo';
import { CelebracaoFase, type CelebracaoFaseDados } from './CelebracaoFase';
import { FichaAtividade } from './FichaAtividade';
import { GanttAba } from './GanttAba';
import { PendenciasAba } from './PendenciasAba';
import { PlanoRecuperacao } from './PlanoRecuperacao';
import { ProvidenciasAba } from './ProvidenciasAba';
import { classificarProvidencias } from './providenciasObra';
import { entradaRecuperacao } from './recuperacaoObra';
import { useObraDetalhe } from './useObraDetalhe';
import type { AoConcluir } from './useConcluirAtividade';
import { useObraCampo } from './useObraCampo';
import { useObraPendencias } from './useObraPendencias';
import { montarTrilha } from './trilhaObra';
import styles from './ObraDetalhe.module.css';

type AbaObra = 'fases' | 'pendencias' | 'providencias' | 'cronograma' | 'boletim';

const ABAS: { key: Exclude<AbaObra, 'boletim'>; label: string; icon: IconName }[] = [
  { key: 'fases', label: 'Fases', icon: 'fases' },
  { key: 'pendencias', label: 'Pendências', icon: 'pendencias' },
  { key: 'providencias', label: 'Providências', icon: 'providencias' },
  { key: 'cronograma', label: 'Cronograma', icon: 'cronograma' },
];

export function ObraDetalhe({
  id,
  onVoltar,
  abrirBoletim,
  abrirPlano,
}: {
  id: string;
  onVoltar: () => void;
  abrirBoletim?: boolean;
  /** Abre direto no plano de recuperação (atalho da aba Hoje). */
  abrirPlano?: boolean;
}) {
  const { data: obra, isLoading } = useObraDetalhe(id);
  const pendencias = useObraPendencias(id);
  const { showToast } = useToast();
  const campo = useObraCampo(id);
  const [faseAberta, setFaseAberta] = useState<string | null>(null);
  const [fichaAtvId, setFichaAtvId] = useState<string | null>(null);
  // O boletim abre dentro da obra (protótipo), pelo ícone do cabeçalho.
  const [aba, setAba] = useState<AbaObra>(abrirBoletim ? 'boletim' : 'fases');
  const [celebra, setCelebra] = useState<CelebracaoFaseDados | null>(null);
  const [planoAberto, setPlanoAberto] = useState(Boolean(abrirPlano));

  const fases = useMemo(() => (obra ? montarTrilha(obra) : []), [obra]);

  const provAtrasadas = useMemo(
    () => (obra ? classificarProvidencias(obra, hojeISO()).atrasadas.length : 0),
    [obra],
  );
  const pendAbertas = useMemo(
    () => classificarPendencias(pendencias.query.data ?? [], hojeISO()).fila.length,
    [pendencias.query.data],
  );

  // Inauguração prevista (atrasadas terminam hoje) x a planejada, fixada na obra.
  const previsao = useMemo(
    () => (obra ? previsaoEntrega(entradaRecuperacao(obra, hojeISO())) : null),
    [obra],
  );
  // Primeira abertura: guarda a inauguração planejada (base do plano de recuperação).
  const original = obra && !obra.entrega_original ? previsao?.entregaOriginal : null;
  useEffect(() => {
    if (obra && original) void fixarEntregaOriginal(obra.id, original).catch(() => undefined);
  }, [obra, original]);

  if (isLoading || !obra) {
    return (
      <div className={styles.screen}>
        <header className={styles.cabecalho}>
          <div className={styles.topo}>
            <button
              type="button"
              className={styles.voltar}
              aria-label="Voltar para obras"
              onClick={onVoltar}
            >
              <Icon name="chevronLeft" size={22} />
            </button>
            <span className={styles.sub}>Carregando…</span>
          </div>
        </header>
      </div>
    );
  }

  // Concluída (com ou sem foto): celebra se fechou a fase; senão, avisa o que
  // liberou, com Desfazer (regra 10).
  const aoConcluir: AoConcluir = (r, det) => {
    setFichaAtvId(null);
    const desfazer = () => campo.desfazer.mutate({ atividadeId: det.atividadeId, xp: r.xp });
    if (r.fase_fechada) {
      setCelebra({
        ordem: det.faseOrdem ?? 0,
        titulo: det.faseTitulo,
        xp: r.xp,
        libera: det.libera,
        proxOrdem: det.proxOrdem,
      });
    } else if (det.libera.length) {
      showToast({
        message: `"${det.nome}" concluída · liberou ${det.libera.join(', ')}`,
        onUndo: desfazer,
      });
    } else {
      showToast({ message: `"${det.nome}" concluída · +${r.xp} XP`, onUndo: desfazer });
    }
  };

  if (planoAberto) {
    return <PlanoRecuperacao obra={obra} onVoltar={() => setPlanoAberto(false)} />;
  }

  const pct = Math.round(obra.pct * 100);
  // Fase aberta: a escolhida, senão a atual (como no protótipo).
  const atual = fases.find((f) => f.status === 'execucao');
  const aberta = faseAberta ?? atual?.id ?? null;
  const nFasesConcl = fases.filter((f) => f.status === 'concluida').length;

  const ritmo = ritmoTexto(obra.ritmoDias);
  const restantes = diasUteisRestantes(obra.decorridos, obra.dia.m);
  const inaugSub =
    (restantes > 0 ? `Faltam ${restantes} dias úteis` : 'Prazo do modelo encerrado') +
    (ritmo.atrasada ? ` · ${ritmo.texto}` : '');

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.topo}>
          <button
            type="button"
            className={styles.voltar}
            aria-label="Voltar para obras"
            onClick={onVoltar}
          >
            <Icon name="chevronLeft" size={22} />
          </button>
          <div className={styles.titulo}>
            <h1 className={styles.nome}>{obra.nome}</h1>
            <div className={styles.sub}>
              Dia {obra.dia.n} de {obra.dia.m} do modelo
            </div>
          </div>
          <div className={styles.pct}>
            {pct}
            <span>%</span>
          </div>
          <button
            type="button"
            className={`${styles.iconeBtn} ${aba === 'boletim' ? styles.iconeAtivo : ''}`}
            aria-label="Boletim da semana"
            aria-pressed={aba === 'boletim'}
            title="Boletim da semana"
            onClick={() => setAba(aba === 'boletim' ? 'fases' : 'boletim')}
          >
            <Icon name="documento" size={20} />
          </button>
        </div>
        <div
          className={styles.barra}
          role="progressbar"
          aria-label="Avanço da obra"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={styles.barraFill} style={{ width: `${pct}%` }} />
        </div>
      </header>

      <div className={styles.conteudo}>
        {aba === 'fases' ? (
          <div className={styles.mapa}>
            {previsao && previsao.atrasoDu > 0 ? (
              <div className={styles.risco}>
                <span className={styles.riscoIcone} aria-hidden="true">
                  <Icon name="relogio" size={18} strokeWidth={2.4} />
                </span>
                <span className={styles.riscoTexto}>
                  <b className={styles.riscoTitulo}>Inauguração em risco</b>
                  <span>
                    <s>{formatarDataCurta(previsao.entregaOriginal)}</s> →{' '}
                    <b className={styles.riscoData}>
                      {formatarDataCurta(previsao.entregaPrevista)} (+{previsao.atrasoDu} d.u.)
                    </b>
                  </span>
                </span>
                <button
                  type="button"
                  className={styles.riscoBtn}
                  onClick={() => setPlanoAberto(true)}
                >
                  Ver plano
                </button>
              </div>
            ) : null}
            {fases.map((f) => (
              <Fase
                key={f.id}
                fase={f}
                aberta={aberta === f.id}
                onToggle={() => setFaseAberta(aberta === f.id ? '' : f.id)}
                onAbrir={setFichaAtvId}
              />
            ))}

            <div className={styles.selos}>
              <span className={styles.selo}>
                {nFasesConcl} de {fases.length} fases
              </span>
            </div>

            <div className={styles.inauguracao}>
              <div className={styles.inaugIcone}>
                <Icon name="bandeira" size={22} />
              </div>
              <div className={styles.inaugTexto}>
                <div className={styles.inaugRotulo}>Inauguração</div>
                <div className={styles.inaugData}>{formatarDataCompleta(obra.entrega)}</div>
                <div className={ritmo.atrasada ? styles.inaugAtraso : styles.inaugSub}>
                  {inaugSub}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {aba === 'pendencias' ? <PendenciasAba obra={obra} /> : null}
        {aba === 'providencias' ? <ProvidenciasAba obra={obra} /> : null}
        {aba === 'cronograma' ? <GanttAba obra={obra} onAbrir={setFichaAtvId} /> : null}
        {aba === 'boletim' ? <BoletimView obra={obra} /> : null}
      </div>

      <nav className={styles.nav} aria-label="Seções da obra">
        {ABAS.map((t) => {
          const badge =
            t.key === 'pendencias' && pendAbertas > 0 ? (
              <span className={styles.badge}>{pendAbertas}</span>
            ) : t.key === 'providencias' && provAtrasadas > 0 ? (
              <span className={`${styles.badge} ${styles.badgeAtraso}`}>
                <span className="sr-only">atrasadas: </span>
                {provAtrasadas}
              </span>
            ) : null;
          return (
            <button
              key={t.key}
              type="button"
              className={`${styles.navBtn} ${aba === t.key ? styles.navAtivo : ''}`}
              aria-current={aba === t.key ? 'page' : undefined}
              onClick={() => setAba(t.key)}
            >
              <Icon name={t.icon} size={22} />
              {t.label}
              {badge}
            </button>
          );
        })}
      </nav>

      <FichaAtividade
        obra={obra}
        atividadeId={fichaAtvId}
        onClose={() => setFichaAtvId(null)}
        onConcluida={aoConcluir}
      />

      {celebra ? <CelebracaoFase dados={celebra} onFechar={() => setCelebra(null)} /> : null}
    </div>
  );
}

function Fase({
  fase: f,
  aberta,
  onToggle,
  onAbrir,
}: {
  fase: FaseTrilha;
  aberta: boolean;
  onToggle: () => void;
  onAbrir: (id: string) => void;
}) {
  const noClasse =
    f.status === 'concluida'
      ? styles.noConcluida
      : f.atrasadas > 0
        ? f.status === 'execucao'
          ? `${styles.noAtual} ${styles.noAtraso} ${styles.anelAtraso}`
          : styles.noAtraso
        : f.status === 'execucao'
          ? styles.noAtual
          : styles.noPlanejada;
  return (
    <div className={styles.fase}>
      <div className={styles.trilho}>
        <div className={`${styles.no} ${noClasse}`}>
          {f.status === 'concluida' ? (
            <Icon name="checkGrosso" size={20} strokeWidth={2.6} />
          ) : (
            <span>{f.n}</span>
          )}
        </div>
        <div className={`${styles.linha} ${f.status === 'concluida' ? styles.linhaFeita : ''}`} />
      </div>
      <div className={styles.faseCorpo}>
        <button type="button" className={styles.faseBtn} aria-expanded={aberta} onClick={onToggle}>
          <span className={styles.etiquetas}>
            <span className={`${styles.etiqueta} ${styles[`et_${f.status}`]}`}>
              Fase {f.n} · {f.rotulo}
            </span>
            {f.atrasadas > 0 ? (
              <span className={`${styles.etiqueta} ${styles.etAtraso}`}>{f.atrasoTxt}</span>
            ) : null}
          </span>
          <span className={styles.faseLinha}>
            <span className={styles.faseTitulo}>{f.titulo}</span>
            <span className={styles.faseProg}>
              {f.concluidas}/{f.total}
            </span>
          </span>
          <span className={styles.faseInfo}>{f.info}</span>
        </button>
        {aberta ? (
          <div className={styles.atividades}>
            {f.atividades.map((a) => (
              <div key={a.id} className={`${styles.atv} ${styles[`atv_${a.status}`]}`}>
                <div className={styles.atvIcone}>
                  {a.status === 'concluida' ? (
                    <Icon name="checkGrosso" size={16} strokeWidth={2.6} />
                  ) : a.status === 'atrasada' ? (
                    <Icon name="relogio" size={16} strokeWidth={2.2} />
                  ) : (
                    <Icon name="seta" size={16} strokeWidth={2.2} />
                  )}
                </div>
                <button type="button" className={styles.atvTexto} onClick={() => onAbrir(a.id)}>
                  <span className={styles.atvNome}>{a.nome}</span>
                  <span className={styles.atvSub}>{a.sub}</span>
                  {a.prestador ? (
                    <span className={styles.prestador}>
                      <Icon name="pessoa" size={12} strokeWidth={2.2} />
                      {a.prestador}
                    </span>
                  ) : null}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
