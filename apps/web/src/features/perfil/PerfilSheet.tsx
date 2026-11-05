import { useState, type ReactNode } from 'react';
import { rotuloAmbiente, rotuloPapelGeral, rotuloPerfil, type Ambiente } from '@contro/core';
import { BottomSheet, Icon, type IconName } from '@contro/ui';
import { EditarNome } from '../../screens/EditarNome';
import { TrocarSenha } from '../../screens/TrocarSenha';
import { AvisosCelularSheet } from '../avisos/AvisosCelularSheet';
import { VERSAO_APP, forcarAtualizacao } from '../../lib/pwa';
import type { PessoaAtual } from './usePerfil';
import styles from './PerfilSheet.module.css';

/**
 * Painel de perfil (opção A): quem é → Ambiente (só com os dois) → itens do
 * ambiente → Sua conta. As folhas de nome, senha e avisos abrem daqui.
 */
export function PerfilSheet({
  aberto,
  onFechar,
  pessoa,
  ambiente,
  disponiveis,
  onTrocarAmbiente,
  itensDoAmbiente,
  onSair,
}: {
  aberto: boolean;
  onFechar: () => void;
  pessoa: PessoaAtual;
  ambiente: Ambiente;
  disponiveis: Ambiente[];
  onTrocarAmbiente: (a: Ambiente) => void;
  itensDoAmbiente: ReactNode;
  onSair: () => void;
}) {
  const [editarNome, setEditarNome] = useState(false);
  const [trocarSenha, setTrocarSenha] = useState(false);
  const [avisos, setAvisos] = useState(false);
  const papel =
    ambiente === 'geral'
      ? pessoa.administrador
        ? 'Administrador'
        : pessoa.papelGeral
          ? rotuloPapelGeral(pessoa.papelGeral)
          : ''
      : rotuloPerfil(pessoa.perfil);

  return (
    <>
      <BottomSheet open={aberto} onClose={onFechar}>
        <div className={styles.painel}>
          <div className={styles.quem}>
            <span className={styles.avatar} aria-hidden="true">
              <Icon name="pessoa" size={24} />
            </span>
            <span>
              <span className={styles.quemNome}>{pessoa.nome}</span>
              <span className={styles.quemPerfil}>{papel}</span>
            </span>
          </div>
          {disponiveis.length > 1 ? (
            <div className={styles.ambiente}>
              <span className={styles.ambienteTitulo}>Ambiente</span>
              <div className={styles.seg} role="tablist" aria-label="Ambiente">
                {disponiveis.map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="tab"
                    aria-selected={a === ambiente}
                    className={`${styles.opcao} ${a === ambiente ? styles.opcaoAtiva : ''}`}
                    onClick={() => {
                      if (a === ambiente) return;
                      onFechar();
                      onTrocarAmbiente(a);
                    }}
                  >
                    {a === ambiente ? <Icon name="check" size={16} strokeWidth={2.4} /> : null}
                    {rotuloAmbiente(a)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {itensDoAmbiente}
          <ItemMenu
            icon="pessoa"
            rotulo="Editar meu nome"
            onClick={() => {
              onFechar();
              setEditarNome(true);
            }}
          />
          <ItemMenu
            icon="sino"
            rotulo="Avisos neste celular"
            onClick={() => {
              onFechar();
              setAvisos(true);
            }}
          />
          <ItemMenu
            icon="cadeado"
            rotulo="Trocar senha"
            onClick={() => {
              onFechar();
              setTrocarSenha(true);
            }}
          />
          <ItemMenu
            icon="sync"
            rotulo={`Atualizar o app · versão ${VERSAO_APP}`}
            onClick={() => void forcarAtualizacao()}
          />
          <ItemMenu icon="sair" rotulo="Sair" separado onClick={onSair} semSeta />
        </div>
      </BottomSheet>

      <TrocarSenha aberto={trocarSenha} onFechar={() => setTrocarSenha(false)} />

      <AvisosCelularSheet aberto={avisos} onFechar={() => setAvisos(false)} />

      <EditarNome aberto={editarNome} atual={pessoa.nome} onFechar={() => setEditarNome(false)} />
    </>
  );
}

/** Linha do painel de perfil (ícone, rótulo, selo opcional e seta). */
export function ItemMenu({
  icon,
  rotulo,
  selo,
  separado,
  semSeta,
  onClick,
}: {
  icon: IconName;
  rotulo: string;
  selo?: string;
  separado?: boolean;
  semSeta?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.item} ${separado ? styles.itemSeparado : ''}`}
      onClick={onClick}
    >
      <Icon name={icon} size={22} />
      <span className={styles.itemRotulo}>{rotulo}</span>
      {selo ? <span className={styles.selo}>{selo}</span> : null}
      {semSeta ? null : <Icon name="seta" size={18} className={styles.itemSeta} />}
    </button>
  );
}
