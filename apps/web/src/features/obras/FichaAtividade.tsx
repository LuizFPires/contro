import { useEffect, useMemo, useState } from 'react';
import {
  comecarProvidencia,
  diaMes,
  duEntre,
  naObraEm,
  providenciaAtrasada,
  providenciarAte,
} from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import { AjustePrazo } from './AjustePrazo';
import { Camera } from './Camera';
import { CampoPrestador } from './CampoPrestador';
import type { ObraCompleta } from './detalhe';
import { NovaProvidenciaSheet } from './ProvidenciasAba';
import { TextoEditavel } from './TextoEditavel';
import { LinhaPara } from './LinhaPara';
import linhaStyles from './LinhaPara.module.css';
import { numeracaoObra } from './numeracaoObra';
import { useConcluirAtividade, type AoConcluir } from './useConcluirAtividade';
import { useObraCampo } from './useObraCampo';
import styles from './FichaAtividade.module.css';

type Tipo = 'contratacao' | 'locacao' | 'compra';
const TIPO_ROTULO: Record<Tipo, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};

/** Ficha da atividade (protótipo · FICHA DA ATIVIDADE). */
/** Data local (YYYY-MM-DD) de um instante salvo pelo servidor. */
const dataLocal = (ts: string) => new Date(ts).toLocaleDateString('sv-SE');

