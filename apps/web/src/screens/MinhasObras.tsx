import { useCallback, useEffect, useState } from 'react';
import { useLembrado } from '../lib/useLembrado';
import { horaCurta, reuniaoQueVem, rotuloAmbiente, type Ambiente } from '@contro/core';
import { Icon, Logo, Simbolo, useToast } from '@contro/ui';
import { ObraCard } from '../features/obras/ObraCard';
import { HojeObras } from '../features/obras/HojeObras';
import { ObraDetalhe, type AbaObra } from '../features/obras/ObraDetalhe';
import { NovaObraScreen } from '../features/obras/NovaObraScreen';
import { useObras } from '../features/obras/useObras';
import { usePerfil } from '../features/perfil/usePerfil';
import { useMembrosPendentes } from '../features/membros/useMembros';
import { ProntosParaEnviar } from '../features/boletim-auto/ProntosParaEnviar';
import { NavInferior } from './NavInferior';
import { ItemMenu, PerfilSheet } from '../features/perfil/PerfilSheet';
import { useConfigAvisos } from '../features/avisos/useConfigAvisos';
import { hojeISO } from '../features/obras/api';
import { formatarDataCurta } from '../lib/datas';
import styles from './MinhasObras.module.css';

export type DestinoInicio =
  | 'modelos'
  | 'reuniao'
  | 'reunioes'
  | 'tarefas'
  | 'minhas'
  | 'config'
  | 'membros'
  | 'avisos'
  | 'score'
  | 'log';

/** Pedido para abrir uma obra numa aba (ex.: pendência tocada em Tarefas). */
export interface AbrirObra {
  id: string;
  aba?: AbaObra;
  /** Pendência para destacar no Check list. */
  pendenciaId?: string;
  /** Atividade cuja ficha abre (toque no Log). */
  atividadeId?: string;
  /** Tela para onde o Voltar da obra retorna (em vez da lista). */
  voltar?: DestinoInicio;
}

