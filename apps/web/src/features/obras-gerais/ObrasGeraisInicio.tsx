import { useState } from 'react';
import { podeGerirObrasGerais, reuniaoQueVem, textoEficiencia } from '@contro/core';
import { Icon, Simbolo } from '@contro/ui';
import type { PessoaAtual } from '../perfil/usePerfil';
import { hojeISO } from '../obras/api';
import { BlocoAcoesGeral } from './BlocoAcoesGeral';
import { BlocoReuniaoGeral, BlocosObraGeral } from './reuniao/BlocoReuniaoGeral';
import { useAgendasObrasGerais } from './reuniao/useConfigAvisosObra';
import { NovaObraGeralSheet } from './NovaObraGeralSheet';
import { useObrasGerais } from './useObrasGerais';
import { useResumoObrasGerais } from './useResumoObrasGerais';
import styles from './ObrasGeraisInicio.module.css';

/**
 * Lista das obras gerais (aba Obras do Administrador; Coordenador e Membro com mais de
 * uma obra, quando nenhuma foi aberta) e, para o Administrador, a criação.
 */
export function ObrasGeraisInicio({
  pessoa,
  onAbrirObra,
  onAbrirAcoes,
  onAbrirReunioes,
}: {
  pessoa: PessoaAtual;
  onAbrirObra: (id: string) => void;
  /** Administrador: abre as ações de todas as obras gerais juntas. */
  onAbrirAcoes?: (obraIds: string[]) => void;
  /** Administrador: abre as reuniões das obras gerais (uma por obra). */
  onAbrirReunioes?: () => void;
}) {
  const [nova, setNova] = useState(false);
  const { data: obras, isLoading, isError, refetch } = useObrasGerais();
  const { data: resumo } = useResumoObrasGerais();
  const agendas = useAgendasObrasGerais(
    pessoa.administrador && onAbrirReunioes ? (obras ?? []).map((o) => o.id) : [],
  );
  // A próxima reunião entre as obras (a mais cedo, pela data e pela hora).
  const proxima = [...(agendas.data?.values() ?? [])]
    .map((a) => ({ data: reuniaoQueVem(hojeISO(), a.reuniaoDia), hora: a.reuniaoHora }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora))[0];
  const porId = new Map((resumo ?? []).map((r) => [r.id, r]));
  const eficienciaDe = (id: string) => {
    const r = porId.get(id);
    return r ? textoEficiencia(r.eficiencia) : null;
  };
  const admin = podeGerirObrasGerais({
    administrador: pessoa.administrador,
    acessoContorno: pessoa.acessoContorno,
    papelGeral: pessoa.papelGeral,
  });
  return (
    <>
      <div className={styles.topo}>
        <h1 className={styles.titulo}>Minhas obras</h1>
        {admin ? (
          <button
            type="button"
            className={styles.nova}
            aria-label="Nova obra"
            title="Nova obra"
            onClick={() => setNova(true)}
          >
            <Icon name="plus" size={22} strokeWidth={2.4} />
          </button>
        ) : null}
      </div>

      {pessoa.administrador && onAbrirAcoes && resumo && resumo.length > 0 ? (
        <div className={styles.blocoAcoes}>
          <BlocosObraGeral>
            {onAbrirReunioes ? (
              <BlocoReuniaoGeral proxima={proxima ?? null} onAbrir={onAbrirReunioes} />
            ) : null}
            <BlocoAcoesGeral
              acoes={resumo.flatMap((r) => r.acoes)}
              pessoaId={pessoa.id}
              soDaPessoa={false}
              onAbrir={() => onAbrirAcoes(resumo.map((r) => r.id))}
            />
          </BlocosObraGeral>
        </div>
      ) : null}

      {isLoading ? (
        <p className={styles.aviso}>Carregando…</p>
      ) : isError ? (
        <div className={styles.vazio}>
          <h2>Não foi possível carregar as obras.</h2>
          <button type="button" className={styles.tentar} onClick={() => void refetch()}>
            Tentar de novo
          </button>
        </div>
      ) : obras && obras.length > 0 ? (
        <ul className={styles.lista}>
          {obras.map((o) => (
            <li key={o.id}>
              <button type="button" className={styles.card} onClick={() => onAbrirObra(o.id)}>
                <span className={styles.cardTexto}>
                  <span className={styles.nome}>{o.nome}</span>
                  <span className={styles.meta}>
                    {[
                      o.cidade,
                      eficienciaDe(o.id),
                      o.pessoas === 1 ? '1 pessoa' : `${o.pessoas} pessoas`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <Icon name="seta" size={20} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.vazio}>
          <Simbolo size={56} />
          <h2>Nenhuma obra geral ainda.</h2>
          {admin ? <p>Toque no + para criar a primeira.</p> : null}
        </div>
      )}

      {admin ? <NovaObraGeralSheet aberto={nova} onFechar={() => setNova(false)} /> : null}
    </>
  );
}
