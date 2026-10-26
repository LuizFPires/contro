import { useMemo, useState } from 'react';
import { classificarTarefas, tarefaAtrasada, textoReplanejamento } from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import { usePessoas } from '../perfil/usePessoas';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import { Camera } from './Camera';
import { TarefaSheet } from './TarefaSheet';
import type { EntradaTarefa } from './campo';
import type { TarefaObra } from './tarefasObra';
import { useObraCampo } from './useObraCampo';
import { useObras } from './useObras';
import { useTarefasAcoes, useTarefasDasObras } from './useObraTarefas';
import styles from './TarefasScreen.module.css';

const SEM = 'sem';

/** Tarefas da equipe (protótipo · TAREFAS): todas as obras, filtro por pessoa. */
export function TarefasScreen({ onVoltar }: { onVoltar: () => void }) {
  const { showToast } = useToast();
  const { data: obras = [] } = useObras();
  const { data: pessoas = [] } = usePessoas();
  const { tarefas: lista, carregando } = useTarefasDasObras(obras.map((o) => o.id));
  const acoes = useTarefasAcoes();
  const [filtro, setFiltro] = useState<string>('todos');
  const [editando, setEditando] = useState<TarefaObra | null>(null);
  const [nova, setNova] = useState(false);
  const [camera, setCamera] = useState<TarefaObra | null>(null);
  const hoje = hojeISO();

  const nomeObra = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);

  // Chips: uma pessoa por responsável com tarefa, com o nº de atrasadas.
  const chips = useMemo(() => {
    const m = new Map<string, { nome: string; atrasadas: number }>();
    for (const t of lista) {
      const k = t.responsavel_id ?? SEM;
      const c = m.get(k) ?? { nome: t.responsavelNome ?? 'Sem responsável', atrasadas: 0 };
      if (tarefaAtrasada(t, hoje)) c.atrasadas += 1;
      m.set(k, c);
    }
    return [...m.entries()].map(([id, c]) => ({ id, ...c }));
  }, [lista, hoje]);

  const filtrada = useMemo(
    () => (filtro === 'todos' ? lista : lista.filter((t) => (t.responsavel_id ?? SEM) === filtro)),
    [lista, filtro],
  );
  const { atrasadas, abertas, concluidas } = useMemo(
    () => classificarTarefas(filtrada, hoje),
    [filtrada, hoje],
  );

  const quem = filtro === 'todos' ? 'Equipe' : (chips.find((c) => c.id === filtro)?.nome ?? '');
  const nAbertas = atrasadas.length + abertas.length;
  const resumo = `${quem}: ${nAbertas} ${nAbertas === 1 ? 'aberta' : 'abertas'} · ${atrasadas.length} ${atrasadas.length === 1 ? 'atrasada' : 'atrasadas'} · ${concluidas.length} ${concluidas.length === 1 ? 'concluída' : 'concluídas'}`;

  const alvo = (t: TarefaObra) => ({ obraId: t.obra_id, id: t.id });

  function concluir(t: TarefaObra) {
    if (t.vinculo_tipo === 'atividade' && t.vinculo_id) {
      setCamera(t); // atividade → câmera (conclui a atividade e a tarefa)
      return;
    }
    acoes.concluir.mutate(alvo(t), {
      onSuccess: () =>
        showToast({ message: 'Tarefa concluída', onUndo: () => acoes.reabrir.mutate(alvo(t)) }),
    });
  }

  function reabrir(t: TarefaObra) {
    acoes.reabrir.mutate(alvo(t), {
      onSuccess: () =>
        showToast({ message: 'Tarefa reaberta', onUndo: () => acoes.concluir.mutate(alvo(t)) }),
    });
  }

  function salvar(e: EntradaTarefa, obraEscolhida?: string) {
    const obraId = editando?.obra_id ?? obraEscolhida;
    if (!obraId) return;
    const nova = !editando;
    acoes.salvar.mutate(
      { obraId, entrada: e },
      {
        onSuccess: () => {
          setEditando(null);
          setNova(false);
          if (nova) showToast({ message: 'Tarefa criada' });
        },
        onError: () => showToast({ message: 'Não foi possível salvar a tarefa' }),
      },
    );
  }

  function excluir(t: TarefaObra) {
    acoes.excluir.mutate(alvo(t), {
      onSuccess: () => {
        setEditando(null);
        showToast({ message: 'Tarefa excluída', onUndo: () => acoes.restaurar.mutate(alvo(t)) });
      },
    });
  }

  const grupos = [
    { titulo: 'Atrasadas', classe: styles.gAtraso, itens: atrasadas },
    { titulo: 'Abertas', classe: '', itens: abertas },
    { titulo: 'Concluídas', classe: styles.gFeita, itens: concluidas },
  ].filter((g) => g.itens.length);

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.topo}>
          <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
            <Icon name="chevronLeft" size={22} />
          </button>
          <div className={styles.topoTexto}>
            <h1 className={styles.titulo}>Tarefas da equipe</h1>
            <div className={styles.sub}>
              O que cada um ficou de fazer · dê baixa ao longo da semana
            </div>
          </div>
          <button
            type="button"
            className={styles.nova}
            aria-label="Nova tarefa"
            title="Nova tarefa"
            onClick={() => setNova(true)}
          >
            <Icon name="plus" size={22} strokeWidth={2.4} />
          </button>
        </div>
        <div className={styles.chips}>
          {[{ id: 'todos', nome: 'Todos', atrasadas: 0 }, ...chips].map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.chip} ${filtro === c.id ? styles.chipAtivo : ''}`}
              aria-pressed={filtro === c.id}
              onClick={() => setFiltro(c.id)}
            >
              {c.nome}
              {c.atrasadas ? (
                <span className={styles.chipAtraso}>
                  <span className="sr-only">atrasadas: </span>
                  {c.atrasadas}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.resumo}>{carregando ? 'Carregando…' : resumo}</div>

      <div className={styles.lista}>
        {grupos.map((g) => (
          <section key={g.titulo} className={styles.grupo}>
            <h2 className={`${styles.grupoTitulo} ${g.classe}`}>
              {g.titulo} · {g.itens.length}
            </h2>
            {g.itens.map((t) => (
              <Linha
                key={t.id}
                t={t}
                obra={nomeObra.get(t.obra_id) ?? ''}
                atrasada={tarefaAtrasada(t, hoje)}
                onConcluir={() => concluir(t)}
                onReabrir={() => reabrir(t)}
                onEditar={() => setEditando(t)}
              />
            ))}
          </section>
        ))}
        {!carregando && filtrada.length === 0 ? (
          <div className={styles.vazio}>
            {filtro === 'todos'
              ? 'Nenhuma tarefa ainda. Toque no + para criar uma.'
              : 'Nenhuma tarefa para esta pessoa.'}
          </div>
        ) : null}
      </div>

      <TarefaSheet
        aberto={editando !== null || nova}
        tarefa={editando}
        pessoas={pessoas}
        obras={obras.map((o) => ({ id: o.id, nome: o.nome }))}
        pendente={acoes.salvar.isPending}
        onFechar={() => {
          setEditando(null);
          setNova(false);
        }}
        onSalvar={salvar}
        onExcluir={editando ? () => excluir(editando) : undefined}
      />

      {camera ? (
        <CameraAtividade
          tarefa={camera}
          onFechar={() => setCamera(null)}
          onConcluida={() => {
            const t = camera;
            setCamera(null);
            acoes.concluir.mutate(alvo(t), {
              onSuccess: () =>
                showToast({
                  message: 'Atividade e tarefa concluídas',
                  onUndo: () => acoes.reabrir.mutate(alvo(t)),
                }),
            });
          }}
        />
      ) : null}
    </div>
  );
}

/** Câmera para concluir a atividade vinculada à tarefa (na obra da tarefa). */
function CameraAtividade({
  tarefa,
  onFechar,
  onConcluida,
}: {
  tarefa: TarefaObra;
  onFechar: () => void;
  onConcluida: () => void;
}) {
  const { showToast } = useToast();
  const campo = useObraCampo(tarefa.obra_id);
  return (
    <Camera
      kicker="Foto de conclusão"
      titulo="Concluir atividade com foto"
      dica="Uma foto por ambiente. Ela vira o registro da etapa e libera as próximas atividades."
      pendente={campo.concluir.isPending}
      onCancelar={onFechar}
      onCapturar={(file) =>
        campo.concluir.mutate(
          { atividadeId: tarefa.vinculo_id as string, file },
          {
            onSuccess: onConcluida,
            onError: () => showToast({ message: 'Não foi possível concluir a atividade' }),
          },
        )
      }
    />
  );
}

function Linha({
  t,
  obra,
  atrasada,
  onConcluir,
  onReabrir,
  onEditar,
}: {
  t: TarefaObra;
  obra: string;
  atrasada: boolean;
  onConcluir: () => void;
  onReabrir: () => void;
  onEditar: () => void;
}) {
  const feita = t.status === 'feita';
  const repl = feita
    ? null
    : textoReplanejamento(
        t.replanejamentos,
        t.prazo_original ? formatarDataCurta(t.prazo_original) : null,
      );
  const prazo = feita
    ? 'Concluída'
    : atrasada
      ? `ATRASADA · prazo era ${formatarDataCurta(t.prazo)}`
      : `Prazo ${formatarDataCurta(t.prazo)}`;
  const estado = feita ? styles.feita : atrasada ? styles.atrasada : '';

  return (
    <div className={`${styles.item} ${estado}`}>
      {feita ? (
        <button
          type="button"
          className={styles.checkFeito}
          aria-label="Reabrir tarefa"
          title="Reabrir tarefa"
          onClick={onReabrir}
        >
          <Icon name="checkGrosso" size={20} strokeWidth={2.6} />
        </button>
      ) : (
        <button
          type="button"
          className={styles.check}
          aria-label="Concluir tarefa"
          onClick={onConcluir}
        >
          <Icon name="checkGrosso" size={20} strokeWidth={2.4} />
        </button>
      )}
      <button type="button" className={styles.corpo} aria-label="Editar tarefa" onClick={onEditar}>
        <span className={styles.texto}>{t.texto}</span>
        <span className={styles.meta}>
          {[obra, t.responsavelNome ?? 'Sem responsável', t.origem_texto]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <span className={styles.prazo}>{prazo}</span>
        {repl ? <span className={styles.repl}>{repl}</span> : null}
      </button>
      {feita ? (
        <button type="button" className={styles.reabrir} onClick={onReabrir}>
          Reabrir
        </button>
      ) : null}
    </div>
  );
}
