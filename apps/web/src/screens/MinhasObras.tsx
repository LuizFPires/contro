import { useState } from 'react';
import { useLembrado } from '../lib/useLembrado';
import { horaCurta, reuniaoQueVem, rotuloPerfil } from '@contro/core';
import { BottomSheet, Icon, Logo, Simbolo, useToast, type IconName } from '@contro/ui';
import { ObraCard } from '../features/obras/ObraCard';
import { HojeObras } from '../features/obras/HojeObras';
import { ObraDetalhe } from '../features/obras/ObraDetalhe';
import { NovaObraScreen } from '../features/obras/NovaObraScreen';
import { useObras } from '../features/obras/useObras';
import { usePerfil } from '../features/perfil/usePerfil';
import { useMembrosPendentes } from '../features/membros/useMembros';
import { ProntosParaEnviar } from '../features/boletim-auto/ProntosParaEnviar';
import { EditarNome } from './EditarNome';
import { TrocarSenha } from './TrocarSenha';
import { AvisosCelularSheet } from '../features/avisos/AvisosCelularSheet';
import { useConfigAvisos } from '../features/avisos/useConfigAvisos';
import { hojeISO } from '../features/obras/api';
import { formatarDataCurta } from '../lib/datas';
import styles from './MinhasObras.module.css';

export type DestinoInicio =
  | 'modelos'
  | 'reuniao'
  | 'tarefas'
  | 'minhas'
  | 'config'
  | 'membros'
  | 'avisos';

export function MinhasObras({
  onIr,
  onSair,
}: {
  onIr: (destino: DestinoInicio) => void;
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
  } | null>('inicio:obra', null);
  // Menu inferior da tela inicial: "Hoje" abre por padrão.
  const [aba, setAba] = useLembrado<'hoje' | 'obras'>('inicio:aba', 'hoje');

  if (obraAberta) {
    return (
      <ObraDetalhe
        id={obraAberta.id}
        abrirBoletim={obraAberta.boletim}
        abrirPlano={obraAberta.plano}
        onVoltar={() => setObraAberta(null)}
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
  const tarAbertas = lista.reduce((s, o) => s + o.tarefasAbertas, 0);
  const tarAtrasadas = lista.reduce((s, o) => s + o.tarefasAtrasadas, 0);
  const nMembros = ehGestor ? (membros.query.data?.length ?? 0) : 0;
  const nAtrasos = lista.reduce((s, o) => s + o.agenda.atrasados.length, 0);

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
            <button type="button" className={styles.blocoReuniao} onClick={() => onIr('reuniao')}>
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
              <span className={styles.blocoStatus}>Abrir pauta da próxima reunião</span>
            </button>
            <button type="button" className={styles.blocoTarefas} onClick={() => onIr('tarefas')}>
              <span className={styles.blocoTitulo}>
                <Icon name="tarefas" size={18} strokeWidth={2} />
                Tarefas
              </span>
              <span className={styles.blocoSubClaro}>{tarAbertas} abertas na equipe</span>
              <span className={tarAtrasadas ? styles.blocoAtraso : styles.blocoOk}>
                {tarAtrasadas
                  ? `${tarAtrasadas} ${tarAtrasadas === 1 ? 'atrasada' : 'atrasadas'}`
                  : 'nenhuma atrasada'}
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

      <nav className={styles.nav} aria-label="Início">
        <button
          type="button"
          className={`${styles.navBtn} ${aba === 'hoje' ? styles.navAtivo : ''}`}
          aria-current={aba === 'hoje' ? 'page' : undefined}
          onClick={() => setAba('hoje')}
        >
          <Icon name="calendario" size={22} />
          Hoje
          {nAtrasos ? (
            <span className={styles.navBadge}>
              <span className="sr-only">atrasos: </span>
              {nAtrasos}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className={`${styles.navBtn} ${aba === 'obras' ? styles.navAtivo : ''}`}
          aria-current={aba === 'obras' ? 'page' : undefined}
          onClick={() => setAba('obras')}
        >
          <Icon name="obras" size={22} />
          Minhas obras
        </button>
      </nav>

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
