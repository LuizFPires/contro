import { useMemo, useState } from 'react';
import {
  classificarAcoes,
  estadoAcao,
  nomeCurto,
  providenciaParaAcaoBase,
  textoResumoSecoes,
  type AtividadeSemDono,
  type ProvidenciaSemDono,
} from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import { usePessoas } from '../perfil/usePessoas';
import { acoesVisiveis, secoesAcoes, type AcaoObra } from './acoesObra';
import { hojeISO } from './api';
import { Camera } from './Camera';
import { CardAcao, MarcadorAcao, TituloSecao } from './CardAcao';
import { TarefaSheet } from './TarefaSheet';
import { entradaAtribuicao, entradaAtribuicaoAtividade } from './entradaTarefa';
import type { EntradaTarefa } from './campo';
import type { TarefaObra } from './tarefasObra';
import { useObraCampo } from './useObraCampo';
import { useObras } from './useObras';
import { useAcoesDasObras } from './useAcoesDasObras';
import { useTarefasAcoes } from './useObraTarefas';
import styles from './TarefasScreen.module.css';

const SEM = 'sem';

/** Chave do chip: pessoa do app, nome digitado ou sem responsável. */
const chaveResp = (a: AcaoObra) =>
  a.responsavelId ?? (a.responsavelNome ? `nome:${a.responsavelNome}` : SEM);

/**
 * Tarefas da equipe (protótipo · TAREFAS): tarefas, pendências do Check list e
 * providências e atividades sem dono de todas as obras, como "ação", em quatro
 * seções; filtro por pessoa. Providência e atividade sem dono caem em "Sem
 * responsável" e o toque abre a atribuição (vira tarefa vinculada).
 */
