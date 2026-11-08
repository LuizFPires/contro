import { useMemo, useState } from 'react';
import {
  compararRevisoes,
  evolucaoNota,
  formatarEvolucao,
  faltamParaFechar,
  formatarNota,
  notaAoResolver,
  notaAvaliacao,
  pctOficial,
  previaNovaRevisao,
  podeEditarModelos,
  resumoSecoes,
  situacaoItem,
  tirandoPonto,
} from '@contro/core';
import { BottomSheet, Button, Icon, Input, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from '../obras/api';
import { usePerfil } from '../perfil/usePerfil';
import { ItemLinha } from './ItemLinha';
import { ListaItensSheet } from './ListaItensSheet';
import { useAvaliacao, type RevisaoTela } from './useAvaliacao';
import styles from './Avaliacao.module.css';

type Tela =
  | { nome: 'auto' }
  | { nome: 'historico' }
  | { nome: 'partida' }
  | { nome: 'ambiente'; secao: number }
  | { nome: 'comparacao'; revisaoId: string };

const ROT_CRIT: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
/** Pré-avaliação de entrega: prova interna antes da avaliação da Contorno. */
export function AvaliacaoAba({
  obraId,
  onVerPendencia,
}: {
  obraId: string;
  onVerPendencia: (id: string) => void;
}) {
  const aval = useAvaliacao(obraId);
  const { showToast } = useToast();
  const { data: perfil } = usePerfil();
  const [tela, setTela] = useState<Tela>({ nome: 'auto' });
  const [visao, setVisao] = useState<'ambientes' | 'perdas'>('ambientes');
  const [listaAberta, setListaAberta] = useState(false);
  const [lancarAberto, setLancarAberto] = useState(false);

  const aberta = aval.revisoes.find((r) => r.aberta) ?? null;
  const ultimaFechada = aval.revisoes.find((r) => !r.aberta) ?? null;

  if (aval.semConexao) {
    return <p className={styles.vazio}>A avaliação precisa de conexão para abrir.</p>;
  }
  if (aval.carregando) return <p className={styles.vazio}>Carregando a avaliação…</p>;
  if (aval.erro) return <p className={styles.vazio}>Não foi possível carregar a avaliação.</p>;

  const erroToast = () => showToast({ message: 'Não foi possível concluir. Verifique a conexão.' });
  const comecar = (refazer: boolean) =>
    aval.abrir.mutate(refazer, {
      onSuccess: () => {
        setVisao('ambientes');
        setTela({ nome: 'auto' });
      },
      onError: erroToast,
    });

  const fechar = (r: RevisaoTela) =>
    aval.fechar.mutate(r.id, {
      onSuccess: () => {
        setTela({ nome: 'comparacao', revisaoId: r.id });
        showToast({
          message: `Revisão ${r.numero} fechada`,
          onUndo: () =>
            aval.reabrir.mutate(r.id, {
              onSuccess: () => setTela({ nome: 'auto' }),
              onError: erroToast,
            }),
        });
      },
      onError: erroToast,
    });

  const extras = (
    <>
      {listaAberta ? <ListaItensSheet onFechar={() => setListaAberta(false)} /> : null}
      {lancarAberto ? (
        <LancarSheet
          totalSugerido={ultimaFechada ? notaAvaliacao(ultimaFechada.itens).total : 1030}
          enviando={aval.lancar.isPending}
          onFechar={() => setLancarAberto(false)}
          onLancar={(v) =>
            aval.lancar.mutate(v, {
              onSuccess: () => setLancarAberto(false),
              onError: erroToast,
            })
          }
        />
      ) : null}
    </>
  );

  if (tela.nome === 'comparacao') {
    const atual = aval.revisoes.find((r) => r.id === tela.revisaoId);
    if (atual) {
      const anterior = aval.revisoes.find((r) => r.numero === atual.numero - 1) ?? null;
      return (
        <Comparacao
          atual={atual}
          anterior={anterior}
          onConcluir={() => setTela({ nome: 'historico' })}
        />
      );
    }
  }

  if (tela.nome === 'partida' && ultimaFechada) {
    const previa = previaNovaRevisao(ultimaFechada.itensAgora);
    const num = ultimaFechada.numero + 1;
    const linhas: [number, string, string][] = [
      [previa.aReconfirmar, 'A reconfirmar', `Resolvidos desde a revisão ${ultimaFechada.numero}`],
      [previa.pendentes, 'Ainda pendentes', 'Seguem tirando ponto até a foto do depois'],
      [previa.mantidos, 'Mantidos como Conforme', 'Dá para mudar qualquer um se piorar'],
    ];
    return (
      <div className={styles.tela}>
        <button
          type="button"
          className={styles.voltar}
          onClick={() => setTela({ nome: 'historico' })}
        >
          <Icon name="chevronLeft" size={18} />
          Revisões
        </button>
        <h2 className={styles.titulo}>Começar a revisão {num}</h2>
        <p className={styles.dica}>
          A revisão {ultimaFechada.numero} fica guardada como estava. A nova parte dela.
        </p>
        <div className={styles.cartao}>
          {linhas.map(([n, t, d]) => (
            <div key={t} className={styles.previa}>
              <b>{n}</b>
              <span>
                <strong>{t}</strong>
                {d}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={styles.primario}
          disabled={aval.abrir.isPending}
          onClick={() => comecar(false)}
        >
          Revisar o que mudou
        </button>
        <button
          type="button"
          className={styles.terciarioLargo}
          disabled={aval.abrir.isPending}
          onClick={() => comecar(true)}
        >
          Refazer os {ultimaFechada.itens.length} itens
        </button>
      </div>
    );
  }

  if (tela.nome === 'ambiente' && aberta) {
    const secao = resumoSecoes(aberta.itens).find((s) => s.ordem === tela.secao);
    if (secao) {
      return (
        <div className={styles.tela}>
          <button type="button" className={styles.voltar} onClick={() => setTela({ nome: 'auto' })}>
            <Icon name="chevronLeft" size={18} />
            Ambientes
          </button>
          <div className={styles.topoAmbiente}>
            <div>
              <h2 className={styles.titulo}>
                {secao.ordem} · {secao.nome}
              </h2>
              <p className={styles.dica}>{secao.status}</p>
            </div>
            <div className={styles.notaPequena}>
              <b>{formatarNota(notaAvaliacao(aberta.itens).pct)}</b>
              <span>nota geral</span>
            </div>
          </div>
          {secao.itens.map((it) => (
            <ItemLinha key={it.id} item={it} aval={aval} />
          ))}
        </div>
      );
    }
  }

  if (aberta && tela.nome !== 'historico') {
    const nota = notaAvaliacao(aberta.itens);
    const secoes = resumoSecoes(aberta.itens);
    const perdas = tirandoPonto(aberta.itens, (i) => i.criticidade);
    const reconfirmar = aberta.itens.filter((i) => situacaoItem(i) === 'a_reconfirmar');
    const faltam = faltamParaFechar(aberta.itens);
    return (
      <div className={styles.tela}>
        <div className={styles.heroi}>
          <div className={styles.heroiTopo}>
            <span>Revisão {aberta.numero} · em andamento</span>
            <button
              type="button"
              className={styles.heroiBotao}
              onClick={() => setTela({ nome: 'historico' })}
            >
              <Icon name="relogio" size={16} />
              Revisões
            </button>
          </div>
          <div className={styles.heroiNota}>
            <b>{formatarNota(nota.pct)}</b>
            <span>
              {nota.respondidos} de {nota.quantidade} itens
            </span>
          </div>
        </div>

        <div className={styles.segmentos} role="group" aria-label="Visão">
          <button
            type="button"
            aria-pressed={visao === 'ambientes'}
            className={`${styles.segmento} ${visao === 'ambientes' ? styles.segmentoOn : ''}`}
            onClick={() => setVisao('ambientes')}
          >
            Ambientes
          </button>
          <button
            type="button"
            aria-pressed={visao === 'perdas'}
            className={`${styles.segmento} ${visao === 'perdas' ? styles.segmentoOn : ''}`}
            onClick={() => setVisao('perdas')}
          >
            Tirando ponto ({perdas.length})
          </button>
        </div>

        {visao === 'ambientes' ? (
          <>
            {reconfirmar.length ? (
              <>
                <h3 className={styles.subtitulo}>A reconfirmar ({reconfirmar.length})</h3>
                {reconfirmar.map((it) => (
                  <ItemLinha key={it.id} item={it} aval={aval} />
                ))}
                <h3 className={styles.subtitulo}>Ambientes</h3>
              </>
            ) : null}
            {secoes.map((s) => {
              const graus = Math.round((s.respondidos / s.itens.length) * 360);
              return (
                <button
                  key={s.ordem}
                  type="button"
                  className={styles.ambiente}
                  onClick={() => setTela({ nome: 'ambiente', secao: s.ordem })}
                >
                  <span
                    className={styles.anel}
                    aria-hidden="true"
                    style={{
                      background: `conic-gradient(#54B4B0 ${graus}deg, rgb(24 24 24 / 12%) 0)`,
                    }}
                  >
                    <span>{s.ordem}</span>
                  </span>
                  <span className={styles.ambienteTexto}>
                    <b>{s.nome}</b>
                    <span>{s.status}</span>
                  </span>
                  <b className={styles.ambientePct}>{s.pct === null ? '—' : formatarNota(s.pct)}</b>
                  <Icon name="chevronRight" size={18} />
                </button>
              );
            })}
          </>
        ) : (
          <>
            {perdas.length === 0 ? (
              <p className={styles.vazio}>Nada tirando ponto até aqui.</p>
            ) : null}
            {perdas.map((p) => (
              <div key={p.id} className={styles.cartao}>
                <div className={styles.perdaTopo}>
                  <div className={styles.itemTexto}>
                    <b>{p.nome}</b>
                    <span>
                      {p.secao}
                      {p.codigo ? ` · item ${p.codigo}` : ''}
                    </span>
                  </div>
                </div>
                <div className={styles.perdaStatus}>
                  <Icon name="pendencias" size={16} />
                  Pendente no Check list · {ROT_CRIT[p.criticidade ?? 'media']}
                </div>
                <div className={styles.perdaRodape}>
                  <span>Resolver sobe para {formatarNota(notaAoResolver(nota, p.pontos))}</span>
                  <button
                    type="button"
                    className={styles.terciario}
                    onClick={() => p.pendenciaId && onVerPendencia(p.pendenciaId)}
                  >
                    Ver pendência
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        <button
          type="button"
          className={styles.primario}
          disabled={faltam > 0 || aval.fechar.isPending}
          onClick={() => fechar(aberta)}
        >
          {faltam > 0
            ? `Faltam ${plural(faltam, 'item', 'itens')} para fechar`
            : `Fechar a revisão ${aberta.numero}`}
        </button>
        {extras}
      </div>
    );
  }

  // Histórico, ou a tela inicial de quem ainda não avaliou.
  if (aval.revisoes.length === 0) {
    return (
      <div className={styles.tela}>
        <div className={styles.cartaoVazio}>
          <h2 className={styles.titulo}>Pré-avaliação da entrega</h2>
          <p className={styles.dica}>
            Passe ponto a ponto pelos itens que a Contorno vai avaliar e veja a nota antes da
            entrega.
          </p>
          <button
            type="button"
            className={styles.primario}
            disabled={aval.abrir.isPending}
            onClick={() => comecar(false)}
          >
            Começar a 1ª revisão
          </button>
        </div>
        {perfil && podeEditarModelos(perfil.perfil) ? (
          <button
            type="button"
            className={styles.terciarioLargo}
            onClick={() => setListaAberta(true)}
          >
            Itens da avaliação
          </button>
        ) : null}
        {extras}
      </div>
    );
  }

  return (
    <Historico
      revisoes={aval.revisoes}
      oficial={aval.oficial}
      podeEditar={Boolean(perfil && podeEditarModelos(perfil.perfil))}
      onAbrirLista={() => setListaAberta(true)}
      onLancar={() => setLancarAberto(true)}
      onContinuar={aberta ? () => setTela({ nome: 'auto' }) : undefined}
      onNova={aberta ? undefined : () => setTela({ nome: 'partida' })}
      onComparar={(id) => setTela({ nome: 'comparacao', revisaoId: id })}
      extras={extras}
    />
  );
}

function Historico({
  revisoes,
  oficial,
  podeEditar,
  onAbrirLista,
  onLancar,
  onContinuar,
  onNova,
  onComparar,
  extras,
}: {
  revisoes: RevisaoTela[];
  oficial: { data: string; pontos: number; total: number } | null;
  podeEditar: boolean;
  onAbrirLista: () => void;
  onLancar: () => void;
  onContinuar?: () => void;
  onNova?: () => void;
  onComparar: (id: string) => void;
  extras: React.ReactNode;
}) {
  const fechadas = useMemo(() => revisoes.filter((r) => !r.aberta), [revisoes]);
  const ultima = fechadas[0];
  const primeira = fechadas[fechadas.length - 1];
  const notaUltima = ultima ? notaAvaliacao(ultima.itens) : null;
  const ganho =
    ultima && primeira && ultima !== primeira ? evolucaoNota(primeira.itens, ultima.itens) : null;

  return (
    <div className={styles.tela}>
      {ultima && notaUltima ? (
        <div className={styles.heroi}>
          <div className={styles.heroiTopo}>
            <span>Última nota · Revisão {ultima.numero}</span>
          </div>
          <div className={styles.heroiNota}>
            <b>{formatarNota(notaUltima.pct)}</b>
            {ganho !== null ? (
              <span>
                {formatarEvolucao(ganho)}
                <br />
                desde a 1ª revisão
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <h3 className={styles.subtitulo}>Revisões</h3>
      {revisoes.map((r) => {
        const n = notaAvaliacao(r.itens);
        const anterior = revisoes.find((x) => x.numero === r.numero - 1);
        const c = anterior ? compararRevisoes(anterior.itens, r.itens) : null;
        const resumo = r.aberta
          ? `Em andamento · ${n.respondidos} de ${n.quantidade} itens`
          : c
            ? `${plural(c.melhorou.length, 'resolvido', 'resolvidos')} · ${c.piorou.length} ${c.piorou.length === 1 ? 'piorou' : 'pioraram'} · ${plural(n.naoConformes, 'não conforme', 'não conformes')}`
            : `Primeira passada · ${plural(n.naoConformes, 'não conforme', 'não conformes')}`;
        const conteudo = (
          <>
            <span className={styles.revisaoTopo}>
              <span>
                <b>Revisão {r.numero}</b> · {formatarDataCurta(r.data)}
              </span>
              <b>{formatarNota(n.pct)}</b>
            </span>
            <span className={styles.barra} aria-hidden="true">
              <span style={{ width: `${n.pct}%` }} />
            </span>
            <span className={styles.revisaoResumo}>{resumo}</span>
            {r.quem ? <b className={styles.revisaoQuem}>Por {r.quem}</b> : null}
          </>
        );
        return r.aberta ? (
          <div key={r.id} className={styles.revisao}>
            {conteudo}
          </div>
        ) : (
          <button
            key={r.id}
            type="button"
            className={styles.revisao}
            onClick={() => onComparar(r.id)}
          >
            {conteudo}
          </button>
        );
      })}

      <div className={styles.oficial}>
        <h3 className={styles.subtitulo}>Avaliação oficial da Contorno</h3>
        {oficial ? (
          <p className={styles.dica}>
            Contorno: <b>{formatarNota(pctOficial(oficial.pontos, oficial.total))}</b> em{' '}
            {formatarDataCurta(oficial.data)}
            {notaUltima ? (
              <>
                <br />
                Nossa última projeção: <b>{formatarNota(notaUltima.pct)}</b>
              </>
            ) : null}
          </p>
        ) : (
          <p className={styles.dica}>
            Quando vier o PDF, lance a nota para comparar com a nossa projeção.
          </p>
        )}
        <button type="button" className={styles.terciarioLargo} onClick={onLancar}>
          {oficial ? 'Lançar nova nota' : 'Lançar nota da Contorno'}
        </button>
      </div>

      {podeEditar ? (
        <button type="button" className={styles.terciarioLargo} onClick={onAbrirLista}>
          Itens da avaliação
        </button>
      ) : null}
      {onContinuar ? (
        <button type="button" className={styles.primario} onClick={onContinuar}>
          Continuar a revisão
        </button>
      ) : null}
      {onNova ? (
        <button type="button" className={styles.primario} onClick={onNova}>
          Nova revisão
        </button>
      ) : null}
      {extras}
    </div>
  );
}

function Comparacao({
  atual,
  anterior,
  onConcluir,
}: {
  atual: RevisaoTela;
  anterior: RevisaoTela | null;
  onConcluir: () => void;
}) {
  const nota = notaAvaliacao(atual.itens);
  const c = anterior ? compararRevisoes(anterior.itens, atual.itens) : null;
  const grupos = c
    ? [
        { titulo: 'Melhorou', itens: c.melhorou },
        { titulo: 'Piorou', itens: c.piorou },
        { titulo: 'Continua pendente', itens: c.continua },
      ]
    : [
        {
          titulo: 'Tirando ponto',
          itens: atual.itens.filter((i) => situacaoItem(i) === 'nao_conforme'),
        },
      ];
  return (
    <div className={styles.tela}>
      <div className={styles.heroi}>
        <div className={styles.heroiTopo}>
          <span>
            {anterior ? `Revisão ${anterior.numero} → ` : ''}Revisão {atual.numero}
          </span>
        </div>
        <div className={styles.heroiNota}>
          <b>{formatarNota(nota.pct)}</b>
          {anterior && c ? (
            <span>
              antes {formatarNota(notaAvaliacao(anterior.itens).pct)}
              <br />
              {formatarEvolucao(evolucaoNota(anterior.itens, atual.itens))}
            </span>
          ) : null}
        </div>
        {atual.quem ? <div className={styles.heroiQuem}>Por {atual.quem}</div> : null}
      </div>
      {grupos.map((g) => (
        <div key={g.titulo} className={styles.cartao}>
          <h3 className={styles.subtitulo}>
            {g.titulo} ({g.itens.length})
          </h3>
          {g.itens.map((i) => (
            <p key={i.id} className={styles.linhaGrupo}>
              {i.nome} · {i.secao}
            </p>
          ))}
        </div>
      ))}
      <button type="button" className={styles.primario} onClick={onConcluir}>
        Ver todas as revisões
      </button>
    </div>
  );
}

function LancarSheet({
  totalSugerido,
  enviando,
  onFechar,
  onLancar,
}: {
  totalSugerido: number;
  enviando: boolean;
  onFechar: () => void;
  onLancar: (v: { data: string; pontos: number; total: number }) => void;
}) {
  const [data, setData] = useState(hojeISO());
  const [pontos, setPontos] = useState('');
  const [total, setTotal] = useState(String(totalSugerido));
  const p = Number(pontos);
  const t = Number(total);
  const valido =
    pontos !== '' && Number.isInteger(p) && Number.isInteger(t) && p >= 0 && t > 0 && p <= t;
  return (
    <BottomSheet open title="Nota da Contorno" onClose={onFechar}>
      <div className={styles.formSheet}>
        <Input
          label="Data da avaliação"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
        <Input
          label="Pontos obtidos"
          inputMode="numeric"
          value={pontos}
          onChange={(e) => setPontos(e.target.value.replace(/\D/g, ''))}
        />
        <Input
          label="Total de pontos"
          inputMode="numeric"
          value={total}
          onChange={(e) => setTotal(e.target.value.replace(/\D/g, ''))}
        />
        <Button
          full
          disabled={!valido || !data || enviando}
          onClick={() => onLancar({ data, pontos: p, total: t })}
        >
          Salvar
        </Button>
      </div>
    </BottomSheet>
  );
}
