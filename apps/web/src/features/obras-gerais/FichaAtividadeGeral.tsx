import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  atalhosDataPrevista,
  diaCurto,
  podePlanejarObraGeral,
  ROTULO_TIPO_PROVIDENCIA,
  situacaoProvidenciaGeral,
  trilhaObraGeral,
  type SubitemGeral,
  type TipoProvidencia,
} from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { EscolherData } from '../../components/EscolherData';
import { VidaDoItem } from '../log/VidaDoItem';
import { hojeISO } from '../obras/api';
import { Camera } from '../obras/Camera';
import fichaStyles from '../obras/FichaAtividade.module.css';
import { LinhaPara } from '../obras/LinhaPara';
import linhaStyles from '../obras/LinhaPara.module.css';
import { NovaProvidenciaSheet } from '../obras/ProvidenciasAba';
import { CampoPrestador } from '../obras/CampoPrestador';
import { RodapeAvanco } from '../obras/RodapeAvanco';
import { TextoEditavel } from '../obras/TextoEditavel';
import { useAvanco } from '../obras/useAvanco';
import { useConcluirAtividade, type AoConcluir } from '../obras/useConcluirAtividade';
import { useObraCampo } from '../obras/useObraCampo';
import type { PessoaAtual } from '../perfil/usePerfil';
import { EditarSubitemSheet } from './EditarSubitemSheet';
import { EscolherResponsavel } from './EscolherResponsavel';
import styles from './FichaAtividadeGeral.module.css';
import type { ObraGeral } from './obraGeral';
import {
  definirDataPrevista,
  definirResponsavelAtividade,
  desfazerDataPrevista,
  desfazerResponsavelAtividade,
} from './planejamento';

const NOTA_MEMBRO =
  'Data e responsável são definidos pelo coordenador. Se não vai dar no prazo, fale com ele para ajustar.';

