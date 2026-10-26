import { useState } from 'react';
import { faixasDeFases } from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { AssistenteAtividade } from './AssistenteAtividade';
import type { ModeloCompleto } from './detalhe';
import { useEdicaoModelo } from './useEdicaoModelo';
import { numeracao } from './numeracao';
import { useSalvarAtividade } from './useModeloDetalhe';
import styles from './Modelos.module.css';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Uma fase do modelo e suas atividades (protótipo · ModeloCel · FASE). */
export function FaseModelo({
  modelo,
  faseId,
  onVoltar,
}: {
  modelo: ModeloCompleto;
  faseId: string;
  onVoltar: () => void;
}) {
  const ed = useEdicaoModelo(modelo.id);
  const salvar = useSalvarAtividade(modelo.id);
  const { showToast } = useToast();
  const [opcoes, setOpcoes] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [confirma, setConfirma] = useState(false);
  const [assistente, setAssistente] = useState<{ editar: string | null } | null>(null);

  const fase = modelo.fases.find((f) => f.id === faseId);
  if (!fase) return null;
  const n = modelo.fases.findIndex((f) => f.id === faseId) + 1;
  const idx = numeracao(modelo);
  const daFase = modelo.atividades
    .filter((a) => !a.pai_id && a.fase_id === faseId)
    .sort((a, b) => a.ordem - b.ordem);
  const fx = faixasDeFases(modelo.fases, modelo.atividades, modelo.cronograma).find(
    (f) => f.id === faseId,
  );
  const resumo = fx
    ? `${plural(daFase.length, 'atividade', 'atividades')} · D${fx.es + 1} a D${fx.ef}`
    : 'sem atividades';

  function abrirOpcoes() {
    setTitulo(fase?.titulo ?? '');
    setConfirma(false);
    setOpcoes(true);
  }

  function pronto() {
    const v = titulo.trim();
    if (v && v !== fase?.titulo) ed.renomearFase.mutate({ id: faseId, titulo: v });
    setOpcoes(false);
  }

  function excluir() {
    if (!confirma) {
      setConfirma(true);
      return;
    }
    ed.excluirFase.mutate(faseId, {
      onSuccess: () => {
        setOpcoes(false);
        onVoltar();
        showToast({ message: `Fase "${fase?.titulo}" excluída` });
      },
      onError: (e) => showToast({ message: (e as Error).message }),
    });
  }

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.barraTopo}>
          <button
            type="button"
            className={styles.iconeBtn}
            aria-label="Voltar às fases"
            onClick={onVoltar}
          >
            <Icon name="chevronLeft" size={22} />
          </button>
          <div className={styles.sobretitulo} />
          <button
            type="button"
            className={styles.iconeBtn}
            aria-label="Opções da fase"
            onClick={abrirOpcoes}
          >
            <Icon name="more" size={22} strokeWidth={3} />
          </button>
        </div>
        <div className={styles.titulos}>
          <div className={styles.kicker}>Fase {n}</div>
          <h1 className={styles.titulo}>{fase.titulo}</h1>
          <div className={styles.miudo}>{resumo}</div>
        </div>
      </header>

      <div className={styles.lista}>
        {daFase.length === 0 ? (
          <div className={styles.vazio}>
            Nenhuma atividade nesta fase ainda.
            <br />
            Toque em <b>Nova atividade</b>.
          </div>
        ) : null}
        {daFase.map((a) => {
          const c = modelo.cronograma.porId[a.id];
          const subs = modelo.atividades.filter((x) => x.pai_id === a.id).length;
          const tags = [
            ...(subs ? [plural(subs, 'subitem', 'subitens')] : []),
            ...(a.providencias.length
              ? [plural(a.providencias.length, 'lembrete', 'lembretes')]
              : []),
          ];
          return (
            <button
              key={a.id}
              type="button"
              className={styles.atv}
              onClick={() => setAssistente({ editar: a.id })}
            >
              <span className={styles.atvIdx}>#{idx.get(a.id)}</span>
              <span className={styles.atvCorpo}>
                <span className={styles.atvNome}>{a.nome}</span>
                {modelo.atividades
                  .filter((x) => x.pai_id === a.id)
                  .sort((x, y) => x.ordem - y.ordem)
                  .map((s) => (
                    <span key={s.id} className={styles.atvSubitem}>
                      ↳ {s.nome} · {s.duracao_du} du{s.em_sequencia ? '' : ' (paralelo)'}
                    </span>
                  ))}
                <span className={styles.atvDep}>
                  {a.mapa_alvo_id
                    ? `pré-obra · prepara #${idx.get(a.mapa_alvo_id) ?? '?'} · fecha ${a.mapa_antecedencia_du ? `${a.mapa_antecedencia_du} du antes` : 'no dia'}`
                    : a.predecessoras.length
                      ? `depois de ${a.predecessoras.map((p) => `#${idx.get(p) ?? '?'}`).join(', ')}`
                      : modelo.fases.find((f) => f.id === a.fase_id)?.preliminar
                        ? 'pré-obra · antes do dia 0'
                        : 'começa no início da obra'}
                </span>
                {tags.length || c?.critico ? (
                  <span className={styles.chips}>
                    {tags.map((t) => (
                      <span key={t} className={styles.chip}>
                        {t}
                      </span>
                    ))}
                    {c?.critico ? (
                      <span className={styles.chipTurquesa}>caminho crítico</span>
                    ) : null}
                  </span>
                ) : null}
              </span>
              <span className={styles.atvDur}>
                <strong>{c?.dur ?? a.duracao_du}</strong>
                <span> d</span>
                {c ? (
                  <small>
                    D{c.es + 1}–D{c.ef}
                  </small>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.rodape}>
        <button
          type="button"
          className={styles.btnPrimario}
          onClick={() => setAssistente({ editar: null })}
        >
          <Icon name="plus" size={22} strokeWidth={2.4} />
          Nova atividade
        </button>
      </div>

      <BottomSheet open={opcoes} onClose={pronto}>
        <div className={styles.folha}>
          <label className={styles.rotulo}>
            Nome da fase
            <input
              className={styles.campo}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={confirma ? styles.btnConfirma : styles.btnContorno}
            disabled={ed.excluirFase.isPending}
            onClick={excluir}
          >
            {confirma
              ? `Toque de novo para excluir${daFase.length ? ` (${plural(daFase.length, 'atividade', 'atividades')})` : ''}`
              : 'Excluir fase'}
          </button>
          <button type="button" className={styles.btnPrimario} onClick={pronto}>
            Pronto
          </button>
        </div>
      </BottomSheet>

      {assistente ? (
        <AssistenteAtividade
          modelo={modelo}
          faseId={faseId}
          editarId={assistente.editar}
          numeros={idx}
          salvando={salvar.isPending || ed.editarAtv.isPending || ed.excluirAtv.isPending}
          onFechar={() => setAssistente(null)}
          onSalvar={(dados) => {
            const editar = assistente.editar;
            if (editar) {
              ed.editarAtv.mutate(
                { atv: { id: editar, fase_id: faseId }, dados },
                {
                  onSuccess: () => {
                    setAssistente(null);
                    showToast({ message: 'Atividade atualizada no modelo' });
                  },
                  onError: (e) => {
                    const err = e as { message?: string; code?: string };
                    showToast({
                      message:
                        err.code === '23514' || /ciclo/i.test(err.message ?? '')
                          ? 'Essa dependência criaria um ciclo'
                          : (err.message ?? 'Não foi possível salvar'),
                    });
                  },
                },
              );
            } else {
              salvar.mutate(
                { ...dados, modeloId: modelo.id, faseId },
                {
                  onSuccess: () => {
                    setAssistente(null);
                    showToast({ message: 'Atividade adicionada ao modelo' });
                  },
                  onError: (e) => showToast({ message: (e as Error).message }),
                },
              );
            }
          }}
          onRemover={
            assistente.editar
              ? () =>
                  ed.excluirAtv.mutate(assistente.editar as string, {
                    onSuccess: () => {
                      setAssistente(null);
                      showToast({ message: 'Atividade removida do modelo' });
                    },
                    onError: (e) => showToast({ message: (e as Error).message }),
                  })
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
