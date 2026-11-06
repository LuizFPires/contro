import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  classificarAcoes,
  podePlanejarObraGeral,
  rotuloPapelGeral,
  seloChipResponsavel,
  textoResumoSecoes,
} from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import { acoesVisiveis, secoesAcoes } from '../obras/acoesObra';
import { hojeISO } from '../obras/api';
import { CardAcao, MarcadorAcao, TituloSecao } from '../obras/CardAcao';
import type { EntradaTarefa } from '../obras/campo';
import { motivoReplanejamento } from '../obras/entradaTarefa';
import { AvancoSheet } from '../obras/MinhasAcoesScreen';
import { TarefaSheet } from '../obras/TarefaSheet';
import type { TarefaObra } from '../obras/tarefasObra';
import { usePendenciasDasObras } from '../obras/useObraPendencias';
import { useTarefasAcoes, useTarefasDasObras } from '../obras/useObraTarefas';
import type { PessoaResumo } from '../perfil/usePessoas';
import type { PessoaAtual } from '../perfil/usePerfil';
import { acoesDaTelaGeral, type AcaoObraGeral } from './resumoObrasGerais';
import { useObraGeral } from './useObraGeral';
import { useResumoObrasGerais } from './useResumoObrasGerais';
import tarefas from '../obras/TarefasScreen.module.css';
import styles from './AcoesObraGeral.module.css';

const SEM = 'sem';

const chaveResp = (a: AcaoObraGeral) =>
  a.responsavelId ?? (a.responsavelNome ? `nome:${a.responsavelNome}` : SEM);

/**
 * Ações da equipe de uma ou de todas as obras gerais (mockups C1, J2, A13): chips por
 * responsável e as seções Atrasadas, Vencem hoje, Próximos 5 dias e Concluídas, com
 * atividades, tarefas, pendências e providências (a mesma conta das ações do dia). Atividade
 * e providência abrem a ficha da atividade; pendência abre o Check list; tarefa conclui no
 * check e o toque abre o avanço (a própria ou de quem não planeja) ou a edição (quem planeja).
 */