/** Ficha da atividade da obra geral (mockup C4, C12, J4): data, responsável, subitens e avanço. */
export function FichaAtividadeGeral({
  obra,
  atividadeId,
  pessoa,
  onClose,
}: {
  obra: ObraGeral;
  atividadeId: string;
  pessoa: PessoaAtual;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const campo = useObraCampo(obra.id);
  const conclusao = useConcluirAtividade(obra);
  const aoConcluir: AoConcluir = (r, det) =>
    showToast({
      message: r.fase_fechada
        ? `"${det.nome}" concluída · fase concluída`
        : `"${det.nome}" concluída`,
      onUndo: () => campo.desfazer.mutate({ atividadeId: det.atividadeId, xp: r.xp }),
    });
  const avanco = useAvanco(obra, aoConcluir, false);

  const [menuAberto, setMenuAberto] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [mudandoData, setMudandoData] = useState(false);
  const [trocandoResp, setTrocandoResp] = useState(false);
  const [camera, setCamera] = useState<'concluir' | 'anexar' | null>(null);
  const [novoTipo, setNovoTipo] = useState<TipoProvidencia | null>(null);
  const [provMenuId, setProvMenuId] = useState<string | null>(null);
  // `undefined` = fechado; `null` = subitem novo.
  const [subitemEdit, setSubitemEdit] = useState<SubitemGeral | null | undefined>(undefined);

  const planeja = podePlanejarObraGeral({
    administrador: pessoa.administrador,
    acessoContorno: pessoa.acessoContorno,
    papelGeral: pessoa.papelGeral,
  });

  const hoje = hojeISO();
  const item = useMemo(() => {
    const fases = trilhaObraGeral({
      fases: obra.fases,
      atividades: obra.atividades,
      hoje,
      pessoaId: pessoa.id,
      nomes: Object.fromEntries(obra.pessoas.map((p) => [p.id, p.nome])),
    });
    for (const f of fases) {
      const a = f.atividades.find((x) => x.id === atividadeId);
      if (a) return { a, fase: f.titulo };
    }
    return null;
  }, [obra, atividadeId, hoje, pessoa.id]);
  const bruta = obra.atividades.find((x) => x.id === atividadeId);

  if (!item || !bruta) return <BottomSheet open={false} onClose={onClose} children={null} />;
  const { a, fase } = item;
  const temSubitens = a.subitens.length > 0;
  const concluida = a.status === 'concluida';
  const feitos = a.subitens.filter((s) => s.feito).length;
  const nomeResp = a.responsavelId
    ? obra.pessoas.find((p) => p.id === a.responsavelId)?.nome
    : null;

  const status = concluida
    ? {
        txt: a.semFoto ? 'Concluída · sem foto' : 'Concluída',
        cls: fichaStyles.tagConcluida,
        icone: 'checkGrosso' as const,
      }
    : a.status === 'atrasada'
      ? { txt: 'Atrasada', cls: fichaStyles.tagAtrasada, icone: 'alert' as const }
      : a.status === 'vence_hoje'
        ? { txt: 'Vence hoje', cls: styles.tagHoje, icone: 'relogio' as const }
        : a.avancoPct > 0
          ? { txt: `Em andamento · ${a.avancoPct}%`, cls: fichaStyles.tagLiberada, icone: null }
          : { txt: 'Aberta', cls: fichaStyles.tagPlanejada, icone: null };

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ['obras-gerais', 'resumo'] });
    return qc.invalidateQueries({ queryKey: ['obra', obra.id] });
  };
  const avisarErro = (e: unknown) =>
    showToast({ message: e instanceof Error ? e.message : 'Não foi possível salvar.' });

  /** Chama a RPC, atualiza a obra e avisa com Desfazer. */
  async function planejar(
    fazer: () => Promise<void>,
    desfazer: () => Promise<void>,
    mensagem: string,
  ) {
    try {
      await fazer();
      await atualizar();
      showToast({
        message: mensagem,
        onUndo: () => void desfazer().then(atualizar).catch(avisarErro),
      });
    } catch (e) {
      avisarErro(e);
    }
  }

  function mudarData(nova: string) {
    setMudandoData(false);
    if (nova === bruta!.data_prevista) return;
    let evento: string | null = null;
    void planejar(
      async () => {
        evento = await definirDataPrevista(a.id, nova);
      },
      // Volta exatamente (data, original e replanejamentos), sem contar outro replanejamento.
      async () => {
        if (evento) await desfazerDataPrevista(evento);
      },
      'Data alterada.',
    );
  }

  function trocarResponsavel(novo: string | null) {
    setTrocandoResp(false);
    const antes = a.responsavelId;
    if (novo === antes) return;
    void planejar(
      () => definirResponsavelAtividade(a.id, novo),
      () => desfazerResponsavelAtividade(a.id, antes),
      'Responsável alterado.',
    );
  }

  // Lembretes de contratação, locação e compra desta atividade (prazo pela data prevista).
  const provs = obra.providencias
    .filter((p) => p.atividade_id === a.id)
    .map((p) => ({
      p,
      feito: p.status === 'feito',
      ...situacaoProvidenciaGeral({
        status: p.status,
        atividadeConcluida: concluida,
        prazoAtividade: a.prazo,
        antecedenciaDu: p.antecedencia_du,
        hoje,
      }),
    }));
  const provsFeitas = provs.filter((x) => x.feito).length;
  const provMenu = provs.find((x) => x.p.id === provMenuId)?.p ?? null;

  function alternarProv(id: string, feito: boolean, tipoTxt: string) {
    campo.providencia.mutate(
      { id, feito },
      {
        onSuccess: () =>
          showToast({
            message: feito ? `${tipoTxt} providenciada` : `${tipoTxt} reaberta`,
            onUndo: () => campo.providencia.mutate({ id, feito: !feito }),
          }),
      },
    );
  }

  const dataTxt = a.prazo ? diaCurto(a.prazo) : 'sem data';
  const replan = bruta.replanejamentos;

  return (
    <>
      <BottomSheet open={!camera} onClose={onClose}>
        <div className={fichaStyles.ficha}>
          <div className={`${fichaStyles.topo} ${styles.topoFixo}`}>
            <div className={fichaStyles.topoTexto}>
              <button
                type="button"
                className={styles.faseVoltar}
                aria-label={`Voltar para ${fase}`}
                onClick={onClose}
              >
                <Icon name="chevronLeft" size={16} strokeWidth={2.4} />
                {fase}
              </button>
              <div>
                <span className={`${fichaStyles.tag} ${styles.tag} ${status.cls}`}>
                  {status.icone ? <Icon name={status.icone} size={12} strokeWidth={2.6} /> : null}
                  {status.txt}
                </span>
              </div>
              {planeja ? (
                <TextoEditavel
                  valor={a.nome}
                  rotulo="Editar nome da atividade"
                  editando={editandoNome}
                  onFimEdicao={() => setEditandoNome(false)}
                  onSalvar={(nome) => {
                    const antes = a.nome;
                    campo.renomear.mutate({ atividadeId: a.id, nome });
                    showToast({
                      message: 'Nome salvo',
                      onUndo: () => campo.renomear.mutate({ atividadeId: a.id, nome: antes }),
                    });
                  }}
                >
                  <h2 className={fichaStyles.nome}>{a.nome}</h2>
                </TextoEditavel>
              ) : (
                <h2 className={fichaStyles.nome}>{a.nome}</h2>
              )}
            </div>
            <div className={fichaStyles.topoAcoes}>
              {planeja ? (
                <button
                  type="button"
                  className={fichaStyles.fechar}
                  aria-label="Mais opções da atividade"
                  aria-haspopup="menu"
                  aria-expanded={menuAberto}
                  onClick={() => setMenuAberto((v) => !v)}
                >
                  <Icon name="more" size={24} />
                </button>
              ) : null}
              <button
                type="button"
                className={fichaStyles.fechar}
                aria-label="Fechar"
                onClick={onClose}
              >
                <Icon name="close" size={24} />
              </button>
              {menuAberto ? (
                <>
                  <button
                    type="button"
                    className={fichaStyles.menuFundo}
                    aria-label="Fechar menu"
                    onClick={() => setMenuAberto(false)}
                  />
                  <div className={fichaStyles.menu} role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className={fichaStyles.menuItem}
                      onClick={() => {
                        setMenuAberto(false);
                        setEditandoNome(true);
                      }}
                    >
                      <Icon name="editar" size={20} />
                      Editar nome
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={fichaStyles.menuItem}
                      onClick={() => {
                        setMenuAberto(false);
                        campo.excluir.mutate(a.id);
                        onClose();
                        showToast({
                          message: `"${a.nome}" excluída`,
                          onUndo: () => campo.restaurar.mutate(a.id),
                        });
                      }}
                    >
                      <Icon name="lixeira" size={20} />
                      Excluir atividade
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className={styles.linhaInfo}>
            <div className={styles.infoTexto}>
              <span className={styles.rotulo}>Data prevista</span>
              <span className={styles.infoValor}>
                {dataTxt}
                {!concluida && a.status === 'vence_hoje' ? (
                  <span className={styles.venceHoje}> · vence hoje</span>
                ) : null}
                {!concluida && a.status === 'atrasada' ? (
                  <span className={styles.atrasada}> · atrasada</span>
                ) : null}
                {replan > 0 ? ` · replanejada ${replan}×` : ''}
              </span>
              {temSubitens ? (
                <span className={styles.infoNota}>
                  A data da atividade acompanha a do último subitem.
                </span>
              ) : null}
            </div>
            {planeja && !temSubitens ? (
              <button
                type="button"
                className={styles.acaoLinha}
                onClick={() => setMudandoData(true)}
              >
                Mudar
              </button>
            ) : null}
          </div>

          <div className={styles.linhaInfo}>
            <div className={styles.infoTexto}>
              <span className={styles.rotulo}>Responsável</span>
              <span className={styles.infoValor}>
                {nomeResp
                  ? a.responsavelId === pessoa.id
                    ? `${nomeResp} (você)`
                    : nomeResp
                  : 'Sem responsável'}
              </span>
            </div>
            {planeja ? (
              <button
                type="button"
                className={styles.acaoLinha}
                onClick={() => setTrocandoResp(true)}
              >
                Trocar
              </button>
            ) : null}
          </div>
          {!planeja ? <p className={styles.nota}>{NOTA_MEMBRO}</p> : null}

          {planeja ? (
            <CampoPrestador
              key={a.id}
              atividadeId={a.id}
              valor={a.prestador}
              ambiente="geral"
              rotulo="Empresa ou prestador"
              placeholder="Opcional · nome de quem executa"
              onSalvar={(v) => campo.prestador.mutate({ id: a.id, prestador: v })}
            />
          ) : (
            <div className={styles.prestadorBloco}>
              <span className={styles.rotulo}>Empresa ou prestador</span>
              <span className={a.prestador ? styles.infoValor : styles.vazioTxt}>
                {a.prestador ?? 'opcional'}
              </span>
            </div>
          )}

          {temSubitens || planeja ? (
            <section className={fichaStyles.secao}>
              <h3 className={fichaStyles.rotulo}>
                Subitens · {feitos} de {a.subitens.length}
              </h3>
              {a.subitens.map((s) => (
                <div key={s.id} className={fichaStyles.linhaCheck}>
                  <input
                    type="checkbox"
                    aria-label={`Concluir ${s.nome}`}
                    checked={s.feito}
                    disabled={concluida}
                    onChange={(e) => campo.subitem.mutate({ id: s.id, feito: e.target.checked })}
                  />
                  {planeja ? (
                    <button
                      type="button"
                      className={styles.subTexto}
                      onClick={() => setSubitemEdit(s)}
                    >
                      <span className={s.feito ? fichaStyles.feito : ''}>{s.nome}</span>
                      <span className={styles.subData}>{s.prazoTxt ?? 'sem data'}</span>
                    </button>
                  ) : (
                    <span className={styles.subTextoFixo}>
                      <span className={s.feito ? fichaStyles.feito : ''}>{s.nome}</span>
                      <span className={styles.subData}>{s.prazoTxt ?? 'sem data'}</span>
                    </span>
                  )}
                </div>
              ))}
              {planeja ? (
                <button type="button" className={styles.mais} onClick={() => setSubitemEdit(null)}>
                  + Adicionar subitem
                </button>
              ) : null}
            </section>
          ) : null}

          {provs.length || planeja ? (
            <section className={fichaStyles.secao}>
              <h3 className={fichaStyles.rotulo}>
                Para começar ·{' '}
                {provs.length
                  ? `${provsFeitas} de ${provs.length} ${provs.length === 1 ? 'providenciado' : 'providenciados'}`
                  : 'nada a providenciar'}
              </h3>
              {provs.length ? (
                <div className={linhaStyles.lista}>
                  {provs.map(({ p, feito, ate, atrasada, venceHoje }) => (
                    <LinhaPara
                      key={p.id}
                      tipo={ROTULO_TIPO_PROVIDENCIA[p.tipo]}
                      nome={p.descricao}
                      feito={feito}
                      atrasado={atrasada}
                      meta={
                        feito ? (
                          p.feito_por_nome || 'Providenciado'
                        ) : !ate ? (
                          `${p.antecedencia_du} d.u. antes da data prevista`
                        ) : atrasada ? (
                          `Atrasado · era até ${diaCurto(ate)}`
                        ) : venceHoje ? (
                          <span className={styles.venceHoje}>Vence hoje</span>
                        ) : (
                          `até ${diaCurto(ate)}`
                        )
                      }
                      onAlternar={() => alternarProv(p.id, !feito, ROTULO_TIPO_PROVIDENCIA[p.tipo])}
                      onMais={planeja ? () => setProvMenuId(p.id) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div className={fichaStyles.vazio}>
                  Nenhuma contratação, locação ou compra lançada para esta atividade.
                </div>
              )}
              {planeja && !concluida ? (
                <div className={fichaStyles.novos}>
                  {(Object.keys(ROTULO_TIPO_PROVIDENCIA) as TipoProvidencia[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={fichaStyles.novo}
                      onClick={() => setNovoTipo(t)}
                    >
                      + {ROTULO_TIPO_PROVIDENCIA[t]}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Sem "Pendências da atividade" na ficha (06/11/2026): muita informação numa
              tela só. As pendências ficam na aba Check list da obra. */}

          <VidaDoItem itemId={a.id} ambiente="geral" />

          {concluida && a.semFoto ? (
            <div className={fichaStyles.semFoto}>
              <span>
                <b>Concluída sem foto</b>
                <span className={fichaStyles.semFotoTexto}>
                  Anexe a foto quando puder, para o registro da etapa.
                </span>
              </span>
              <button
                type="button"
                className={fichaStyles.anexar}
                disabled={campo.anexarFoto.isPending}
                onClick={() => setCamera('anexar')}
              >
                <Icon name="camera" size={18} strokeWidth={2} />
                Anexar foto
              </button>
            </div>
          ) : null}
        </div>

        {!concluida ? (
          <RodapeAvanco
            avancoPct={bruta.avanco_pct}
            desabilitado={conclusao.pendente}
            onPasso={(v) => avanco.card(a.id, v)}
            onPronta={() => avanco.card(a.id, 100)}
            onFoto={() => setCamera('concluir')}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet open={mudandoData} title="Data prevista" onClose={() => setMudandoData(false)}>
        <EscolherData
          valor={bruta.data_prevista ?? ''}
          onEscolher={mudarData}
          sugestoes={atalhosDataPrevista(hoje)}
          hoje={hoje}
          rotulo="Data prevista da atividade"
        />
      </BottomSheet>

      <BottomSheet open={trocandoResp} title="Responsável" onClose={() => setTrocandoResp(false)}>
        <EscolherResponsavel
          pessoas={obra.pessoas}
          pessoaId={pessoa.id}
          valor={a.responsavelId}
          onEscolher={trocarResponsavel}
          permitirNenhum
        />
      </BottomSheet>

      <BottomSheet open={Boolean(provMenu)} onClose={() => setProvMenuId(null)}>
        {provMenu ? (
          <div className={linhaStyles.detalhe}>
            <span className={linhaStyles.detTipo}>{ROTULO_TIPO_PROVIDENCIA[provMenu.tipo]}</span>
            <h3 className={fichaStyles.provDesc}>{provMenu.descricao}</h3>
            <span className={linhaStyles.detTexto}>
              Providenciar {provMenu.antecedencia_du} dias úteis antes da data prevista
            </span>
            <button
              type="button"
              className={linhaStyles.acao}
              disabled={campo.removerProv.isPending}
              onClick={() => {
                const id = provMenu.id;
                campo.removerProv.mutate(id, {
                  onSuccess: () => {
                    setProvMenuId(null);
                    showToast({
                      message: 'Lembrete excluído',
                      onUndo: () => campo.restaurarProv.mutate(id),
                    });
                  },
                  onError: () =>
                    showToast({ message: 'Não foi possível excluir o lembrete. Tente novamente.' }),
                });
              }}
            >
              <Icon name="lixeira" size={18} strokeWidth={2} />
              Excluir lembrete
            </button>
          </div>
        ) : null}
      </BottomSheet>

      <NovaProvidenciaSheet
        obra={obra}
        tipo={novoTipo}
        atividadeFixa={a.id}
        comAntecedencia
        pendente={campo.addProvidencia.isPending}
        onFechar={() => setNovoTipo(null)}
        onSalvar={(v) =>
          campo.addProvidencia.mutate(v, {
            onSuccess: () => {
              setNovoTipo(null);
              showToast({ message: 'Lembrete salvo' });
            },
            onError: () => showToast({ message: 'Não foi possível salvar o lembrete' }),
          })
        }
      />

      <EditarSubitemSheet
        aberto={subitemEdit !== undefined}
        obraId={obra.id}
        atividadeId={a.id}
        subitem={subitemEdit ?? null}
        onFechar={() => setSubitemEdit(undefined)}
      />

      {camera === 'concluir' ? (
        <Camera
          kicker="Foto de conclusão"
          titulo={a.nome}
          dica="Uma foto por ambiente. Ela vira o registro da etapa."
          pendente={conclusao.pendente}
          onCancelar={() => setCamera(null)}
          onCapturar={(file) =>
            conclusao.concluir(a.id, file, (r, det) => {
              setCamera(null);
              aoConcluir(r, det);
            })
          }
          onSemFoto={() =>
            conclusao.concluir(a.id, null, (r, det) => {
              setCamera(null);
              aoConcluir(r, det);
            })
          }
        />
      ) : null}
      {camera === 'anexar' ? (
        <Camera
          kicker="Foto de conclusão"
          titulo={a.nome}
          dica="A atividade já está concluída. Esta foto fica como registro da etapa."
          pendente={campo.anexarFoto.isPending}
          onCancelar={() => setCamera(null)}
          onCapturar={(file) =>
            campo.anexarFoto.mutate(
              { atividadeId: a.id, file },
              {
                onSuccess: () => {
                  setCamera(null);
                  showToast({ message: 'Foto anexada à conclusão' });
                },
                onError: () => showToast({ message: 'Não foi possível anexar a foto' }),
              },
            )
          }
        />
      ) : null}
    </>
  );
}
