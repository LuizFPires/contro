import { useState } from 'react';
import { rotuloAmbiente, type Ambiente } from '@contro/core';
import { Icon, Logo, Simbolo } from '@contro/ui';
import { PerfilSheet } from '../perfil/PerfilSheet';
import type { PessoaAtual } from '../perfil/usePerfil';
import styles from './ObrasGeraisInicio.module.css';

/**
 * Início das obras gerais. Esboço da etapa 1 (cabeçalho e perfil com a troca
 * de ambiente); a lista de obras gerais chega na tarefa seguinte.
 */
export function ObrasGeraisInicio({
  pessoa,
  ambiente,
  disponiveis,
  onTrocarAmbiente,
  onSair,
}: {
  pessoa: PessoaAtual;
  ambiente: Ambiente;
  disponiveis: Ambiente[];
  onTrocarAmbiente: (a: Ambiente) => void;
  onSair: () => void;
  onPessoas: () => void;
}) {
  const [perfilAberto, setPerfilAberto] = useState(false);
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

      <div className={styles.vazio}>
        <Simbolo size={56} />
        <h2>Nenhuma obra geral ainda.</h2>
      </div>

      <PerfilSheet
        aberto={perfilAberto}
        onFechar={() => setPerfilAberto(false)}
        pessoa={pessoa}
        ambiente={ambiente}
        disponiveis={disponiveis}
        onTrocarAmbiente={onTrocarAmbiente}
        itensDoAmbiente={null}
        onSair={onSair}
      />
    </div>
  );
}