export function TarefasScreen({
  onVoltar,
  onMinhas,
  onAbrirPendencia,
}: {
  onVoltar: () => void;
  /** Abre Minhas ações (o que está com quem está logado). */
  onMinhas: () => void;
  /** Abre o Check list da obra da pendência. */
  onAbrirPendencia: (obraId: string, pendenciaId: string) => void;
}) {
  const { showToast } = useToast();
  const { data: obras = [] } = useObras();
  const { data: pessoas = [] } = usePessoas();
  const { acoes: todas, carregando } = useAcoesDasObras(obras.map((o) => o.id));
  const acoes = useTarefasAcoes();
  const [filtro, setFiltro] = useState<string>('todos');
  const [editando, setEditando] = useState<TarefaObra | null>(null);
  const [nova, setNova] = useState(false);
  const [camera, setCamera] = useState<TarefaObra | null>(null);
  const [atribuindo, setAtribuindo] = useState<ProvidenciaSemDono | null>(null);
  const [atribuindoAtividade, setAtribuindoAtividade] = useState<AtividadeSemDono | null>(null);
  const hoje = hojeISO();
  const lista = useMemo(() => acoesVisiveis(todas, hoje), [todas, hoje]);

  const nomeObra = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  // Estável: a folha reinicia o formulário quando `obras` muda de identidade.
  const opcoesObra = useMemo(() => obras.map((o) => ({ id: o.id, nome: o.nome })), [obras]);

  // Chips: uma pessoa por responsável com ação; o selo conta só as atrasadas.
  const chips = useMemo(() => {
    const m = new Map<string, { nome: string; atrasadas: number }>();
    for (const a of lista) {
      const k = chaveResp(a);
      const c = m.get(k) ?? { nome: a.responsavelNome ?? 'Sem responsável', atrasadas: 0 };
      if (estadoAcao(a, hoje) === 'atrasada') c.atrasadas += 1;
      m.set(k, c);
    }
    return [...m.entries()].map(([id, c]) => ({ id, ...c }));
  }, [lista, hoje]);

  const filtrada = useMemo(
    () => (filtro === 'todos' ? lista : lista.filter((a) => chaveResp(a) === filtro)),
    [lista, filtro],
  );
  const classificadas = useMemo(() => classificarAcoes(filtrada, hoje), [filtrada, hoje]);
  const secoes = secoesAcoes(classificadas);

  const quem = filtro === 'todos' ? 'Equipe' : (chips.find((c) => c.id === filtro)?.nome ?? '');
  const resumo = `${quem}: ${textoResumoSecoes({
    atrasadas: classificadas.atrasadas.length,
    hoje: classificadas.hoje.length,
    proximas: classificadas.proximas.length,
    concluidas: classificadas.concluidas.length,
  })}`;

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

  // Nome curto só para o toast (o digitado vai completo: fica gravado e vira
  // sugestão). O card otimista encurta o nome em useTarefasAcoes.
  const nomeDoToast = (e: EntradaTarefa) =>
    nomeCurto(
      e.responsavelId ? pessoas.find((x) => x.id === e.responsavelId)?.nome : e.responsavelNome,
    ) || 'responsável';

  function atribuir(e: EntradaTarefa) {
    const p = atribuindo;
    if (!p) return;
    const nome = nomeDoToast(e);
    acoes.salvar.mutate(
      { obraId: p.obraId, entrada: entradaAtribuicao(p, e) },
      {
        onSuccess: (id) => {
          setAtribuindo(null);
          showToast({
            message: `Providência atribuída a ${nome}`,
            onUndo: () => acoes.excluir.mutate({ obraId: p.obraId, id }),
          });
        },
        onError: () => showToast({ message: 'Não foi possível atribuir a providência' }),
      },
    );
  }

  function atribuirAtividade(e: EntradaTarefa) {
    const a = atribuindoAtividade;
    if (!a) return;
    const nome = nomeDoToast(e);
    acoes.salvar.mutate(
      { obraId: a.obraId, entrada: entradaAtribuicaoAtividade(a, e) },
      {
        onSuccess: (id) => {
          setAtribuindoAtividade(null);
          showToast({
            message: `Atividade atribuída a ${nome}`,
            onUndo: () => acoes.excluir.mutate({ obraId: a.obraId, id }),
          });
        },
        onError: () => showToast({ message: 'Não foi possível atribuir a atividade' }),
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
          <button type="button" className={styles.minhas} onClick={onMinhas}>
            <Icon name="pessoa" size={18} />
            Minhas
          </button>
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
        {secoes.map((sec) => (
          <section key={sec.estado} className={styles.grupo}>
            <TituloSecao secao={sec} />
            {sec.itens.map((a) => (
              <Linha
                key={`${a.origem}:${a.id}`}
                a={a}
                hoje={hoje}
                obra={nomeObra.get(a.obraId) ?? ''}
                onConcluir={concluir}
                onReabrir={reabrir}
                onEditar={setEditando}
                onAbrirPendencia={onAbrirPendencia}
                onAtribuir={setAtribuindo}
                onAtribuirAtividade={setAtribuindoAtividade}
              />
            ))}
          </section>
        ))}
        {!carregando && filtrada.length === 0 ? (
          <div className={styles.vazio}>
            {filtro === 'todos'
              ? 'Nenhuma ação ainda. Toque no + para criar uma tarefa.'
              : 'Nenhuma ação para esta pessoa.'}
          </div>
        ) : null}
      </div>

      <TarefaSheet
        aberto={editando !== null || nova}
        tarefa={editando}
        pessoas={pessoas}
        obras={opcoesObra}
        pendente={acoes.salvar.isPending}
        onFechar={() => {
          setEditando(null);
          setNova(false);
        }}
        onSalvar={salvar}
        onExcluir={editando ? () => excluir(editando) : undefined}
      />

      <TarefaSheet
        modo="atribuir"
        aberto={atribuindo !== null}
        tarefa={null}
        inicial={
          atribuindo
            ? {
                texto: providenciaParaAcaoBase(atribuindo).texto,
                prazo: atribuindo.prazo,
                obraId: atribuindo.obraId,
              }
            : undefined
        }
        pessoas={pessoas}
        obras={opcoesObra}
        pendente={acoes.salvar.isPending}
        onFechar={() => setAtribuindo(null)}
        onSalvar={atribuir}
      />

      <TarefaSheet
        modo="atribuir"
        tituloAtribuir="Atribuir atividade"
        aberto={atribuindoAtividade !== null}
        tarefa={null}
        inicial={
          atribuindoAtividade
            ? {
                texto: `Atividade: ${atribuindoAtividade.nome}`,
                prazo: atribuindoAtividade.prazo,
                obraId: atribuindoAtividade.obraId,
              }
            : undefined
        }
        pessoas={pessoas}
        obras={opcoesObra}
        pendente={acoes.salvar.isPending}
        onFechar={() => setAtribuindoAtividade(null)}
        onSalvar={atribuirAtividade}
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

/** Uma ação na lista: tarefa com check/reabrir/editar; pendência abre o Check list. */
function Linha({
  a,
  hoje,
  obra,
  onConcluir,
  onReabrir,
  onEditar,
  onAbrirPendencia,
  onAtribuir,
  onAtribuirAtividade,
}: {
  a: AcaoObra;
  hoje: string;
  obra: string;
  onConcluir: (t: TarefaObra) => void;
  onReabrir: (t: TarefaObra) => void;
  onEditar: (t: TarefaObra) => void;
  onAbrirPendencia: (obraId: string, pendenciaId: string) => void;
  onAtribuir: (p: ProvidenciaSemDono) => void;
  onAtribuirAtividade: (a: AtividadeSemDono) => void;
}) {
  if (a.origem === 'pendencia') {
    return (
      <CardAcao
        acao={a}
        hoje={hoje}
        obra={obra}
        cardInteiro
        esquerda={<MarcadorAcao feita={!a.aberta} />}
        rotulo={`${a.texto}: abrir no Check list`}
        onToque={() => onAbrirPendencia(a.obraId, a.id)}
      />
    );
  }
  if (a.origem === 'providencia') {
    return <CardAcao acao={a} hoje={hoje} obra={obra} onAtribuir={onAtribuir} />;
  }
  if (a.origem === 'atividade') {
    return <CardAcao acao={a} hoje={hoje} obra={obra} onAtribuirAtividade={onAtribuirAtividade} />;
  }
  const t = a.tarefa;
  const feita = !a.aberta;
  return (
    <CardAcao
      acao={a}
      hoje={hoje}
      obra={obra}
      rotulo={`${a.texto}: editar tarefa`}
      onToque={() => onEditar(t)}
      esquerda={
        feita ? (
          <button
            type="button"
            className={styles.checkFeito}
            aria-label="Reabrir tarefa"
            title="Reabrir tarefa"
            onClick={() => onReabrir(t)}
          >
            <Icon name="checkGrosso" size={20} strokeWidth={2.6} />
          </button>
        ) : (
          <button
            type="button"
            className={styles.check}
            aria-label="Concluir tarefa"
            onClick={() => onConcluir(t)}
          >
            <Icon name="checkGrosso" size={20} strokeWidth={2.4} />
          </button>
        )
      }
      direita={
        feita ? (
          <button type="button" className={styles.reabrir} onClick={() => onReabrir(t)}>
            Reabrir
          </button>
        ) : null
      }
    />
  );
}
