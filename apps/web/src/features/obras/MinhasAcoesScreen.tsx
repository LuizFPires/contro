import { useEffect, useMemo, useState } from 'react';
import { addDU, tarefaAtrasada, textoReplanejamento } from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { EscolherData } from '../../components/EscolherData';
import { formatarDataCurta } from '../../lib/datas';
import { usePerfil } from '../perfil/usePerfil';
import { dataLocal, hojeISO } from './api';
import type { TarefaObra } from './tarefasObra';
import { useObras } from './useObras';
import { useTarefasAcoes, useTarefasDasObras } from './useObraTarefas';
import styles from './MinhasAcoesScreen.module.css';

const PASSOS = [0, 25, 50, 75];
const R = 15;
const CIRC = 2 * Math.PI * R;

/**
 * Minhas ações (pedido do usuário, 29/10/2026): o que ficou com a pessoa, em
 * todas as obras, para ela dar avanço durante a semana. O gestor vê o avanço e
 * o comentário nas Tarefas e na cobrança da próxima reunião.
 */
export function MinhasAcoesScreen({ onVoltar }: { onVoltar: () => void }) {
  const { data: pessoa } = usePerfil();
  const { data: obras = [] } = useObras();
  const { tarefas, carregando } = useTarefasDasObras(obras.map((o) => o.id));
  const acoes = useTarefasAcoes();
  const { showToast } = useToast();
  const [aba, setAba] = useState<'abertas' | 'feitas'>('abertas');
  const [sel, setSel] = useState<TarefaObra | null>(null);
  const hoje = hojeISO();

  const minhas = useMemo(
    () => tarefas.filter((t) => pessoa && t.responsavel_id === pessoa.id),
    [tarefas, pessoa],
  );
  const abertas = minhas.filter((t) => t.status === 'aberta');
  const feitas = minhas
    .filter((t) => t.status === 'feita')
    .sort((a, b) => (b.feita_em ?? '').localeCompare(a.feita_em ?? ''));
  const atrasadas = abertas.filter((t) => tarefaAtrasada(t, hoje)).length;
  const lista = aba === 'abertas' ? abertas : feitas;

  // Por obra, na ordem das obras; dentro, por prazo.
  const grupos = obras
    .map((o) => ({
      obra: o,
      itens: lista.filter((t) => t.obra_id === o.id).sort((a, b) => a.prazo.localeCompare(b.prazo)),
    }))
    .filter((g) => g.itens.length);

  function salvar(t: TarefaObra, v: { pct: number | 'feita'; comentario: string; prazo: string }) {
    const alvo = { obraId: t.obra_id, id: t.id };
    const comentario = v.comentario.trim() || null;
    if (v.prazo !== t.prazo) {
      acoes.salvar.mutate({
        obraId: t.obra_id,
        entrada: {
          id: t.id,
          texto: t.texto,
          responsavelId: t.responsavel_id,
          responsavelNome: t.responsavel_id ? null : t.responsavelNome,
          observacao: t.observacao,
          prazo: v.prazo,
        },
      });
    }
    if (v.pct !== 'feita' && (v.pct !== t.avanco_pct || comentario !== t.comentario)) {
      acoes.avancar.mutate({ ...alvo, pct: v.pct, comentario });
    }
    setSel(null);
    if (v.pct === 'feita') {
      acoes.concluir.mutate(alvo, {
        onSuccess: () =>
          showToast({ message: 'Ação concluída', onUndo: () => acoes.reabrir.mutate(alvo) }),
      });
    } else {
      showToast({ message: 'Avanço salvo' });
    }
  }

  function reabrir(t: TarefaObra) {
    const alvo = { obraId: t.obra_id, id: t.id };
    acoes.reabrir.mutate(alvo, {
      onSuccess: () =>
        showToast({ message: 'Ação reaberta', onUndo: () => acoes.concluir.mutate(alvo) }),
    });
  }

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronLeft" size={22} />
        </button>
        <div>
          <h1 className={styles.titulo}>Minhas ações</h1>
          <div className={styles.sub}>
            {pessoa?.nome ?? ''} · {abertas.length} {abertas.length === 1 ? 'aberta' : 'abertas'}
            {atrasadas ? ` · ${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}` : ''}
          </div>
        </div>
      </header>

      <div className={styles.abas} role="tablist" aria-label="Situação">
        {(
          [
            ['abertas', `Abertas · ${abertas.length}`],
            ['feitas', `Feitas · ${feitas.length}`],
          ] as const
        ).map(([k, t]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={aba === k}
            className={`${styles.aba} ${aba === k ? styles.abaOn : ''}`}
            onClick={() => setAba(k)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={styles.lista}>
        {carregando ? <p className={styles.vazio}>Carregando…</p> : null}
        {!carregando && grupos.length === 0 ? (
          <p className={styles.vazio}>
            {aba === 'abertas'
              ? 'Nenhuma ação aberta com você. As da reunião aparecem aqui.'
              : 'Nenhuma ação concluída ainda.'}
          </p>
        ) : null}
        {grupos.map((g) => (
          <section key={g.obra.id}>
            <h2 className={styles.obra}>{g.obra.nome}</h2>
            <div className={styles.cartao}>
              {g.itens.map((t) => {
                const feita = t.status === 'feita';
                const atrasada = tarefaAtrasada(t, hoje);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={styles.item}
                    onClick={() => (feita ? reabrir(t) : setSel(t))}
                    aria-label={
                      feita ? `${t.texto}: concluída. Tocar para reabrir` : `${t.texto}: dar avanço`
                    }
                  >
                    <Anel pct={feita ? 100 : t.avanco_pct} atrasada={atrasada} />
                    <span className={styles.itemTexto}>
                      <span className={styles.itemTitulo}>{t.texto}</span>
                      {feita ? (
                        <span className={styles.meta}>
                          Concluída
                          {t.feita_em ? ` em ${formatarDataCurta(dataLocal(t.feita_em))}` : ''} ·
                          tocar para reabrir
                        </span>
                      ) : atrasada ? (
                        <span className={styles.atraso}>
                          <Icon name="relogio" size={14} strokeWidth={2.4} />
                          Atrasada · era até {formatarDataCurta(t.prazo)}
                        </span>
                      ) : (
                        <span className={styles.meta}>até {formatarDataCurta(t.prazo)}</span>
                      )}
                      {!feita && t.comentario ? (
                        <span className={styles.comentario}>“{t.comentario}”</span>
                      ) : null}
                      {t.origem_texto ? (
                        <span className={styles.meta}>{t.origem_texto}</span>
                      ) : null}
                    </span>
                    {feita ? null : <Icon name="chevronRight" size={18} />}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <AvancoSheet
        tarefa={sel}
        obra={obras.find((o) => o.id === sel?.obra_id)?.nome ?? ''}
        hoje={hoje}
        onFechar={() => setSel(null)}
        onSalvar={(v) => sel && salvar(sel, v)}
      />
    </div>
  );
}

function Anel({ pct, atrasada }: { pct: number; atrasada: boolean }) {
  if (pct >= 100) {
    return (
      <span className={`${styles.anel} ${styles.anelOk}`} aria-hidden="true">
        <Icon name="checkGrosso" size={16} strokeWidth={2.6} />
      </span>
    );
  }
  return (
    <span className={styles.anel} aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={R} className={styles.trilho} />
        {pct > 0 ? (
          <circle
            cx="18"
            cy="18"
            r={R}
            className={atrasada ? styles.progAtraso : styles.prog}
            strokeDasharray={`${(CIRC * pct) / 100} ${CIRC}`}
            transform="rotate(-90 18 18)"
          />
        ) : null}
      </svg>
      <span className={styles.anelPct}>{pct}%</span>
    </span>
  );
}

function AvancoSheet({
  tarefa,
  obra,
  hoje,
  onFechar,
  onSalvar,
}: {
  tarefa: TarefaObra | null;
  obra: string;
  hoje: string;
  onFechar: () => void;
  onSalvar: (v: { pct: number | 'feita'; comentario: string; prazo: string }) => void;
}) {
  const [pct, setPct] = useState<number | 'feita'>(0);
  const [comentario, setComentario] = useState('');
  const [prazo, setPrazo] = useState('');
  const [mudarPrazo, setMudarPrazo] = useState(false);

  useEffect(() => {
    if (!tarefa) return;
    setPct(PASSOS.includes(tarefa.avanco_pct) ? tarefa.avanco_pct : 0);
    setComentario(tarefa.comentario ?? '');
    setPrazo(tarefa.prazo);
    setMudarPrazo(false);
  }, [tarefa]);

  const repl = tarefa
    ? textoReplanejamento(
        tarefa.replanejamentos + (prazo && prazo !== tarefa.prazo ? 1 : 0),
        tarefa.prazo_original
          ? formatarDataCurta(tarefa.prazo_original)
          : prazo !== tarefa.prazo
            ? formatarDataCurta(tarefa.prazo)
            : null,
      )
    : null;
  const sugestoes = [1, 2, 3, 5].map((n) => ({ valor: addDU(hoje, n) }));

  return (
    <BottomSheet open={Boolean(tarefa)} title={tarefa?.texto ?? ''} onClose={onFechar}>
      {tarefa ? (
        <div className={styles.folha}>
          <p className={styles.meta}>
            {obra}
            {tarefa.origem_texto ? ` · ${tarefa.origem_texto}` : ''} · até{' '}
            {formatarDataCurta(tarefa.prazo)}
          </p>

          <p className={styles.rotulo}>Quanto já fez?</p>
          <div className={styles.chips} role="group" aria-label="Quanto já fez">
            {[...PASSOS, 'feita' as const].map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={pct === p}
                className={`${styles.chip} ${pct === p ? styles.chipOn : ''}`}
                onClick={() => setPct(p)}
              >
                {p === 'feita' ? (
                  <>
                    <Icon name="checkGrosso" size={14} strokeWidth={3} /> Feita
                  </>
                ) : (
                  `${p}%`
                )}
              </button>
            ))}
          </div>

          <label className={styles.rotulo} htmlFor="avanco-comentario">
            Comentário (opcional)
          </label>
          <input
            id="avanco-comentario"
            className={styles.campo}
            placeholder="Ex.: pedido feito, chega amanhã"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />

          <p className={styles.rotulo}>Prazo</p>
          {mudarPrazo ? (
            <EscolherData
              rotulo="Novo prazo"
              valor={prazo}
              onEscolher={setPrazo}
              sugestoes={sugestoes}
              min={hoje}
              hoje={hoje}
            />
          ) : (
            <div className={styles.prazoLinha}>
              <span className={styles.prazoAtual}>{formatarDataCurta(tarefa.prazo)}</span>
              <button type="button" className={styles.mudar} onClick={() => setMudarPrazo(true)}>
                <Icon name="calendario" size={18} /> Mudar
              </button>
            </div>
          )}
          {repl ? <p className={styles.meta}>{repl}</p> : null}
          <p className={styles.aviso}>
            O gestor vê o avanço e o comentário nas Tarefas e na cobrança da próxima reunião.
          </p>

          <button
            type="button"
            className={styles.salvar}
            onClick={() => onSalvar({ pct, comentario, prazo: prazo || tarefa.prazo })}
          >
            {pct === 'feita' ? 'Concluir ação' : 'Salvar avanço'}
          </button>
        </div>
      ) : null}
    </BottomSheet>
  );
}
