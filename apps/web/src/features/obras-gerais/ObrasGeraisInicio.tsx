import { useState } from 'react';
import { podeGerirObrasGerais, rotuloAmbiente, type Ambiente } from '@contro/core';
import { Icon, Logo, Simbolo } from '@contro/ui';
import { useLembrado } from '../../lib/useLembrado';
import { ItemMenu, PerfilSheet } from '../perfil/PerfilSheet';
import type { PessoaAtual } from '../perfil/usePerfil';
import { NovaObraGeralSheet } from './NovaObraGeralSheet';
import { ObraGeralDetalhe } from './ObraGeralDetalhe';
import { useObrasGerais } from './useObrasGerais';
import styles from './ObrasGeraisInicio.module.css';

/**
 * Início das obras gerais (etapa 1): lista de obras e, para o Administrador, a
 * criação. A obra por dentro (reunião, ações) chega nas etapas seguintes.
 */
export function ObrasGeraisInicio({
  pessoa,
  ambiente,
  disponiveis,
  onTrocarAmbiente,
  onSair,
  onPessoas,
}: {
  pessoa: PessoaAtual;
  ambiente: Ambiente;
  disponiveis: Ambiente[];
  onTrocarAmbiente: (a: Ambiente) => void;
  onSair: () => void;
  onPessoas: () => void;
}) {
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [nova, setNova] = useState(false);
  // A obra aberta fica lembrada: ao voltar ao app, reabre nela.
  const [obraAberta, setObraAberta] = useLembrado<string | null>('obrasgerais:obra', null);
  const { data: obras, isLoading, isError, refetch } = useObrasGerais();
  const admin = podeGerirObrasGerais({
    administrador: pessoa.administrador,
    acessoContorno: pessoa.acessoContorno,
    papelGeral: pessoa.papelGeral,
  });
  if (obraAberta) {
    return (
      <ObraGeralDetalhe
        id={obraAberta}
        pessoa={pessoa}
        onVoltar={() => setObraAberta(null)}
        onTrocarObra={setObraAberta}
        onAbrirPessoas={onPessoas}
      />
    );
  }
  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.marca}>
          <Logo on="preto" height={30} />
          {disponiveis.length > 1 ? (
            <span className={styles.ambiente}>{rotuloAmbiente(ambiente)}</span>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.perfil}
          aria-label="Perfil e ajustes"
          onClick={() => setPerfilAberto(true)}
        >
          <Icon name="pessoa" size={22} />
        </button>
      </header>

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
              <button type="button" className={styles.card} onClick={() => setObraAberta(o.id)}>
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

      <PerfilSheet
        aberto={perfilAberto}
        onFechar={() => setPerfilAberto(false)}
        pessoa={pessoa}
        ambiente={ambiente}
        disponiveis={disponiveis}
        onTrocarAmbiente={onTrocarAmbiente}
        itensDoAmbiente={
          pessoa.administrador ? (
            <ItemMenu
              icon="pessoa"
              rotulo="Pessoas e acessos"
              onClick={() => {
                setPerfilAberto(false);
                onPessoas();
              }}
            />
          ) : null
        }
        onSair={onSair}
      />
    </div>
  );
}
