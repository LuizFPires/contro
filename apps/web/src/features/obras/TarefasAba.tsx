import { useMemo, useState } from 'react';
import { classificarTarefas, tarefaAtrasada, textoReplanejamento } from '@obdc/core';
import { Card, Icon, useToast } from '@obdc/ui';
import { usePessoas } from '../perfil/usePessoas';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import { Camera } from './Camera';
import { TarefaSheet } from './TarefaSheet';
import type { EntradaTarefa } from './campo';
import type { ObraCompleta } from './detalhe';
import type { TarefaObra } from './tarefasObra';
import { useObraCampo } from './useObraCampo';
import { useObraTarefas } from './useObraTarefas';
import styles from './TarefasAba.module.css';

const VINCULO_ROTULO: Record<string, string> = {
  providencia: 'Lembrete',
  atividade: 'Atividade',
};

export function TarefasAba({ obra }: { obra: ObraCompleta }) {
  const { showToast } = useToast();
  const { data: pessoas = [] } = usePessoas();
  const tarefas = useObraTarefas(obra.id);
  const campo = useObraCampo(obra.id);
  const [filtro, setFiltro] = useState<string>('todos');
  const [sheet, setSheet] = useState<{ aberto: boolean; tarefa: TarefaObra | null }>({
    aberto: false,
    tarefa: null,
  });
  const [camera, setCamera] = useState<TarefaObra | null>(null);

  const lista = useMemo(() => tarefas.query.data ?? [], [tarefas.query.data]);
  const hoje = hojeISO();

  // Contador de atrasadas por pessoa (para os chips de filtro).
  const atrasadasPorPessoa = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of lista) {
      if (tarefaAtrasada(t, hoje)) {
        const k = t.responsavel_id ?? 'sem';
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    return m;
  }, [lista, hoje]);

  const pessoasComTarefa = useMemo(() => {
    const ids = new Set(lista.map((t) => t.responsavel_id ?? 'sem'));
    return pessoas.filter((p) => ids.has(p.id));
  }, [lista, pessoas]);

  const filtrada = useMemo(
    () =>
      filtro === 'todos' ? lista : lista.filter((t) => (t.responsavel_id ?? 'sem') === filtro),
    [lista, filtro],
  );
  const { atrasadas, abertas, concluidas } = useMemo(
    () => classificarTarefas(filtrada, hoje),
    [filtrada, hoje],
  );

  function concluir(t: TarefaObra) {
    if (t.vinculo_tipo === 'atividade' && t.vinculo_id) {
      setCamera(t); // atividade → câmera (conclui a atividade e a tarefa)
      return;
    }
    tarefas.concluir.mutate(t.id, {
      onSuccess: () =>
        showToast({ message: 'Tarefa concluída', onUndo: () => tarefas.reabrir.mutate(t.id) }),
    });
  }

  function salvar(e: EntradaTarefa) {
    tarefas.salvar.mutate(e, {
      onSuccess: () => setSheet({ aberto: false, tarefa: null }),
      onError: () => showToast({ message: 'Não foi possível salvar a tarefa' }),
    });
  }

  function excluir(t: TarefaObra) {
    tarefas.excluir.mutate(t.id, {
      onSuccess: () => {
        setSheet({ aberto: false, tarefa: null });
        showToast({ message: 'Tarefa excluída', onUndo: () => tarefas.restaurar.mutate(t.id) });
      },
    });
  }

  return (
    <div className={styles.aba}>
      <div className={styles.topo}>
        <div className={styles.filtros}>
          <Chip ativo={filtro === 'todos'} onClick={() => setFiltro('todos')} rotulo="Todos" />
          {pessoasComTarefa.map((p) => (
            <Chip
              key={p.id}
              ativo={filtro === p.id}
              onClick={() => setFiltro(p.id)}
              rotulo={p.nome}
              atrasadas={atrasadasPorPessoa.get(p.id) ?? 0}
            />
          ))}
        </div>
        <button
          type="button"
          className={styles.nova}
          onClick={() => setSheet({ aberto: true, tarefa: null })}
        >
          <Icon name="plus" size={18} />
          Tarefa
        </button>
      </div>

      <Grupo titulo={`Atrasadas (${atrasadas.length})`} atraso>
        {atrasadas.map((t) => (
          <Linha
            key={t.id}
            t={t}
            atrasada
            onConcluir={() => concluir(t)}
            onEditar={() => setSheet({ aberto: true, tarefa: t })}
          />
        ))}
      </Grupo>
      <Grupo titulo={`Abertas (${abertas.length})`}>
        {abertas.map((t) => (
          <Linha
            key={t.id}
            t={t}
            onConcluir={() => concluir(t)}
            onEditar={() => setSheet({ aberto: true, tarefa: t })}
          />
        ))}
      </Grupo>
      <Grupo titulo={`Concluídas (${concluidas.length})`}>
        {concluidas.map((t) => (
          <Linha
            key={t.id}
            t={t}
            concluida
            onConcluir={() =>
              tarefas.reabrir.mutate(t.id, {
                onSuccess: () => showToast({ message: 'Tarefa reaberta' }),
              })
            }
            onEditar={() => setSheet({ aberto: true, tarefa: t })}
          />
        ))}
      </Grupo>

      <TarefaSheet
        aberto={sheet.aberto}
        tarefa={sheet.tarefa}
        pessoas={pessoas}
        pendente={tarefas.salvar.isPending}
        onFechar={() => setSheet({ aberto: false, tarefa: null })}
        onSalvar={salvar}
        onExcluir={sheet.tarefa ? () => excluir(sheet.tarefa as TarefaObra) : undefined}
      />

      {camera ? (
        <Camera
          titulo="Concluir atividade com foto"
          pendente={campo.concluir.isPending}
          onCancelar={() => setCamera(null)}
          onCapturar={(file) =>
            campo.concluir.mutate(
              { atividadeId: camera.vinculo_id as string, file },
              {
                onSuccess: () => {
                  const t = camera;
                  setCamera(null);
                  tarefas.concluir.mutate(t.id, {
                    onSuccess: () =>
                      showToast({
                        message: 'Atividade e tarefa concluídas',
                        onUndo: () => tarefas.reabrir.mutate(t.id),
                      }),
                  });
                },
                onError: () => showToast({ message: 'Não foi possível concluir a atividade' }),
              },
            )
          }
        />
      ) : null}
    </div>
  );
}

