import { useMemo, useState } from 'react';
import {
  ETIQUETA_SECAO,
  contarRespondidos,
  destinoNaAta,
  eficienciaObraGeral,
  horaCurta,
  montarObraAta,
  podePlanejarObraGeral,
  reuniaoQueVem,
  rotuloPapelGeral,
  type RespostaReuniao,
  type SecaoResposta,
} from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../../lib/datas';
import { dataLocal, hojeISO } from '../../obras/api';
import type { EntradaTarefa } from '../../obras/campo';
import { TarefaSheet } from '../../obras/TarefaSheet';
import type { TarefaObra } from '../../obras/tarefasObra';
import type { PessoaAtual } from '../../perfil/usePerfil';
import type { PessoaResumo } from '../../perfil/usePessoas';
import { AtaView } from '../../reuniao/AtaView';
import {
  acaoDoItem,
  acoesDaObra,
  origemDa,
  respostaCobranca,
  respostaDe,
  type ItemPassadaPauta,
  type ItemSemanaPauta,
} from '../../reuniao/ataDados';
import type { TarefaAtrib } from '../../reuniao/reuniaoApi';
import {
  Atraso,
  BlocoPrevia,
  Botoes,
  Etiqueta,
  NaAta,
  ProvLinha,
} from '../../reuniao/ReuniaoScreen';
import styles from '../../reuniao/ReuniaoScreen.module.css';
import {
  entradaAtaGeral,
  montarAtaGeral,
  montarPautaGeral,
  respostaPassada,
  respostasDaPauta,
  semRespostaDaPauta,
} from './pautaGeral';
import type { ReuniaoGeral } from './reuniaoGeralApi';
import { useConfigAvisosObra } from './useConfigAvisosObra';
import { useReuniaoGeral } from './useReuniaoGeral';

// A mesma pauta da Contorno (cobrança, semana passada, esta semana, fechamento), por datas.
const PASSOS = ['Cobrança', 'Semana passada', 'Esta semana', 'Fechamento'];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const ROTULO_PROV: Record<string, string> = {
  contratacao: 'CONTRATAR',
  locacao: 'ALUGAR',
  compra: 'COMPRAR',
};

function amanha(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return dataLocal(d);
}

/** Folha da ação (tarefa): nova (atribuir, com o item da pauta) ou edição. */
interface Folha {
  titulo: string;
  tarefa: TarefaObra | null;
  texto: string;
  vinculo: { tipo: 'atividade' | 'providencia'; id: string } | null;
  /** Resposta gravada ao salvar a ação. */
  resposta: { secao: SecaoResposta; itemId: string; valor: RespostaReuniao } | null;
  /** "Não feita" de ação já concluída: reabre ao salvar. */
  reabrirTarefaId?: string | null;
}

function tarefaObra(t: TarefaAtrib): TarefaObra {
  return {
    id: t.id,
    obra_id: t.obraId,
    texto: t.texto,
    responsavel_id: t.responsavelId,
    responsavelNome: t.pessoa,
    responsavelNomeBruto: t.responsavelNome,
    observacao: t.observacao,
    prazo: t.prazo ?? '',
    prazo_original: t.prazoOriginal,
    replanejamentos: t.replanejamentos,
    status: t.concluido ? 'feita' : 'aberta',
    vinculo_tipo: t.vinculoTipo,
    vinculo_id: t.vinculoId,
    origem_texto: t.origem,
    avanco_pct: t.avancoPct,
    comentario: t.comentario,
    avanco_em: t.avancoEm,
    feita_em: t.feitaEm,
  };
}

/**
 * Reunião da obra geral (decisão 1): a pauta da Contorno para uma obra só, por datas
 * (decisão 2). Qualquer participante responde e escreve a observação; quem planeja a obra
 * (Coordenador, Administrador) cria as ações e fecha a ata.
 */