export function MinhasObras({
  abrirObra,
  onAbrirObraConsumida,
  onIr,
  onNav,
  onAbrirLog,
  onSair,
  ambiente,
  disponiveis,
  onTrocarAmbiente,
}: {
  /** Abre a obra uma vez; depois de usado, o App limpa (o Voltar funciona). */
  abrirObra?: AbrirObra | null;
  onAbrirObraConsumida?: () => void;
  onIr: (destino: DestinoInicio) => void;
  /** Score e Log pelo menu inferior (o Log pelo menu abre em todas as obras). */
  onNav: (item: 'score' | 'log') => void;
  /** Ícone de relógio no cabeçalho da obra: Log filtrado pela obra. */
  onAbrirLog?: (obraId: string) => void;
  onSair: () => void;
  /** Ambiente atual e os da pessoa: a troca fica no perfil. */
  ambiente: Ambiente;
  disponiveis: Ambiente[];
  onTrocarAmbiente: (a: Ambiente) => void;
}) {
  const { data: obras, isLoading } = useObras();
  const { data: pessoa } = usePerfil();
  const ehGestor = pessoa?.perfil === 'gestor';
  const membros = useMembrosPendentes(ehGestor);
  const { showToast } = useToast();
  // Onde a pessoa estava (lista/nova obra, obra aberta, aba) fica lembrado.
  const [vista, setVista] = useLembrado<'lista' | 'nova'>('inicio:vista', 'lista');
  const [perfilAberto, setPerfilAberto] = useState(false);
  // Dia e horário da reunião vêm da configuração do gestor.
  const { config: agenda } = useConfigAvisos();
  const [obraAberta, setObraAberta] = useLembrado<{
    id: string;
    boletim?: boolean;
    plano?: boolean;
    aba?: AbaObra;
    pendenciaId?: string;
    atividadeId?: string;
    voltar?: DestinoInicio;
  } | null>('inicio:obra', null);
  useEffect(() => {
    if (!abrirObra) return;
    setObraAberta({ ...abrirObra });
    onAbrirObraConsumida?.();
  }, [abrirObra, onAbrirObraConsumida, setObraAberta]);
  // Aba e pendência do atalho valem uma vez: depois de aplicadas, saem do que
  // fica lembrado (recarregar não força o Check list de novo).
  const atalhoUsado = useCallback(
    () =>
      setObraAberta((o) =>
        o && (o.aba || o.pendenciaId || o.atividadeId)
          ? { ...o, aba: undefined, pendenciaId: undefined, atividadeId: undefined }
          : o,
      ),
    [setObraAberta],
  );
  // Menu inferior da tela inicial: "Hoje" abre por padrão.
  const [aba, setAba] = useLembrado<'hoje' | 'obras'>('inicio:aba', 'hoje');

  if (obraAberta) {
    return (
      <ObraDetalhe
        id={obraAberta.id}
        abrirBoletim={obraAberta.boletim}
        abrirPlano={obraAberta.plano}
        abrirAba={obraAberta.aba}
        abrirPendenciaId={obraAberta.pendenciaId}
        abrirAtividadeId={obraAberta.atividadeId}
        onAtalhoUsado={atalhoUsado}
        rotuloVoltar={obraAberta.voltar === 'log' ? 'Voltar para o Log' : undefined}
        onAbrirLog={
          onAbrirLog
            ? () => {
                const id = obraAberta.id;
                setObraAberta(null);
                onAbrirLog(id);
              }
            : undefined
        }
        onVoltar={() => {
          const de = obraAberta.voltar;
          setObraAberta(null);
          if (de) onIr(de);
        }}
      />
    );
  }

  if (vista === 'nova') {
    return (
      <NovaObraScreen
        onVoltar={() => setVista('lista')}
        onCriada={(id) => {
          setVista('lista');
          setObraAberta({ id });
          showToast({ message: 'Obra criada com o cronograma do modelo.' });
        }}
        onEditarModelos={ehGestor ? () => onIr('modelos') : undefined}
      />
    );
  }

  const lista = obras ?? [];
  const acAbertas = lista.reduce((s, o) => s + o.acoesAbertas, 0);
  const acAtrasadas = lista.reduce((s, o) => s + o.acoesAtrasadas, 0);
  const acHoje = lista.reduce((s, o) => s + o.acoesHoje, 0);
  const nMembros = ehGestor ? (membros.query.data?.length ?? 0) : 0;

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.marca}>
          <Logo on="preto" height={30} />
          {disponiveis.length > 1 ? (
            <span className={styles.ambiente}>{rotuloAmbiente(ambiente)}</span>
          ) : null}
        </div>
        <div className={styles.acoes}>
          {ehGestor ? (
            <button type="button" className={styles.modelos} onClick={() => onIr('modelos')}>
              <Icon name="listaModelos" size={18} />
              Modelos
            </button>
          ) : null}
          {ehGestor ? (
            <ProntosParaEnviar
              onAbrirBoletim={(obraId) => setObraAberta({ id: obraId, boletim: true })}
            />
          ) : null}
          <button
            type="button"
            className={styles.perfil}
            aria-label={
              nMembros ? `Perfil e ajustes · ${nMembros} membros aguardando` : 'Perfil e ajustes'
            }
            onClick={() => setPerfilAberto(true)}
          >
            <Icon name="pessoa" size={22} />
            {nMembros ? <span className={styles.ponto} aria-hidden="true" /> : null}
          </button>
        </div>
      </header>

      {aba === 'hoje' ? (
        isLoading ? (
          <p className={styles.vazio}>Carregando…</p>
        ) : lista.length ? (
          <HojeObras
            obras={lista}
            onAbrirObra={(id) => setObraAberta({ id })}
            onAbrirTarefas={() => onIr('tarefas')}
            onAbrirPlano={(id) => setObraAberta({ id, plano: true })}
          />
        ) : (
          <div className={styles.vazio}>
            <Simbolo size={56} />
            <h2>Nenhuma obra ainda</h2>
            <p>Crie a primeira obra pelo menu abaixo, na aba de obras.</p>
          </div>
        )
      ) : (
        <>
          <div className={styles.topo}>
            <h1 className={styles.titulo}>Minhas obras</h1>
            <button
              type="button"
              className={styles.nova}
              aria-label="Nova obra a partir do modelo"
              title="Nova obra a partir do modelo"
              onClick={() => setVista('nova')}
            >
              <Icon name="plus" size={22} strokeWidth={2.4} />
            </button>
          </div>

          <div className={styles.blocos}>
            <button type="button" className={styles.blocoReuniao} onClick={() => onIr('reunioes')}>
              <span className={styles.blocoTitulo}>
                <Icon
                  name="calendario"
                  size={18}
                  strokeWidth={2}
                  className={styles.iconeTurquesa}
                />
                Reunião
              </span>
              <span className={styles.blocoSub}>
                {formatarDataCurta(reuniaoQueVem(hojeISO(), agenda.reuniaoDia))} ·{' '}
                {horaCurta(agenda.reuniaoHora)}
              </span>
              <span className={styles.blocoStatus}>Pauta, preparar e atas</span>
            </button>
            <button type="button" className={styles.blocoTarefas} onClick={() => onIr('tarefas')}>
              <span className={styles.blocoTitulo}>
                <Icon name="tarefas" size={18} strokeWidth={2} />
                Ações da equipe
              </span>
              <span className={styles.blocoSubClaro}>
                {acAbertas} {acAbertas === 1 ? 'aberta' : 'abertas'} na equipe
              </span>
              <span className={acAtrasadas ? styles.blocoAtraso : styles.blocoOk}>
                {textoStatusAcoes(acAtrasadas, acHoje)}
              </span>
            </button>
          </div>

          {isLoading ? (
            <p className={styles.vazio}>Carregando…</p>
          ) : lista.length ? (
            <div className={styles.lista}>
              {lista.map((o) => (
                <ObraCard key={o.id} obra={o} onAbrir={() => setObraAberta({ id: o.id })} />
              ))}
            </div>
          ) : (
            <div className={styles.vazio}>
              <Simbolo size={56} />
              <h2>Nenhuma obra ainda</h2>
              <p>Toque no “+” para criar a primeira obra a partir de um modelo.</p>
            </div>
          )}
        </>
      )}

      <NavInferior
        ativo={aba}
        onEscolher={(item) => {
          if (item === 'hoje' || item === 'obras') setAba(item);
          else onNav(item);
        }}
      />

      {pessoa ? (
        <PerfilSheet
          aberto={perfilAberto}
          onFechar={() => setPerfilAberto(false)}
          pessoa={pessoa}
          ambiente={ambiente}
          disponiveis={disponiveis}
          onTrocarAmbiente={onTrocarAmbiente}
          onSair={onSair}
          itensDoAmbiente={
            ehGestor ? (
              <>
                <ItemMenu
                  icon="calendario"
                  rotulo="Reunião e avisos"
                  onClick={() => {
                    setPerfilAberto(false);
                    onIr('avisos');
                  }}
                />
                <ItemMenu
                  icon="documento"
                  rotulo="Boletim automático"
                  onClick={() => {
                    setPerfilAberto(false);
                    onIr('config');
                  }}
                />
                <ItemMenu
                  icon="membros"
                  rotulo="Pessoas e acessos"
                  selo={nMembros ? `${nMembros} aguardando` : undefined}
                  onClick={() => {
                    setPerfilAberto(false);
                    onIr('membros');
                  }}
                />
              </>
            ) : null
          }
        />
      ) : null}
    </div>
  );
}

function textoStatusAcoes(atrasadas: number, hoje: number): string {
  const venceHoje = hoje === 1 ? '1 vence hoje' : `${hoje} vencem hoje`;
  if (atrasadas > 0) {
    const atr = atrasadas === 1 ? '1 atrasada' : `${atrasadas} atrasadas`;
    return hoje > 0 ? `${atr} · ${venceHoje}` : atr;
  }
  return hoje > 0 ? `nenhuma atrasada · ${venceHoje}` : 'nenhuma atrasada';
}
