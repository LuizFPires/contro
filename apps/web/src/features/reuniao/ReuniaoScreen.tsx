import { useMemo, useState } from 'react';
import {
  ETIQUETA_SECAO,
  RESPOSTAS_POR_SECAO,
  ROTULO_RESPOSTA,
  contarRespondidos,
  destinoNaAta,
  montarObraAta,
  reuniaoDaSemana,
  simularConclusaoEm,
  type LinhaAta,
  type RespostaReuniao,
  type SecaoResposta,
} from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { usePerfil } from '../perfil/usePerfil';
import { usePessoas } from '../perfil/usePessoas';
import { hojeISO } from '../obras/api';
import { useConfigAvisos } from '../avisos/useConfigAvisos';
import { formatarDataCurta } from '../../lib/datas';
import { AtaView } from './AtaView';
import {
  ProvidenciaSheet,
  type CabecalhoProvidencia,
  type ValoresProvidencia,
} from './ProvidenciaSheet';
import {
  acoesDaObra,
  cobrancaDaObra,
  entradaObraAta,
  itensPassada,
  itensSemana,
  origemDa,
  respostaCobranca,
  respostaDe,
  respostasDaObra,
  type ItemPassadaPauta,
  type ItemSemanaPauta,
} from './ataDados';
import { useNomesSugeridos } from './useNomesSugeridos';
import { useReuniao } from './useReuniao';
import type { ReuniaoObraDados, TarefaAtrib } from './reuniaoApi';
import styles from './ReuniaoScreen.module.css';

// Pauta por obra (decisão do usuário, 29/10/2026): começa cobrando o combinado,
// depois o que estava previsto, o que vem pela frente e o fechamento.
const PASSOS = ['Cobrança', 'Semana passada', 'Esta semana', 'Fechamento'];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const VAZIO: ValoresProvidencia = {
  texto: '',
  responsavelId: null,
  responsavelNome: null,
  prazo: '',
  observacao: '',
};

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
  /** Resposta gravada ao salvar a ação. */
  resposta: { secao: SecaoResposta; itemId: string; valor: RespostaReuniao } | null;
  /** "Quanto andou?": atividade cujo avanço é gravado ao salvar. */
  avancoAtividadeId: string | null;
  avancoAntes: number;
}

