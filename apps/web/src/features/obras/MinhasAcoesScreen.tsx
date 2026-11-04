import { useEffect, useMemo, useState } from 'react';
import {
  addDU,
  classificarAcoes,
  estadoAcao,
  textoReplanejamento,
  textoResumoSecoes,
} from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { EscolherData } from '../../components/EscolherData';
import { formatarDataCurta } from '../../lib/datas';
import { usePerfil } from '../perfil/usePerfil';
import { acoesVisiveis, secoesAcoes, type AcaoObra } from './acoesObra';
import { hojeISO } from './api';
import { CardAcao, MarcadorAcao, TituloSecao } from './CardAcao';
import { MOTIVO_MAX, motivoReplanejamento, prazoMudou } from './entradaTarefa';
import type { TarefaObra } from './tarefasObra';
import { useAcoesDasObras } from './useAcoesDasObras';
import { useObras } from './useObras';
import { useTarefasAcoes } from './useObraTarefas';
import styles from './MinhasAcoesScreen.module.css';

const PASSOS = [0, 25, 50, 75];
const R = 15;
const CIRC = 2 * Math.PI * R;

/**
 * Minhas ações (pedido do usuário, 29/10/2026): o que ficou com a pessoa, em
 * todas as obras (tarefas e pendências do Check list), em quatro seções e,
 * dentro de cada uma, por obra. O gestor vê o avanço e o comentário nas
 * Tarefas e na cobrança da próxima reunião.
 */
export function MinhasAcoesScreen({
  onVoltar,
  onAbrirPendencia,
}: {
  onVoltar: () => void;
  /** Abre o Check list da obra da pendência. */
  onAbrirPendencia: (obraId: string, pendenciaId: string) => void;
}) {
  const { data: pessoa } = usePerfil();
  const { data: obras = [] } = useObras();
  const { acoes: todas, carregando } = useAcoesDasObras(obras.map((o) => o.id));
  const acoes = useTarefasAcoes();
  const { showToast } = useToast();
  const [sel, setSel] = useState<TarefaObra | null>(null);
  const hoje = hojeISO();

  const minhas = useMemo(
    () => (pessoa ? acoesVisiveis(todas, hoje).filter((a) => a.responsavelId === pessoa.id) : []),
    [todas, pessoa, hoje],
  );
  const classificadas = useMemo(() => classificarAcoes(minhas, hoje), [minhas, hoje]);
  const resumo = `Você: ${textoResumoSecoes({
    atrasadas: classificadas.atrasadas.length,
    hoje: classificadas.hoje.length,
    proximas: classificadas.proximas.length,
    concluidas: classificadas.concluidas.length,
  })}`;

  // Seções → obras (na ordem das obras) → itens (na ordem da seção).
  const secoes = secoesAcoes(classificadas).map((sec) => ({
    ...sec,
    grupos: obras
      .map((o) => ({ obra: o, itens: sec.itens.filter((a) => a.obraId === o.id) }))
      .filter((g) => g.itens.length),
  }));

  function salvar(
    t: TarefaObra,
    v: { pct: number | 'feita'; comentario: string; prazo: string; motivo: string },
  ) {
    const alvo = { obraId: t.obra_id, id: t.id };
    const comentario = v.comentario.trim() || null;
    if (v.prazo !== t.prazo) {
      acoes.salvar.mutate({
        obraId: t.obra_id,
        entrada: {
          id: t.id,
          texto: t.texto,
          responsavelId: t.responsavel_id,
          responsavelNome: t.responsavel_id ? null : t.responsavelNomeBruto,
          observacao: t.observacao,
          prazo: v.prazo,
          motivoReplanejamento: motivoReplanejamento(t, v.prazo, v.motivo),
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

  function card(a: AcaoObra) {
    const feita = !a.aberta;
    const seta = feita ? null : <Icon name="chevronRight" size={18} />;
    if (a.origem === 'pendencia') {
      return (
        <CardAcao
          key={`pendencia:${a.id}`}
          acao={a}
          hoje={hoje}
          comResponsavel={false}
          cardInteiro
          esquerda={<MarcadorAcao feita={feita} />}
          direita={<Icon name="chevronRight" size={18} />}
          rotulo={`${a.texto}: abrir no Check list`}
          onToque={() => onAbrirPendencia(a.obraId, a.id)}
        />
      );
    }
    // Providência e atividade sem dono não têm responsável: não entram em Minhas ações.
    if (a.origem === 'providencia' || a.origem === 'atividade') return null;
    const t = a.tarefa;
    return (
      <CardAcao
        key={`tarefa:${a.id}`}
        acao={a}
        hoje={hoje}
        comResponsavel={false}
        cardInteiro
        esquerda={
          <Anel pct={feita ? 100 : t.avanco_pct} atrasada={estadoAcao(a, hoje) === 'atrasada'} />
        }
        direita={seta}
        rotulo={feita ? `${a.texto}: concluída. Tocar para reabrir` : `${a.texto}: dar avanço`}
        onToque={() => (feita ? reabrir(t) : setSel(t))}
      />
    );
  }

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronLeft" size={22} />
        </button>
        <div>
          <h1 className={styles.titulo}>Minhas ações</h1>
          <div className={styles.sub}>O que está com você, em todas as obras</div>
        </div>
      </header>

      <div className={styles.resumo}>{carregando ? 'Carregando…' : resumo}</div>

      <div className={styles.lista}>
        {!carregando && minhas.length === 0 ? (
          <p className={styles.vazio}>
            Nenhuma ação com você. As da reunião e as pendências do Check list aparecem aqui.
          </p>
        ) : null}
        {secoes.map((sec) => (
          <section key={sec.estado} className={styles.secao}>
            <TituloSecao secao={sec} />
            {sec.grupos.map((g) => (
              <div key={g.obra.id} className={styles.grupo}>
                <h3 className={styles.obra}>{g.obra.nome}</h3>
                {g.itens.map(card)}
              </div>
            ))}
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
      <svg className={styles.anelSvg} width="40" height="40" viewBox="0 0 36 36">
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
  onSalvar: (v: {
    pct: number | 'feita';
    comentario: string;
    prazo: string;
    motivo: string;
  }) => void;
}) {
  const [pct, setPct] = useState<number | 'feita'>(0);
  const [comentario, setComentario] = useState('');
  const [prazo, setPrazo] = useState('');
  const [mudarPrazo, setMudarPrazo] = useState(false);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!tarefa) return;
    setPct(PASSOS.includes(tarefa.avanco_pct) ? tarefa.avanco_pct : 0);
    setComentario(tarefa.comentario ?? '');
    setPrazo(tarefa.prazo);
    setMudarPrazo(false);
    setMotivo('');
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
          {prazoMudou(tarefa, prazo) ? (
            <>
              <label className={styles.rotulo} htmlFor="avanco-motivo">
                Motivo (opcional)
              </label>
              <input
                id="avanco-motivo"
                className={styles.campo}
                placeholder="Ex.: fornecedor sem estoque"
                maxLength={MOTIVO_MAX}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </>
          ) : null}
          <p className={styles.aviso}>
            O gestor vê o avanço e o comentário nas Tarefas e na cobrança da próxima reunião.
          </p>

          <button
            type="button"
            className={styles.salvar}
            onClick={() => onSalvar({ pct, comentario, prazo: prazo || tarefa.prazo, motivo })}
          >
            {pct === 'feita' ? 'Concluir ação' : 'Salvar avanço'}
          </button>
        </div>
      ) : null}
    </BottomSheet>
  );
}
