import { useMemo, useState } from 'react';
import { ritmoTexto } from '@obdc/core';
import { Icon, useToast } from '@obdc/ui';
import { usePerfil } from '../perfil/usePerfil';
import { usePessoas } from '../perfil/usePessoas';
import { formatarDataCompleta, formatarDataCurta } from '../../lib/datas';
import { AtaView } from './AtaView';
import { NovaAcaoSheet } from './NovaAcaoSheet';
import { useReuniao } from './useReuniao';
import type { ReuniaoObraDados } from './reuniaoApi';
import styles from './ReuniaoScreen.module.css';

/** Segunda-feira da semana corrente (ISO). */
function segundaISO(): string {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function ReuniaoScreen({ onVoltar }: { onVoltar: () => void }) {
  const data = useMemo(segundaISO, []);
  const { data: pessoa } = usePerfil();
  const { data: pessoas = [] } = usePessoas();
  const { showToast } = useToast();
  const { query, observacao, fechar, criarAcao } = useReuniao(data);
  const [ataAberta, setAtaAberta] = useState(false);
  const [acaoObra, setAcaoObra] = useState<ReuniaoObraDados | null>(null);

  const reuniao = query.data;
  const obras = useMemo(() => reuniao?.obras ?? [], [reuniao]);
  const fechada = reuniao?.status === 'fechada';
  const ehGestor = pessoa?.perfil === 'gestor';

  const kpis = useMemo(() => {
    let aProvidenciar = 0;
    let atrasadas = 0;
    for (const o of obras) {
      aProvidenciar += o.providenciar.length;
      atrasadas += o.providenciasAtrasadas.length;
    }
    return { obras: obras.length, aProvidenciar, atrasadas };
  }, [obras]);

  function concluirReuniao() {
    if (!reuniao) return;
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
      <div className={styles.topo}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronRight" size={24} />
        </button>
        <div>
          <h1 className={styles.titulo}>Reunião da semana</h1>
          <p className={styles.sub}>{formatarDataCompleta(data)} · 16h</p>
        </div>
      </div>

      {query.isLoading ? (
        <p className={styles.vazio}>Montando a pauta…</p>
      ) : (
        <>
          <div className={styles.kpis}>
            <Kpi n={kpis.obras} rotulo="obras" />
            <Kpi n={kpis.aProvidenciar} rotulo="a providenciar" />
            <Kpi n={kpis.atrasadas} rotulo="atrasadas" atraso />
          </div>

          {obras.map((o) => (
            <ObraCard
              key={o.obraId}
              o={o}
              fechada={fechada}
              onNovaAcao={() => setAcaoObra(o)}
              onObservacao={(texto) =>
                reuniao && observacao.mutate({ reuniaoId: reuniao.id, obraId: o.obraId, texto })
              }
            />
          ))}

          {fechada ? (
            <button type="button" className={styles.ata} onClick={() => setAtaAberta(true)}>
              Ver ata
            </button>
          ) : ehGestor ? (
            <button
              type="button"
              className={styles.fechar}
              disabled={fechar.isPending}
              onClick={concluirReuniao}
            >
              {fechar.isPending ? 'Fechando…' : 'Fechar reunião e gerar ata'}
            </button>
          ) : (
            <p className={styles.vazio}>Só o gestor fecha a reunião.</p>
          )}
        </>
      )}

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
                showToast({ message: 'Registrado na reunião' });
              },
              onError: () => showToast({ message: 'Não foi possível registrar' }),
            },
          );
        }}
      />
    </div>
  );
}

function Kpi({ n, rotulo, atraso }: { n: number; rotulo: string; atraso?: boolean }) {
  return (
    <div className={styles.kpi}>
      <span className={`${styles.kpiN} ${atraso && n > 0 ? styles.kpiAtraso : ''}`}>{n}</span>
      <span className={styles.kpiR}>{rotulo}</span>
    </div>
  );
}

