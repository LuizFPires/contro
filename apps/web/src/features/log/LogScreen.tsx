import { useMemo, useState } from 'react';
import {
  agruparPorDia,
  filtrarLog,
  nomeCurto,
  nomeCurtoObra,
  rotuloLinhaLog,
  type EventoBruto,
  type FiltroLog,
  type ItemLog,
  type LinhaLog,
  type TipoLinhaLog,
} from '@contro/core';
import { Icon, type IconName } from '@contro/ui';
import { formatarDiaSemana } from '../../lib/datas';
import { useLembrado } from '../../lib/useLembrado';
import { NavInferior, type ItemNav } from '../../screens/NavInferior';
import { usePerfil } from '../perfil/usePerfil';
import { useLogDados } from './dadosLogScore';
import { horaDe } from './formatos';
import { LinhaDoTempo } from './VidaDoItem';
import styles from './LogScreen.module.css';

type TipoFiltro = NonNullable<FiltroLog['tipo']>;

const TIPOS: { id: TipoFiltro; rotulo: string }[] = [
  { id: 'replanejadas', rotulo: 'Replanejadas' },
  { id: 'atividades', rotulo: 'Atividades' },
  { id: 'tarefas', rotulo: 'Tarefas' },
  { id: 'pendencias', rotulo: 'Pendências' },
];

/** Dias do Log por vez: os 7 mais recentes e "Ver dias anteriores" traz mais 7. */
const DIAS_POR_VEZ = 7;

const ORIGEM: Record<ItemLog['origem'], string> = {
  tarefa: 'Tarefa',
  providencia: 'Providência',
  atividade: 'Atividade',
  pendencia: 'Pendência',
};

function iconeDo(tipo: TipoLinhaLog): IconName {
  switch (tipo) {
    case 'concluida':
    case 'resolvida':
      return 'checkGrosso';
    case 'replanejada':
    case 'inicio_ajustado':
      return 'replanejar';
    case 'vencida':
      return 'alert';
    case 'criada':
    case 'atribuida':
    case 'apontada':
      return 'plus';
    default:
      return 'ponto';
  }
}

/**
 * Log: o que mudou e quem mudou (protótipo Score e Log, 04/11/2026). Linha do
 * tempo de todas as obras, por dia; chips por obra, por tipo e "Eu". No filtro
 * Replanejadas a lista vira um card por item, com a vida dele. Só leitura: o Log é a
 * foto do que aconteceu; editar fica nas telas de cada item (pedido do usuário, 04/11/2026).
 */
