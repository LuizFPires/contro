import { useMemo, useState } from 'react';
import { classificarPendencias } from '@obdc/core';
import { Card, Icon, Segmented, useToast } from '@obdc/ui';
import { usePerfil } from '../perfil/usePerfil';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import { AdiarSheet } from './AdiarSheet';
import { ApontarSheet } from './ApontarSheet';
import { Camera } from './Camera';
import { PendenciaDeck } from './PendenciaDeck';
import { VistoriaSheet } from './VistoriaSheet';
import type { ObraCompleta } from './detalhe';
import type { PendenciaObra } from './pendenciasObra';
import { useObraPendencias } from './useObraPendencias';
import styles from './PendenciasAba.module.css';

const CRIT: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

export function PendenciasAba({ obra }: { obra: ObraCompleta }) {
  const { data: pessoa } = usePerfil();
  const { showToast } = useToast();
  const campo = useObraPendencias(obra.id);
  const [aba, setAba] = useState<'fila' | 'lista'>('fila');
  const [apontar, setApontar] = useState(false);
  const [resolver, setResolver] = useState<PendenciaObra | null>(null);
  const [adiar, setAdiar] = useState<PendenciaObra | null>(null);
  const [vistoria, setVistoria] = useState<PendenciaObra | null>(null);

  const { fila, adiadas, emVistoria, concluidas } = useMemo(
    () => classificarPendencias(campo.query.data ?? [], hojeISO()),
    [campo.query.data],
  );

  const atividades = obra.atividades
    .filter((a) => !a.pai_id)
    .map((a) => ({ id: a.id, nome: a.nome }));

  function confirmarAdiar(data: string, motivo: string) {
    const p = adiar;
    if (!p) return;
    campo.adiar.mutate(
      { id: p.id, data, motivo },
      {
        onSuccess: () => {
          setAdiar(null);
          showToast({
            message: `Adiada para ${formatarDataCurta(data)}`,
            onUndo: () => campo.trazer.mutate(p.id),
          });
        },
      },
    );
  }

  return (
    <div className={styles.aba}>
      <div className={styles.topo}>
        <Segmented
          ariaLabel="Modo das pendências"
          value={aba}
          onChange={setAba}
          options={[
            { value: 'fila', label: fila.length > 0 ? `Fila (${fila.length})` : 'Fila' },
            { value: 'lista', label: 'Lista completa' },
          ]}
        />
        <button type="button" className={styles.apontar} onClick={() => setApontar(true)}>
          <Icon name="camera" size={20} />
          Apontar
        </button>
      </div>

      {aba === 'fila' ? (
        <PendenciaDeck
          pendencias={fila}
          onResolver={(p) => setResolver(p)}
          onAdiar={(p) => setAdiar(p)}
        />
      ) : (
        <ListaCompleta
          fila={fila}
          adiadas={adiadas}
          emVistoria={emVistoria}
          concluidas={concluidas}
          onResolver={setResolver}
          onVistoriar={setVistoria}
          onTrazer={(id) => campo.trazer.mutate(id)}
        />
      )}

      <ApontarSheet
        aberto={apontar}
        atividades={atividades}
        pendente={campo.apontar.isPending}
        onFechar={() => setApontar(false)}
        onApontar={(dados, file) =>
          campo.apontar.mutate({ dados, file }, { onSuccess: () => setApontar(false) })
        }
      />

      {resolver ? (
        <Camera
          titulo="Resolver — alinhe com o antes"
          ghostUrl={resolver.fotoAntesUrl}
          pendente={campo.resolver.isPending}
          onCancelar={() => setResolver(null)}
          onCapturar={(file) =>
            campo.resolver.mutate(
              { id: resolver.id, file, pessoaId: pessoa?.id ?? null },
              {
                onSuccess: () => {
                  setResolver(null);
                  showToast({ message: 'Enviada para vistoria' });
                },
              },
            )
          }
        />
      ) : null}

      <AdiarSheet
        aberto={Boolean(adiar)}
        pendente={campo.adiar.isPending}
        onFechar={() => setAdiar(null)}
        onConfirmar={confirmarAdiar}
      />

      <VistoriaSheet
        pendencia={vistoria}
        pessoaId={pessoa?.id ?? null}
        pendente={campo.vistoriar.isPending}
        onFechar={() => setVistoria(null)}
        onAprovar={() =>
          vistoria &&
          campo.vistoriar.mutate(
            { id: vistoria.id, aprovado: true },
            {
              onSuccess: () => {
                setVistoria(null);
                showToast({ message: 'Pendência fechada' });
              },
            },
          )
        }
        onReabrir={(motivo) =>
          vistoria &&
          campo.vistoriar.mutate(
            { id: vistoria.id, aprovado: false, motivo },
            { onSuccess: () => setVistoria(null) },
          )
        }
      />
    </div>
  );
}

