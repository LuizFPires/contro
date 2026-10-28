import { useMemo, useState } from 'react';
import { deReuniaoAnterior, origemReuniao, simularConclusaoEm } from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import { usePerfil } from '../perfil/usePerfil';
import { usePessoas } from '../perfil/usePessoas';
import { hojeISO } from '../obras/api';
import { desfazerConclusao } from '../obras/campo';
import { formatarDataCurta } from '../../lib/datas';
import { AtaView } from './AtaView';
import {
  ProvidenciaSheet,
  type CabecalhoProvidencia,
  type ValoresProvidencia,
} from './ProvidenciaSheet';
import { useNomesSugeridos } from './useNomesSugeridos';
import { useReuniao } from './useReuniao';
import type { ItemPassada, ReuniaoObraDados, TarefaAtrib } from './reuniaoApi';
import styles from './ReuniaoScreen.module.css';

/** Segunda-feira da semana corrente (ISO). */
function segundaISO(): string {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  // Data local (toISOString é UTC e, à noite, podia cair no dia seguinte).
  return d.toLocaleDateString('sv-SE');
}

const PASSOS = ['Semana passada', 'Esta semana', 'Providências', 'Observações'];
const TIPO: Record<string, string> = {
  contratacao: 'Contratar',
  locacao: 'Alugar',
  compra: 'Comprar',
};
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

interface Sheet {
  obraId: string;
  titulo: string;
  cabecalho: CabecalhoProvidencia | null;
  info: string | null;
  inicial: ValoresProvidencia;
  /** Atividade cujo impacto no cronograma é simulado. */
  impactoAtividadeId: string | null;
  vinculo: { tipo: 'atividade' | 'providencia'; id: string } | null;
  tarefaId: string | null;
}

interface ItemSemana {
  id: string;
  vinculoTipo: 'atividade' | 'providencia';
  tipo: string;
  nome: string;
  sub: string;
  prestador?: string | null;
  atraso: string | null;
  sugestao: string;
}

