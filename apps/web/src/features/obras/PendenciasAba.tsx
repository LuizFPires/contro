import { useMemo, useState } from 'react';
import { classificarPendencias, pendenteHa, podeVistoriar } from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { usePerfil } from '../perfil/usePerfil';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import { AdiarSheet } from './AdiarSheet';
import { ApontarSheet, EditarPendenciaSheet } from './ApontarSheet';
import { Camera } from './Camera';
import { ChecklistInfo } from './ChecklistInfo';
import { PendenciaDeck } from './PendenciaDeck';
import type { ObraCompleta } from './detalhe';
import type { PendenciaObra } from './pendenciasObra';
import type { NovaPendencia } from './campo';
import { useObraPendencias } from './useObraPendencias';
import styles from './PendenciasAba.module.css';

const CRIT: Record<string, string> = { alta: 'alta', media: 'média', baixa: 'baixa' };

type Modo = 'fila' | 'lista' | 'vistoria';

/** Pendências da obra (protótipo · PENDÊNCIAS e VISTORIA). */
export function PendenciasAba({ obra }: { obra: ObraCompleta }) {
  const { data: pessoa } = usePerfil();
  const { showToast } = useToast();
  const campo = useObraPendencias(obra.id);
  const [modo, setModo] = useState<Modo>('fila');
  const [apontar, setApontar] = useState(false);
  const [resolver, setResolver] = useState<PendenciaObra | null>(null);
  const [adiar, setAdiar] = useState<PendenciaObra | null>(null);
  const hoje = hojeISO();

  const lista = useMemo(() => campo.query.data ?? [], [campo.query.data]);
  const { fila, adiadas, emVistoria, concluidas } = useMemo(
    () => classificarPendencias(lista, hoje),
    [lista, hoje],
  );

  // Lista completa: "⋯" de um item (editar, apagar) e a edição aberta.
  const [menuPend, setMenuPend] = useState<PendenciaObra | null>(null);
  const [editando, setEditando] = useState<PendenciaObra | null>(null);
  const inicialEdicao = useMemo<NovaPendencia | null>(
    () =>
      editando
        ? {
            titulo: editando.titulo,
            local: editando.local,
            criticidade: editando.criticidade,
            atividadeId: editando.atividade_id,
          }
        : null,
    [editando],
  );

  function apagar(p: PendenciaObra) {
    // Exclusão lógica (regra 7), com Desfazer (regra 10).
    setMenuPend(null);
    campo.excluir.mutate(p.id);
    showToast({ message: `"${p.titulo}" apagada`, onUndo: () => campo.restaurar.mutate(p) });
  }

  function salvarEdicao(dados: NovaPendencia) {
    const p = editando;
    if (!p) return;
    setEditando(null);
    const nomeDe = (id: string | null) =>
      id ? (obra.atividades.find((a) => a.id === id)?.nome ?? null) : null;
    campo.editar.mutate({ id: p.id, dados, atividadeNome: nomeDe(dados.atividadeId) });
    const antes: NovaPendencia = {
      titulo: p.titulo,
      local: p.local,
      criticidade: p.criticidade,
      atividadeId: p.atividade_id,
    };
    showToast({
      message: 'Pendência salva',
      onUndo: () => campo.editar.mutate({ id: p.id, dados: antes, atividadeNome: p.atividadeNome }),
    });
  }

  function confirmarAdiar(data: string, motivo: string) {
    const p = adiar;
    if (!p) return;
    campo.adiar.mutate(
      { id: p.id, data, motivo },
      {
        onSuccess: () => {
          setAdiar(null);
          showToast({
            message: `Adiada até ${formatarDataCurta(data)}`,
            onUndo: () => campo.trazer.mutate(p.id),
          });
        },
      },
    );
  }

  function vistoriar(p: PendenciaObra, aprovado: boolean) {
    campo.vistoriar.mutate(
      { id: p.id, aprovado, motivo: aprovado ? undefined : '' },
      {
        onSuccess: () =>
          showToast({ message: aprovado ? 'Pendência fechada' : 'Pendência reaberta na fila' }),
      },
    );
  }

  const [info, setInfo] = useState(false);

  return (
    <div className={styles.aba}>
      <div className={styles.topo}>
        <div role="tablist" aria-label="Modo de visualização" className={styles.modos}>
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'fila'}
            className={`${styles.modo} ${modo === 'fila' ? styles.modoAtivo : ''}`}
            onClick={() => setModo('fila')}
          >
            Fila · {fila.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo !== 'fila'}
            className={`${styles.modo} ${modo !== 'fila' ? styles.modoAtivo : ''}`}
            onClick={() => setModo('lista')}
          >
            Lista completa · {lista.length}
          </button>
        </div>
        <button
          type="button"
          className={styles.infoBtn}
          aria-label="Como funciona o Check list"
          title="Como funciona"
          onClick={() => setInfo(true)}
        >
          <Icon name="info" size={20} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={styles.apontar}
          aria-label="Apontar nova pendência"
          title="Apontar nova pendência"
          onClick={() => setApontar(true)}
        >
          <Icon name="camera" size={20} strokeWidth={2} />
        </button>
      </div>

      {modo === 'fila' ? (
        <>
          <div className={styles.resumo}>
            <span>{fila.length} na fila</span>
            {adiadas.length ? (
              <button type="button" className={styles.chip} onClick={() => setModo('lista')}>
                {adiadas.length} {adiadas.length === 1 ? 'adiada' : 'adiadas'}
              </button>
            ) : null}
            {emVistoria.length ? (
              <button
                type="button"
                className={`${styles.chip} ${styles.chipPreto}`}
                onClick={() => setModo('vistoria')}
              >
                {emVistoria.length} em vistoria
              </button>
            ) : null}
          </div>
          <PendenciaDeck pendencias={fila} onResolver={setResolver} onAdiar={setAdiar} />
        </>
      ) : null}

      {modo === 'lista' ? (
        <div className={styles.grupos}>
          <Grupo titulo="Na fila" itens={fila}>
            {(p, i) => (
              <Linha
                key={p.id}
                p={p}
                onMais={() => setMenuPend(p)}
                sub={i === 0 ? 'Primeira da fila' : `Aberta há ${pendenteHa(p.apontada_em, hoje)}`}
                acao={
                  i > 0
                    ? { txt: 'Resolver agora', tipo: 'turquesa', fn: () => setResolver(p) }
                    : undefined
                }
              />
            )}
          </Grupo>
          <Grupo titulo="Adiadas" itens={adiadas}>
            {(p) => (
              <Linha
                key={p.id}
                p={p}
                onMais={() => setMenuPend(p)}
                apagada
                sub={`Volta ${p.adiada_ate ? formatarDataCurta(p.adiada_ate) : '—'} · ${p.motivo_adiamento || 'sem motivo'}`}
                acao={{
                  txt: 'Trazer para a fila',
                  tipo: 'branco',
                  fn: () => campo.trazer.mutate(p.id),
                }}
              />
            )}
          </Grupo>
          <Grupo titulo="Em vistoria" itens={emVistoria}>
            {(p) => (
              <Linha
                key={p.id}
                p={p}
                onMais={() => setMenuPend(p)}
                sub={`Resolvida por ${p.resolveuNome ?? '—'}`}
                acao={{ txt: 'Vistoriar', tipo: 'preto', fn: () => setModo('vistoria') }}
              />
            )}
          </Grupo>
          <Grupo titulo="Concluídas" itens={concluidas}>
            {(p) => (
              <Linha
                key={p.id}
                p={p}
                fechada
                sub="Antes e depois arquivados"
                onMais={() => setMenuPend(p)}
              />
            )}
          </Grupo>
          {lista.length === 0 ? (
            <div className={styles.vazio}>Nenhuma pendência registrada nesta obra.</div>
          ) : null}
        </div>
      ) : null}

      {modo === 'vistoria' ? (
        <div className={styles.vistoria}>
          <div className={styles.vistoriaTopo}>
            <h2 className={styles.vistoriaTitulo}>Vistoria: antes e depois</h2>
            <button type="button" className={styles.voltarFila} onClick={() => setModo('fila')}>
              Voltar à fila
            </button>
          </div>
          <div className={styles.vistoriaRegra}>
            Quem vistoria não é quem executou. Só fecha com a foto de depois aprovada.
          </div>
          {emVistoria.map((p) => {
            const pode = podeVistoriar(p, pessoa?.id ?? null);
            return (
              <div key={p.id} className={styles.vCard}>
                <div>
                  <div className={styles.vNome}>{p.titulo}</div>
                  <div className={styles.vOnde}>
                    {[p.local, p.atividadeNome ?? 'Geral'].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className={styles.vFotos}>
                  <div className={styles.vFoto}>
                    {p.fotoAntesUrl ? <img src={p.fotoAntesUrl} alt="Antes" /> : null}
                    <span className={styles.vAntes}>ANTES</span>
                  </div>
                  <div className={styles.vFoto}>
                    {p.fotoDepoisUrl ? <img src={p.fotoDepoisUrl} alt="Depois" /> : null}
                    <span className={styles.vDepois}>
                      DEPOIS
                      {p.resolvida_em ? ` · ${formatarDataCurta(p.resolvida_em.slice(0, 10))}` : ''}
                    </span>
                  </div>
                </div>
                {pode ? (
                  <div className={styles.vAcoes}>
                    <button
                      type="button"
                      className={styles.vReabrir}
                      disabled={campo.vistoriar.isPending}
                      onClick={() => vistoriar(p, false)}
                    >
                      Reabrir
                    </button>
                    <button
                      type="button"
                      className={styles.vAprovar}
                      disabled={campo.vistoriar.isPending}
                      onClick={() => vistoriar(p, true)}
                    >
                      Aprovar e fechar
                    </button>
                  </div>
                ) : (
                  <p className={styles.vBloqueio}>
                    <Icon name="alert" size={16} />
                    Quem resolveu não pode vistoriar a própria pendência.
                  </p>
                )}
              </div>
            );
          })}
          {emVistoria.length === 0 ? <div className={styles.vazio}>Nada em vistoria.</div> : null}
        </div>
      ) : null}

      <ApontarSheet
        aberto={apontar}
        obra={obra}
        pendente={campo.apontar.isPending}
        onFechar={() => setApontar(false)}
        onApontar={(dados, file) =>
          campo.apontar.mutate({ dados, file }, { onSuccess: () => setApontar(false) })
        }
      />

      {resolver ? (
        <Camera
          kicker="Foto de depois"
          titulo={resolver.titulo}
          dica="A foto do apontamento aparece por trás. Alinhe o enquadramento para o antes e depois bater."
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
        titulo={adiar?.titulo}
        pendente={campo.adiar.isPending}
        onFechar={() => setAdiar(null)}
        onConfirmar={confirmarAdiar}
      />
      <ChecklistInfo aberto={info} onFechar={() => setInfo(false)} />

      <BottomSheet open={Boolean(menuPend)} onClose={() => setMenuPend(null)}>
        {menuPend ? (
          <div className={styles.menuPend}>
            <div className={styles.menuPendTopo}>
              <div className={styles.menuPendFoto}>
                {menuPend.fotoAntesUrl ? (
                  <img src={menuPend.fotoAntesUrl} alt="Foto do antes" />
                ) : null}
              </div>
              <div className={styles.info}>
                <div className={styles.desc}>{menuPend.titulo}</div>
                <div className={styles.meta}>
                  {[menuPend.local, menuPend.atividadeNome ?? 'Geral'].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
            <button
              type="button"
              className={styles.menuPendItem}
              onClick={() => {
                setEditando(menuPend);
                setMenuPend(null);
              }}
            >
              <Icon name="editar" size={20} />
              Editar pendência
            </button>
            <button type="button" className={styles.menuPendItem} onClick={() => apagar(menuPend)}>
              <Icon name="lixeira" size={20} />
              Apagar pendência
            </button>
            <p className={styles.menuPendDica}>
              Foto errada? Apague e aponte de novo com a foto certa.
            </p>
          </div>
        ) : null}
      </BottomSheet>

      <EditarPendenciaSheet
        obra={obra}
        inicial={inicialEdicao}
        onFechar={() => setEditando(null)}
        onSalvar={salvarEdicao}
      />
    </div>
  );
}

function Grupo({
  titulo,
  itens,
  children,
}: {
  titulo: string;
  itens: PendenciaObra[];
  children: (p: PendenciaObra, i: number) => React.ReactNode;
}) {
  if (itens.length === 0) return null;
  return (
    <section className={styles.grupo}>
      <h3 className={styles.grupoTitulo}>
        {titulo} · {itens.length}
      </h3>
      {itens.map(children)}
    </section>
  );
}

function Linha({
  p,
  sub,
  apagada,
  fechada,
  acao,
  onMais,
}: {
  p: PendenciaObra;
  sub: string;
  apagada?: boolean;
  fechada?: boolean;
  acao?: { txt: string; tipo: 'turquesa' | 'branco' | 'preto'; fn: () => void };
  /** "⋯": editar ou apagar a pendência. */
  onMais?: () => void;
}) {
  return (
    <div className={styles.linha}>
      <div
        className={`${styles.miniatura} ${apagada ? styles.apagada : ''} ${fechada ? styles.fechadaFoto : ''}`}
      >
        {p.fotoAntesUrl ? <img src={p.fotoAntesUrl} alt="" /> : null}
      </div>
      <div className={styles.info}>
        <div className={`${styles.desc} ${fechada ? styles.descFechada : ''}`}>{p.titulo}</div>
        <div className={styles.meta}>
          {p.local ? `${p.local} · ` : ''}criticidade {CRIT[p.criticidade]}
        </div>
        <div className={styles.sub}>{sub}</div>
      </div>
      {acao ? (
        <button
          type="button"
          className={`${styles.acao} ${styles[`acao_${acao.tipo}`]}`}
          onClick={acao.fn}
        >
          {acao.txt}
        </button>
      ) : null}
      {onMais ? (
        <button
          type="button"
          className={styles.mais}
          aria-label={`Mais opções de "${p.titulo}"`}
          onClick={onMais}
        >
          <Icon name="more" size={22} />
        </button>
      ) : null}
    </div>
  );
}
