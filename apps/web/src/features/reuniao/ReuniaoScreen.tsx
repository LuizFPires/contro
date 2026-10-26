import { useMemo, useState } from 'react';
import { deReuniaoAnterior, origemReuniao, resumoReuniao, ritmoTexto } from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import { usePerfil } from '../perfil/usePerfil';
import { usePessoas } from '../perfil/usePessoas';
import { formatarDataCurta } from '../../lib/datas';
import { AtaView } from './AtaView';
import { NovaAcaoSheet } from './NovaAcaoSheet';
import { useReuniao } from './useReuniao';
import type { ReuniaoObraDados, TarefaAtrib } from './reuniaoApi';
import styles from './ReuniaoScreen.module.css';

/** Segunda-feira da semana corrente (ISO). */
function segundaISO(): string {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

const TIPO: Record<string, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};

/** Reunião semanal (protótipo · REUNIÃO SEMANAL): pauta por obra e ata. */
export function ReuniaoScreen({ onVoltar }: { onVoltar: () => void }) {
  const data = useMemo(segundaISO, []);
  const { data: pessoa } = usePerfil();
  const { data: pessoas = [] } = usePessoas();
  const { showToast } = useToast();
  const { query, observacao, fechar, criarAcao } = useReuniao(data);
  const [ataAberta, setAtaAberta] = useState(false);
  const [acaoObra, setAcaoObra] = useState<ReuniaoObraDados | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const reuniao = query.data;
  const obras = useMemo(() => reuniao?.obras ?? [], [reuniao]);
  const tarefas = useMemo(() => reuniao?.tarefas ?? [], [reuniao]);
  const fechada = reuniao?.status === 'fechada';
  const ehGestor = pessoa?.perfil === 'gestor';
  const origemAtual = origemReuniao(formatarDataCurta(data));

  const resumo = useMemo(
    () =>
      resumoReuniao(
        tarefas.map((t) => ({ origem: t.origem, concluida: t.concluido, atrasada: t.atrasado })),
        origemAtual,
      ),
    [tarefas, origemAtual],
  );
  // Obra aberta: a escolhida, senão a primeira (como no protótipo).
  const obraAberta = aberta ?? obras[0]?.obraId ?? null;

  function gerarAta() {
    if (!reuniao) return;
    if (fechada) {
      setAtaAberta(true);
      return;
    }
    const snapshots = obras.map((o) => ({
      obra_id: o.obraId,
      snapshot: { pct: o.pct, ritmoDias: o.ritmoDias, entrega: o.entrega },
    }));
    fechar.mutate(
      { id: reuniao.id, snapshots },
      {
        onSuccess: () => {
          setAtaAberta(true);
          showToast({ message: 'Reunião fechada · ata gerada' });
        },
        onError: () => showToast({ message: 'Não foi possível fechar a reunião' }),
      },
    );
  }

  if (ataAberta && reuniao) {
    return <AtaView reuniao={reuniao} onVoltar={() => setAtaAberta(false)} />;
  }

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.topo}>
          <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
            <Icon name="chevronLeft" size={22} />
          </button>
          <div>
            <h1 className={styles.titulo}>Reunião semanal</h1>
            <div className={styles.sub}>
              Segunda {formatarDataCurta(data).split(' ')[1]} · 16h ·{' '}
              {fechada ? 'ata gerada' : 'ata em construção'}
            </div>
          </div>
        </div>
        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <strong>{resumo.cumpridas}</strong>
            <span>providências cumpridas</span>
          </div>
          <div className={`${styles.kpi} ${resumo.atrasadas ? styles.kpiAtraso : ''}`}>
            <strong>{resumo.atrasadas}</strong>
            <span>providências atrasadas</span>
          </div>
          <div className={`${styles.kpi} ${styles.kpiNovas}`}>
            <strong>{resumo.novas}</strong>
            <span>novas nesta reunião</span>
          </div>
        </div>
      </header>

      <div className={styles.lista}>
        {query.isLoading ? (
          <p className={styles.vazio}>Montando a pauta…</p>
        ) : query.isError ? (
          <p className={styles.vazio}>Não foi possível montar a pauta. Tente de novo.</p>
        ) : obras.length === 0 ? (
          <p className={styles.vazio}>Nenhuma obra em andamento para a pauta.</p>
        ) : (
          obras.map((o) => (
            <ObraPauta
              key={o.obraId}
              o={o}
              tarefas={tarefas.filter((t) => t.obraId === o.obraId)}
              origemAtual={origemAtual}
              aberta={obraAberta === o.obraId}
              fechada={fechada}
              onToggle={() => setAberta(obraAberta === o.obraId ? '' : o.obraId)}
              onNovaAcao={() => setAcaoObra(o)}
              onObservacao={(texto) =>
                reuniao &&
                observacao.mutate(
                  { reuniaoId: reuniao.id, obraId: o.obraId, texto },
                  { onError: () => showToast({ message: 'Não foi possível salvar a observação' }) },
                )
              }
            />
          ))
        )}
      </div>

      <div className={styles.rodape}>
        {fechada || ehGestor ? (
          <button
            type="button"
            className={styles.gerar}
            disabled={!reuniao || fechar.isPending}
            onClick={gerarAta}
          >
            {fechada
              ? 'Ver ata da reunião'
              : fechar.isPending
                ? 'Gerando…'
                : 'Gerar ata da reunião'}
          </button>
        ) : (
          <p className={styles.soGestor}>O gestor gera a ata ao fim da reunião.</p>
        )}
      </div>

      <NovaAcaoSheet
        aberto={Boolean(acaoObra)}
        obra={acaoObra}
        pessoas={pessoas}
        dataFmt={formatarDataCurta(data)}
        pendente={criarAcao.isPending}
        onFechar={() => setAcaoObra(null)}
        onSalvar={(entrada) => {
          if (!acaoObra) return;
          criarAcao.mutate(
            { obraId: acaoObra.obraId, entrada },
            {
              onSuccess: () => {
                setAcaoObra(null);
                showToast({ message: 'Providência registrada na ata' });
              },
              onError: () => showToast({ message: 'Não foi possível registrar' }),
            },
          );
        }}
      />
    </div>
  );
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function ObraPauta({
  o,
  tarefas,
  origemAtual,
  aberta,
  fechada,
  onToggle,
  onObservacao,
  onNovaAcao,
}: {
  o: ReuniaoObraDados;
  tarefas: TarefaAtrib[];
  origemAtual: string;
  aberta: boolean;
  fechada: boolean;
  onToggle: () => void;
  onObservacao: (texto: string) => void;
  onNovaAcao: () => void;
}) {
  const ritmo = ritmoTexto(o.ritmoDias, true);
  const passada = [
    ...o.passadaConcluir.map((p) => ({
      ok: p.ok,
      t: `${p.ok ? 'Concluída' : 'Não concluída'}: ${p.nome}`,
      s: p.ok ? null : (p.motivo ?? null),
    })),
    ...o.passadaComecar.map((p) => ({
      ok: p.ok,
      t: `${p.ok ? 'Começou' : 'Não começou'}: ${p.nome}`,
      s: p.ok ? null : (p.motivo ?? null),
    })),
  ];
  const anteriores = tarefas.filter((t) => deReuniaoAnterior(t, origemAtual));
  const novas = tarefas.filter((t) => t.origem === origemAtual);
  const nomes = (xs: { nome: string }[]) =>
    xs.length ? xs.map((x) => x.nome).join(', ') : 'nada previsto';
  const pedir = o.providenciar.length
    ? o.providenciar.map((p) => `${TIPO[p.tipo]}: ${p.descricao}`).join(', ')
    : 'nada a fechar';

  return (
    <div className={styles.obra}>
      <button type="button" className={styles.obraBtn} aria-expanded={aberta} onClick={onToggle}>
        <span className={styles.obraTexto}>
          <span className={styles.obraNome}>{o.nome}</span>
          <span className={styles.obraInd}>
            Real {Math.round(o.pct * 100)}% · previsto sexta {Math.round(o.previstoSexta * 100)}% ·{' '}
            {o.faseAtual}
          </span>
        </span>
        <span className={ritmo.atrasada ? styles.ritmoAtraso : styles.ritmo}>{ritmo.texto}</span>
      </button>

      {aberta ? (
        <div className={styles.obraCorpo}>
          <section>
            <h3 className={styles.secao}>Semana passada · previsto x realizado</h3>
            {passada.map((x, i) => (
              <div key={i} className={styles.passada}>
                <span className={x.ok ? styles.icOk : styles.icNao}>
                  <Icon name={x.ok ? 'checkGrosso' : 'close'} size={14} strokeWidth={2.6} />
                </span>
                <div>
                  <span className={x.ok ? styles.passadaOk : styles.passadaNao}>{x.t}</span>
                  {x.s ? <div className={styles.miuda}>{x.s}</div> : null}
                </div>
              </div>
            ))}
            {passada.length === 0 ? (
              <div className={styles.miuda}>
                Nada previsto para concluir ou começar na semana passada.
              </div>
            ) : null}
          </section>

          <section>
            <h3 className={styles.secao}>Providências da reunião anterior</h3>
            {anteriores.map((t) => {
              const tag = t.concluido ? 'Feita' : t.atrasado ? 'Atrasada' : 'No prazo';
              return (
                <div key={t.id} className={styles.anterior}>
                  <div className={styles.anteriorTexto}>
                    <span
                      className={
                        t.concluido ? styles.feita : t.atrasado ? styles.txtAtraso : styles.forte
                      }
                    >
                      {t.texto}
                    </span>
                    <div className={styles.miuda}>
                      {t.pessoa} · prazo {t.prazo ? formatarDataCurta(t.prazo) : '—'}
                    </div>
                  </div>
                  <span
                    className={`${styles.tag} ${t.concluido ? styles.tagFeita : t.atrasado ? styles.tagAtraso : ''}`}
                  >
                    {tag}
                  </span>
                </div>
              );
            })}
            {anteriores.length === 0 ? (
              <div className={styles.miuda}>Nenhuma providência anterior.</div>
            ) : null}
          </section>

          <section>
            <h3 className={styles.secao}>Esta semana</h3>
            <div className={styles.semana}>
              <div>
                <b>Concluir:</b> {nomes(o.concluir)}
              </div>
              <div>
                <b>Começar:</b> {nomes(o.comecar)}
              </div>
              <div>
                <b>Contratar/comprar:</b> {pedir}
              </div>
            </div>
          </section>

          <section className={styles.obsBloco}>
            <label htmlFor={`obs-${o.obraId}`} className={styles.secao}>
              Avanços e observações da reunião
            </label>
            <textarea
              id={`obs-${o.obraId}`}
              className={styles.obs}
              rows={3}
              defaultValue={o.observacoes}
              disabled={fechada}
              placeholder="Ex.: forro avançou 60%; azulejista mobilizado na quinta"
              onBlur={(e) => {
                if (e.target.value !== o.observacoes) onObservacao(e.target.value);
              }}
            />
          </section>

          <section>
            <h3 className={styles.secao}>Novas providências</h3>
            {novas.map((t) => (
              <div key={t.id} className={styles.nova}>
                <span className={styles.avatar} aria-hidden="true">
                  {iniciais(t.pessoa)}
                </span>
                <div>
                  <b>{t.texto}</b>
                  <div className={styles.miuda}>
                    {t.pessoa} · até {t.prazo ? formatarDataCurta(t.prazo) : '—'}
                  </div>
                </div>
              </div>
            ))}
            {!fechada ? (
              <button type="button" className={styles.addProv} onClick={onNovaAcao}>
                + Providência com responsável e prazo
              </button>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
