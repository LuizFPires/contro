import { useEffect, useMemo, useState } from 'react';
import {
  podePlanejarObraGeral,
  resumoObraGeral,
  rotuloPapelGeral,
  trilhaObraGeral,
  type FaseGeral,
} from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import { useLembrado } from '../../lib/useLembrado';
import { hojeISO } from '../obras/api';
import { AnelAvanco } from '../obras/AnelAvanco';
import { Camera } from '../obras/Camera';
import base from '../obras/ObraDetalhe.module.css';
import type { AoConcluir } from '../obras/useConcluirAtividade';
import { useAvanco } from '../obras/useAvanco';
import { useObraCampo } from '../obras/useObraCampo';
import type { PessoaAtual } from '../perfil/usePerfil';
import { FichaAtividadeGeral } from './FichaAtividadeGeral';
import { NovaFaseSheet } from './NovaFaseSheet';
import styles from './ObraGeralDetalhe.module.css';
import { TrocarObraSheet } from './TrocarObraSheet';
import { useObraGeral } from './useObraGeral';
import { useObrasGerais } from './useObrasGerais';

/** Obra geral por dentro: trilha de fases com as atividades e o anel de avanço. */
export function ObraGeralDetalhe({
  id,
  pessoa,
  onVoltar,
  onTrocarObra,
}: {
  id: string;
  pessoa: PessoaAtual;
  onVoltar: () => void;
  onTrocarObra: (id: string) => void;
  onAbrirPessoas: () => void;
}) {
  const { data: obra, isLoading } = useObraGeral(id);
  const { data: obras } = useObrasGerais();
  const campo = useObraCampo(id);
  const { showToast } = useToast();
  const [faseAberta, setFaseAberta] = useLembrado<string | null>(`obrageral:${id}:fase`, null);
  // A ficha da atividade e a nova atividade abrem por estes estados (telas próprias).
  const [fichaId, setFichaId] = useLembrado<string | null>(`obrageral:${id}:ficha`, null);
  const [, setNovaAtividadeFaseId] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [novaFase, setNovaFase] = useState(false);
  const [anexandoId, setAnexandoId] = useState<string | null>(null);

  const aoConcluir: AoConcluir = (r, det) => {
    showToast({
      message: r.fase_fechada
        ? `"${det.nome}" concluída · fase concluída`
        : `"${det.nome}" concluída`,
      onUndo: () => campo.desfazer.mutate({ atividadeId: det.atividadeId, xp: r.xp }),
    });
  };
  const avanco = useAvanco(obra ?? null, aoConcluir, false);

  const fases = useMemo(
    () =>
      obra
        ? trilhaObraGeral({
            fases: obra.fases,
            atividades: obra.atividades,
            hoje: hojeISO(),
            pessoaId: pessoa.id,
            nomes: Object.fromEntries(obra.pessoas.map((p) => [p.id, p.nome])),
          })
        : [],
    [obra, pessoa.id],
  );

  // A obra lembrada não existe mais ou deixou de ser visível: volta para a lista.
  useEffect(() => {
    if (!isLoading && obra === null) onVoltar();
  }, [isLoading, obra, onVoltar]);

  const voltar = (
    <button
      type="button"
      className={base.voltar}
      aria-label="Voltar para Minhas obras"
      onClick={onVoltar}
    >
      <Icon name="chevronLeft" size={22} />
    </button>
  );

  if (isLoading || !obra) {
    return (
      <div className={base.screen}>
        <header className={base.cabecalho}>
          <div className={base.topo}>
            {voltar}
            <span className={base.sub}>Carregando…</span>
          </div>
        </header>
      </div>
    );
  }

  const planeja = podePlanejarObraGeral({
    administrador: pessoa.administrador,
    acessoContorno: pessoa.acessoContorno,
    papelGeral: pessoa.papelGeral,
  });
  const papel = pessoa.administrador
    ? 'Administrador'
    : pessoa.papelGeral
      ? rotuloPapelGeral(pessoa.papelGeral)
      : 'Membro';
  const lista = obras ?? [];
  const podeTrocar = lista.length > 1;
  const atual = fases.find((f) => !f.concluida);
  const aberta = faseAberta === null ? (atual?.id ?? null) : faseAberta;
  const anexando = anexandoId ? obra.atividades.find((a) => a.id === anexandoId) : undefined;

  return (
    <div className={base.screen}>
      <header className={base.cabecalho}>
        <div className={base.topo}>
          {voltar}
          <div className={base.titulo}>
            <h1 className={base.nome}>
              {podeTrocar ? (
                <button
                  type="button"
                  className={styles.nomeBtn}
                  aria-label={`${obra.nome}. Trocar de obra`}
                  aria-haspopup="dialog"
                  onClick={() => setTrocando(true)}
                >
                  <span className={styles.nomeTxt}>{obra.nome}</span>
                  <Icon name="chevronDown" size={20} strokeWidth={2.4} />
                </button>
              ) : (
                obra.nome
              )}
            </h1>
            <div className={base.sub}>{resumoObraGeral(fases)}</div>
          </div>
        </div>
      </header>

      <div className={base.conteudo}>
        <div className={base.mapa}>
          {fases.length === 0 ? (
            <p className={styles.vazio}>
              <b>Nenhuma fase ainda.</b>
              {planeja ? 'Toque em + fase para começar.' : null}
            </p>
          ) : null}

          {fases.map((f) => (
            <FaseGeralView
              key={f.id}
              fase={f}
              atual={atual?.id === f.id}
              aberta={aberta === f.id}
              planeja={planeja}
              onToggle={() => setFaseAberta(aberta === f.id ? '' : f.id)}
              onAnel={avanco.anel}
              onFicha={setFichaId}
              onAnexar={setAnexandoId}
              onAdicionar={() => setNovaAtividadeFaseId(f.id)}
            />
          ))}

          {planeja ? (
            <button type="button" className={styles.mais} onClick={() => setNovaFase(true)}>
              + fase
            </button>
          ) : null}

          <div className={base.inauguracao}>
            <div className={base.inaugIcone}>
              <Icon name="bandeira" size={22} />
            </div>
            <div className={base.inaugTexto}>
              <div className={base.inaugData}>Entrega da obra</div>
            </div>
          </div>
        </div>
      </div>

      <TrocarObraSheet
        aberto={trocando}
        obras={lista}
        atualId={obra.id}
        papel={papel}
        onEscolher={(novo) => {
          setTrocando(false);
          onTrocarObra(novo);
        }}
        onFechar={() => setTrocando(false)}
      />

      <NovaFaseSheet
        aberto={novaFase}
        obraId={obra.id}
        onFechar={() => setNovaFase(false)}
        onCriada={setFaseAberta}
      />

      {fichaId ? (
        <FichaAtividadeGeral
          obra={obra}
          atividadeId={fichaId}
          pessoa={pessoa}
          onClose={() => setFichaId(null)}
        />
      ) : null}

      {anexando ? (
        <Camera
          kicker="Foto de conclusão"
          titulo={anexando.nome}
          dica="A atividade já está concluída. Esta foto fica como registro da etapa."
          pendente={campo.anexarFoto.isPending}
          onCancelar={() => setAnexandoId(null)}
          onCapturar={(file) =>
            campo.anexarFoto.mutate(
              { atividadeId: anexando.id, file },
              {
                onSuccess: () => {
                  setAnexandoId(null);
                  showToast({ message: 'Foto anexada à conclusão' });
                },
                onError: () => showToast({ message: 'Não foi possível anexar a foto' }),
              },
            )
          }
        />
      ) : null}
    </div>
  );
}

