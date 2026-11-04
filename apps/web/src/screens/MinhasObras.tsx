import { useCallback, useEffect, useState } from 'react';
import { useLembrado } from '../lib/useLembrado';
import { horaCurta, reuniaoQueVem, rotuloPerfil } from '@contro/core';
import { BottomSheet, Icon, Logo, Simbolo, useToast, type IconName } from '@contro/ui';
import { ObraCard } from '../features/obras/ObraCard';
import { HojeObras } from '../features/obras/HojeObras';
import { ObraDetalhe, type AbaObra } from '../features/obras/ObraDetalhe';
import { NovaObraScreen } from '../features/obras/NovaObraScreen';
import { useObras } from '../features/obras/useObras';
import { usePerfil } from '../features/perfil/usePerfil';
import { useMembrosPendentes } from '../features/membros/useMembros';
import { ProntosParaEnviar } from '../features/boletim-auto/ProntosParaEnviar';
import { EditarNome } from './EditarNome';
import { NavInferior } from './NavInferior';
import { TrocarSenha } from './TrocarSenha';
import { AvisosCelularSheet } from '../features/avisos/AvisosCelularSheet';
import { useConfigAvisos } from '../features/avisos/useConfigAvisos';
import { hojeISO } from '../features/obras/api';
import { formatarDataCurta } from '../lib/datas';
import { VERSAO_APP, forcarAtualizacao } from '../lib/pwa';
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
  onAbrirLog,
  onSair,
}: {
  /** Abre a obra uma vez; depois de usado, o App limpa (o Voltar funciona). */
  abrirObra?: AbrirObra | null;
  onAbrirObraConsumida?: () => void;
  onIr: (destino: DestinoInicio) => void;
  /** Ícone de relógio no cabeçalho da obra: Log filtrado pela obra. */
  onAbrirLog?: (obraId: string) => void;
  onSair: () => void;
}) {
  const { data: obras, isLoading } = useObras();
  const { data: pessoa } = usePerfil();
  const ehGestor = pessoa?.perfil === 'gestor';
  const membros = useMembrosPendentes(ehGestor);
  const { showToast } = useToast();
  // Onde a pessoa estava (lista/nova obra, obra aberta, aba) fica lembrado.
  const [vista, setVista] = useLembrado<'lista' | 'nova'>('inicio:vista', 'lista');
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [editarNome, setEditarNome] = useState(false);
  const [trocarSenha, setTrocarSenha] = useState(false);
  const [avisos, setAvisos] = useState(false);
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
        onEscolher={(item) => (item === 'hoje' || item === 'obras' ? setAba(item) : onIr(item))}
      />

      <BottomSheet open={perfilAberto} onClose={() => setPerfilAberto(false)}>
        <div className={styles.painel}>
          <div className={styles.quem}>
            <span className={styles.avatar} aria-hidden="true">
              <Icon name="pessoa" size={24} />
            </span>
            <span>
              <span className={styles.quemNome}>{pessoa?.nome ?? ''}</span>
              <span className={styles.quemPerfil}>{pessoa ? rotuloPerfil(pessoa.perfil) : ''}</span>
            </span>
          </div>
          {ehGestor ? (
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
                rotulo="Aprovar membros"
                selo={nMembros ? `${nMembros} aguardando` : undefined}
                onClick={() => {
                  setPerfilAberto(false);
                  onIr('membros');
                }}
              />
            </>
          ) : null}
          <ItemMenu
            icon="pessoa"
            rotulo="Editar meu nome"
            onClick={() => {
              setPerfilAberto(false);
              setEditarNome(true);
            }}
          />
          <ItemMenu
            icon="sino"
            rotulo="Avisos neste celular"
            onClick={() => {
              setPerfilAberto(false);
              setAvisos(true);
            }}
          />
          <ItemMenu
            icon="cadeado"
            rotulo="Trocar senha"
            onClick={() => {
              setPerfilAberto(false);
              setTrocarSenha(true);
            }}
          />
          <ItemMenu
            icon="sync"
            rotulo={`Atualizar o app · versão ${VERSAO_APP}`}
            onClick={() => void forcarAtualizacao()}
          />
          <ItemMenu icon="sair" rotulo="Sair" separado onClick={onSair} semSeta />
        </div>
      </BottomSheet>

      <TrocarSenha aberto={trocarSenha} onFechar={() => setTrocarSenha(false)} />

      <AvisosCelularSheet aberto={avisos} onFechar={() => setAvisos(false)} />

      <EditarNome
        aberto={editarNome}
        atual={pessoa?.nome ?? ''}
        onFechar={() => setEditarNome(false)}
      />
    </div>
  );
}

function ItemMenu({
  icon,
  rotulo,
  selo,
  separado,
  semSeta,
  onClick,
}: {
  icon: IconName;
  rotulo: string;
  selo?: string;
  separado?: boolean;
  semSeta?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.item} ${separado ? styles.itemSeparado : ''}`}
      onClick={onClick}
    >
      <Icon name={icon} size={22} />
      <span className={styles.itemRotulo}>{rotulo}</span>
      {selo ? <span className={styles.selo}>{selo}</span> : null}
      {semSeta ? null : <Icon name="seta" size={18} className={styles.itemSeta} />}
    </button>
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
