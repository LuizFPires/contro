import { useMemo, useState } from 'react';
import { classificarAcoes, seloChipResponsavel, textoResumoSecoes } from '@contro/core';
import { Icon } from '@contro/ui';
import { acoesVisiveis, secoesAcoes, type AcaoObra } from '../obras/acoesObra';
import { hojeISO } from '../obras/api';
import { CardAcao, MarcadorAcao, TituloSecao } from '../obras/CardAcao';
import type { PessoaAtual } from '../perfil/usePerfil';
import { useResumoObrasGerais } from './useResumoObrasGerais';
import tarefas from '../obras/TarefasScreen.module.css';
import styles from './AcoesObraGeral.module.css';

const SEM = 'sem';

const chaveResp = (a: AcaoObra) =>
  a.responsavelId ?? (a.responsavelNome ? `nome:${a.responsavelNome}` : SEM);

/**
 * Ações da equipe de uma ou de todas as obras gerais (mockups C1, J2, A13): chips por
 * responsável e as seções Atrasadas, Vencem hoje, Próximos 5 dias e Concluídas. Tocar no card
 * abre a ficha da atividade; concluir acontece lá.
 */
export function AcoesObraGeral({
  obraIds,
  pessoa,
  filtroInicial,
  onVoltar,
  onAbrirAtividade,
}: {
  obraIds: string[];
  pessoa: PessoaAtual;
  /** Chip com que a tela abre (ao voltar da ficha, o que estava escolhido). */
  filtroInicial?: string;
  onVoltar: () => void;
  /** `filtro` é o chip escolhido, para a tela voltar nele. */
  onAbrirAtividade: (obraId: string, atividadeId: string, filtro: string) => void;
}) {
  const { data: resumo, isLoading } = useResumoObrasGerais();
  const hoje = hojeISO();
  const obras = useMemo(
    () => (resumo ?? []).filter((o) => obraIds.includes(o.id)),
    [resumo, obraIds],
  );
  const soUma = obraIds.length === 1;
  // Membro (em todas as obras mostradas) abre no chip dele; o resto, em "Todos".
  const membro = obras.length > 0 && obras.every((o) => o.papel === 'membro');
  const [escolhido, setFiltro] = useState<string | null>(filtroInicial ?? null);
  const filtro = escolhido ?? (membro ? pessoa.id : 'todos');

  const lista = useMemo<AcaoObra[]>(
    () =>
      acoesVisiveis(
        obras.flatMap((o) =>
          o.acoes.map(
            (a): AcaoObra => ({
              ...a,
              origem: 'atividade',
              atividade: {
                id: a.id,
                obraId: o.id,
                obraNome: o.nome,
                nome: a.texto,
                faseNome: '',
                prestador: null,
                prazo: a.prazo,
              },
            }),
          ),
        ),
        hoje,
      ),
    [obras, hoje],
  );
  const nomeObra = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);

  const chips = useMemo(() => {
    const m = new Map<string, { nome: string; itens: AcaoObra[] }>();
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

      <div className={tarefas.resumo}>{isLoading ? 'Carregando…' : resumoTexto}</div>

      <div className={tarefas.lista}>
        {secoes.map((sec) => (
          <section key={sec.estado} className={tarefas.grupo}>
            <TituloSecao secao={sec} />
            {sec.itens.map((a) => (
              <CardAcao
                key={a.id}
                acao={a}
                hoje={hoje}
                obra={null}
                cardInteiro
                meta={[
                  soUma ? null : nomeObra.get(a.obraId),
                  a.responsavelNome ?? 'Sem responsável',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                esquerda={<MarcadorAcao feita={!a.aberta} />}
                rotulo={`${a.texto}: abrir a atividade`}
                onToque={() => onAbrirAtividade(a.obraId, a.id, filtroAtivo)}
              />
            ))}
          </section>
        ))}
        {!isLoading && filtrada.length === 0 ? (
          <div className={tarefas.vazio}>
            {filtroAtivo === 'todos'
              ? 'Nenhuma ação com prazo ainda.'
              : 'Nenhuma ação para esta pessoa.'}
          </div>
        ) : null}
      </div>
    </div>
  );
}
