import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  atalhosDataPrevista,
  diaCurto,
  podePlanejarObraGeral,
  trilhaObraGeral,
  type SubitemGeral,
} from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { EscolherData } from '../../components/EscolherData';
import { hojeISO } from '../obras/api';
import { Camera } from '../obras/Camera';
import fichaStyles from '../obras/FichaAtividade.module.css';
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
import { definirDataPrevista, definirResponsavelAtividade } from './planejamento';

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
    ? { txt: a.semFoto ? 'Concluída · sem foto' : 'Concluída', cls: fichaStyles.tagConcluida }
    : a.status === 'atrasada'
      ? { txt: 'Atrasada', cls: fichaStyles.tagAtrasada }
      : a.avancoPct > 0
        ? { txt: `Em andamento · ${a.avancoPct}%`, cls: fichaStyles.tagLiberada }
        : { txt: 'Aberta', cls: fichaStyles.tagPlanejada };

  const atualizar = () => qc.invalidateQueries({ queryKey: ['obra', obra.id] });
  const avisarErro = (e: unknown) =>
    showToast({ message: e instanceof Error ? e.message : 'Não foi possível salvar.' });

  /** Chama a RPC, atualiza a obra e avisa com Desfazer (que repete a RPC com o valor antigo). */
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
    const antes = bruta!.data_prevista;
    if (nova === antes) return;
    void planejar(
      () => definirDataPrevista(a.id, nova),
      () => definirDataPrevista(a.id, antes),
      'Data alterada.',
    );
  }

  function trocarResponsavel(novo: string | null) {
    setTrocandoResp(false);
    const antes = a.responsavelId;
    if (novo === antes) return;
    void planejar(
      () => definirResponsavelAtividade(a.id, novo),
      () => definirResponsavelAtividade(a.id, antes),
      'Responsável alterado.',
    );
  }

  const dataTxt = a.prazo ? diaCurto(a.prazo) : 'sem data';
  const replan = bruta.replanejamentos;

  return (
    <>
      <BottomSheet open={!camera} onClose={onClose}>
        <div className={fichaStyles.ficha}>
          <div className={fichaStyles.topo}>
            <div className={fichaStyles.topoTexto}>
              <span className={styles.fase}>{`‹ ${fase}`}</span>
              <div>
                <span className={`${fichaStyles.tag} ${status.cls}`}>{status.txt}</span>
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

          <div className={styles.prestadorBloco}>
            <span className={styles.rotulo}>Empresa ou prestador</span>
            {planeja ? (
              <TextoEditavel
                key={a.id}
                valor={a.prestador ?? ''}
                rotulo="Editar empresa ou prestador"
                onSalvar={(v) => campo.prestador.mutate({ id: a.id, prestador: v })}
              >
                <span className={a.prestador ? styles.infoValor : styles.vazioTxt}>
                  {a.prestador ?? 'opcional'}
                </span>
              </TextoEditavel>
            ) : (
              <span className={a.prestador ? styles.infoValor : styles.vazioTxt}>
                {a.prestador ?? 'opcional'}
              </span>
            )}
          </div>

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