function Chip({
  ativo,
  onClick,
  rotulo,
  atrasadas,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  atrasadas?: number;
}) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${ativo ? styles.chipAtivo : ''}`}
      onClick={onClick}
    >
      {rotulo}
      {atrasadas ? <span className={styles.chipBadge}>{atrasadas}</span> : null}
    </button>
  );
}

function Grupo({
  titulo,
  atraso,
  children,
}: {
  titulo: string;
  atraso?: boolean;
  children: React.ReactNode;
}) {
  const vazio = Array.isArray(children) && children.length === 0;
  if (vazio) return null;
  return (
    <Card>
      <p className={`${styles.grupoTitulo} ${atraso ? styles.grupoAtraso : ''}`}>{titulo}</p>
      {children}
    </Card>
  );
}

function Linha({
  t,
  atrasada,
  concluida,
  onConcluir,
  onEditar,
}: {
  t: TarefaObra;
  atrasada?: boolean;
  concluida?: boolean;
  onConcluir: () => void;
  onEditar: () => void;
}) {
  const repl = textoReplanejamento(
    t.replanejamentos,
    t.prazo_original ? formatarDataCurta(t.prazo_original) : null,
  );
  return (
    <div className={styles.linha}>
      <button
        type="button"
        className={styles.check}
        aria-label={concluida ? 'Reabrir tarefa' : 'Concluir tarefa'}
        onClick={onConcluir}
      >
        <span className={`${styles.checkCirc} ${concluida ? styles.checkFeito : ''}`}>
          {concluida ? <Icon name="check" size={16} /> : null}
        </span>
      </button>
      <button type="button" className={styles.corpo} onClick={onEditar}>
        <span className={`${styles.texto} ${concluida ? styles.textoFeito : ''}`}>{t.texto}</span>
        <span className={styles.meta}>
          {t.responsavelNome ?? 'Sem responsável'} ·{' '}
          <span className={atrasada ? styles.prazoAtraso : ''}>{formatarDataCurta(t.prazo)}</span>
          {t.vinculo_tipo ? ` · ${VINCULO_ROTULO[t.vinculo_tipo]}` : ''}
          {t.origem_texto ? ` · ${t.origem_texto}` : ''}
        </span>
        {repl ? <span className={styles.repl}>{repl}</span> : null}
      </button>
    </div>
  );
}
