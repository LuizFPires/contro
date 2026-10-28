import { useMemo, useState } from 'react';
import { classificarPendencias, pendenteHa, pendentesPorCriticidade } from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { usePerfil } from '../perfil/usePerfil';
import { formatarDataCurta } from '../../lib/datas';
import { useLembrado } from '../../lib/useLembrado';
import { hojeISO } from './api';
import { ApontarSheet, EditarPendenciaSheet } from './ApontarSheet';
import { Camera } from './Camera';
import { FotoViewer, type FotoAmpliada } from './FotoViewer';
import { ChecklistInfo } from './ChecklistInfo';
import { PendenciaDeck } from './PendenciaDeck';
import type { ObraCompleta } from './detalhe';
import type { PendenciaObra } from './pendenciasObra';
import type { NovaPendencia } from './campo';
import { useObraPendencias } from './useObraPendencias';
import styles from './PendenciasAba.module.css';

type Aba = 'pendentes' | 'resolvidos';
type Vista = 'fotos' | 'lista';

const CRIT: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

/**
 * Check list da obra (decisão do usuário, 28/10/2026, opção B do protótipo):
 * Pendências (fotos uma a uma ou lista por criticidade) e Resolvidos (lista
 * compacta que abre com antes e depois). Sem fila, sem adiar e sem vistoria:
 * tirou a foto do depois, está resolvido.
 */