const TIPO: Record<string, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};

function ObraCard({
  o,
  fechada,
  onObservacao,
  onNovaAcao,
}: {
  o: ReuniaoObraDados;
  fechada: boolean;
  onObservacao: (texto: string) => void;
  onNovaAcao: () => void;
}) {
  const ritmo = ritmoTexto(o.ritmoDias, true);
  return (
    <div className={styles.card}>
      <div className={styles.faixa}>{o.nome}</div>
      <div className={styles.corpo}>
        <p className={styles.ind}>
          {Math.round(o.pct * 100)}% ·{' '}
          <span className={ritmo.atrasada ? styles.atraso : ''}>{ritmo.texto}</span> · entrega{' '}
          {formatarDataCurta(o.entrega)}
        </p>

        {o.atividadesAtrasadas.length > 0 ? (
          <Secao titulo={`Atrasos (${o.atividadesAtrasadas.length})`} atraso>
            {o.atividadesAtrasadas.map((a, i) => (
              <Linha key={i} texto={a.nome} meta={`era ${formatarDataCurta(a.data)}`} atraso />
            ))}
          </Secao>
        ) : null}

        {o.passadaConcluir.length + o.passadaComecar.length > 0 ? (
          <Secao titulo="Semana passada">
            {o.passadaConcluir.map((p, i) => (
              <Linha
                key={`c${i}`}
                texto={p.nome}
                meta={p.ok ? 'concluída' : `não · ${p.motivo ?? '—'}`}
                atraso={!p.ok}
              />
            ))}
            {o.passadaComecar.map((p, i) => (
              <Linha
                key={`b${i}`}
                texto={p.nome}
                meta={p.ok ? 'começou' : `não · ${p.motivo ?? '—'}`}
                atraso={!p.ok}
              />
            ))}
          </Secao>
        ) : null}

        <Secao titulo="Esta semana">
          {o.concluir.map((a, i) => (
            <Linha
              key={`cc${i}`}
              texto={a.nome}
              meta={`concluir até ${formatarDataCurta(a.data)}`}
            />
          ))}
          {o.comecar.map((a, i) => (
            <Linha key={`bb${i}`} texto={a.nome} meta={`começar ${formatarDataCurta(a.data)}`} />
          ))}
          {o.providenciar.map((p, i) => (
            <Linha
              key={`pp${i}`}
              texto={`${TIPO[p.tipo]}: ${p.descricao}`}
              meta={p.naObraEm ? `na obra ${formatarDataCurta(p.naObraEm)}` : 'providenciar'}
            />
          ))}
          {o.concluir.length + o.comecar.length + o.providenciar.length === 0 ? (
            <p className={styles.nada}>Nada previsto.</p>
          ) : null}
        </Secao>

        <p className={styles.rotulo}>Observações</p>
        <textarea
          className={styles.obs}
          defaultValue={o.observacoes}
          disabled={fechada}
          placeholder="O que ficou combinado…"
          onBlur={(e) => {
            if (e.target.value !== o.observacoes) onObservacao(e.target.value);
          }}
        />

        {!fechada ? (
          <button type="button" className={styles.novaAcao} onClick={onNovaAcao}>
            <Icon name="plus" size={16} />
            Providência / tarefa
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Secao({
  titulo,
  atraso,
  children,
}: {
  titulo: string;
  atraso?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.secao}>
      <p className={`${styles.secaoTitulo} ${atraso ? styles.atraso : ''}`}>{titulo}</p>
      {children}
    </div>
  );
}

function Linha({ texto, meta, atraso }: { texto: string; meta: string; atraso?: boolean }) {
  return (
    <div className={styles.linha}>
      <span className={styles.linhaTexto}>{texto}</span>
      <span className={`${styles.linhaMeta} ${atraso ? styles.atraso : ''}`}>{meta}</span>
    </div>
  );
}