export function ReuniaoGeralScreen({
  obraId,
  data: dataEscolhida,
  pessoa,
  onVoltar,
  onReunioes,
  onMinhas,
}: {
  obraId: string;
  /** Reunião escolhida na lista; sem ela, a que vem. */
  data?: string | null;
  pessoa: PessoaAtual;
  onVoltar: () => void;
  /** Reuniões e atas da obra. */
  onReunioes: () => void;
  /** Ações da equipe da obra (botão "Minhas ações" da ata). */
  onMinhas: () => void;
}) {
  const hoje = hojeISO();
  // A reunião que vem, no dia da obra (Reunião e avisos da obra); a escolhida na lista
  // (as passadas só são lidas). Espera a configuração para não abrir a data errada.
  const { config: agenda, query: agendaQuery } = useConfigAvisosObra(obraId);
  const queVem = reuniaoQueVem(hoje, agenda.reuniaoDia);
  const data = dataEscolhida ?? (agendaQuery.isSuccess ? queVem : '');
  const verAnterior = Boolean(dataEscolhida) && agendaQuery.isSuccess && data < queVem;
  const { showToast } = useToast();
  const r = useReuniaoGeral(obraId, data, !verAnterior);
  const { query } = r;
  const planeja = podePlanejarObraGeral({
    administrador: pessoa.administrador,
    acessoContorno: pessoa.acessoContorno,
    papelGeral: pessoa.papelGeral,
  });

  const [menuAberto, setMenuAberto] = useState(false);
  const [ataAberta, setAtaAberta] = useState(false);
  const [baixarAtaAberta, setBaixarAtaAberta] = useState(false);
  const [gerarAberto, setGerarAberto] = useState(false);
  const [passo, setPasso] = useState(0);
  const [folha, setFolha] = useState<Folha | null>(null);

  const reuniao = query.data ?? null;
  const pauta = useMemo(() => (reuniao ? montarPautaGeral(reuniao, hoje) : null), [reuniao, hoje]);
  const fechada = reuniao?.status === 'fechada';
  const dataFmt = data ? formatarDataCurta(data) : '';
  const pessoas: PessoaResumo[] = useMemo(
    () =>
      (reuniao?.obra.pessoas ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        papel_texto: p.papel === 'administrador' ? 'Administrador' : rotuloPapelGeral(p.papel),
      })),
    [reuniao],
  );

  const acaoDe = (secao: SecaoResposta, id: string) =>
    reuniao ? acaoDoItem(reuniao, obraId, secao, id) : null;

  function irPasso(p: number) {
    setPasso(p);
    window.scrollTo({ top: 0 });
  }

  function responder(
    secao: SecaoResposta,
    itemId: string,
    resposta: RespostaReuniao | null,
    tarefaId?: string | null,
  ) {
    if (!reuniao) return;
    r.responder.mutate(
      { reuniaoId: reuniao.id, secao, itemId, resposta, tarefaId },
      { onError: () => showToast({ message: 'Não foi possível gravar a resposta' }) },
    );
  }

  /** Ação do item: quem planeja abre a folha; os outros só gravam a resposta. */
  function pedirAcao(f: Folha) {
    if (planeja) {
      const existente = f.resposta ? acaoDe(f.resposta.secao, f.resposta.itemId) : null;
      setFolha(existente ? { ...f, tarefa: tarefaObra(existente) } : f);
      return;
    }
    if (f.resposta) responder(f.resposta.secao, f.resposta.itemId, f.resposta.valor);
    if (f.reabrirTarefaId) r.marcarFeita.mutate({ id: f.reabrirTarefaId, feita: false });
  }

  function salvarFolha(e: EntradaTarefa) {
    if (!folha || !reuniao) return;
    const f = folha;
    r.salvarAcao.mutate(
      // Edição mantém o vínculo da ação; a nova nasce ligada ao item e com a origem da reunião.
      f.tarefa
        ? { ...e, vinculoTipo: f.tarefa.vinculo_tipo, vinculoId: f.tarefa.vinculo_id }
        : {
            ...e,
            vinculoTipo: f.vinculo?.tipo ?? null,
            vinculoId: f.vinculo?.id ?? null,
            origemTexto: origemDa(reuniao),
          },
      {
        onSuccess: (tarefaId) => {
          if (f.resposta)
            responder(f.resposta.secao, f.resposta.itemId, f.resposta.valor, tarefaId);
          if (f.reabrirTarefaId) r.marcarFeita.mutate({ id: f.reabrirTarefaId, feita: false });
          setFolha(null);
          showToast({ message: 'Ação salva · vai para as Ações da equipe' });
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
        onError: () => {
          responder('cobranca', t.id, null);
          showToast({ message: 'Não foi possível marcar' });
        },
      },
    );
  }

  function naoFeitaCobranca(t: TarefaAtrib) {
    pedirAcao({
      titulo: 'Remarcar ação',
      tarefa: tarefaObra(t),
      texto: t.texto,
      vinculo: null,
      resposta: { secao: 'cobranca', itemId: t.id, valor: 'nao_feita' },
      reabrirTarefaId: t.concluido ? t.id : null,
    });
  }

  // --- Passo 2 · Semana passada ---
  function terminou(it: ItemPassadaPauta) {
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

  function naoTerminou(it: ItemPassadaPauta) {
    pedirAcao({
      titulo: 'Não terminou · o que fazer?',
      tarefa: null,
      texto: `Concluir ${it.nome.toLowerCase()}`,
      vinculo: { tipo: 'atividade', id: it.atividadeId },
      resposta: { secao: it.secao, itemId: it.atividadeId, valor: 'nao_terminou' },
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
    pedirAcao({
      titulo: it.secao === 'semana_providencia' ? 'Quem cuida?' : 'Precisa de ação',
      tarefa: null,
      texto: it.sugestao,
      vinculo: { tipo: it.vinculoTipo, id: it.id },
      resposta: { secao: it.secao, itemId: it.id, valor: 'acao' },
    });
  }

  function gerarAta() {
    if (!reuniao || !pauta) return;
    if (fechada) {
      setAtaAberta(true);
      return;
    }
    r.fechar.mutate(
      {
        id: reuniao.id,
        snapshot: {
          eficienciaPct: eficienciaObraGeral(reuniao.obra.atividades, hoje).pct,
          atrasadas: pauta.atrasadas,
        },
      },
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

  if ((ataAberta || baixarAtaAberta) && reuniao && pauta) {
    return (
      <AtaView
        reuniao={reuniao}
        ataPronta={montarAtaGeral(reuniao, pauta, hoje)}
        baixarAoAbrir={baixarAtaAberta}
        onVoltar={() => {
          setAtaAberta(false);
          setBaixarAtaAberta(false);
        }}
        onMinhas={onMinhas}
      />
    );
  }

  const cont = reuniao && pauta ? contarRespondidos(respostasDaPauta(reuniao, pauta)) : null;

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.topo}>
          <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
            <Icon name="chevronLeft" size={22} />
          </button>
          <div>
            <h1 className={styles.titulo}>{dataFmt ? `Reunião de ${dataFmt}` : 'Reunião'}</h1>
            <div className={styles.sub}>
              {fechada
                ? `${reuniao?.obra.nome ?? ''} · ata gerada`
                : reuniao
                  ? `${reuniao.obra.nome} · ${horaCurta(reuniao.hora)}`
                  : 'Ata em construção'}
            </div>
          </div>
          <button
            type="button"
            className={styles.mais}
            aria-label="Mais opções da reunião"
            title="Mais opções"
            onClick={() => setMenuAberto(true)}
          >
            <Icon name="more" size={22} />
          </button>
        </div>
      </header>

      {reuniao && pauta ? (
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
        {query.isLoading || agendaQuery.isLoading ? (
          <p className={styles.vazio}>Montando a pauta…</p>
        ) : query.isError || agendaQuery.isError ? (
          <p className={styles.vazio}>Não foi possível montar a pauta. Tente de novo.</p>
        ) : !reuniao || !pauta ? (
          <p className={styles.vazio}>
            {verAnterior ? `Não houve reunião em ${dataFmt}.` : 'Nenhuma reunião para mostrar.'}
          </p>
        ) : (
          <>
            {cont && cont.total > 0 ? (
              <div className={styles.contador}>
                <Icon name="checkGrosso" size={13} strokeWidth={3} />
                {cont.respondidos} de {cont.total} respondidos
              </div>
            ) : null}

            {passo === 0 ? (
              <Cobranca
                reuniao={reuniao}
                itens={pauta.cobranca}
                fechada={fechada}
                onFeita={feitaCobranca}
                onNaoFeita={naoFeitaCobranca}
              />
            ) : passo === 1 ? (
              <>
                <h2 className={styles.h2}>O que estava previsto aconteceu?</h2>
                {pauta.passada.length === 0 ? (
                  <p className={styles.vazio}>Nada previsto para terminar na semana passada.</p>
                ) : null}
                {pauta.passada.map((it) => {
                  const acao = acaoDe(it.secao, it.atividadeId);
                  const resp = respostaPassada(reuniao, it);
                  return (
                    <div
                      key={it.atividadeId}
                      className={`${styles.card} ${resp === 'nao_terminou' ? styles.cardAtraso : ''}`}
                    >
                      <Etiqueta texto={ETIQUETA_SECAO[it.secao]} escura />
                      <div className={styles.cardTopo}>
                        <b>{it.nome}</b>
                        <span className={styles.cinza}>
                          data prevista {formatarDataCurta(it.data)}
                          {!it.ok ? ` · no app: ${it.avancoPct}%` : ''}
                        </span>
                        {!resp ? (
                          <Atraso texto={`Atrasada · prevista ${formatarDataCurta(it.data)}`} />
                        ) : null}
                      </div>
                      {it.ok ? (
                        <div className={styles.concluida}>
                          <span className={styles.icOk} aria-hidden="true">
                            <Icon name="checkGrosso" size={14} strokeWidth={3} />
                          </span>
                          Concluída no app
                        </div>
                      ) : (
                        <>
                          <div className={styles.pergunta}>Terminou?</div>
                          <Botoes
                            secao={it.secao}
                            resposta={resp}
                            fechada={fechada || r.concluirAtv.isPending}
                            travaPositivo={Boolean(acao)}
                            onPositivo={() => terminou(it)}
                            onNegativo={() => naoTerminou(it)}
                          />
                        </>
                      )}
                      {acao ? (
                        <ProvLinha
                          t={acao}
                          fechada={fechada || !planeja}
                          onEditar={() => naoTerminou(it)}
                        />
                      ) : null}
                      {acao && planeja && !fechada ? (
                        <p className={styles.cinza}>Para mudar a resposta, edite a ação.</p>
                      ) : null}
                      {resp ? <NaAta texto={destinoNaAta(it.secao, resp, acao?.pessoa)} /> : null}
                    </div>
                  );
                })}
              </>
            ) : passo === 2 ? (
              <>
                <h2 className={styles.h2}>O que vem pela frente está garantido?</h2>
                {pauta.semana.length === 0 ? (
                  <p className={styles.vazio}>Nada previsto para esta semana.</p>
                ) : null}
                {pauta.semana.map((it) => {
                  const acao = acaoDe(it.secao, it.id);
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
                        onLimpar={
                          resp === 'segue' ? () => responder(it.secao, it.id, null) : undefined
                        }
                      />
                      {acao ? (
                        <ProvLinha
                          t={acao}
                          fechada={fechada || !planeja}
                          onEditar={() => negativoSemana(it)}
                        />
                      ) : null}
                      {resp ? <NaAta texto={destinoNaAta(it.secao, resp, acao?.pessoa)} /> : null}
                    </div>
                  );
                })}
              </>
            ) : (
              <Fechamento
                key={reuniao.id}
                observacoes={reuniao.observacoes}
                linhas={montarObraAta(entradaAtaGeral(reuniao, pauta, hoje))}
                avulsas={acoesDaObra(reuniao, obraId).filter(
                  (t) =>
                    !t.vinculoId ||
                    ![
                      ...pauta.passada.map((x) => x.atividadeId),
                      ...pauta.semana.map((x) => x.id),
                    ].includes(t.vinculoId),
                )}
                fechada={fechada}
                planeja={planeja}
                semResposta={semRespostaDaPauta(reuniao, pauta)}
                onResponder={irPasso}
                onEditarAvulsa={(t) =>
                  setFolha({
                    titulo: 'Ação',
                    tarefa: tarefaObra(t),
                    texto: t.texto,
                    vinculo: null,
                    resposta: null,
                  })
                }
                onNova={() =>
                  setFolha({
                    titulo: 'Nova ação',
                    tarefa: null,
                    texto: '',
                    vinculo: null,
                    resposta: null,
                  })
                }
                onSalvarObs={(texto) =>
                  r.observacao.mutate(
                    { reuniaoId: reuniao.id, texto },
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

      {reuniao && pauta ? (
        <div className={styles.rodape}>
          <button
            type="button"
            className={styles.anterior}
            disabled={passo === 0}
            onClick={() => irPasso(passo - 1)}
          >
            Voltar
          </button>
          {passo < 3 ? (
            <button type="button" className={styles.avancar} onClick={() => irPasso(passo + 1)}>
              Continuar
            </button>
          ) : fechada ? (
            <button type="button" className={styles.avancar} onClick={() => setAtaAberta(true)}>
              Ver ata da reunião
            </button>
          ) : (
            <button type="button" className={styles.avancar} onClick={() => setGerarAberto(true)}>
              {planeja ? 'Gerar ata da reunião' : 'Ver pauta da reunião'}
            </button>
          )}
        </div>
      ) : null}

      <BottomSheet
        open={gerarAberto}
        title="Pauta da reunião"
        onClose={() => setGerarAberto(false)}
      >
        {reuniao && cont ? (
          <div className={styles.pauta}>
            <div className={styles.pautaLinha}>
              <span
                className={cont.respondidos === cont.total ? styles.icOk : styles.icVazio}
                aria-hidden="true"
              >
                {cont.respondidos === cont.total ? (
                  <Icon name="checkGrosso" size={13} strokeWidth={3} />
                ) : null}
              </span>
              <b>{reuniao.obra.nome}</b>
              <span className={styles.cinza}>
                {cont.respondidos} de {cont.total} respondidos
              </span>
            </div>
          </div>
        ) : null}
        <p className={styles.dica}>Itens sem resposta saem na ata como “sem resposta”.</p>
        {planeja ? (
          <button
            type="button"
            className={styles.gerar}
            disabled={r.fechar.isPending}
            onClick={gerarAta}
          >
            {r.fechar.isPending ? 'Gerando…' : 'Gerar ata da reunião'}
          </button>
        ) : (
          <p className={styles.soGestor}>O Coordenador gera a ata ao fim da reunião.</p>
        )}
      </BottomSheet>

      <BottomSheet
        open={menuAberto}
        title={dataFmt ? `Reunião de ${dataFmt}` : 'Reunião'}
        onClose={() => setMenuAberto(false)}
      >
        <div className={styles.menu}>
          {fechada && reuniao ? (
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                setMenuAberto(false);
                setBaixarAtaAberta(true);
              }}
            >
              <Icon name="baixar" size={20} />
              <span>
                <b>Baixar ata · PDF</b>
                <span>Resumo em tabela e ata completa da obra</span>
              </span>
            </button>
          ) : null}
          {fechada && reuniao && planeja ? (
            <button
              type="button"
              className={styles.menuItem}
              disabled={r.reabrir.isPending}
              onClick={() =>
                r.reabrir.mutate(reuniao.id, {
                  onSuccess: () => {
                    setMenuAberto(false);
                    showToast({ message: 'Pauta reaberta' });
                  },
                  onError: () => showToast({ message: 'Não foi possível reabrir a pauta' }),
                })
              }
            >
              <Icon name="undo" size={20} />
              <span>
                <b>Reabrir a pauta</b>
                <span>Volta a responder e gera a ata de novo</span>
              </span>
            </button>
          ) : null}
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setMenuAberto(false);
              onReunioes();
            }}
          >
            <Icon name="calendario" size={20} />
            <span>
              <b>Reuniões e atas</b>
              <span>A próxima e as atas das reuniões passadas</span>
            </span>
          </button>
        </div>
      </BottomSheet>

      {folha && reuniao ? (
        <TarefaSheet
          key={`${folha.titulo}:${folha.tarefa?.id ?? folha.vinculo?.id ?? 'nova'}`}
          aberto
          tarefa={folha.tarefa}
          pessoas={pessoas}
          ambiente="geral"
          pendente={r.salvarAcao.isPending}
          modo={folha.tarefa ? undefined : 'atribuir'}
          inicial={folha.tarefa ? undefined : { texto: folha.texto, prazo: amanha(), obraId }}
          tituloAtribuir={folha.titulo}
          onSalvar={salvarFolha}
          onFechar={() => setFolha(null)}
        />
      ) : null}
    </div>
  );
}

function Cobranca({
  reuniao,
  itens,
  fechada,
  onFeita,
  onNaoFeita,
}: {
  reuniao: ReuniaoGeral;
  itens: TarefaAtrib[];
  fechada: boolean;
  onFeita: (t: TarefaAtrib) => void;
  onNaoFeita: (t: TarefaAtrib) => void;
}) {
  return (
    <>
      <h2 className={styles.h2}>As ações combinadas foram feitas?</h2>
      {itens.length === 0 ? <p className={styles.vazio}>Nada para cobrar nesta obra.</p> : null}
      {itens.map((t) => {
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
              onPositivo={() => onFeita(t)}
              onNegativo={() => onNaoFeita(t)}
            />
            {resp ? <NaAta texto={destinoNaAta('cobranca', resp)} /> : null}
          </div>
        );
      })}
    </>
  );
}

function Fechamento({
  observacoes,
  linhas,
  avulsas,
  fechada,
  planeja,
  semResposta,
  onResponder,
  onEditarAvulsa,
  onNova,
  onSalvarObs,
}: {
  observacoes: string;
  linhas: ReturnType<typeof montarObraAta>;
  avulsas: TarefaAtrib[];
  fechada: boolean;
  planeja: boolean;
  semResposta: { nome: string; passo: number }[];
  onResponder: (passo: number) => void;
  onEditarAvulsa: (t: TarefaAtrib) => void;
  onNova: () => void;
  onSalvarObs: (texto: string) => void;
}) {
  const blocos = [
    linhas.aconteceu,
    linhas.naoAconteceu,
    linhas.proximaSemana,
    linhas.providencias,
    linhas.cobranca,
  ];
  return (
    <>
      <h2 className={styles.h2}>Observações da obra</h2>
      <textarea
        className={styles.obs}
        rows={3}
        aria-label="Observações da obra"
        defaultValue={observacoes}
        disabled={fechada}
        placeholder="Ex.: tapume entregue na sexta; caçamba atrasou um dia"
        onBlur={(e) => {
          if (e.target.value !== observacoes) onSalvarObs(e.target.value);
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
        <ProvLinha
          key={t.id}
          t={t}
          fechada={fechada || !planeja}
          onEditar={() => onEditarAvulsa(t)}
        />
      ))}
      {!fechada && planeja ? (
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
        {blocos.every((x) => x.length === 0) ? (
          <p className={styles.cinza}>Nada desta obra na ata ainda.</p>
        ) : null}
      </div>
    </>
  );
}
