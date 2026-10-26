import { useMemo, useState } from 'react';
import {
  classificarPendencias,
  diasUteisRestantes,
  ritmoTexto,
  trilhaDeFases,
  type FaseTrilha,
} from '@contro/core';
import { Icon, useToast, type IconName } from '@contro/ui';
import { formatarDataCompleta } from '../../lib/datas';
import { hojeISO } from './api';
import { BoletimView } from './BoletimView';
import { CelebracaoFase, type CelebracaoFaseDados } from './CelebracaoFase';
import { FichaAtividade } from './FichaAtividade';
import { GanttAba } from './GanttAba';
import { PendenciasAba } from './PendenciasAba';
import { ProvidenciasAba } from './ProvidenciasAba';
import { classificarProvidencias } from './providenciasObra';
import { useObraDetalhe } from './useObraDetalhe';
import { useObraPendencias } from './useObraPendencias';
import type { ObraCompleta } from './detalhe';
import styles from './ObraDetalhe.module.css';

type AbaObra = 'fases' | 'pendencias' | 'providencias' | 'cronograma';

const ABAS: { key: AbaObra; label: string; icon: IconName }[] = [
  { key: 'fases', label: 'Fases', icon: 'fases' },
  { key: 'pendencias', label: 'Pendências', icon: 'pendencias' },
  { key: 'providencias', label: 'Providências', icon: 'providencias' },
  { key: 'cronograma', label: 'Cronograma', icon: 'cronograma' },
];

export function ObraDetalhe({
  id,
  onVoltar,
  abrirBoletim,
}: {
  id: string;
  onVoltar: () => void;
  abrirBoletim?: boolean;
}) {
  const { data: obra, isLoading } = useObraDetalhe(id);
  const pendencias = useObraPendencias(id);
  const { showToast } = useToast();
  const [faseAberta, setFaseAberta] = useState<string | null>(null);
  const [fichaAtvId, setFichaAtvId] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaObra>('fases');
  const [boletimAberto, setBoletimAberto] = useState(abrirBoletim ?? false);
  const [celebra, setCelebra] = useState<CelebracaoFaseDados | null>(null);

  const fases = useMemo(() => (obra ? montarTrilha(obra) : []), [obra]);

  const provAtrasadas = useMemo(
    () => (obra ? classificarProvidencias(obra, hojeISO()).atrasadas.length : 0),
    [obra],
  );
  const pendAbertas = useMemo(
    () => classificarPendencias(pendencias.query.data ?? [], hojeISO()).fila.length,
    [pendencias.query.data],
  );

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

  if (boletimAberto) {
    return <BoletimView obra={obra} onFechar={() => setBoletimAberto(false)} />;
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
            className={styles.iconeBtn}
            aria-label="Boletim da semana"
            title="Boletim da semana"
            onClick={() => setBoletimAberto(true)}
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
        onConcluida={(r, det) => {
          setFichaAtvId(null);
          if (r.fase_fechada) {
            setCelebra({
              ordem: det.faseOrdem ?? 0,
              titulo: det.faseTitulo,
              xp: r.xp,
              libera: det.libera,
              proxOrdem: det.proxOrdem,
            });
          } else if (det.libera.length) {
            showToast({ message: `"${det.nome}" concluída · liberou ${det.libera.join(', ')}` });
          } else {
            showToast({ message: `"${det.nome}" concluída · +${r.xp} XP` });
          }
        }}
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
          ) : f.status === 'execucao' ? (
            <span>{f.n}</span>
          ) : (
            <Icon name="cadeado" size={16} strokeWidth={2} />
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
                  ) : a.status === 'liberada' ? (
                    <Icon name="seta" size={16} strokeWidth={2.2} />
                  ) : a.status === 'aguardando' ? (
                    <Icon name="providencias" size={16} strokeWidth={2} />
                  ) : (
                    <Icon name="cadeado" size={14} strokeWidth={2.2} />
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
                {a.podeConcluir ? (
                  <button
                    type="button"
                    className={styles.camera}
                    aria-label={`Concluir ${a.nome} com foto`}
                    onClick={() => onAbrir(a.id)}
                  >
                    <Icon name="camera" size={18} strokeWidth={2} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function montarTrilha(obra: ObraCompleta): FaseTrilha[] {
  const topo = obra.atividades.filter((a) => !a.pai_id);
  return trilhaDeFases({
    fases: obra.fases,
    atividades: topo.map((a) => ({
      id: a.id,
      fase_id: a.fase_id,
      nome: a.nome,
      predecessoras: a.predecessoras,
      prestador: a.prestador,
      providenciasPendentes: a.providencias
        .filter((p) => p.status === 'pendente')
        .map((p) => ({ tipo: p.tipo, descricao: p.descricao })),
    })),
    estados: obra.estados,
    datas: Object.fromEntries(
      obra.cron.itens.map((it) => [it.id, { inicio: it.inicio_previsto, fim: it.fim_previsto }]),
    ),
  });
}