export function PendenciasAba({ obra }: { obra: ObraCompleta }) {
  const { data: pessoa } = usePerfil();
  const { showToast } = useToast();
  const campo = useObraPendencias(obra.id);
  const [aba, setAba] = useLembrado<Aba>(`obra:${obra.id}:check`, 'pendentes');
  const [vista, setVista] = useLembrado<Vista>(`obra:${obra.id}:checkVista`, 'fotos');
  const [apontar, setApontar] = useState(false);
  const [resolver, setResolver] = useState<PendenciaObra | null>(null);
  const [info, setInfo] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const hoje = hojeISO();

  const lista = useMemo(() => campo.query.data ?? [], [campo.query.data]);
  const { pendentes, resolvidas } = useMemo(() => classificarPendencias(lista), [lista]);
  const grupos = useMemo(() => pendentesPorCriticidade(pendentes), [pendentes]);

  // Foto ampliada (antes e depois, com zoom) e "Voltar para pendente" da resolvida.
  const [ampliar, setAmpliar] = useState<{ p: PendenciaObra; i: number } | null>(null);
  const [reabrindo, setReabrindo] = useState<PendenciaObra | null>(null);
  const fotosDe = (p: PendenciaObra): FotoAmpliada[] =>
    [
      p.fotoAntesUrl ? { rotulo: 'Antes', url: p.fotoAntesUrl } : null,
      p.fotoDepoisUrl ? { rotulo: 'Depois', url: p.fotoDepoisUrl } : null,
    ].filter((f): f is FotoAmpliada => f !== null);
  const abrirFoto = (p: PendenciaObra, qual: 'antes' | 'depois' = 'antes') => {
    const fotos = fotosDe(p);
    if (!fotos.length) return;
    setAmpliar({ p, i: qual === 'depois' ? fotos.length - 1 : 0 });
  };

  function reabrir(p: PendenciaObra, manterFoto: boolean) {
    setReabrindo(null);
    campo.reabrir.mutate({ id: p.id, manterFoto });
    showToast({
      message: manterFoto
        ? `"${p.titulo}" voltou para pendente (foto do depois mantida)`
        : `"${p.titulo}" voltou para pendente, sem a foto do depois`,
    });
  }

  // "⋯" de um item (ver fotos, voltar para pendente, editar, apagar).
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

  const onde = (p: PendenciaObra) =>
    [p.local, p.atividadeNome ?? 'Geral'].filter(Boolean).join(' · ');
  const resolvidoTxt = (p: PendenciaObra) =>
    `Resolvido${p.resolvida_em ? ` ${p.resolvida_em.slice(0, 10) === hoje ? 'hoje' : formatarDataCurta(p.resolvida_em.slice(0, 10))}` : ''}${p.resolveuNome ? ` · ${p.resolveuNome}` : ''}`;

  return (
    <div className={styles.aba}>
      <div className={styles.topo}>
        <div role="tablist" aria-label="Pendências e resolvidos" className={styles.modos}>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'pendentes'}
            className={`${styles.modo} ${aba === 'pendentes' ? styles.modoAtivo : ''}`}
            onClick={() => setAba('pendentes')}
          >
            Pendências · {pendentes.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'resolvidos'}
            className={`${styles.modo} ${aba === 'resolvidos' ? styles.modoAtivo : ''}`}
            onClick={() => setAba('resolvidos')}
          >
            Resolvidos · {resolvidas.length}
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

      {aba === 'pendentes' ? (
        <>
          {/* Opção B: a mesma aba alterna entre passar as fotos e ver a lista. */}
          <div className={styles.vistaLinha}>
            <span className={styles.vistaResumo}>
              {pendentes.length} {pendentes.length === 1 ? 'pendente' : 'pendentes'}
            </span>
            <div className={styles.vista} role="group" aria-label="Ver pendências como">
              <button
                type="button"
                aria-pressed={vista === 'fotos'}
                className={`${styles.vistaBtn} ${vista === 'fotos' ? styles.vistaOn : ''}`}
                onClick={() => setVista('fotos')}
              >
                <Icon name="camera" size={16} strokeWidth={2} />
                Fotos
              </button>
              <button
                type="button"
                aria-pressed={vista === 'lista'}
                className={`${styles.vistaBtn} ${vista === 'lista' ? styles.vistaOn : ''}`}
                onClick={() => setVista('lista')}
              >
                <Icon name="fases" size={16} strokeWidth={2} />
                Lista
              </button>
            </div>
          </div>

          {vista === 'fotos' ? (
            <PendenciaDeck
              pendencias={pendentes}
              onResolver={setResolver}
              onMais={setMenuPend}
              onFoto={(p) => abrirFoto(p)}
            />
          ) : (
            <div className={styles.grupos}>
              {grupos.map((g) => (
                <section key={g.criticidade} className={styles.grupo}>
                  <h3 className={styles.grupoTitulo}>
                    {CRIT[g.criticidade]} · {g.itens.length}
                  </h3>
                  {g.itens.map((p) => (
                    <div key={p.id} className={styles.linha}>
                      <button
                        type="button"
                        className={styles.miniatura}
                        aria-label={`Ver foto de "${p.titulo}"`}
                        disabled={!p.fotoAntesUrl}
                        onClick={() => abrirFoto(p)}
                      >
                        {p.fotoAntesUrl ? <img src={p.fotoAntesUrl} alt="" /> : null}
                      </button>
                      <div className={styles.info}>
                        <div className={styles.desc}>{p.titulo}</div>
                        <div className={styles.meta}>{onde(p)}</div>
                        <div className={styles.critLinha}>
                          <span className={`${styles.critTag} ${styles[`crit_${p.criticidade}`]}`}>
                            {CRIT[p.criticidade]}
                          </span>
                          <span className={styles.sub}>
                            {pendenteHa(p.apontada_em, hoje) === 'hoje'
                              ? 'apontada hoje'
                              : `há ${pendenteHa(p.apontada_em, hoje)}`}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles.resolverMini}
                        aria-label={`Resolver "${p.titulo}" com a foto do depois`}
                        onClick={() => setResolver(p)}
                      >
                        <Icon name="camera" size={20} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className={styles.mais}
                        aria-label={`Mais opções de "${p.titulo}"`}
                        onClick={() => setMenuPend(p)}
                      >
                        <Icon name="more" size={22} />
                      </button>
                    </div>
                  ))}
                </section>
              ))}
              {pendentes.length === 0 ? (
                <div className={styles.vazio}>Nada pendente nesta obra.</div>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <div className={styles.grupos}>
          {resolvidas.map((p) =>
            aberto === p.id ? (
              <div key={p.id} className={styles.vCard}>
                <div className={styles.vCabeca}>
                  <button
                    type="button"
                    className={styles.resTexto}
                    aria-expanded
                    onClick={() => setAberto(null)}
                  >
                    <span className={styles.desc}>{p.titulo}</span>
                    <span className={styles.meta}>{onde(p)}</span>
                    <span className={styles.resOk}>
                      <Icon name="checkGrosso" size={13} strokeWidth={3} />
                      {resolvidoTxt(p)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.mais}
                    aria-label={`Mais opções de "${p.titulo}"`}
                    onClick={() => setMenuPend(p)}
                  >
                    <Icon name="more" size={22} />
                  </button>
                </div>
                <div className={styles.vFotos}>
                  <button
                    type="button"
                    className={styles.vFoto}
                    aria-label="Ampliar foto do antes"
                    onClick={() => abrirFoto(p, 'antes')}
                  >
                    {p.fotoAntesUrl ? <img src={p.fotoAntesUrl} alt="Antes" /> : null}
                    <span className={styles.vAntes}>ANTES</span>
                  </button>
                  <button
                    type="button"
                    className={styles.vFoto}
                    aria-label="Ampliar foto do depois"
                    onClick={() => abrirFoto(p, 'depois')}
                  >
                    {p.fotoDepoisUrl ? <img src={p.fotoDepoisUrl} alt="Depois" /> : null}
                    <span className={styles.vDepois}>DEPOIS</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                key={p.id}
                type="button"
                className={styles.resLinha}
                aria-expanded={false}
                onClick={() => setAberto(p.id)}
              >
                <span className={styles.resMinis} aria-hidden="true">
                  <span className={styles.resMini}>
                    {p.fotoAntesUrl ? <img src={p.fotoAntesUrl} alt="" /> : null}
                  </span>
                  <span className={styles.resMini}>
                    {p.fotoDepoisUrl ? <img src={p.fotoDepoisUrl} alt="" /> : null}
                  </span>
                </span>
                <span className={styles.resTexto}>
                  <span className={styles.desc}>{p.titulo}</span>
                  <span className={styles.meta}>{onde(p)}</span>
                  <span className={styles.resOk}>
                    <Icon name="checkGrosso" size={13} strokeWidth={3} />
                    {resolvidoTxt(p)}
                  </span>
                </span>
                <Icon name="chevronDown" size={18} />
              </button>
            ),
          )}
          {resolvidas.length === 0 ? (
            <div className={styles.vazio}>
              Nada resolvido ainda. Resolva uma pendência com a foto do depois.
            </div>
          ) : null}
        </div>
      )}

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
                  showToast({ message: `"${resolver.titulo}" resolvida` });
                },
              },
            )
          }
        />
      ) : null}

      <ChecklistInfo aberto={info} onFechar={() => setInfo(false)} />

      <BottomSheet open={Boolean(menuPend)} onClose={() => setMenuPend(null)}>
        {menuPend ? (
          <div className={styles.menuPend}>
            <div className={styles.menuPendTopo}>
              <button
                type="button"
                className={styles.menuPendFoto}
                aria-label="Ampliar fotos"
                onClick={() => abrirFoto(menuPend)}
              >
                {menuPend.fotoAntesUrl ? (
                  <img src={menuPend.fotoAntesUrl} alt="Foto do antes" />
                ) : null}
              </button>
              <div className={styles.info}>
                <div className={styles.desc}>{menuPend.titulo}</div>
                <div className={styles.meta}>{onde(menuPend)}</div>
              </div>
            </div>
            {fotosDe(menuPend).length ? (
              <button
                type="button"
                className={styles.menuPendItem}
                onClick={() => abrirFoto(menuPend)}
              >
                <Icon name="camera" size={20} />
                {menuPend.fotoDepoisUrl ? 'Ver antes e depois' : 'Ver foto'}
              </button>
            ) : null}
            {menuPend.status !== 'aberta' ? (
              <button
                type="button"
                className={styles.menuPendItem}
                onClick={() => {
                  setReabrindo(menuPend);
                  setMenuPend(null);
                }}
              >
                <Icon name="undo" size={20} />
                Voltar para pendente
              </button>
            ) : null}
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

      <BottomSheet
        open={Boolean(reabrindo)}
        title="Voltar para pendente"
        onClose={() => setReabrindo(null)}
      >
        {reabrindo ? (
          <div className={styles.menuPend}>
            <p className={styles.reabrirTexto}>
              <b>{reabrindo.titulo}</b> volta para Pendências. Depois, tire uma nova foto do depois
              para documentar.
            </p>
            <button
              type="button"
              className={styles.reabrirOpcao}
              onClick={() => reabrir(reabrindo, true)}
            >
              <b>Manter a foto do depois</b>
              <span>Fica como registro até a nova foto.</span>
            </button>
            <button
              type="button"
              className={styles.reabrirOpcao}
              onClick={() => reabrir(reabrindo, false)}
            >
              <b>Tirar a foto do depois</b>
              <span>A pendência fica só com a foto do antes. O arquivo continua no histórico.</span>
            </button>
          </div>
        ) : null}
      </BottomSheet>

      {ampliar ? (
        <FotoViewer
          fotos={fotosDe(ampliar.p)}
          inicial={ampliar.i}
          titulo={ampliar.p.titulo}
          onFechar={() => setAmpliar(null)}
        />
      ) : null}

      <EditarPendenciaSheet
        obra={obra}
        inicial={inicialEdicao}
        onFechar={() => setEditando(null)}
        onSalvar={salvarEdicao}
      />
    </div>
  );
}