function FaseGeralView({
  fase: f,
  atual,
  aberta,
  planeja,
  onToggle,
  onAnel,
  onFicha,
  onAnexar,
  onAdicionar,
}: {
  fase: FaseGeral;
  atual: boolean;
  aberta: boolean;
  planeja: boolean;
  onToggle: () => void;
  onAnel: (id: string) => void;
  onFicha: (id: string) => void;
  onAnexar: (id: string) => void;
  onAdicionar: () => void;
}) {
  const noClasse = f.concluida
    ? base.noConcluida
    : f.atrasadas > 0
      ? atual
        ? `${base.noAtual} ${base.noAtraso} ${base.anelAtraso}`
        : base.noAtraso
      : atual
        ? base.noAtual
        : base.noPlanejada;
  return (
    <div className={base.fase}>
      <div className={base.trilho}>
        <div className={`${base.no} ${noClasse}`}>
          {f.concluida ? (
            <Icon name="checkGrosso" size={20} strokeWidth={2.6} />
          ) : (
            <span>{f.n}</span>
          )}
        </div>
        <div className={`${base.linha} ${f.concluida ? base.linhaFeita : ''}`} />
      </div>
      <div className={base.faseCorpo}>
        <button type="button" className={base.faseBtn} aria-expanded={aberta} onClick={onToggle}>
          <span className={base.faseLinha}>
            <span className={base.faseTitulo}>{f.titulo}</span>
          </span>
          <span className={base.faseInfo}>
            {f.concluida ? (
              'concluída'
            ) : f.total === 0 ? (
              'sem atividades'
            ) : (
              <>
                {f.concluidas}/{f.total}
                {f.atrasadas > 0 ? (
                  <span className={styles.progAtraso}>
                    {' · '}
                    {f.atrasadas === 1 ? '1 atrasada' : `${f.atrasadas} atrasadas`}
                  </span>
                ) : null}
                {f.venceHoje > 0 ? (
                  <span className={styles.progHoje}>
                    {' · '}
                    {f.venceHoje === 1 ? '1 vence hoje' : `${f.venceHoje} vencem hoje`}
                  </span>
                ) : null}
              </>
            )}
          </span>
        </button>
        {aberta ? (
          <div className={base.atividades}>
            {f.atividades.map((a) => (
              <div
                key={a.id}
                className={`${base.atv} ${base[`atv_${a.status}`] ?? ''} ${styles[a.status] ?? ''}`}
              >
                <AnelAvanco
                  pct={a.status === 'concluida' ? 100 : a.avancoPct}
                  atrasada={a.status === 'atrasada'}
                  nome={a.nome}
                  onTocar={() => onAnel(a.id)}
                />
                <div className={styles.atvCorpo}>
                  <button type="button" className={base.atvTexto} onClick={() => onFicha(a.id)}>
                    <span className={base.atvNome}>{a.nome}</span>
                    <span className={`${base.atvSub} ${styles.subHoje}`}>{a.sub}</span>
                    {a.status !== 'concluida' && a.avancoPct > 0 && a.avancoPct < 100 ? (
                      <span className={base.atvBarra} aria-hidden="true">
                        <span style={{ width: `${a.avancoPct}%` }} />
                      </span>
                    ) : null}
                    {a.subitens.length ? (
                      <span className={base.subitens}>
                        {a.subitens.map((s) => (
                          <span key={s.id} className={s.feito ? base.subFeito : base.subitem}>
                            <Icon
                              name={s.feito ? 'checkGrosso' : 'seta'}
                              size={12}
                              strokeWidth={s.feito ? 3 : 2.2}
                            />
                            {s.nome}
                          </span>
                        ))}
                      </span>
                    ) : null}
                    {a.prestador ? (
                      <span className={base.prestador}>
                        <Icon name="pessoa" size={12} strokeWidth={2.2} />
                        {a.prestador}
                      </span>
                    ) : null}
                  </button>
                  {a.semFoto ? (
                    <button
                      type="button"
                      className={styles.anexarLink}
                      onClick={() => onAnexar(a.id)}
                    >
                      anexar foto
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {planeja ? (
              <button type="button" className={base.adicionarAtv} onClick={onAdicionar}>
                + Adicionar atividade
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
