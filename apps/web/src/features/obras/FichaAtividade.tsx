import { useMemo, useState } from 'react';
import { diaMes, duEntre, naObraEm, providenciaAtrasada, providenciarAte } from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import { AjustePrazo } from './AjustePrazo';
import { Camera } from './Camera';
import type { ObraCompleta } from './detalhe';
import { NovaProvidenciaSheet } from './ProvidenciasAba';
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
  const [camera, setCamera] = useState(false);
  const [ajustes, setAjustes] = useState(false);

  const dados = useMemo(() => {
    if (!atividadeId) return null;
    const a = obra.atividades.find((x) => x.id === atividadeId);
    if (!a) return null;
    const hoje = hojeISO();
    const decorridos = duEntre(obra.inicio, hoje);
    const iniciada = hoje >= obra.inicio;
    const est = obra.estados[a.id];
    const cron = obra.cron.porId[a.id];
    const es = cron?.es ?? 0;
    const subitens = obra.atividades.filter((x) => x.pai_id === a.id);
    const nomePorId = new Map(obra.atividades.map((x) => [x.id, x.nome]));
    const dependePreds = a.predecessoras.map((p) => ({ id: p, nome: nomePorId.get(p) ?? p }));
    const faltam = a.predecessoras
      .filter((p) => !obra.estados[p]?.concluida)
      .map((p) => nomePorId.get(p) ?? p);
    const libera = obra.atividades
      .filter((x) => !x.pai_id && x.predecessoras.includes(a.id))
      .map((x) => x.nome);
    const subsOk = subitens.every((s) => s.concluida_em);
    const podeConcluir = Boolean(est?.liberada) && subsOk && !a.concluida_em;
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
      faltam,
      libera,
      subsOk,
      podeConcluir,
      provs,
    };
  }, [obra, atividadeId]);

  if (!dados) return <BottomSheet open={false} onClose={onClose} children={null} />;
  const { a, est, cron, subitens, dependePreds, faltam, libera, subsOk } = dados;
  const { podeConcluir, provs } = dados;

  const status = a.concluida_em
    ? { txt: 'Concluída', cls: styles.tagConcluida }
    : est?.atrasada
      ? { txt: 'Atrasada', cls: styles.tagAtrasada }
      : est?.liberada
        ? { txt: 'Liberada', cls: styles.tagLiberada }
        : est?.aguardandoProvidencia
          ? { txt: 'Aguardando providência', cls: styles.tagPlanejada }
          : { txt: 'Planejada', cls: styles.tagPlanejada };

  const nFeitas = provs.filter((x) => x.feito).length;
  const bloqueio = a.concluida_em
    ? null
    : subitens.length > 0 && !subsOk && est?.liberada
      ? 'Marque todos os subitens para concluir.'
      : !est?.predsOk
        ? `Libera quando concluir: ${faltam.join(', ')}`
        : !est?.provOk
          ? 'Libera quando todos os lembretes desta atividade estiverem providenciados.'
          : null;

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

          <div className={`${styles.prestador} ${a.prestador ? styles.prestadorDefinido : ''}`}>
            <Icon name="pessoa" size={24} />
            <div className={styles.prestadorCorpo}>
              <label htmlFor={`prest-${a.id}`} className={styles.prestadorRotulo}>
                Prestador da atividade
              </label>
              <input
                id={`prest-${a.id}`}
                key={a.id}
                className={styles.prestadorInput}
                defaultValue={a.prestador ?? ''}
                placeholder="Opcional · nome de quem executa"
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== (a.prestador ?? null))
                    campo.prestador.mutate({ id: a.id, prestador: v });
                }}
              />
            </div>
          </div>

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
              <strong>Libera:</strong> {libera.length ? libera.join(', ') : 'nada'}
            </div>
          </div>

          {podeConcluir ? (
            <button
              type="button"
              className={styles.concluir}
              disabled={conclusao.pendente}
              onClick={() => setCamera(true)}
            >
              <Icon name="camera" size={20} strokeWidth={2} />
              {conclusao.pendente ? 'Concluindo…' : 'Concluir com foto'}
            </button>
          ) : bloqueio ? (
            <div className={styles.bloqueio}>{bloqueio}</div>
          ) : null}

          {!a.concluida_em ? (
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

      {camera ? (
        <Camera
          kicker="Foto de conclusão"
          titulo={a.nome}
          dica="Uma foto por ambiente. Ela vira o registro da etapa e libera as próximas atividades."
          pendente={conclusao.pendente}
          onCancelar={() => setCamera(false)}
          onCapturar={(file) =>
            conclusao.concluir(a.id, file, (r, det) => {
              setCamera(false);
              onConcluida(r, det);
            })
          }
        />
      ) : null}
    </>
  );
}
