import { useState } from 'react';
import { podeGerirObrasGerais } from '@contro/core';
import { Icon, Simbolo } from '@contro/ui';
import type { PessoaAtual } from '../perfil/usePerfil';
import { NovaObraGeralSheet } from './NovaObraGeralSheet';
import { useObrasGerais } from './useObrasGerais';
import styles from './ObrasGeraisInicio.module.css';

/**
 * Lista das obras gerais (aba Obras do Administrador; Coordenador e Membro com mais de
 * uma obra, quando nenhuma foi aberta) e, para o Administrador, a criação.
 */
export function ObrasGeraisInicio({
  pessoa,
  onAbrirObra,
}: {
  pessoa: PessoaAtual;
  onAbrirObra: (id: string) => void;
}) {
  const [nova, setNova] = useState(false);
  const { data: obras, isLoading, isError, refetch } = useObrasGerais();
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
                    {o.cidade ? `${o.cidade} · ` : ''}
                    {o.pessoas === 1 ? '1 pessoa' : `${o.pessoas} pessoas`}
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
