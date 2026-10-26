import { useMemo, useState } from 'react';
import { diaMes, duEntre, naObraEm, providenciaAtrasada, providenciarAte } from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import { AjustePrazo } from './AjustePrazo';
import { Camera } from './Camera';
import { CampoPrestador } from './CampoPrestador';
import type { ObraCompleta } from './detalhe';
import { NovaProvidenciaSheet } from './ProvidenciasAba';
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

  const status = a.concluida_em
    ? { txt: 'Concluída', cls: styles.tagConcluida }
    : est?.atrasada
      ? { txt: 'Atrasada', cls: styles.tagAtrasada }
      : cron && cron.inicio_previsto <= hojeISO()
        ? { txt: 'Em andamento', cls: styles.tagLiberada }
        : { txt: 'Planejada', cls: styles.tagPlanejada };

  // Pré-obra: o que o mapa libera e quais mapas preparam esta atividade (só aviso).
  const num = numeracaoObra(obra);
  const nomeDe = (id: string) => obra.atividades.find((x) => x.id === id)?.nome ?? '—';
  const preparadaPor = obra.atividades.filter((x) => x.mapaLibera.includes(a.id));

  const nFeitas = provs.filter((x) => x.feito).length;

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
            <div>
              <span className={`${styles.tag} ${status.cls}`}>{status.txt}</span>
              <h2 className={styles.nome}>{a.nome}</h2>
              {cron ? (
                <div className={est?.atrasada ? styles.datasAtraso : styles.datas}>
                  {est?.atrasada
                    ? `Devia terminar ${formatarDataCurta(cron.fim_previsto)} · previsto ${diaMes(cron.inicio_previsto)}–${diaMes(cron.fim_previsto)}`
                    : `Previsto ${formatarDataCurta(cron.inicio_previsto)} a ${formatarDataCurta(cron.fim_previsto)} · ${a.duracao_du} dias úteis`}
                </div>
              ) : null}
            </div>
            <button type="button" className={styles.fechar} aria-label="Fechar" onClick={onClose}>
              <Icon name="close" size={22} />
            </button>
          </div>

          <CampoPrestador
            key={a.id}
            atividadeId={a.id}
            valor={a.prestador}
            onSalvar={(v) => campo.prestador.mutate({ id: a.id, prestador: v })}
          />

          <section className={styles.secao}>
            <h3 className={styles.rotulo}>
              Para começar ·{' '}
              {provs.length
                ? `${nFeitas} de ${provs.length} ${provs.length === 1 ? 'providenciado' : 'providenciados'}`
                : 'nada a providenciar'}
            </h3>
            {provs.map(({ p, feito, atrasada, ate, naObra }) => (
              <div
                key={p.id}
                className={`${styles.prov} ${atrasada ? styles.provAtraso : feito ? styles.provFeita : ''}`}
              >
                <div className={styles.provTopo}>
                  <span className={styles.provTipo}>{TIPO_ROTULO[p.tipo]}</span>
                  <span
                    className={`${styles.sit} ${feito ? styles.sitFeita : atrasada ? styles.sitAtraso : ''}`}
                  >
                    {feito ? 'Providenciado' : atrasada ? 'Atrasado' : 'A providenciar'}
                  </span>
                </div>
                <div className={styles.provDesc}>{p.descricao}</div>
                <div className={styles.provNaObra}>
                  Precisa estar na obra {formatarDataCurta(naObra)}
                </div>
                <div className={atrasada ? styles.quandoAtraso : styles.quando}>
                  {feito
                    ? 'Providenciado'
                    : atrasada
                      ? `ATRASADO · era para providenciar até ${formatarDataCurta(ate)}`
                      : `Providenciar até ${formatarDataCurta(ate)} (${p.antecedencia_du} dias úteis antes)`}
                </div>
                <div className={styles.provAcoes}>
                  <button
                    type="button"
                    className={feito ? styles.btnSecundario : styles.btnMarcar}
                    onClick={() => alternarProv(p.id, !feito, TIPO_ROTULO[p.tipo])}
                  >
                    {feito ? 'Reabrir' : 'Marcar como providenciado'}
                  </button>
                  {p.manual ? (
                    <button
                      type="button"
                      className={styles.remover}
                      aria-label="Remover lembrete"
                      onClick={() =>
                        campo.removerProv.mutate(p.id, {
                          onSuccess: () =>
                            showToast({
                              message: 'Lembrete removido',
                              onUndo: () =>
                                campo.addProvidencia.mutate({
                                  atividadeId: a.id,
                                  tipo: p.tipo,
                                  descricao: p.descricao,
                                }),
                            }),
                        })
                      }
                    >
                      <Icon name="lixeira" size={18} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {provs.length === 0 ? (
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
            {preparadaPor.length ? (
              <div>
                <strong>Preparada por:</strong>{' '}
                {preparadaPor.map((m) => `#${num.get(m.id) ?? '?'} ${m.nome}`).join(', ')}
              </div>
            ) : null}
          </div>

          {a.concluida_em && !a.foto_conclusao_id ? (
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

        {podeConcluir ? (
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