/** Reunião semanal: obra por obra, em 4 passos, até a ata. */
export function ReuniaoScreen({
  onVoltar,
  onMinhas,
}: {
  onVoltar: () => void;
  onMinhas: () => void;
}) {
  const hoje = hojeISO();
  // Reunião desta semana no dia configurado pelo gestor (Reunião e avisos).
  const { config: agenda } = useConfigAvisos();
  const data = reuniaoDaSemana(hoje, agenda.reuniaoDia);
  const { data: pessoa } = usePerfil();
  const { data: pessoas = [] } = usePessoas();
  const { data: nomesSugeridos = [] } = useNomesSugeridos();
  const { showToast } = useToast();
  const r = useReuniao(data);
  const { query } = r;

  const [ataAberta, setAtaAberta] = useState(false);
  const [gerarAberto, setGerarAberto] = useState(false);
  const [obraSel, setObraSel] = useState<string | null>(null);
  const [passo, setPasso] = useState(0);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const reuniao = query.data;
  const obras = useMemo(() => reuniao?.obras ?? [], [reuniao]);
  const fechada = reuniao?.status === 'fechada';
  const ehGestor = pessoa?.perfil === 'gestor';
  const dataFmt = formatarDataCurta(data);

  const idx = Math.max(
    0,
    obras.findIndex((o) => o.obraId === obraSel),
  );
  const o = obras[idx] as ReuniaoObraDados | undefined;
  const novas = reuniao && o ? acoesDaObra(reuniao, o.obraId) : [];
  const acaoDe = (id: string) => novas.find((t) => t.vinculoId === id) ?? null;

  const contagem = (x: ReuniaoObraDados) =>
    reuniao ? contarRespondidos(respostasDaObra(reuniao, x)) : { respondidos: 0, total: 0 };

  function irObra(i: number) {
    setObraSel(obras[i]?.obraId ?? null);
    setPasso(0);
    window.scrollTo({ top: 0 });
  }
  function irPasso(p: number) {
    setPasso(p);
    window.scrollTo({ top: 0 });
  }

  function responder(
    secao: SecaoResposta,
    itemId: string,
    resposta: RespostaReuniao | null,
    obraId = o?.obraId,
  ) {
    if (!reuniao || !obraId) return;
    r.responder.mutate(
      { reuniaoId: reuniao.id, obraId, secao, itemId, resposta },
      { onError: () => showToast({ message: 'Não foi possível gravar a resposta' }) },
    );
  }

  function abrirAcao(
    base: Omit<Sheet, 'obraId' | 'info' | 'tarefaId' | 'avancoAntes'> & {
      avancoAntes?: number;
    },
  ) {
    if (!o) return;
    const existente = base.vinculo ? acaoDe(base.vinculo.id) : null;
    setSheet({
      obraId: o.obraId,
      info: null,
      tarefaId: existente?.id ?? null,
      avancoAntes: base.avancoAntes ?? 0,
      ...base,
      inicial: existente
        ? {
            texto: existente.texto,
            responsavelId: existente.responsavelId,
            responsavelNome: existente.responsavelId ? null : existente.responsavelNome,
            prazo: existente.prazo ?? '',
            observacao: existente.observacao ?? '',
            avancoPct: base.inicial.avancoPct,
          }
        : base.inicial,
    });
  }

  function salvarSheet(v: ValoresProvidencia) {
    if (!sheet || !reuniao) return;
    const s = sheet;
    r.salvarProvidencia.mutate(
      {
        obraId: s.obraId,
        entrada: {
          id: s.tarefaId,
          texto: v.texto,
          responsavelId: v.responsavelId,
          responsavelNome: v.responsavelNome,
          prazo: v.prazo,
          observacao: v.observacao,
          vinculoTipo: s.vinculo?.tipo ?? null,
          vinculoId: s.vinculo?.id ?? null,
          origemTexto: s.tarefaId ? undefined : origemDa(reuniao),
        },
      },
      {
        onSuccess: () => {
          if (s.resposta)
            responder(s.resposta.secao, s.resposta.itemId, s.resposta.valor, s.obraId);
          if (s.avancoAtividadeId && v.avancoPct != null && v.avancoPct !== s.avancoAntes) {
            r.avancoAtv.mutate({ atividadeId: s.avancoAtividadeId, pct: v.avancoPct });
          }
          setSheet(null);
          showToast({ message: 'Ação salva · vai para as Tarefas de quem cuida' });
        },
        onError: () => showToast({ message: 'Não foi possível salvar a ação' }),
      },
    );
  }

  // --- Passo 1 · Cobrança ---
  function feitaCobranca(t: TarefaAtrib) {
    responder('cobranca', t.id, 'feita');
    if (t.concluido) return;
    r.marcarFeita.mutate(
      { id: t.id, feita: true },
      {
        onSuccess: () =>
          showToast({
            message: 'Ação marcada como feita',
            onUndo: () => {
              r.marcarFeita.mutate({ id: t.id, feita: false });
              responder('cobranca', t.id, null);
            },
          }),
        onError: () => showToast({ message: 'Não foi possível marcar' }),
      },
    );
  }

  function naoFeitaCobranca(t: TarefaAtrib) {
    if (!o) return;
    responder('cobranca', t.id, 'nao_feita');
    if (t.concluido) r.marcarFeita.mutate({ id: t.id, feita: false });
    const original = t.prazoOriginal ?? t.prazo;
    setSheet({
      obraId: o.obraId,
      titulo: 'Remarcar ação',
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
      impactoAtividadeId: null,
      vinculo: t.vinculoTipo && t.vinculoId ? { tipo: t.vinculoTipo, id: t.vinculoId } : null,
      tarefaId: t.id,
      resposta: null,
      avancoAtividadeId: null,
      avancoAntes: 0,
      inicial: {
        texto: t.texto,
        responsavelId: t.responsavelId,
        responsavelNome: t.responsavelId ? null : t.responsavelNome,
        prazo: t.prazo ?? '',
        observacao: t.observacao ?? '',
      },
    });
  }

  // --- Passo 2 · Semana passada ---
  function positivoPassada(it: ItemPassadaPauta) {
    if (it.secao === 'passada_comecar') {
      responder(it.secao, it.atividadeId, 'comecou');
      return;
    }
    responder(it.secao, it.atividadeId, 'terminou');
    r.concluirAtv.mutate(it.atividadeId, {
      onSuccess: () =>
        showToast({
          message: `${it.nome} concluída (sem foto)`,
          onUndo: () => {
            r.desfazerAtv.mutate(it.atividadeId, {
              onError: () => showToast({ message: 'Não foi possível desfazer' }),
            });
            responder(it.secao, it.atividadeId, null);
          },
        }),
      onError: () => {
        responder(it.secao, it.atividadeId, null);
        showToast({ message: 'Não foi possível concluir' });
      },
    });
  }

  function negativoPassada(it: ItemPassadaPauta) {
    const concluir = it.secao === 'passada_concluir';
    const avanco = Math.min(75, Math.floor(it.avancoPct / 25) * 25);
    abrirAcao({
      titulo: concluir ? 'Não terminou · o que fazer?' : 'Não começou · o que fazer?',
      cabecalho: {
        rotulo: ETIQUETA_SECAO[it.secao],
        atraso: true,
        nome: it.nome,
        etiquetaAtraso: `Atrasada · prevista ${formatarDataCurta(it.data)}`,
      },
      impactoAtividadeId: concluir ? it.atividadeId : null,
      vinculo: { tipo: 'atividade', id: it.atividadeId },
      resposta: {
        secao: it.secao,
        itemId: it.atividadeId,
        valor: concluir ? 'nao_terminou' : 'nao_comecou',
      },
      avancoAtividadeId: concluir ? it.atividadeId : null,
      avancoAntes: avanco,
      inicial: {
        ...VAZIO,
        texto: `${concluir ? 'Concluir' : 'Começar'} ${it.nome.toLowerCase()}`,
        avancoPct: concluir ? avanco : null,
      },
    });
  }

  // --- Passo 3 · Esta semana ---
  function positivoSemana(it: ItemSemanaPauta) {
    if (it.secao !== 'semana_providencia') {
      responder(it.secao, it.id, 'segue');
      return;
    }
    responder(it.secao, it.id, 'ja_providenciado');
    r.marcarProv.mutate(
      { id: it.id, feito: true },
      {
        onSuccess: () =>
          showToast({
            message: `${it.nome} · providenciado`,
            onUndo: () => {
              r.marcarProv.mutate({ id: it.id, feito: false });
              responder(it.secao, it.id, null);
            },
          }),
        onError: () => {
          responder(it.secao, it.id, null);
          showToast({ message: 'Não foi possível marcar' });
        },
      },
    );
  }

  function negativoSemana(it: ItemSemanaPauta) {
    abrirAcao({
      titulo: it.secao === 'semana_providencia' ? 'Quem cuida?' : 'Precisa de ação',
      cabecalho: {
        rotulo: ETIQUETA_SECAO[it.secao],
        atraso: Boolean(it.atraso),
        nome: it.nome,
        etiquetaAtraso: it.atraso,
      },
      impactoAtividadeId: null,
      vinculo: { tipo: it.vinculoTipo, id: it.id },
      resposta: { secao: it.secao, itemId: it.id, valor: 'acao' },
      avancoAtividadeId: null,
      inicial: { ...VAZIO, texto: it.sugestao },
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
    r.fechar.mutate(
      { id: reuniao.id, snapshots },
      {
        onSuccess: () => {
          setGerarAberto(false);
          setAtaAberta(true);
          showToast({ message: 'Reunião fechada · ata gerada' });
        },
        onError: () => showToast({ message: 'Não foi possível fechar a reunião' }),
      },
    );
  }

  if (ataAberta && reuniao) {
    return <AtaView reuniao={reuniao} onVoltar={() => setAtaAberta(false)} onMinhas={onMinhas} />;
  }

  const ultimaObra = idx >= obras.length - 1;
  const proxima = obras[idx + 1];
  const sheetImpacto =
    sheet?.impactoAtividadeId && o
      ? (prazo: string) =>
          simularConclusaoEm(o.inicio, o.entradaCronograma, sheet.impactoAtividadeId!, prazo)
      : null;
  const cont = o ? contagem(o) : null;

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.topo}>
          <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
            <Icon name="chevronLeft" size={22} />
          </button>
          <div>
            <h1 className={styles.titulo}>Reunião de {dataFmt}</h1>
            <div className={styles.sub}>
              {fechada
                ? 'Ata gerada'
                : o
                  ? `${o.nome} · obra ${idx + 1} de ${obras.length}`
                  : 'Ata em construção'}
            </div>
          </div>
        </div>
        {obras.length > 0 ? (
          <div className={styles.obras} role="tablist" aria-label="Obras da reunião">
            {obras.map((x, i) => {
              const c = contagem(x);
              const pronta = c.total > 0 && c.respondidos === c.total;
              return (
                <button
                  key={x.obraId}
                  type="button"
                  role="tab"
                  aria-selected={i === idx}
                  className={`${styles.obraChip} ${i === idx ? styles.obraChipOn : ''}`}
                  onClick={() => irObra(i)}
                >
                  {pronta ? (
                    <>
                      <Icon name="checkGrosso" size={13} strokeWidth={3} />
                      <span className="sr-only">tudo respondido: </span>
                    </>
                  ) : null}
                  {x.nome}
                </button>
              );
            })}
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
                disabled={r.reabrir.isPending}
                onClick={() =>
                  reuniao &&
                  r.reabrir.mutate(reuniao.id, {
                    onSuccess: () => showToast({ message: 'Pauta reaberta com as obras de hoje' }),
                    onError: () => showToast({ message: 'Não foi possível reabrir a pauta' }),
                  })
                }
              >
                <Icon name="undo" size={18} strokeWidth={2} />
                {r.reabrir.isPending ? 'Reabrindo…' : 'Reabrir pauta'}
              </button>
            ) : (
              <p className={styles.vazio}>Peça ao gestor para reabrir a pauta.</p>
            )}
          </div>
        ) : !o || !reuniao ? (
          <p className={styles.vazio}>Nenhuma obra em andamento para a pauta.</p>
        ) : (
          <>
            {cont && cont.total > 0 ? (
              <div className={styles.contador}>
                <Icon name="checkGrosso" size={13} strokeWidth={3} />
                {cont.respondidos} de {cont.total} respondidos nesta obra
              </div>
            ) : null}

            {passo === 0 ? (
              <>
                <h2 className={styles.h2}>O combinado na última reunião foi feito?</h2>
                {cobrancaDaObra(reuniao, o.obraId).length === 0 ? (
                  <p className={styles.vazio}>Nada para cobrar nesta obra.</p>
                ) : null}
                {cobrancaDaObra(reuniao, o.obraId).map((t) => {
                  const resp = respostaCobranca(reuniao, t);
                  return (
                    <div key={t.id} className={styles.card}>
                      <div className={styles.cardTopo}>
                        <b className={t.concluido ? styles.riscado : undefined}>{t.texto}</b>
                        <span className={styles.cinza}>
                          {t.pessoa} · até {t.prazo ? formatarDataCurta(t.prazo) : '—'}
                          {t.origem ? ` · ${t.origem}` : ''}
                        </span>
                        {t.atrasado && !t.concluido ? <Atraso texto="Atrasada" /> : null}
                      </div>
                      {!t.concluido && (t.avancoPct > 0 || t.comentario) ? (
                        <div className={styles.informou}>
                          <b>
                            {t.pessoa} informou {t.avancoPct}%
                            {t.avancoEm ? ` · ${formatarDataCurta(t.avancoEm.slice(0, 10))}` : ''}
                          </b>
                          {t.comentario ? <span>“{t.comentario}”</span> : null}
                        </div>
                      ) : null}
                      <Botoes
                        secao="cobranca"
                        resposta={resp}
                        fechada={fechada}
                        onPositivo={() => feitaCobranca(t)}
                        onNegativo={() => naoFeitaCobranca(t)}
                      />
                      {resp ? <NaAta texto={destinoNaAta('cobranca', resp)} /> : null}
                    </div>
                  );
                })}
              </>
            ) : passo === 1 ? (
              <>
                <h2 className={styles.h2}>O que estava previsto aconteceu?</h2>
                {itensPassada(o).length === 0 ? (
                  <p className={styles.vazio}>
                    Nada previsto para terminar ou começar na semana passada.
                  </p>
                ) : null}
                {itensPassada(o).map((it) => {
                  const acao = acaoDe(it.atividadeId);
                  const resp = respostaDe(reuniao, it.secao, it.atividadeId, {
                    concluida: it.ok,
                    avancoPct: it.avancoPct,
                  });
                  const negativo = resp === 'nao_terminou' || resp === 'nao_comecou';
                  const concluir = it.secao === 'passada_concluir';
                  return (
                    <div
                      key={`${it.secao}-${it.atividadeId}`}
                      className={`${styles.card} ${negativo ? styles.cardAtraso : ''}`}
                    >
                      <Etiqueta texto={ETIQUETA_SECAO[it.secao]} escura={concluir} />
                      <div className={styles.cardTopo}>
                        <b>{it.nome}</b>
                        <span className={styles.cinza}>
                          {concluir ? 'fim previsto' : 'início previsto'}{' '}
                          {formatarDataCurta(it.data)}
                          {!it.ok ? ` · no app: ${it.avancoPct}%` : ''}
                        </span>
                        {!resp ? (
                          <Atraso texto={`Atrasada · prevista ${formatarDataCurta(it.data)}`} />
                        ) : null}
                      </div>
                      {concluir && it.ok ? (
                        <div className={styles.concluida}>
                          <span className={styles.icOk} aria-hidden="true">
                            <Icon name="checkGrosso" size={14} strokeWidth={3} />
                          </span>
                          Concluída no app
                        </div>
                      ) : (
                        <>
                          <div className={styles.pergunta}>
                            {concluir ? 'Terminou?' : 'Começou?'}
                          </div>
                          <Botoes
                            secao={it.secao}
                            resposta={resp}
                            fechada={fechada || r.concluirAtv.isPending}
                            travaPositivo={Boolean(acao)}
                            onPositivo={() => positivoPassada(it)}
                            onNegativo={() => negativoPassada(it)}
                          />
                        </>
                      )}
                      {resp === 'comecou' && !it.ok && !fechada ? (
                        <div className={styles.andou}>
                          <span>
                            Quanto já andou? <span className={styles.cinza}>(opcional)</span>
                          </span>
                          <div className={styles.chips} role="group" aria-label="Quanto já andou">
                            {[0, 25, 50].map((p) => (
                              <button
                                key={p}
                                type="button"
                                aria-pressed={it.avancoPct === p}
                                className={`${styles.chip} ${it.avancoPct === p ? styles.chipOn : ''}`}
                                onClick={() =>
                                  r.avancoAtv.mutate({ atividadeId: it.atividadeId, pct: p })
                                }
                              >
                                {p === 0 ? 'Só começou' : `${p}%`}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {acao ? (
                        <ProvLinha
                          t={acao}
                          fechada={fechada}
                          onEditar={() => negativoPassada(it)}
                        />
                      ) : null}
                      {acao ? (
                        <p className={styles.cinza}>
                          Para mudar a resposta, edite ou exclua a ação.
                        </p>
                      ) : null}
                      {resp ? <NaAta texto={destinoNaAta(it.secao, resp, acao?.pessoa)} /> : null}
                    </div>
                  );
                })}
              </>
            ) : passo === 2 ? (
              <>
                <h2 className={styles.h2}>O que vem pela frente está garantido?</h2>
                {itensSemana(o).length === 0 ? (
                  <p className={styles.vazio}>Nada previsto para esta semana.</p>
                ) : null}
                {itensSemana(o).map((it) => {
                  const acao = acaoDe(it.id);
                  const resp = respostaDe(reuniao, it.secao, it.id);
                  return (
                    <div key={`${it.secao}-${it.id}`} className={styles.card}>
                      <Etiqueta
                        texto={
                          it.secao === 'semana_providencia'
                            ? ROTULO_PROV[it.tipoProvidencia ?? 'compra']
                            : ETIQUETA_SECAO[it.secao]
                        }
                        escura={it.secao === 'semana_concluir'}
                      />
                      <div className={styles.cardTopo}>
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
                      <Botoes
                        secao={it.secao}
                        resposta={resp}
                        fechada={fechada}
                        travaPositivo={Boolean(acao)}
                        onPositivo={() => positivoSemana(it)}
                        onNegativo={() => negativoSemana(it)}
                      />
                      {acao ? (
                        <ProvLinha t={acao} fechada={fechada} onEditar={() => negativoSemana(it)} />
                      ) : null}
                      {resp ? <NaAta texto={destinoNaAta(it.secao, resp, acao?.pessoa)} /> : null}
                    </div>
                  );
                })}
              </>
            ) : (
              <Fechamento
                o={o}
                reuniaoId={reuniao.id}
                linhas={montarObraAta(entradaObraAta(reuniao, o))}
                avulsas={novas.filter(
                  (t) =>
                    !t.vinculoId ||
                    ![
                      ...itensPassada(o).map((x) => x.atividadeId),
                      ...itensSemana(o).map((x) => x.id),
                    ].includes(t.vinculoId),
                )}
                fechada={fechada}
                semResposta={[
                  ...cobrancaDaObra(reuniao, o.obraId)
                    .filter((t) => !respostaCobranca(reuniao, t))
                    .map((t) => ({ nome: t.texto, passo: 0 })),
                  ...itensPassada(o)
                    .filter(
                      (it) =>
                        !respostaDe(reuniao, it.secao, it.atividadeId, {
                          concluida: it.ok,
                          avancoPct: it.avancoPct,
                        }),
                    )
                    .map((it) => ({ nome: it.nome, passo: 1 })),
                  ...itensSemana(o)
                    .filter((it) => !respostaDe(reuniao, it.secao, it.id))
                    .map((it) => ({ nome: it.nome, passo: 2 })),
                ]}
                onResponder={irPasso}
                onEditarAvulsa={(t) =>
                  setSheet({
                    obraId: o.obraId,
                    titulo: 'Ação',
                    cabecalho: null,
                    info: null,
                    impactoAtividadeId: null,
                    vinculo: null,
                    tarefaId: t.id,
                    resposta: null,
                    avancoAtividadeId: null,
                    avancoAntes: 0,
                    inicial: {
                      texto: t.texto,
                      responsavelId: t.responsavelId,
                      responsavelNome: t.responsavelId ? null : t.responsavelNome,
                      prazo: t.prazo ?? '',
                      observacao: t.observacao ?? '',
                    },
                  })
                }
                onNova={() =>
                  setSheet({
                    obraId: o.obraId,
                    titulo: 'Nova ação',
                    cabecalho: null,
                    info: null,
                    impactoAtividadeId: null,
                    vinculo: null,
                    tarefaId: null,
                    resposta: null,
                    avancoAtividadeId: null,
                    avancoAntes: 0,
                    inicial: VAZIO,
                  })
                }
                onSalvarObs={(texto) =>
                  r.observacao.mutate(
                    { reuniaoId: reuniao.id, obraId: o.obraId, texto },
                    {
                      onError: () => showToast({ message: 'Não foi possível salvar a observação' }),
                    },
                  )
                }
              />
            )}
          </>
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
          ) : fechada ? (
            <button type="button" className={styles.avancar} onClick={() => setAtaAberta(true)}>
              Ver ata da reunião
            </button>
          ) : (
            <button type="button" className={styles.avancar} onClick={() => setGerarAberto(true)}>
              {ehGestor ? 'Gerar ata da reunião' : 'Ver pauta da reunião'}
            </button>
          )}
        </div>
      ) : null}

      <BottomSheet
        open={gerarAberto}
        title="Pauta da reunião"
        onClose={() => setGerarAberto(false)}
      >
        <p className={styles.dica}>Respondidos em cada obra.</p>
        <div className={styles.pauta}>
          {obras.map((x, i) => {
            const c = contagem(x);
            const pronta = c.respondidos === c.total;
            return (
              <button
                key={x.obraId}
                type="button"
                className={styles.pautaLinha}
                onClick={() => {
                  setGerarAberto(false);
                  irObra(i);
                }}
              >
                <span className={pronta ? styles.icOk : styles.icVazio} aria-hidden="true">
                  {pronta ? <Icon name="checkGrosso" size={13} strokeWidth={3} /> : null}
                </span>
                <b>{x.nome}</b>
                <span className={styles.cinza}>
                  {c.respondidos} de {c.total}
                </span>
              </button>
            );
          })}
        </div>
        <p className={styles.dica}>Itens sem resposta saem na ata como “sem resposta”.</p>
        {ehGestor ? (
          <button
            type="button"
            className={styles.gerar}
            disabled={r.fechar.isPending}
            onClick={gerarAta}
          >
            {r.fechar.isPending ? 'Gerando…' : 'Gerar ata da reunião'}
          </button>
        ) : (
          <p className={styles.soGestor}>O gestor gera a ata ao fim da reunião.</p>
        )}
      </BottomSheet>

      <ProvidenciaSheet
        aberto={Boolean(sheet)}
        titulo={sheet?.titulo ?? ''}
        cabecalho={sheet?.cabecalho}
        info={sheet?.info}
        inicial={sheet?.inicial ?? VAZIO}
        hoje={hoje}
        dataReuniao={data}
        pessoas={pessoas}
        nomesSugeridos={nomesSugeridos}
        impacto={sheetImpacto}
        pendente={r.salvarProvidencia.isPending}
        rotuloSalvar="Salvar ação"
        onSalvar={salvarSheet}
        onFechar={() => setSheet(null)}
      />
    </div>
  );
}

const ROTULO_PROV: Record<string, string> = {
  contratacao: 'CONTRATAR',
  locacao: 'ALUGAR',
  compra: 'COMPRAR',
};

function Etiqueta({ texto, escura }: { texto: string; escura?: boolean }) {
  return <span className={escura ? styles.etiquetaEscura : styles.etiqueta}>{texto}</span>;
}

function NaAta({ texto }: { texto: string }) {
  return (
    <div className={styles.naAta}>
      <Icon name="documento" size={15} />
      <span>Na ata: {texto}</span>
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

/** Os dois botões da seção; o marcado mostra ícone (estado nunca só por cor). */
function Botoes({
  secao,
  resposta,
  fechada,
  travaPositivo,
  onPositivo,
  onNegativo,
}: {
  secao: SecaoResposta;
  resposta: RespostaReuniao | null;
  fechada: boolean;
  /** Já há ação para o item: o positivo fica travado (edite a ação). */
  travaPositivo?: boolean;
  onPositivo: () => void;
  onNegativo: () => void;
}) {
  const [pos, neg] = RESPOSTAS_POR_SECAO[secao];
  return (
    <div className={styles.dois}>
      <button
        type="button"
        aria-pressed={resposta === pos}
        disabled={fechada || travaPositivo || resposta === pos}
        className={`${styles.opcao} ${resposta === pos ? styles.opcaoOk : ''}`}
        onClick={onPositivo}
      >
        {resposta === pos ? <Icon name="checkGrosso" size={16} strokeWidth={3} /> : null}
        {ROTULO_RESPOSTA[pos]}
      </button>
      <button
        type="button"
        aria-pressed={resposta === neg}
        disabled={fechada}
        className={`${styles.opcao} ${resposta === neg ? styles.opcaoEscura : ''}`}
        onClick={onNegativo}
      >
        {resposta === neg ? <Icon name="close" size={14} strokeWidth={3} /> : null}
        {ROTULO_RESPOSTA[neg]}
      </button>
    </div>
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
          <Icon name="pessoa" size={13} /> <b>{t.pessoa}</b> · até{' '}
          {t.prazo ? formatarDataCurta(t.prazo) : '—'} · nas Tarefas
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

function BlocoPrevia({ titulo, linhas }: { titulo: string; linhas: LinhaAta[] }) {
  if (linhas.length === 0) return null;
  return (
    <div className={styles.previaBloco}>
      <div className={styles.previaTitulo}>{titulo}</div>
      {linhas.map((l, i) => (
        <div
          key={i}
          className={
            l.atraso ? styles.previaAtraso : l.semResposta ? styles.previaSem : styles.previaLinha
          }
        >
          {l.ok ? '✓ ' : l.atraso ? '✗ ' : ''}
          {l.texto}
          {l.acao ? ` → ${l.acao}` : ''}
        </div>
      ))}
    </div>
  );
}

function Fechamento({
  o,
  linhas,
  avulsas,
  fechada,
  semResposta,
  onResponder,
  onEditarAvulsa,
  onNova,
  onSalvarObs,
}: {
  o: ReuniaoObraDados;
  reuniaoId: string;
  linhas: ReturnType<typeof montarObraAta>;
  avulsas: TarefaAtrib[];
  fechada: boolean;
  semResposta: { nome: string; passo: number }[];
  onResponder: (passo: number) => void;
  onEditarAvulsa: (t: TarefaAtrib) => void;
  onNova: () => void;
  onSalvarObs: (texto: string) => void;
}) {
  return (
    <>
      <h2 className={styles.h2}>Observações da obra</h2>
      <textarea
        key={o.obraId}
        className={styles.obs}
        rows={3}
        aria-label="Observações da obra"
        defaultValue={o.observacoes}
        disabled={fechada}
        placeholder="Ex.: tapume entregue na sexta; caçamba atrasou um dia"
        onBlur={(e) => {
          if (e.target.value !== o.observacoes) onSalvarObs(e.target.value);
        }}
      />

      {semResposta.length > 0 && !fechada ? (
        <div className={styles.semResposta}>
          <b>{plural(semResposta.length, 'item sem resposta', 'itens sem resposta')}</b>
          {semResposta.map((s, i) => (
            <div key={i} className={styles.semRespostaLinha}>
              <span>{s.nome}</span>
              <button type="button" className={styles.editar} onClick={() => onResponder(s.passo)}>
                Responder
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <h3 className={styles.secao}>Outras ações desta obra</h3>
      {avulsas.length === 0 ? <p className={styles.cinza}>Nenhuma.</p> : null}
      {avulsas.map((t) => (
        <ProvLinha key={t.id} t={t} fechada={fechada} onEditar={() => onEditarAvulsa(t)} />
      ))}
      {!fechada ? (
        <button type="button" className={styles.adicionar} onClick={onNova}>
          + Nova ação
        </button>
      ) : null}

      <div className={styles.card}>
        <div className={styles.previaTopo}>
          <Icon name="documento" size={16} /> Como fica na ata
        </div>
        <BlocoPrevia titulo="PLANEJADO E ACONTECEU" linhas={linhas.aconteceu} />
        <BlocoPrevia titulo="PLANEJADO E NÃO ACONTECEU" linhas={linhas.naoAconteceu} />
        <BlocoPrevia titulo="PRÓXIMA SEMANA" linhas={linhas.proximaSemana} />
        <BlocoPrevia titulo="PROVIDÊNCIAS" linhas={linhas.providencias} />
        <BlocoPrevia titulo="COBRANÇA" linhas={linhas.cobranca} />
        {[
          linhas.aconteceu,
          linhas.naoAconteceu,
          linhas.proximaSemana,
          linhas.providencias,
          linhas.cobranca,
        ].every((x) => x.length === 0) ? (
          <p className={styles.cinza}>Nada desta obra na ata ainda.</p>
        ) : null}
      </div>
    </>
  );
}