/** Reunião semanal (opção A · pauta guiada): obra por obra, em 4 etapas. */
export function ReuniaoScreen({ onVoltar }: { onVoltar: () => void }) {
  const data = useMemo(segundaISO, []);
  const hoje = hojeISO();
  const { data: pessoa } = usePerfil();
  const { data: pessoas = [] } = usePessoas();
  const { data: nomesSugeridos = [] } = useNomesSugeridos();
  const { showToast } = useToast();
  const { query, observacao, fechar, salvarProvidencia, concluirAtv, marcarFeita, reabrir } =
    useReuniao(data);

  const [ataAberta, setAtaAberta] = useState(false);
  const [obraSel, setObraSel] = useState<string | null>(null);
  const [passo, setPasso] = useState(0);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  // Decisões que não gravam nada: "Segue o plano" e "Começou".
  const [semAcao, setSemAcao] = useState<Set<string>>(new Set());
  const [naoFeitas, setNaoFeitas] = useState<Set<string>>(new Set());

  const reuniao = query.data;
  const obras = useMemo(() => reuniao?.obras ?? [], [reuniao]);
  const tarefas = useMemo(() => reuniao?.tarefas ?? [], [reuniao]);
  const fechada = reuniao?.status === 'fechada';
  const ehGestor = pessoa?.perfil === 'gestor';
  const dataFmt = formatarDataCurta(data);
  const origemAtual = origemReuniao(dataFmt);

  const idx = Math.max(
    0,
    obras.findIndex((o) => o.obraId === obraSel),
  );
  const o = obras[idx] as ReuniaoObraDados | undefined;
  const doObra = tarefas.filter((t) => t.obraId === o?.obraId);
  const novas = doObra.filter((t) => t.origem === origemAtual);
  const anteriores = doObra.filter((t) => deReuniaoAnterior(t, origemAtual));
  const provDe = (id: string) => novas.find((t) => t.vinculoId === id) ?? null;

  const marcar = (set: Set<string>, id: string, on: boolean) => {
    const n = new Set(set);
    if (on) n.add(id);
    else n.delete(id);
    return n;
  };

  function irObra(i: number) {
    setObraSel(obras[i]?.obraId ?? null);
    setPasso(0);
    window.scrollTo({ top: 0 });
  }
  function irPasso(p: number) {
    setPasso(p);
    window.scrollTo({ top: 0 });
  }

  function abrirEdicao(t: TarefaAtrib, titulo: string, extra?: Partial<Sheet>) {
    if (!o) return;
    setSheet({
      obraId: o.obraId,
      titulo,
      cabecalho: null,
      info: null,
      impactoAtividadeId: null,
      vinculo: t.vinculoTipo && t.vinculoId ? { tipo: t.vinculoTipo, id: t.vinculoId } : null,
      tarefaId: t.id,
      inicial: {
        texto: t.texto,
        responsavelId: t.responsavelId,
        responsavelNome: t.responsavelId ? null : t.responsavelNome,
        prazo: t.prazo ?? '',
        observacao: t.observacao ?? '',
      },
      ...extra,
    });
  }

  function salvarSheet(v: ValoresProvidencia) {
    if (!sheet) return;
    salvarProvidencia.mutate(
      {
        obraId: sheet.obraId,
        entrada: {
          id: sheet.tarefaId,
          texto: v.texto,
          responsavelId: v.responsavelId,
          responsavelNome: v.responsavelNome,
          prazo: v.prazo,
          observacao: v.observacao,
          vinculoTipo: sheet.vinculo?.tipo ?? null,
          vinculoId: sheet.vinculo?.id ?? null,
          origemTexto: sheet.tarefaId ? undefined : origemAtual,
        },
      },
      {
        onSuccess: () => {
          setSheet(null);
          showToast({ message: 'Providência salva na ata' });
        },
        onError: () => showToast({ message: 'Não foi possível salvar a providência' }),
      },
    );
  }

  // --- Semana passada ---
  function feitoPassada(it: ItemPassada) {
    if (it.tipo === 'comecar') {
      setSemAcao(marcar(semAcao, it.atividadeId, true));
      return;
    }
    concluirAtv.mutate(it.atividadeId, {
      onSuccess: () =>
        showToast({
          message: `${it.nome} concluída (sem foto)`,
          onUndo: () =>
            void desfazerConclusao(it.atividadeId)
              .then(() => query.refetch())
              .catch(() => showToast({ message: 'Não foi possível desfazer' })),
        }),
      onError: () => showToast({ message: 'Não foi possível concluir' }),
    });
  }

  function naoFeitoPassada(it: ItemPassada) {
    if (!o) return;
    setSemAcao(marcar(semAcao, it.atividadeId, false));
    const existente = provDe(it.atividadeId);
    const cabecalho: CabecalhoProvidencia = {
      rotulo: it.tipo === 'concluir' ? 'Não feito' : 'Não começou',
      atraso: true,
      nome: it.nome,
      etiquetaAtraso: `Atrasada · prevista ${formatarDataCurta(it.data)}`,
    };
    const impactoAtividadeId = it.tipo === 'concluir' ? it.atividadeId : null;
    if (existente) {
      abrirEdicao(existente, 'Providência para recuperar', { cabecalho, impactoAtividadeId });
      return;
    }
    setSheet({
      obraId: o.obraId,
      titulo: 'Providência para recuperar',
      cabecalho,
      info: null,
      impactoAtividadeId,
      vinculo: { tipo: 'atividade', id: it.atividadeId },
      tarefaId: null,
      inicial: {
        texto: `${it.tipo === 'concluir' ? 'Concluir' : 'Começar'} ${it.nome.toLowerCase()}`,
        responsavelId: null,
        responsavelNome: null,
        prazo: '',
        observacao: '',
      },
    });
  }

  // --- Esta semana ---
  const itensSemana: ItemSemana[] = o
    ? [
        ...o.concluir.map((a) => ({
          id: a.atividadeId,
          vinculoTipo: 'atividade' as const,
          tipo: 'Concluir',
          nome: a.nome,
          sub: `previsto concluir até ${formatarDataCurta(a.data)}`,
          prestador: a.prestador ?? null,
          atraso: null,
          sugestao: a.prestador
            ? `Confirmar com ${a.prestador} a conclusão`
            : `Garantir conclusão: ${a.nome}`,
        })),
        ...o.comecar.map((a) => ({
          id: a.atividadeId,
          vinculoTipo: 'atividade' as const,
          tipo: 'Começar',
          nome: a.nome,
          sub: `previsto começar ${formatarDataCurta(a.data)}`,
          prestador: a.prestador ?? null,
          atraso: null,
          sugestao: a.prestador
            ? `Confirmar com ${a.prestador} o início`
            : `Mobilizar início: ${a.nome}`,
        })),
        ...o.providenciasAtrasadas.map((p) => ({
          id: p.providenciaId,
          vinculoTipo: 'providencia' as const,
          tipo: TIPO[p.tipo],
          nome: p.descricao,
          sub: 'era para já estar providenciado',
          atraso: p.naObraEm ? `Atrasado · na obra ${formatarDataCurta(p.naObraEm)}` : 'Atrasado',
          sugestao: `${TIPO[p.tipo]}: ${p.descricao}`,
        })),
        ...o.providenciar.map((p) => ({
          id: p.providenciaId,
          vinculoTipo: 'providencia' as const,
          tipo: TIPO[p.tipo],
          nome: p.descricao,
          sub: p.naObraEm
            ? `precisa estar na obra ${formatarDataCurta(p.naObraEm)}`
            : 'providenciar nesta semana',
          atraso: null,
          sugestao: `${TIPO[p.tipo]}: ${p.descricao}`,
        })),
      ]
    : [];

  function providenciaSemana(it: ItemSemana) {
    if (!o) return;
    setSemAcao(marcar(semAcao, it.id, false));
    const existente = provDe(it.id);
    const cabecalho: CabecalhoProvidencia = {
      rotulo: it.tipo,
      atraso: Boolean(it.atraso),
      nome: it.nome,
      etiquetaAtraso: it.atraso,
    };
    if (existente) {
      abrirEdicao(existente, 'Providência', { cabecalho });
      return;
    }
    setSheet({
      obraId: o.obraId,
      titulo: 'Providência',
      cabecalho,
      info: null,
      impactoAtividadeId: null,
      vinculo: { tipo: it.vinculoTipo, id: it.id },
      tarefaId: null,
      inicial: {
        texto: it.sugestao,
        responsavelId: null,
        responsavelNome: null,
        prazo: '',
        observacao: '',
      },
    });
  }

  // --- Providências da reunião anterior ---
  function feitaAnterior(t: TarefaAtrib) {
    setNaoFeitas(marcar(naoFeitas, t.id, false));
    if (t.concluido) return;
    marcarFeita.mutate(
      { id: t.id, feita: true },
      {
        onSuccess: () =>
          showToast({
            message: 'Providência marcada como feita',
            onUndo: () => marcarFeita.mutate({ id: t.id, feita: false }),
          }),
        onError: () => showToast({ message: 'Não foi possível marcar' }),
      },
    );
  }

  function naoFeitaAnterior(t: TarefaAtrib) {
    setNaoFeitas(marcar(naoFeitas, t.id, true));
    if (t.concluido) marcarFeita.mutate({ id: t.id, feita: false });
    const original = t.prazoOriginal ?? t.prazo;
    abrirEdicao(t, 'Remarcar providência', {
      cabecalho: {
        rotulo: 'Não feita',
        atraso: true,
        nome: t.texto,
        etiquetaAtraso:
          t.atrasado && t.prazo ? `Atrasada · era até ${formatarDataCurta(t.prazo)}` : null,
      },
      info:
        t.replanejamentos > 0 && original
          ? `Remarcada ${plural(t.replanejamentos, 'vez', 'vezes')} · prazo original ${formatarDataCurta(original)}`
          : null,
    });
  }

  function gerarAta() {
    if (!reuniao) return;
    if (fechada) {
      setAtaAberta(true);
      return;
    }
    const snapshots = obras.map((x) => ({
      obra_id: x.obraId,
      snapshot: { pct: x.pct, ritmoDias: x.ritmoDias, entrega: x.entrega },
    }));
    fechar.mutate(
      { id: reuniao.id, snapshots },
      {
        onSuccess: () => {
          setAtaAberta(true);
          showToast({ message: 'Reunião fechada · ata gerada' });
        },
        onError: () => showToast({ message: 'Não foi possível fechar a reunião' }),
      },
    );
  }

  if (ataAberta && reuniao) {
    return <AtaView reuniao={reuniao} onVoltar={() => setAtaAberta(false)} />;
  }

  const ultimaObra = idx >= obras.length - 1;
  const proxima = obras[idx + 1];
  const sheetImpacto =
    sheet?.impactoAtividadeId && o
      ? (prazo: string) =>
          simularConclusaoEm(o.inicio, o.entradaCronograma, sheet.impactoAtividadeId!, prazo)
      : null;

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.topo}>
          <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
            <Icon name="chevronLeft" size={22} />
          </button>
          <div>
            <h1 className={styles.titulo}>Reunião de {dataFmt}</h1>
            <div className={styles.sub}>{fechada ? 'Ata gerada' : 'Ata da obra em construção'}</div>
          </div>
        </div>
        {obras.length > 0 ? (
          <div className={styles.obras} role="tablist" aria-label="Obras da reunião">
            {obras.map((x, i) => (
              <button
                key={x.obraId}
                type="button"
                role="tab"
                aria-selected={i === idx}
                className={`${styles.obraChip} ${i === idx ? styles.obraChipOn : ''}`}
                onClick={() => irObra(i)}
              >
                {x.nome}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {o ? (
        <nav className={styles.passos} aria-label="Etapas da pauta">
          {PASSOS.map((t, i) => (
            <button
              key={t}
              type="button"
              aria-current={i === passo ? 'step' : undefined}
              className={styles.passo}
              onClick={() => irPasso(i)}
            >
              <span className={i <= passo ? styles.barraOn : styles.barra} />
              <span className={i === passo ? styles.passoAtual : undefined}>{t}</span>
            </button>
          ))}
        </nav>
      ) : null}

      <div className={styles.conteudo}>
        {query.isLoading ? (
          <p className={styles.vazio}>Montando a pauta…</p>
        ) : query.isError ? (
          <p className={styles.vazio}>Não foi possível montar a pauta. Tente de novo.</p>
        ) : !o && fechada ? (
          // Ata fechada sem obras: as obras dela foram apagadas depois (28/10/2026).
          <div className={styles.vazioBox}>
            <p className={styles.vazio}>
              A ata desta semana foi fechada com obras que depois foram apagadas, por isso está
              vazia.
            </p>
            {ehGestor ? (
              <button
                type="button"
                className={styles.reabrirPauta}
                disabled={reabrir.isPending}
                onClick={() =>
                  reuniao &&
                  reabrir.mutate(reuniao.id, {
                    onSuccess: () => showToast({ message: 'Pauta reaberta com as obras de hoje' }),
                    onError: () => showToast({ message: 'Não foi possível reabrir a pauta' }),
                  })
                }
              >
                <Icon name="undo" size={18} strokeWidth={2} />
                {reabrir.isPending ? 'Reabrindo…' : 'Reabrir pauta'}
              </button>
            ) : (
              <p className={styles.vazio}>Peça ao gestor para reabrir a pauta.</p>
            )}
          </div>
        ) : !o ? (
          <p className={styles.vazio}>Nenhuma obra em andamento para a pauta.</p>
        ) : passo === 0 ? (
          <SemanaPassada
            o={o}
            provDe={provDe}
            semAcao={semAcao}
            fechada={fechada}
            pendente={concluirAtv.isPending}
            onFeito={feitoPassada}
            onNaoFeito={naoFeitoPassada}
          />
        ) : passo === 1 ? (
          <>
            <h2 className={styles.h2}>Esta semana na obra</h2>
            <p className={styles.dica}>O que vem pela frente precisa de alguém cuidando?</p>
            {itensSemana.length === 0 ? (
              <p className={styles.vazio}>Nada previsto para esta semana.</p>
            ) : null}
            {itensSemana.map((it) => {
              const prov = provDe(it.id);
              const segue = !prov && semAcao.has(it.id);
              return (
                <div key={`${it.vinculoTipo}-${it.id}`} className={styles.card}>
                  <div className={styles.cardTopo}>
                    <span className={styles.tipo}>{it.tipo}</span>
                    <b>{it.nome}</b>
                    <span className={styles.cinza}>
                      {it.sub}
                      {it.prestador ? (
                        <>
                          {' '}
                          · prestador <b className={styles.prestador}>{it.prestador}</b>
                        </>
                      ) : null}
                    </span>
                    {it.atraso ? <Atraso texto={it.atraso} /> : null}
                  </div>
                  <div className={styles.dois}>
                    <button
                      type="button"
                      aria-pressed={segue}
                      disabled={fechada || Boolean(prov)}
                      className={`${styles.opcao} ${segue ? styles.opcaoOk : ''}`}
                      onClick={() => setSemAcao(marcar(semAcao, it.id, true))}
                    >
                      Segue o plano
                    </button>
                    <button
                      type="button"
                      aria-pressed={Boolean(prov)}
                      disabled={fechada}
                      className={`${styles.opcao} ${prov ? styles.opcaoEscura : ''}`}
                      onClick={() => providenciaSemana(it)}
                    >
                      Providência
                    </button>
                  </div>
                  {prov ? (
                    <ProvLinha t={prov} fechada={fechada} onEditar={() => providenciaSemana(it)} />
                  ) : null}
                </div>
              );
            })}
          </>
        ) : passo === 2 ? (
          <>
            <h2 className={styles.h2}>Providências</h2>
            <h3 className={styles.secao}>Da reunião anterior</h3>
            {anteriores.length === 0 ? (
              <p className={styles.cinza}>Nenhuma providência de reunião anterior.</p>
            ) : null}
            {anteriores.map((t) => {
              const nao = !t.concluido && naoFeitas.has(t.id);
              return (
                <div key={t.id} className={styles.card}>
                  <div className={styles.cardTopo}>
                    <b className={t.concluido ? styles.riscado : undefined}>{t.texto}</b>
                    <span className={styles.cinza}>
                      {t.pessoa} · até {t.prazo ? formatarDataCurta(t.prazo) : '—'} · {t.origem}
                    </span>
                    {t.atrasado && !t.concluido ? <Atraso texto="Atrasada" /> : null}
                  </div>
                  <div className={styles.dois}>
                    <button
                      type="button"
                      aria-pressed={t.concluido}
                      disabled={fechada || marcarFeita.isPending}
                      className={`${styles.opcao} ${t.concluido ? styles.opcaoOk : ''}`}
                      onClick={() => feitaAnterior(t)}
                    >
                      Feita
                    </button>
                    <button
                      type="button"
                      aria-pressed={nao}
                      disabled={fechada}
                      className={`${styles.opcao} ${nao ? styles.opcaoEscura : ''}`}
                      onClick={() => naoFeitaAnterior(t)}
                    >
                      Não feita
                    </button>
                  </div>
                </div>
              );
            })}

            <h3 className={styles.secao}>Criadas nesta reunião</h3>
            {novas.length === 0 ? <p className={styles.cinza}>Nenhuma ainda nesta obra.</p> : null}
            {novas.map((t) => (
              <div key={t.id} className={styles.nova}>
                <span className={styles.origem}>
                  {t.vinculoTipo === 'atividade' &&
                  [...o.passadaConcluir, ...o.passadaComecar].some(
                    (p) => p.atividadeId === t.vinculoId,
                  )
                    ? 'Da semana passada'
                    : t.vinculoId
                      ? 'De esta semana'
                      : 'Nova'}
                </span>
                <ProvLinha t={t} fechada={fechada} onEditar={() => abrirEdicao(t, 'Providência')} />
              </div>
            ))}
            {!fechada ? (
              <button
                type="button"
                className={styles.adicionar}
                onClick={() =>
                  setSheet({
                    obraId: o.obraId,
                    titulo: 'Nova providência',
                    cabecalho: null,
                    info: null,
                    impactoAtividadeId: null,
                    vinculo: null,
                    tarefaId: null,
                    inicial: {
                      texto: '',
                      responsavelId: null,
                      responsavelNome: null,
                      prazo: '',
                      observacao: '',
                    },
                  })
                }
              >
                + Nova providência
              </button>
            ) : null}
          </>
        ) : (
          <Observacoes
            o={o}
            novas={novas}
            anteriores={anteriores}
            provDe={provDe}
            fechada={fechada}
            onSalvar={(texto) =>
              reuniao &&
              observacao.mutate(
                { reuniaoId: reuniao.id, obraId: o.obraId, texto },
                { onError: () => showToast({ message: 'Não foi possível salvar a observação' }) },
              )
            }
          />
        )}
      </div>

      {o ? (
        <div className={styles.rodape}>
          <button
            type="button"
            className={styles.anterior}
            disabled={passo === 0 && idx === 0}
            onClick={() => (passo > 0 ? irPasso(passo - 1) : irObra(idx - 1))}
          >
            Voltar
          </button>
          {passo < 3 ? (
            <button type="button" className={styles.avancar} onClick={() => irPasso(passo + 1)}>
              Continuar
            </button>
          ) : !ultimaObra && proxima ? (
            <button type="button" className={styles.avancar} onClick={() => irObra(idx + 1)}>
              Próxima obra · {proxima.nome}
            </button>
          ) : fechada || ehGestor ? (
            <button
              type="button"
              className={styles.avancar}
              disabled={!reuniao || fechar.isPending}
              onClick={gerarAta}
            >
              {fechada
                ? 'Ver ata da reunião'
                : fechar.isPending
                  ? 'Gerando…'
                  : 'Gerar ata da reunião'}
            </button>
          ) : (
            <p className={styles.soGestor}>O gestor gera a ata ao fim da reunião.</p>
          )}
        </div>
      ) : null}

      <ProvidenciaSheet
        aberto={Boolean(sheet)}
        titulo={sheet?.titulo ?? ''}
        cabecalho={sheet?.cabecalho}
        info={sheet?.info}
        inicial={
          sheet?.inicial ?? {
            texto: '',
            responsavelId: null,
            responsavelNome: null,
            prazo: '',
            observacao: '',
          }
        }
        hoje={hoje}
        dataReuniao={data}
        pessoas={pessoas}
        nomesSugeridos={nomesSugeridos}
        impacto={sheetImpacto}
        pendente={salvarProvidencia.isPending}
        onSalvar={salvarSheet}
        onFechar={() => setSheet(null)}
      />
    </div>
  );
}

function Atraso({ texto }: { texto: string }) {
  return (
    <span className={styles.atraso}>
      <Icon name="relogio" size={14} strokeWidth={2.4} />
      {texto}
    </span>
  );
}

function ProvLinha({
  t,
  fechada,
  onEditar,
}: {
  t: TarefaAtrib;
  fechada: boolean;
  onEditar: () => void;
}) {
  return (
    <div className={styles.prov}>
      <div>
        <b>{t.texto}</b>
        <div className={styles.provSub}>
          {t.pessoa} · até {t.prazo ? formatarDataCurta(t.prazo) : '—'} · vai para as Tarefas
        </div>
        {t.observacao ? <div className={styles.provSub}>{t.observacao}</div> : null}
      </div>
      {!fechada ? (
        <button type="button" className={styles.editar} onClick={onEditar}>
          Editar
        </button>
      ) : null}
    </div>
  );
}

function SemanaPassada({
  o,
  provDe,
  semAcao,
  fechada,
  pendente,
  onFeito,
  onNaoFeito,
}: {
  o: ReuniaoObraDados;
  provDe: (id: string) => TarefaAtrib | null;
  semAcao: Set<string>;
  fechada: boolean;
  pendente: boolean;
  onFeito: (it: ItemPassada) => void;
  onNaoFeito: (it: ItemPassada) => void;
}) {
  const itens = [...o.passadaConcluir, ...o.passadaComecar];
  return (
    <>
      <h2 className={styles.h2}>O que estava previsto aconteceu?</h2>
      {itens.length === 0 ? (
        <p className={styles.vazio}>Nada previsto para concluir ou começar na semana passada.</p>
      ) : null}
      {itens.map((it) => {
        const prov = provDe(it.atividadeId);
        const feito = !prov && (it.ok || semAcao.has(it.atividadeId));
        const nao = Boolean(prov);
        const concluida = it.tipo === 'concluir' && it.ok;
        return (
          <div
            key={`${it.tipo}-${it.atividadeId}`}
            className={`${styles.card} ${nao ? styles.cardAtraso : ''}`}
          >
            <div className={styles.cardTopo}>
              <b>{it.nome}</b>
              <span className={styles.cinza}>
                {it.tipo === 'concluir' ? 'previsto concluir até' : 'previsto começar'}{' '}
                {formatarDataCurta(it.data)}
              </span>
              {!it.ok && !feito ? (
                <Atraso texto={`Atrasada · prevista ${formatarDataCurta(it.data)}`} />
              ) : null}
            </div>
            {concluida ? (
              <div className={styles.concluida}>
                <span className={styles.icOk} aria-hidden="true">
                  <Icon name="checkGrosso" size={14} strokeWidth={3} />
                </span>
                Concluída no app
              </div>
            ) : (
              <div className={styles.dois}>
                <button
                  type="button"
                  aria-pressed={feito}
                  disabled={fechada || pendente || nao}
                  className={`${styles.opcao} ${feito ? styles.opcaoOk : ''}`}
                  onClick={() => onFeito(it)}
                >
                  {feito ? <Icon name="checkGrosso" size={16} strokeWidth={3} /> : null}
                  {it.tipo === 'concluir' ? 'Feito' : 'Começou'}
                </button>
                <button
                  type="button"
                  aria-pressed={nao}
                  disabled={fechada}
                  className={`${styles.opcao} ${nao ? styles.opcaoNao : ''}`}
                  onClick={() => onNaoFeito(it)}
                >
                  {nao ? <Icon name="close" size={14} strokeWidth={3} /> : null}
                  {it.tipo === 'concluir' ? 'Não feito' : 'Não começou'}
                </button>
              </div>
            )}
            {prov ? <ProvLinha t={prov} fechada={fechada} onEditar={() => onNaoFeito(it)} /> : null}
          </div>
        );
      })}
    </>
  );
}

function Observacoes({
  o,
  novas,
  anteriores,
  provDe,
  fechada,
  onSalvar,
}: {
  o: ReuniaoObraDados;
  novas: TarefaAtrib[];
  anteriores: TarefaAtrib[];
  provDe: (id: string) => TarefaAtrib | null;
  fechada: boolean;
  onSalvar: (texto: string) => void;
}) {
  const itens = [...o.passadaConcluir, ...o.passadaComecar];
  const naoFeitos = itens.filter((it) => provDe(it.atividadeId));
  const feitos = itens.filter((it) => it.ok && !provDe(it.atividadeId));
  const anterioresAbertas = anteriores.filter((t) => !t.concluido);
  const porPessoa = new Map<string, number>();
  for (const t of novas) porPessoa.set(t.pessoa, (porPessoa.get(t.pessoa) ?? 0) + 1);
  const pessoasTxt = [...porPessoa.entries()].map(([p, n]) => `${p} ${n}`).join(' · ');

  return (
    <>
      <h2 className={styles.h2}>Observações da obra</h2>
      <p className={styles.dica}>
        Avanços, combinados e o que mais precisa ficar registrado na ata.
      </p>
      <textarea
        key={o.obraId}
        className={styles.obs}
        rows={5}
        aria-label="Observações da obra"
        defaultValue={o.observacoes}
        disabled={fechada}
        placeholder="Ex.: tapume entregue na sexta; caçamba atrasou um dia"
        onBlur={(e) => {
          if (e.target.value !== o.observacoes) onSalvar(e.target.value);
        }}
      />
      <h3 className={styles.secao}>Antes de fechar a ata</h3>
      <div className={styles.card}>
        <div className={styles.resumoLinha}>
          <span className={styles.icOk} aria-hidden="true">
            <Icon name="checkGrosso" size={14} strokeWidth={3} />
          </span>
          {plural(feitos.length, 'previsto feito', 'previstos feitos')}
        </div>
        <div className={styles.resumoLinha}>
          <span className={styles.icNao} aria-hidden="true">
            <Icon name="close" size={12} strokeWidth={3} />
          </span>
          <span>
            {plural(naoFeitos.length, 'não feito', 'não feitos')}
            {naoFeitos.length ? ` · ${naoFeitos.map((n) => n.nome).join(', ')}` : ''}
          </span>
        </div>
        <div className={styles.resumoLinha}>
          <span className={styles.icAtraso} aria-hidden="true">
            <Icon name="relogio" size={14} strokeWidth={2.4} />
          </span>
          {plural(
            anterioresAbertas.length,
            'providência anterior em aberto',
            'providências anteriores em aberto',
          )}
        </div>
        <div className={styles.resumoTotal}>
          <b>{plural(novas.length, 'providência nova', 'providências novas')}</b>
          {pessoasTxt ? ` · ${pessoasTxt}` : ''}
        </div>
      </div>
    </>
  );
}