export function FichaAtividade({
  obra,
  atividadeId,
  onClose,
  onConcluida,
}: {
  obra: ObraCompleta;
  atividadeId: string | null;
  onClose: () => void;
  onConcluida: AoConcluir;
}) {
  const campo = useObraCampo(obra.id);
  const conclusao = useConcluirAtividade(obra);
  // "⋯" de um lembrete do "Para começar": abre o detalhe (editar, reabrir, excluir).
  const [detalheProvId, setDetalheProvId] = useState<string | null>(null);
  // Menu "⋯" do topo da ficha e edição do nome aberta por ele.
  const [menuAberto, setMenuAberto] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  useEffect(() => {
    setMenuAberto(false);
    setEditandoNome(false);
  }, [atividadeId]);
  const { showToast } = useToast();
  const [novoTipo, setNovoTipo] = useState<Tipo | null>(null);
  // Câmera para concluir ou para anexar a foto a uma conclusão sem foto.
  const [camera, setCamera] = useState<'concluir' | 'anexar' | null>(null);
  const [ajustes, setAjustes] = useState(false);

  const dados = useMemo(() => {
    if (!atividadeId) return null;
    const a = obra.atividades.find((x) => x.id === atividadeId);
    if (!a) return null;
    const hoje = hojeISO();
    const decorridos = duEntre(obra.inicio, hoje);
    const iniciada = hoje >= obra.inicio;
    const est = obra.estados[a.id];
    // Pré-obra (antes do dia 0) tem as datas calculadas à parte.
    const cron = obra.cron.porId[a.id] ?? obra.pre[a.id];
    const es = cron?.es ?? 0;
    const subitens = obra.atividades.filter((x) => x.pai_id === a.id);
    const nomePorId = new Map(obra.atividades.map((x) => [x.id, x.nome]));
    const dependePreds = a.predecessoras.map((p) => ({ id: p, nome: nomePorId.get(p) ?? p }));
    const libera = obra.atividades
      .filter((x) => !x.pai_id && x.predecessoras.includes(a.id))
      .map((x) => x.nome);
    // Sem atividade bloqueada: toda atividade aberta pode ser concluída (os
    // subitens abertos são marcados junto, no servidor).
    const podeConcluir = !a.concluida_em;
    const provs = a.providencias.map((p) => {
      const feito = p.status === 'feito';
      return {
        p,
        feito,
        atrasada: providenciaAtrasada({
          status: p.status,
          atividadeConcluida: Boolean(a.concluida_em),
          obraIniciada: iniciada,
          decorridos,
          esAtividade: es,
          antecedenciaDu: p.antecedencia_du,
        }),
        ate: providenciarAte(obra.inicio, es, p.antecedencia_du),
        comecar: comecarProvidencia(obra.inicio, es, p.antecedencia_du, p.duracao_du ?? 0),
        naObra: naObraEm(obra.inicio, es, p.na_obra_em),
      };
    });
    return {
      a,
      est,
      cron,
      subitens,
      dependePreds,
      libera,
      podeConcluir,
      provs,
    };
  }, [obra, atividadeId]);

  if (!dados) return <BottomSheet open={false} onClose={onClose} children={null} />;
  const { a, est, cron, subitens, dependePreds, libera } = dados;
  const { podeConcluir, provs } = dados;
  const provDet = provs.find((x) => x.p.id === detalheProvId) ?? null;

  // Mapa de coleta: só controle de pronto (para a decisão de contratação), sem foto nem pontos.
  const mapa = a.mapa_antecedencia_du !== null;
  const status = a.concluida_em
    ? { txt: mapa ? 'Pronto' : 'Concluída', cls: styles.tagConcluida }
    : est?.atrasada
      ? { txt: 'Atrasada', cls: styles.tagAtrasada }
      : cron && cron.inicio_previsto <= hojeISO()
        ? { txt: 'Em andamento', cls: styles.tagLiberada }
        : { txt: 'Planejada', cls: styles.tagPlanejada };

  // Pré-obra: o que o mapa libera e quais mapas preparam esta atividade (só aviso).
  const num = numeracaoObra(obra);
  const nomeDe = (id: string) => obra.atividades.find((x) => x.id === id)?.nome ?? '—';
  const preparadaPor = obra.atividades.filter((x) => x.mapaLibera.includes(a.id));
  // Mapas de coleta que preparam esta atividade entram como card em "Para começar".
  const nMapasFeitos = preparadaPor.filter((m) => m.concluida_em).length;
  const totalPara = provs.length + preparadaPor.length;
  const feitosPara = provs.filter((x) => x.feito).length + nMapasFeitos;

  function resolverMapa(m: (typeof preparadaPor)[number]) {
    conclusao.concluir(m.id, null, (r) =>
      showToast({
        message: `Mapa de coleta "${m.nome}" pronto para decisão de contratação`,
        onUndo: () => campo.desfazer.mutate({ atividadeId: m.id, xp: r.xp }),
      }),
    );
  }

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

  return (
    <>
      <BottomSheet open={Boolean(atividadeId) && !camera} onClose={onClose}>
        <div className={styles.ficha}>
          <div className={styles.topo}>
            <div className={styles.topoTexto}>
              <span className={`${styles.tag} ${status.cls}`}>{status.txt}</span>
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
                <h2 className={styles.nome}>{a.nome}</h2>
              </TextoEditavel>
              {cron ? (
                <div className={est?.atrasada ? styles.datasAtraso : styles.datas}>
                  {est?.atrasada
                    ? `Devia terminar ${formatarDataCurta(cron.fim_previsto)} · previsto ${diaMes(cron.inicio_previsto)}–${diaMes(cron.fim_previsto)}`
                    : `Previsto ${formatarDataCurta(cron.inicio_previsto)} a ${formatarDataCurta(cron.fim_previsto)} · ${a.duracao_du} dias úteis`}
                </div>
              ) : null}
            </div>
            {/* Opção C do protótipo: "⋯" (editar nome, excluir) ao lado do X, alvos de 48 px. */}
            <div className={styles.topoAcoes}>
              <button
                type="button"
                className={styles.fechar}
                aria-label="Mais opções da atividade"
                aria-haspopup="menu"
                aria-expanded={menuAberto}
                onClick={() => setMenuAberto((v) => !v)}
              >
                <Icon name="more" size={24} />
              </button>
              <button type="button" className={styles.fechar} aria-label="Fechar" onClick={onClose}>
                <Icon name="close" size={24} />
              </button>
              {menuAberto ? (
                <>
                  <button
                    type="button"
                    className={styles.menuFundo}
                    aria-label="Fechar menu"
                    onClick={() => setMenuAberto(false)}
                  />
                  <div className={styles.menu} role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.menuItem}
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
                      className={styles.menuItem}
                      onClick={() => {
                        // Exclusão lógica, com Desfazer (regra 10); a ficha fecha na hora.
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

          <CampoPrestador
            key={a.id}
            atividadeId={a.id}
            valor={a.prestador}
            {...(mapa
              ? {
                  rotulo: 'Quem foi contratado',
                  placeholder: 'Opcional · quando a contratação for decidida',
                }
              : {})}
            onSalvar={(v) => campo.prestador.mutate({ id: a.id, prestador: v })}
          />

          <section className={styles.secao}>
            <h3 className={styles.rotulo}>
              Para começar ·{' '}
              {totalPara
                ? `${feitosPara} de ${totalPara} ${totalPara === 1 ? 'providenciado' : 'providenciados'}`
                : 'nada a providenciar'}
            </h3>
            {totalPara ? (
              // Opção A do protótipo: linhas de altura fixa, quadrado para marcar e "⋯".
              <div className={linhaStyles.lista}>
                {preparadaPor.map((m) => {
                  const feito = Boolean(m.concluida_em);
                  const atrasado = !feito && Boolean(obra.estados[m.id]?.atrasada);
                  const fimMapa = obra.pre[m.id]?.fim_previsto;
                  return (
                    <LinhaPara
                      key={m.id}
                      tipo={`Mapa de coleta · #${num.get(m.id)}`}
                      nome={m.nome}
                      feito={feito}
                      atrasado={atrasado}
                      pendente={conclusao.pendente}
                      meta={
                        feito
                          ? `Pronto ${formatarDataCurta(dataLocal(m.concluida_em!))}${m.prestador ? ` · ${m.prestador}` : ''}`
                          : fimMapa
                            ? `${atrasado ? 'Atrasado · era até' : 'Pronto até'} ${formatarDataCurta(fimMapa)}`
                            : 'Mapa de coleta'
                      }
                      onAlternar={() =>
                        feito
                          ? (campo.desfazer.mutate({ atividadeId: m.id, xp: 0 }),
                            showToast({
                              message: `Mapa "${m.nome}" voltou para a fazer`,
                              onUndo: () => resolverMapa(m),
                            }))
                          : resolverMapa(m)
                      }
                    />
                  );
                })}
                {provs.map(({ p, feito, atrasada, ate, comecar }) => (
                  <LinhaPara
                    key={p.id}
                    tipo={TIPO_ROTULO[p.tipo]}
                    nome={p.descricao}
                    feito={feito}
                    atrasado={atrasada}
                    meta={
                      feito
                        ? [
                            p.feito_por_nome,
                            p.feito_em ? formatarDataCurta(dataLocal(p.feito_em)) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Providenciado'
                        : atrasada
                          ? `Atrasado · era até ${formatarDataCurta(ate)}`
                          : `até ${formatarDataCurta(ate)}${p.duracao_du ? ` · começar ${formatarDataCurta(comecar)}` : ''}`
                    }
                    onAlternar={() => alternarProv(p.id, !feito, TIPO_ROTULO[p.tipo])}
                    onMais={() => setDetalheProvId(p.id)}
                  />
                ))}
              </div>
            ) : null}
            {totalPara === 0 ? (
              <div className={styles.vazio}>
                Nenhuma contratação, locação ou compra lançada para esta atividade.
              </div>
            ) : null}
            {!a.concluida_em ? (
              <div className={styles.novos}>
                {(Object.keys(TIPO_ROTULO) as Tipo[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={styles.novo}
                    onClick={() => setNovoTipo(t)}
                  >
                    + {TIPO_ROTULO[t]}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          {subitens.length > 0 ? (
            <section className={styles.secao}>
              <h3 className={styles.rotulo}>Subitens</h3>
              {subitens.map((s) => (
                <label key={s.id} className={styles.linhaCheck}>
                  <input
                    type="checkbox"
                    checked={Boolean(s.concluida_em)}
                    disabled={Boolean(a.concluida_em)}
                    onChange={(e) => campo.subitem.mutate({ id: s.id, feito: e.target.checked })}
                  />
                  <span className={s.concluida_em ? styles.feito : ''}>
                    {s.nome} · {s.duracao_du} dias úteis
                  </span>
                </label>
              ))}
            </section>
          ) : null}

          <div className={styles.relacoes}>
            <div>
              <strong>Depende de:</strong>{' '}
              {dependePreds.length ? dependePreds.map((p) => p.nome).join(', ') : 'nada'}
            </div>
            <div>
              <strong>Vem depois:</strong> {libera.length ? libera.join(', ') : 'nada'}
            </div>
            {a.mapaLibera.length ? (
              <div>
                <strong>Libera:</strong>{' '}
                {a.mapaLibera.map((id) => `#${num.get(id) ?? '?'} ${nomeDe(id)}`).join(', ')}{' '}
                (contratar até o fim do mapa)
              </div>
            ) : null}
          </div>

          {a.concluida_em && !a.foto_conclusao_id && !mapa ? (
            <div className={styles.semFoto}>
              <span>
                <b>Concluída sem foto</b>
                <span className={styles.semFotoTexto}>
                  Anexe a foto quando puder, para o registro da etapa.
                </span>
              </span>
              <button
                type="button"
                className={styles.anexar}
                disabled={campo.anexarFoto.isPending}
                onClick={() => setCamera('anexar')}
              >
                <Icon name="camera" size={18} strokeWidth={2} />
                Anexar foto
              </button>
            </div>
          ) : null}

          {a.concluida_em ? (
            // Clicou sem querer ou precisa refazer: qualquer pessoa volta para pendente.
            <button
              type="button"
              className={styles.voltarPendente}
              disabled={campo.desfazer.isPending}
              onClick={() => {
                const foto = a.foto_conclusao_id;
                const xp = mapa ? 0 : 50;
                campo.desfazer.mutate(
                  { atividadeId: a.id, xp },
                  {
                    onSuccess: () =>
                      showToast({
                        message: `"${a.nome}" voltou para pendente`,
                        onUndo: () =>
                          campo.reconcluir.mutate({ atividadeId: a.id, fotoId: foto, xp }),
                      }),
                  },
                );
              }}
            >
              <Icon name="undo" size={18} strokeWidth={2} />
              Voltar para pendente
            </button>
          ) : null}

          {!a.concluida_em && !a.preObra ? (
            <section className={styles.ajustes}>
              <button
                type="button"
                className={styles.ajustesBtn}
                aria-expanded={ajustes}
                onClick={() => setAjustes((v) => !v)}
              >
                Ajustar prazo e dependências
                <Icon name={ajustes ? 'chevronDown' : 'chevronRight'} size={18} />
              </button>
              {ajustes ? (
                <div className={styles.ajustesCorpo}>
                  <AjustePrazo key={a.id} obra={obra} atividadeId={a.id} />
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        {podeConcluir && mapa ? (
          // Mapa de coleta (opção A): só "pronto", sem foto; quem foi contratado é opcional.
          <div className={styles.rodapeConcluir}>
            <button
              type="button"
              className={styles.concluir}
              disabled={conclusao.pendente}
              onClick={() =>
                conclusao.concluir(a.id, null, () => {
                  onClose();
                  showToast({
                    message: `"${a.nome}" pronto para decisão de contratação`,
                    onUndo: () => campo.desfazer.mutate({ atividadeId: a.id, xp: 0 }),
                  });
                })
              }
            >
              <Icon name="checkGrosso" size={18} strokeWidth={3} />
              {conclusao.pendente ? 'Marcando…' : 'Mapa pronto'}
            </button>
          </div>
        ) : podeConcluir ? (
          // Protótipo A1: "resolvido" fixo no rodapé, em toda atividade aberta.
          <div className={styles.rodapeConcluir}>
            <button
              type="button"
              className={styles.comFoto}
              aria-label="Concluir com foto"
              disabled={conclusao.pendente}
              onClick={() => setCamera('concluir')}
            >
              <Icon name="camera" size={22} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={styles.concluir}
              disabled={conclusao.pendente}
              onClick={() => conclusao.concluir(a.id, null, (r, det) => onConcluida(r, det))}
            >
              <Icon name="checkGrosso" size={18} strokeWidth={3} />
              {conclusao.pendente ? 'Concluindo…' : 'Marcar como resolvida'}
            </button>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet open={Boolean(provDet)} onClose={() => setDetalheProvId(null)}>
        {provDet ? (
          <div className={linhaStyles.detalhe}>
            <span className={linhaStyles.detTipo}>{TIPO_ROTULO[provDet.p.tipo]}</span>
            <TextoEditavel
              valor={provDet.p.descricao}
              rotulo="Editar texto do lembrete"
              onSalvar={(descricao) => {
                const antes = provDet.p.descricao;
                const id = provDet.p.id;
                campo.descricaoProv.mutate({ atividadeId: a.id, id, descricao });
                showToast({
                  message: 'Lembrete salvo',
                  onUndo: () =>
                    campo.descricaoProv.mutate({ atividadeId: a.id, id, descricao: antes }),
                });
              }}
            >
              <h3 className={styles.provDesc}>{provDet.p.descricao}</h3>
            </TextoEditavel>
            <span className={linhaStyles.detTexto}>
              Precisa estar na obra {formatarDataCurta(provDet.naObra)}
            </span>
            <span className={provDet.atrasada ? linhaStyles.detAtraso : linhaStyles.detTexto}>
              {provDet.feito
                ? `Providenciado${provDet.p.feito_por_nome ? ` por ${provDet.p.feito_por_nome}` : ''}${provDet.p.feito_em ? ` em ${formatarDataCurta(dataLocal(provDet.p.feito_em))}` : ''}`
                : `${provDet.atrasada ? 'ATRASADO · ' : ''}Providenciar até ${formatarDataCurta(provDet.ate)} (${provDet.p.antecedencia_du} dias úteis antes)${provDet.p.duracao_du ? ` · leva ${provDet.p.duracao_du} d, começar ${formatarDataCurta(provDet.comecar)}` : ''}`}
            </span>
            <button
              type="button"
              className={linhaStyles.acao}
              onClick={() => {
                alternarProv(provDet.p.id, !provDet.feito, TIPO_ROTULO[provDet.p.tipo]);
                setDetalheProvId(null);
              }}
            >
              <Icon name={provDet.feito ? 'undo' : 'checkGrosso'} size={18} strokeWidth={2.2} />
              {provDet.feito ? 'Reabrir' : 'Marcar como providenciado'}
            </button>
            {provDet.p.manual ? (
              <button
                type="button"
                className={linhaStyles.acao}
                onClick={() => {
                  const p = provDet.p;
                  setDetalheProvId(null);
                  campo.removerProv.mutate(p.id, {
                    onSuccess: () =>
                      showToast({
                        message: 'Lembrete excluído',
                        onUndo: () =>
                          campo.addProvidencia.mutate({
                            atividadeId: a.id,
                            tipo: p.tipo,
                            descricao: p.descricao,
                          }),
                      }),
                  });
                }}
              >
                <Icon name="lixeira" size={18} strokeWidth={2} />
                Excluir lembrete
              </button>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <NovaProvidenciaSheet
        obra={obra}
        tipo={novoTipo}
        atividadeFixa={a.id}
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
              onConcluida(r, det);
            })
          }
          onSemFoto={() =>
            conclusao.concluir(a.id, null, (r, det) => {
              setCamera(null);
              onConcluida(r, det);
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
