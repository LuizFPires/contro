import { useEffect, useMemo, useState } from 'react';
import {
  classificarPendencias,
  diasUteisRestantes,
  podeApagarObra,
  previsaoEntrega,
  ritmoTexto,
  type FaseTrilha,
} from '@contro/core';
import { BottomSheet, Icon, useToast, type IconName } from '@contro/ui';
import { usePerfil } from '../perfil/usePerfil';
import { ApagarObraSheet } from './ApagarObraSheet';
import { RenomearObraSheet } from './RenomearObraSheet';
import { CampoPrestador } from './CampoPrestador';
import { NovaAtividadeSheet } from './NovaAtividadeSheet';
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
import { useAvanco } from './useAvanco';
import { AnelAvanco } from './AnelAvanco';
import { useObraPendencias } from './useObraPendencias';
import { montarTrilha } from './trilhaObra';
import styles from './ObraDetalhe.module.css';
import { useLembrado } from '../../lib/useLembrado';

type AbaObra = 'fases' | 'pendencias' | 'providencias' | 'cronograma' | 'boletim';

const ABAS: { key: Exclude<AbaObra, 'boletim'>; label: string; icon: IconName }[] = [
  { key: 'fases', label: 'Fases', icon: 'fases' },
  { key: 'providencias', label: 'Providências', icon: 'providencias' },
  { key: 'cronograma', label: 'Cronograma', icon: 'cronograma' },
  // Pendências de qualidade, com o nome "Check list" (pedido do usuário).
  { key: 'pendencias', label: 'Check list', icon: 'pendencias' },
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
  // Aba, fase aberta e ficha aberta ficam lembradas por obra (volta ao mesmo lugar).
  const [faseAberta, setFaseAberta] = useLembrado<string | null>(`obra:${id}:fase`, null);
  const [fichaAtvId, setFichaAtvId] = useLembrado<string | null>(`obra:${id}:ficha`, null);
  // O boletim abre dentro da obra (protótipo), pelo ícone do cabeçalho.
  const [aba, setAba] = useLembrado<AbaObra>(`obra:${id}:aba`, 'fases');
  // Atalho para o boletim (aviso de boletim pronto) manda sobre a aba lembrada.
  useEffect(() => {
    if (abrirBoletim) setAba('boletim');
  }, [abrirBoletim, setAba]);
  const [celebra, setCelebra] = useState<CelebracaoFaseDados | null>(null);
  const [planoAberto, setPlanoAberto] = useState(Boolean(abrirPlano));
  // Mapa de coleta: "+ Quem foi contratado" abre o campo (opcional, depois do check).
  const [contratadoId, setContratadoId] = useState<string | null>(null);
  // Fase que recebe um card novo ("+ Adicionar atividade").
  const [novaFaseId, setNovaFaseId] = useState<string | null>(null);
  // Apagar obra: só o gestor, sempre com confirmação.
  const { data: perfil } = usePerfil();
  const [apagarAberto, setApagarAberto] = useState(false);
  const [menuObra, setMenuObra] = useState(false);
  const [renomearAberto, setRenomearAberto] = useState(false);

  const fases = useMemo(() => (obra ? montarTrilha(obra) : []), [obra]);

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
  const avanco = useAvanco(obra ?? null, aoConcluir);
  // A obra lembrada foi apagada (ou não existe mais): volta para a lista.
  useEffect(() => {
    if (!isLoading && obra === null) onVoltar();
  }, [isLoading, obra, onVoltar]);

  const provAtrasadas = useMemo(
    () => (obra ? classificarProvidencias(obra, hojeISO()).atrasadas.length : 0),
    [obra],
  );
  const pendAbertas = useMemo(
    () => classificarPendencias(pendencias.query.data ?? []).pendentes.length,
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

  if (planoAberto) {
    return <PlanoRecuperacao obra={obra} onVoltar={() => setPlanoAberto(false)} />;
  }

  const pct = Math.round(obra.pct * 100);
  // Fase aberta: a escolhida, senão a atual da obra (como no protótipo). O
  // pré-obra (Orçamento, Mapa de coleta) começa sempre recolhido.
  const preliminares = new Set(obra.fases.filter((f) => f.preliminar).map((f) => f.id));
  const atual = fases.find((f) => f.status === 'execucao' && !preliminares.has(f.id));
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
          {/* "⋮": editar o nome da obra e (só o gestor) apagar a obra. */}
          <div className={styles.menuObraAncora}>
            <button
              type="button"
              className={styles.iconeBtn}
              aria-label="Mais opções da obra"
              aria-haspopup="menu"
              aria-expanded={menuObra}
              onClick={() => setMenuObra((v) => !v)}
            >
              <Icon name="maisVertical" size={22} />
            </button>
            {menuObra ? (
              <>
                <button
                  type="button"
                  className={styles.menuObraFundo}
                  aria-label="Fechar menu"
                  onClick={() => setMenuObra(false)}
                />
                <div className={styles.menuObra} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuObraItem}
                    onClick={() => {
                      setMenuObra(false);
                      setRenomearAberto(true);
                    }}
                  >
                    <Icon name="editar" size={20} />
                    Editar nome da obra
                  </button>
                  {perfil && podeApagarObra(perfil.perfil) ? (
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.menuObraItem}
                      onClick={() => {
                        setMenuObra(false);
                        setApagarAberto(true);
                      }}
                    >
                      <Icon name="lixeira" size={20} />
                      Apagar obra
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
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
                onAnel={avanco.anel}
                mapaDe={(id) => {
                  const m = obra.atividades.find((x) => x.id === id);
                  return m && m.mapa_antecedencia_du !== null
                    ? { prontoEm: m.concluida_em, contratado: m.prestador }
                    : null;
                }}
                onMarcarMapa={(atvId, nome, pronto) => {
                  // Só controle de pronto: sem foto e sem pontos (xp 0), com Desfazer.
                  const marcar = () =>
                    campo.concluir.mutate({ atividadeId: atvId, file: null, xp: 0 });
                  const desmarcar = () => campo.desfazer.mutate({ atividadeId: atvId, xp: 0 });
                  if (pronto) marcar();
                  else desmarcar();
                  showToast({
                    message: pronto
                      ? `"${nome}" pronto para decisão de contratação`
                      : `"${nome}" voltou para a fazer`,
                    onUndo: pronto ? desmarcar : marcar,
                  });
                }}
                onContratado={setContratadoId}
                onAdicionar={
                  obra.fases.find((x) => x.id === f.id)?.preliminar
                    ? undefined
                    : () => setNovaFaseId(f.id)
                }
                subitensDe={(id) =>
                  obra.atividades
                    .filter((x) => x.pai_id === id)
                    .sort((x, y) => x.ordem - y.ordem)
                    .map((x) => ({ id: x.id, nome: x.nome, feito: Boolean(x.concluida_em) }))
                }
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

      <RenomearObraSheet
        obra={obra}
        aberto={renomearAberto}
        onFechar={() => setRenomearAberto(false)}
      />

      <ApagarObraSheet
        obra={obra}
        aberto={apagarAberto}
        onFechar={() => setApagarAberto(false)}
        onApagada={onVoltar}
      />

      <NovaAtividadeSheet obra={obra} faseId={novaFaseId} onFechar={() => setNovaFaseId(null)} />

      <BottomSheet
        open={Boolean(contratadoId)}
        title="Quem foi contratado?"
        onClose={() => setContratadoId(null)}
      >
        {contratadoId ? (
          <CampoPrestador
            key={contratadoId}
            atividadeId={contratadoId}
            valor={obra.atividades.find((x) => x.id === contratadoId)?.prestador ?? null}
            rotulo="Empresa ou prestador"
            placeholder="Digite o nome"
            autoFocus
            onSalvar={(v) => {
              campo.prestador.mutate({ id: contratadoId, prestador: v });
              setContratadoId(null);
              if (v) showToast({ message: `Contratado: ${v}` });
            }}
          />
        ) : null}
      </BottomSheet>

      {celebra ? <CelebracaoFase dados={celebra} onFechar={() => setCelebra(null)} /> : null}
    </div>
  );
}

function Fase({
  fase: f,
  aberta,
  onToggle,
  onAbrir,
  onAnel,
  mapaDe,
  onMarcarMapa,
  onContratado,
  onAdicionar,
  subitensDe,
}: {
  fase: FaseTrilha;
  aberta: boolean;
  onToggle: () => void;
  onAbrir: (id: string) => void;
  /** Toque no anel de avanço da atividade. */
  onAnel: (id: string) => void;
  /** Mapa de coleta (null = atividade comum): quando ficou pronto e quem foi contratado. */
  mapaDe: (id: string) => { prontoEm: string | null; contratado: string | null } | null;
  onMarcarMapa: (id: string, nome: string, pronto: boolean) => void;
  onContratado: (id: string) => void;
  /** Novo card nesta fase (fases da obra; o pré-obra não). */
  onAdicionar?: () => void;
  /** Subitens da atividade, para listar embaixo dela na trilha. */
  subitensDe: (id: string) => { id: string; nome: string; feito: boolean }[];
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
            {f.atividades.map((a) =>
              mapaDe(a.id) ? (
                <CardMapa
                  key={a.id}
                  a={a}
                  m={mapaDe(a.id)!}
                  onAbrir={() => onAbrir(a.id)}
                  onMarcar={(pronto) => onMarcarMapa(a.id, a.nome, pronto)}
                  onContratado={() => onContratado(a.id)}
                />
              ) : (
                <div key={a.id} className={`${styles.atv} ${styles[`atv_${a.status}`]}`}>
                  {/* Anel de avanço (opção C): cada toque +25%, o quarto conclui. */}
                  <AnelAvanco
                    pct={a.avancoPct}
                    atrasada={a.status === 'atrasada'}
                    nome={a.nome}
                    onTocar={() => onAnel(a.id)}
                  />
                  <button type="button" className={styles.atvTexto} onClick={() => onAbrir(a.id)}>
                    <span className={styles.atvNome}>{a.nome}</span>
                    <span className={styles.atvSub}>{a.sub}</span>
                    {a.avancoPct > 0 && a.avancoPct < 100 ? (
                      <span className={styles.atvBarra} aria-hidden="true">
                        <span style={{ width: `${a.avancoPct}%` }} />
                      </span>
                    ) : null}
                    {subitensDe(a.id).length ? (
                      <span className={styles.subitens}>
                        {subitensDe(a.id).map((s) => (
                          <span key={s.id} className={s.feito ? styles.subFeito : styles.subitem}>
                            <Icon
                              name={s.feito ? 'checkGrosso' : 'seta'}
                              size={12}
                              strokeWidth={s.feito ? 3 : 2.2}
                            />
                            {s.nome}
                          </span>
                        ))}
                      </span>
                    ) : null}
                    {a.prestador ? (
                      <span className={styles.prestador}>
                        <Icon name="pessoa" size={12} strokeWidth={2.2} />
                        {a.prestador}
                      </span>
                    ) : null}
                  </button>
                </div>
              ),
            )}
            {onAdicionar ? (
              <button type="button" className={styles.adicionarAtv} onClick={onAdicionar}>
                <Icon name="plus" size={18} strokeWidth={2.2} />
                Adicionar atividade
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Mapa de coleta na trilha (opção A): o quadrado marca "pronto para a decisão de
 * contratação", sem pedir nada; quem foi contratado é opcional, depois.
 */
function CardMapa({
  a,
  m,
  onAbrir,
  onMarcar,
  onContratado,
}: {
  a: FaseTrilha['atividades'][number];
  m: { prontoEm: string | null; contratado: string | null };
  onAbrir: () => void;
  onMarcar: (pronto: boolean) => void;
  onContratado: () => void;
}) {
  const pronto = Boolean(m.prontoEm);
  return (
    <div className={`${styles.atv} ${styles[`atv_${a.status}`]}`}>
      <button
        type="button"
        className={styles.mapaCheck}
        aria-pressed={pronto}
        aria-label={pronto ? `Desmarcar ${a.nome}` : `Marcar ${a.nome} como pronto`}
        onClick={() => onMarcar(!pronto)}
      >
        <span className={pronto ? styles.mapaCaixaOn : styles.mapaCaixa}>
          {pronto ? <Icon name="checkGrosso" size={18} strokeWidth={3} /> : null}
        </span>
      </button>
      <div className={styles.mapaCorpo}>
        <button type="button" className={styles.atvTexto} onClick={onAbrir}>
          <span className={styles.atvNome}>{a.nome}</span>
          <span className={styles.atvSub}>
            {pronto
              ? `Pronto ${formatarDataCurta(new Date(m.prontoEm!).toLocaleDateString('sv-SE'))} · para decisão de contratação`
              : a.sub}
          </span>
          {m.contratado ? (
            <span className={styles.prestador}>
              <Icon name="pessoa" size={12} strokeWidth={2.2} />
              Contratado: {m.contratado}
            </span>
          ) : null}
        </button>
        {pronto && !m.contratado ? (
          <button type="button" className={styles.mapaContratado} onClick={onContratado}>
            <Icon name="pessoa" size={14} strokeWidth={2.2} />+ Quem foi contratado
          </button>
        ) : null}
      </div>
    </div>
  );
}