export function LogScreen({
  obraInicial,
  onVoltar,
  onNav,
}: {
  /** Começa filtrado por esta obra (relógio do cabeçalho da obra). */
  obraInicial?: string | null;
  /** Só quando veio de uma obra: volta para ela. */
  onVoltar?: () => void;
  onNav: (item: ItemNav) => void;
}) {
  const { linhas, itens, eventosPorItem, obras, carregando, erro } = useLogDados();
  const { data: perfil } = usePerfil();
  // O filtro da obra vem lembrado: o relógio da obra grava a obra uma vez ao
  // abrir (App), então "Todas as obras" escolhido depois não volta sozinho.
  const [obraId, setObraId] = useLembrado<string | null>('log:obra', obraInicial ?? null);
  const [tipo, setTipo] = useLembrado<TipoFiltro | null>('log:tipo', null);
  const [eu, setEu] = useLembrado<boolean>('log:eu', false);

  // Obra lembrada que saiu da carga (apagada, pausada): volta para todas.
  const obraValida = obraId && obras.some((o) => o.id === obraId) ? obraId : null;
  const filtradas = useMemo(
    () =>
      filtrarLog(linhas, {
        obraId: obraValida ?? undefined,
        tipo: tipo ?? undefined,
        pessoaId: eu && perfil ? perfil.id : undefined,
      }),
    [linhas, obraValida, tipo, eu, perfil],
  );
  const dias = useMemo(() => agruparPorDia(filtradas, formatarDiaSemana), [filtradas]);
  // Os dias vão aparecendo aos blocos; mudar o filtro volta ao primeiro bloco.
  const chaveFiltro = `${obraValida ?? ''}|${tipo ?? ''}|${eu}`;
  const [blocos, setBlocos] = useState({ chave: chaveFiltro, qtd: DIAS_POR_VEZ });
  const qtdDias = blocos.chave === chaveFiltro ? blocos.qtd : DIAS_POR_VEZ;
  const diasVisiveis = useMemo(() => dias.slice(0, qtdDias), [dias, qtdDias]);
  const itemPorId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);
  // Replanejadas: um card por item, na ordem da mudança mais recente.
  const porItem = useMemo(() => {
    if (tipo !== 'replanejadas') return [];
    const vistos = new Set<string>();
    const lista: ItemLog[] = [];
    for (const l of filtradas) {
      const it = itemPorId.get(l.itemId);
      if (!it || vistos.has(it.id)) continue;
      vistos.add(it.id);
      lista.push(it);
    }
    return lista;
  }, [tipo, filtradas, itemPorId]);

  const nomeObraFiltro = obraValida ? obras.find((o) => o.id === obraValida)?.nome : null;
  const semConexao = erro && linhas.length === 0;
  const vazio = !carregando && !semConexao && filtradas.length === 0;

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.topo}>
          {onVoltar ? (
            <button
              type="button"
              className={styles.voltar}
              aria-label="Voltar para a obra"
              onClick={onVoltar}
            >
              <Icon name="chevronLeft" size={22} />
            </button>
          ) : null}
          <div className={styles.topoTexto}>
            <h1 className={styles.titulo}>{nomeObraFiltro ?? 'Log'}</h1>
            <div className={styles.sub}>
              {nomeObraFiltro ? 'Log · o que mudou e quem mudou' : 'o que mudou e quem mudou'}
            </div>
          </div>
        </div>
        <div className={styles.chips} role="group" aria-label="Filtros do Log">
          <Chip ativo={!obraValida} onClick={() => setObraId(null)}>
            Todas as obras
          </Chip>
          {obras.map((o) => (
            <Chip
              key={o.id}
              ativo={obraValida === o.id}
              rotulo={o.nome}
              onClick={() => setObraId(obraValida === o.id ? null : o.id)}
            >
              {nomeCurtoObra(o.nome)}
            </Chip>
          ))}
          <span className={styles.chipSep} aria-hidden="true" />
          {TIPOS.map((t) => (
            <Chip
              key={t.id}
              ativo={tipo === t.id}
              onClick={() => setTipo(tipo === t.id ? null : t.id)}
            >
              {t.rotulo}
            </Chip>
          ))}
          <Chip ativo={eu} rotulo="Eu: só o que eu mudei" onClick={() => setEu(!eu)}>
            Eu
          </Chip>
        </div>
      </header>

      <div className={styles.lista}>
        {carregando ? <p className={styles.vazio}>Carregando…</p> : null}
        {semConexao ? (
          <p className={styles.vazio} role="alert">
            <Icon name="alert" size={16} /> Sem conexão: não foi possível carregar o Log.
          </p>
        ) : null}
        {vazio ? (
          <p className={styles.vazio}>
            {linhas.length === 0
              ? 'Nada mudou nos últimos 90 dias.'
              : 'Nada com estes filtros nos últimos 90 dias.'}
          </p>
        ) : null}

        {tipo === 'replanejadas'
          ? porItem.map((it) => (
              <CardItem
                key={it.id}
                item={it}
                eventos={eventosPorItem.get(it.id) ?? SEM_EVENTOS}
                comObra={!obraValida}
              />
            ))
          : diasVisiveis.map((d) => (
              <section key={d.dia} className={styles.dia}>
                <h2 className={styles.diaTitulo}>{d.rotulo}</h2>
                {d.linhas.map((l) => (
                  <Linha key={`${l.tipo}:${l.id}`} l={l} comObra={!obraValida} />
                ))}
              </section>
            ))}
        {tipo !== 'replanejadas' && dias.length > qtdDias ? (
          <button
            type="button"
            className={styles.maisDias}
            onClick={() => setBlocos({ chave: chaveFiltro, qtd: qtdDias + DIAS_POR_VEZ })}
          >
            Ver dias anteriores
          </button>
        ) : null}
      </div>

      <NavInferior ativo="log" onEscolher={onNav} />
    </div>
  );
}

const SEM_EVENTOS: EventoBruto[] = [];

function Chip({
  ativo,
  rotulo,
  onClick,
  children,
}: {
  ativo: boolean;
  rotulo?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${ativo ? styles.chipAtivo : ''}`}
      aria-pressed={ativo}
      aria-label={rotulo}
      title={rotulo}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Uma mudança: ícone por tipo, rótulo em negrito, item e "obra · quem · detalhe". */
function Linha({ l, comObra }: { l: LinhaLog; comObra: boolean }) {
  const hora = l.tipo === 'vencida' ? null : horaDe(l.em);
  const meta = [comObra ? nomeCurtoObra(l.obraNome) : null, l.pessoa, l.detalhe]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className={`${styles.ev} ${styles[`cor_${l.cor}`] ?? ''}`}>
      <span className={styles.evIcone} aria-hidden="true">
        <Icon name={iconeDo(l.tipo)} size={14} strokeWidth={2.6} />
      </span>
      <span className={styles.evTexto}>
        <span className={styles.evLinha}>
          <b className={styles.evTipo}>{rotuloLinhaLog(l.tipo)}</b> · {l.itemTexto}
        </span>
        {meta ? <span className={styles.evMeta}>{meta}</span> : null}
      </span>
      {hora ? <span className={styles.evHora}>{hora}</span> : null}
    </div>
  );
}

/** Filtro Replanejadas: o item com a vida dele. */
function CardItem({
  item,
  eventos,
  comObra,
}: {
  item: ItemLog;
  eventos: EventoBruto[];
  comObra: boolean;
}) {
  const meta = [
    ORIGEM[item.origem],
    comObra ? nomeCurtoObra(item.obraNome) : null,
    nomeCurto(item.responsavelNome) || null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <article className={styles.ficha}>
      <div className={styles.fichaTopo}>
        <span className={styles.fichaTexto}>
          <span className={styles.fichaTitulo}>{item.texto}</span>
          <span className={styles.evMeta}>{meta}</span>
        </span>
      </div>
      <LinhaDoTempo item={item} eventos={eventos} semTitulo />
    </article>
  );
}