export function AcoesObraGeral({
  obraIds,
  pessoa,
  filtroInicial,
  onVoltar,
  onAbrirAtividade,
  onAbrirPendencia,
}: {
  obraIds: string[];
  pessoa: PessoaAtual;
  /** Chip com que a tela abre (ao voltar da ficha, o que estava escolhido). */
  filtroInicial?: string;
  onVoltar: () => void;
  /** `filtro` é o chip escolhido, para a tela voltar nele. */
  onAbrirAtividade: (obraId: string, atividadeId: string, filtro: string) => void;
  onAbrirPendencia: (obraId: string, pendenciaId: string, filtro: string) => void;
}) {
  const { data: resumo, isLoading } = useResumoObrasGerais();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const hoje = hojeISO();
  const obras = useMemo(
    () => (resumo ?? []).filter((o) => obraIds.includes(o.id)),
    [resumo, obraIds],
  );
  const { tarefas: listaTarefas, carregando: carregandoT } = useTarefasDasObras(obraIds);
  const { pendencias: listaPendencias, carregando: carregandoP } = usePendenciasDasObras(obraIds);
  const carregando = isLoading || carregandoT || carregandoP;
  const acoes = useTarefasAcoes();
  const planeja = podePlanejarObraGeral({
    administrador: pessoa.administrador,
    acessoContorno: pessoa.acessoContorno,
    papelGeral: pessoa.papelGeral,
  });
  const [editando, setEditando] = useState<TarefaObra | null>(null);
  const [avancando, setAvancando] = useState<TarefaObra | null>(null);
  // Responsável da tarefa em obra geral: só pessoas da obra (e Administradores).
  const { data: obraEditada } = useObraGeral(editando?.obra_id ?? null);
  const pessoasDaObra: PessoaResumo[] = useMemo(
    () =>
      (obraEditada?.pessoas ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        papel_texto: p.papel === 'administrador' ? 'Administrador' : rotuloPapelGeral(p.papel),
      })),
    [obraEditada],
  );

  const soUma = obraIds.length === 1;
  // Membro (em todas as obras mostradas) abre no chip dele; o resto, em "Todos".
  const membro = obras.length > 0 && obras.every((o) => o.papel === 'membro');
  const [escolhido, setFiltro] = useState<string | null>(filtroInicial ?? null);
  const filtro = escolhido ?? (membro ? pessoa.id : 'todos');

  const lista = useMemo<AcaoObraGeral[]>(
    () =>
      acoesVisiveis(
        obras.flatMap((o) =>
          acoesDaTelaGeral(
            o,
            listaTarefas.filter((t) => t.obra_id === o.id),
            listaPendencias.filter((p) => p.obra_id === o.id),
          ),
        ),
        hoje,
      ),
    [obras, listaTarefas, listaPendencias, hoje],
  );
  const nomeObra = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);

  const chips = useMemo(() => {
    const m = new Map<string, { nome: string; itens: AcaoObraGeral[] }>();
    for (const a of lista) {
      const k = chaveResp(a);
      const c = m.get(k) ?? { nome: a.responsavelNome ?? 'Sem responsável', itens: [] };
      c.itens.push(a);
      m.set(k, c);
    }
    return [...m.entries()].map(([id, c]) => ({
      id,
      nome: c.nome,
      ...seloChipResponsavel(c.itens, hoje, id === SEM),
    }));
  }, [lista, hoje]);
  const semResp = chips.find((c) => c.id === SEM);
  const seloTodos = useMemo(() => seloChipResponsavel(lista, hoje, false), [lista, hoje]);
  const ordemChips = [
    ...(semResp ? [semResp] : []),
    { id: 'todos', nome: 'Todos', ...seloTodos },
    ...chips.filter((c) => c.id !== SEM),
  ];
  const filtroAtivo = chips.some((c) => c.id === filtro) ? filtro : 'todos';

  const filtrada = useMemo(
    () => (filtroAtivo === 'todos' ? lista : lista.filter((a) => chaveResp(a) === filtroAtivo)),
    [lista, filtroAtivo],
  );
  const classificadas = useMemo(() => classificarAcoes(filtrada, hoje), [filtrada, hoje]);
  const secoes = secoesAcoes(classificadas);
  const quem =
    filtroAtivo === 'todos' ? 'Equipe' : (chips.find((c) => c.id === filtroAtivo)?.nome ?? '');
  const resumoTexto = `${quem}: ${textoResumoSecoes({
    atrasadas: classificadas.atrasadas.length,
    hoje: classificadas.hoje.length,
    proximas: classificadas.proximas.length,
    concluidas: classificadas.concluidas.length,
  })}`;

  // O Hoje e os blocos leem o resumo: refaz depois de cada ação de tarefa.
  const refazerResumo = () => void qc.invalidateQueries({ queryKey: ['obras-gerais', 'resumo'] });
  const alvo = (t: TarefaObra) => ({ obraId: t.obra_id, id: t.id });

  function concluir(t: TarefaObra) {
    // Tarefa da atividade: conclui-se a atividade na ficha (fecha a tarefa junto).
    if (t.vinculo_tipo === 'atividade' && t.vinculo_id) {
      onAbrirAtividade(t.obra_id, t.vinculo_id, filtroAtivo);
      return;
    }
    acoes.concluir.mutate(alvo(t), {
      onSuccess: () => {
        refazerResumo();
        showToast({
          message: 'Tarefa concluída',
          onUndo: () => acoes.reabrir.mutate(alvo(t), { onSuccess: refazerResumo }),
        });
      },
    });
  }

  function reabrir(t: TarefaObra) {
    acoes.reabrir.mutate(alvo(t), {
      onSuccess: () => {
        refazerResumo();
        showToast({
          message: 'Tarefa reaberta',
          onUndo: () => acoes.concluir.mutate(alvo(t), { onSuccess: refazerResumo }),
        });
      },
    });
  }

  function salvar(e: EntradaTarefa) {
    const t = editando;
    if (!t) return;
    acoes.salvar.mutate(
      {
        obraId: t.obra_id,
        entrada: { ...e, vinculoTipo: t.vinculo_tipo, vinculoId: t.vinculo_id },
      },
      {
        onSuccess: () => {
          setEditando(null);
          refazerResumo();
          showToast({ message: 'Tarefa salva' });
        },
        onError: () => showToast({ message: 'Não foi possível salvar a tarefa' }),
      },
    );
  }

  function excluir(t: TarefaObra) {
    acoes.excluir.mutate(alvo(t), {
      onSuccess: () => {
        setEditando(null);
        refazerResumo();
        showToast({
          message: 'Tarefa excluída',
          onUndo: () => acoes.restaurar.mutate(alvo(t), { onSuccess: refazerResumo }),
        });
      },
    });
  }

  function salvarAvanco(
    t: TarefaObra,
    v: { pct: number | 'feita'; comentario: string; prazo: string; motivo: string },
  ) {
    setAvancando(null);
    // Prazo só muda para quem planeja (a folha esconde o "Mudar" dos outros).
    if (planeja && v.prazo !== t.prazo) {
      acoes.salvar.mutate(
        {
          obraId: t.obra_id,
          entrada: {
            id: t.id,
            texto: t.texto,
            responsavelId: t.responsavel_id,
            responsavelNome: null,
            observacao: t.observacao,
            prazo: v.prazo,
            motivoReplanejamento: motivoReplanejamento(t, v.prazo, v.motivo),
            vinculoTipo: t.vinculo_tipo,
            vinculoId: t.vinculo_id,
          },
        },
        { onSuccess: refazerResumo },
      );
    }
    if (v.pct === 'feita') {
      concluir(t);
      return;
    }
    const comentario = v.comentario.trim() || null;
    if (v.pct !== t.avanco_pct || comentario !== t.comentario) {
      acoes.avancar.mutate({ ...alvo(t), pct: v.pct, comentario });
    }
    showToast({ message: 'Avanço salvo' });
  }

  function tocarTarefa(t: TarefaObra) {
    // A própria tarefa (ou quem não planeja): avanço. Quem planeja, a tarefa de outro: edição.
    if (planeja && t.responsavel_id !== pessoa.id) setEditando(t);
    else if (t.status === 'aberta') setAvancando(t);
    else if (planeja) setEditando(t);
  }

  function card(a: AcaoObraGeral) {
    const obra = soUma ? null : (nomeObra.get(a.obraId) ?? null);
    const quemCuida = a.responsavelNome ?? 'Sem responsável';
    if (a.origem === 'pendencia') {
      return (
        <CardAcao
          key={`pendencia:${a.id}`}
          acao={a}
          hoje={hoje}
          obra={obra}
          cardInteiro
          esquerda={<MarcadorAcao feita={!a.aberta} />}
          rotulo={`${a.texto}: abrir no Check list`}
          onToque={() => onAbrirPendencia(a.obraId, a.id, filtroAtivo)}
        />
      );
    }
    if (a.origem === 'atividade' || a.origem === 'providencia') {
      const atividadeId = a.atividadeId ?? a.id;
      const meta =
        a.origem === 'providencia'
          ? [obra, quemCuida, a.providencia.atividadeNome]
          : [obra, quemCuida];
      return (
        <CardAcao
          key={`${a.origem}:${a.id}`}
          acao={a}
          hoje={hoje}
          obra={null}
          cardInteiro
          meta={meta.filter(Boolean).join(' · ')}
          esquerda={<MarcadorAcao feita={!a.aberta} />}
          rotulo={`${a.texto}: abrir a atividade`}
          onToque={() => onAbrirAtividade(a.obraId, atividadeId, filtroAtivo)}
        />
      );
    }
    const t = a.tarefa;
    const feita = !a.aberta;
    const edita = planeja && (feita || t.responsavel_id !== pessoa.id);
    return (
      <CardAcao
        key={`tarefa:${a.id}`}
        acao={a}
        hoje={hoje}
        obra={obra}
        rotulo={edita ? `${a.texto}: editar tarefa` : feita ? a.texto : `${a.texto}: dar avanço`}
        onToque={() => tocarTarefa(t)}
        esquerda={
          feita ? (
            <button
              type="button"
              className={tarefas.checkFeito}
              aria-label="Reabrir tarefa"
              title="Reabrir tarefa"
              onClick={() => reabrir(t)}
            >
              <Icon name="checkGrosso" size={20} strokeWidth={2.6} />
            </button>
          ) : (
            <button
              type="button"
              className={tarefas.check}
              aria-label="Concluir tarefa"
              onClick={() => concluir(t)}
            >
              <Icon name="checkGrosso" size={20} strokeWidth={2.4} />
            </button>
          )
        }
        direita={
          feita ? (
            <button type="button" className={tarefas.reabrir} onClick={() => reabrir(t)}>
              Reabrir
            </button>
          ) : null
        }
      />
    );
  }

  return (
    <div className={tarefas.screen}>
      <header className={tarefas.cabecalho}>
        <div className={tarefas.topo}>
          <button type="button" className={tarefas.voltar} aria-label="Voltar" onClick={onVoltar}>
            <Icon name="chevronLeft" size={22} />
          </button>
          <div className={tarefas.topoTexto}>
            <h1 className={tarefas.titulo}>Ações da equipe</h1>
            {soUma && obras[0] ? <div className={styles.sub}>{obras[0].nome}</div> : null}
          </div>
        </div>
        <div className={tarefas.chips}>
          {ordemChips.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${tarefas.chip} ${filtroAtivo === c.id ? tarefas.chipAtivo : ''}`}
              aria-pressed={filtroAtivo === c.id}
              onClick={() => setFiltro(c.id)}
            >
              {c.nome}
              {c.total ? (
                <span className={`${tarefas.chipSelo} ${c.atrasadas ? tarefas.chipAtraso : ''}`}>
                  <span className="sr-only">
                    {c.atrasadas ? `${c.atrasadas} atrasadas, total: ` : 'total: '}
                  </span>
                  {c.total}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </header>

      <div className={tarefas.resumo}>{carregando ? 'Carregando…' : resumoTexto}</div>

      <div className={tarefas.lista}>
        {secoes.map((sec) => (
          <section key={sec.estado} className={tarefas.grupo}>
            <TituloSecao secao={sec} />
            {(sec.itens as AcaoObraGeral[]).map(card)}
          </section>
        ))}
        {!carregando && filtrada.length === 0 ? (
          <div className={tarefas.vazio}>
            {filtroAtivo === 'todos'
              ? 'Nenhuma ação com prazo ainda.'
              : 'Nenhuma ação para esta pessoa.'}
          </div>
        ) : null}
      </div>

      {planeja ? (
        <TarefaSheet
          aberto={editando !== null}
          tarefa={editando}
          pessoas={pessoasDaObra}
          nomeLivre={false}
          pendente={acoes.salvar.isPending}
          onFechar={() => setEditando(null)}
          onSalvar={salvar}
          onExcluir={editando ? () => excluir(editando) : undefined}
        />
      ) : null}

      <AvancoSheet
        tarefa={avancando}
        obra={nomeObra.get(avancando?.obra_id ?? '') ?? ''}
        hoje={hoje}
        mudaPrazo={planeja}
        aviso="Quem coordena a obra vê o avanço e o comentário nas ações e na próxima reunião."
        onFechar={() => setAvancando(null)}
        onSalvar={(v) => avancando && salvarAvanco(avancando, v)}
      />
    </div>
  );
}