function ListaCompleta({
  fila,
  adiadas,
  emVistoria,
  concluidas,
  onResolver,
  onVistoriar,
  onTrazer,
}: {
  fila: PendenciaObra[];
  adiadas: PendenciaObra[];
  emVistoria: PendenciaObra[];
  concluidas: PendenciaObra[];
  onResolver: (p: PendenciaObra) => void;
  onVistoriar: (p: PendenciaObra) => void;
  onTrazer: (id: string) => void;
}) {
  return (
    <div className={styles.listas}>
      <Grupo titulo={`Na fila (${fila.length})`}>
        {fila.map((p) => (
          <Linha key={p.id} p={p} acao="Resolver agora" onAcao={() => onResolver(p)} />
        ))}
      </Grupo>
      <Grupo titulo={`Adiadas (${adiadas.length})`}>
        {adiadas.map((p) => (
          <Linha
            key={p.id}
            p={p}
            sub={`volta ${p.adiada_ate ? formatarDataCurta(p.adiada_ate) : '—'}${
              p.motivo_adiamento ? ` · ${p.motivo_adiamento}` : ''
            }`}
            acao="Trazer para a fila"
            onAcao={() => onTrazer(p.id)}
          />
        ))}
      </Grupo>
      <Grupo titulo={`Em vistoria (${emVistoria.length})`}>
        {emVistoria.map((p) => (
          <Linha
            key={p.id}
            p={p}
            sub={`resolvida por ${p.resolveuNome ?? '—'}`}
            acao="Vistoriar"
            onAcao={() => onVistoriar(p)}
          />
        ))}
      </Grupo>
      <Grupo titulo={`Concluídas (${concluidas.length})`}>
        {concluidas.map((p) => (
          <Linha key={p.id} p={p} sub="fechada" />
        ))}
      </Grupo>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const vazio = !children || (Array.isArray(children) && children.length === 0);
  return (
    <Card>
      <p className={styles.grupoTitulo}>{titulo}</p>
      {vazio ? <p className={styles.vazioGrupo}>—</p> : children}
    </Card>
  );
}

function Linha({
  p,
  sub,
  acao,
  onAcao,
}: {
  p: PendenciaObra;
  sub?: string;
  acao?: string;
  onAcao?: () => void;
}) {
  return (
    <div className={styles.linha}>
      <div className={styles.info}>
        <div className={styles.desc}>
          <span className={`${styles.crit} ${styles[`crit_${p.criticidade}`]}`}>
            {CRIT[p.criticidade]}
          </span>
          {p.titulo}
        </div>
        <div className={styles.meta}>
          {p.local ? `${p.local}` : ''}
          {sub ? `${p.local ? ' · ' : ''}${sub}` : ''}
        </div>
      </div>
      {acao && onAcao ? (
        <button type="button" className={styles.acaoBtn} onClick={onAcao}>
          {acao}
        </button>
      ) : null}
    </div>
  );
}
