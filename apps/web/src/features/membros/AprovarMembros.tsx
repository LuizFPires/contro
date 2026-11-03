import { BottomSheet, Button, Icon, useToast } from '@contro/ui';
import { useState } from 'react';
import { usePerfil } from '../perfil/usePerfil';
import { useMembrosPendentes, useTodosMembros } from './useMembros';
import styles from './AprovarMembros.module.css';

/** Tela do gestor: aprovar ou recusar cadastros pendentes. */
export function AprovarMembros({ onVoltar }: { onVoltar: () => void }) {
  const { query, aprovar, recusar } = useMembrosPendentes();
  const todos = useTodosMembros();
  const { data: pessoa } = usePerfil();
  const [aba, setAba] = useState<'pendentes' | 'ativos' | 'inativos'>('pendentes');
  const [desativar, setDesativar] = useState<{ id: string; nome: string } | null>(null);
  const [erroDesativar, setErroDesativar] = useState('');
  const { showToast } = useToast();
  const itens = query.data ?? [];

  return (
    <div className={styles.screen}>
      <div className={styles.barra}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronRight" size={22} />
        </button>
        <span className={styles.titulo}>Aprovar membros</span>
      </div>

      <div className={styles.acoes} role="tablist" aria-label="Status dos membros">
        {(['pendentes', 'ativos', 'inativos'] as const).map((a) => (
          <button
            type="button"
            role="tab"
            aria-selected={aba === a}
            className={aba === a ? styles.aprovar : styles.recusar}
            onClick={() => setAba(a)}
            key={a}
          >
            {a === 'pendentes' ? 'Pendentes' : a === 'ativos' ? 'Ativos' : 'Inativos'}
          </button>
        ))}
      </div>
      {aba !== 'pendentes' ? (
        todos.query.isLoading ? (
          <p>Carregando…</p>
        ) : todos.query.isError ? (
          <p role="alert">Não foi possível carregar os membros.</p>
        ) : (
          <ul className={styles.lista}>
            {(todos.query.data ?? [])
              .filter((m) => (aba === 'ativos' ? m.ativo : !m.ativo && m.desativado_em))
              .map((m) => (
                <li key={m.id} className={styles.item}>
                  <span className={styles.nome}>
                    {m.nome} · {m.perfil === 'gestor' ? 'Gestor' : 'Equipe'}
                    {m.id === pessoa?.id ? ' (você)' : ''}
                  </span>
                  <button
                    type="button"
                    className={m.ativo ? styles.recusar : styles.aprovar}
                    disabled={todos.definirAtivo.isPending || m.id === pessoa?.id}
                    onClick={() => {
                      if (m.ativo) {
                        setErroDesativar('');
                        setDesativar({ id: m.id, nome: m.nome });
                        return;
                      }
                      todos.definirAtivo.mutate(
                        { id: m.id, ativo: true },
                        {
                          onSuccess: () => showToast({ message: `${m.nome} ativado.` }),
                          onError: (e) => showToast({ message: e.message }),
                        },
                      );
                    }}
                  >
                    {m.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </li>
              ))}
            {!(todos.query.data ?? []).some((m) =>
              aba === 'ativos' ? m.ativo : !m.ativo && m.desativado_em,
            ) ? (
              <li className={styles.vazio}>Nenhum membro nesta lista.</li>
            ) : null}
          </ul>
        )
      ) : query.isError ? (
        <p role="alert">Não foi possível carregar os cadastros.</p>
      ) : query.isLoading ? (
        <p className={styles.vazio}>Carregando…</p>
      ) : itens.length === 0 ? (
        <p className={styles.vazio}>Nenhum cadastro aguardando aprovação.</p>
      ) : (
        <ul className={styles.lista}>
          {itens.map((m) => (
            <li key={m.id} className={styles.item}>
              <span className={styles.nome}>{m.nome}</span>
              <div className={styles.acoes}>
                <button
                  type="button"
                  className={styles.recusar}
                  onClick={() =>
                    recusar.mutate(m.id, {
                      onSuccess: () => showToast({ message: 'Cadastro recusado.' }),
                      onError: (e) => showToast({ message: (e as Error).message }),
                    })
                  }
                >
                  Recusar
                </button>
                <button
                  type="button"
                  className={styles.aprovar}
                  onClick={() =>
                    aprovar.mutate(m.id, {
                      onSuccess: () => showToast({ message: `${m.nome} aprovado.` }),
                      onError: (e) => showToast({ message: (e as Error).message }),
                    })
                  }
                >
                  <Icon name="check" size={16} />
                  Aprovar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <BottomSheet
        open={Boolean(desativar)}
        title="Desativar este usuário?"
        onClose={() => {
          if (!todos.definirAtivo.isPending) setDesativar(null);
        }}
      >
        <p className={styles.nome}>{desativar?.nome}</p>
        <p>O usuário perderá o acesso ao CONTRO. Você poderá reativá-lo na aba Inativos.</p>
        {erroDesativar ? <p role="alert">{erroDesativar}</p> : null}
        <div className={styles.acoes}>
          <Button
            variant="tertiary"
            disabled={todos.definirAtivo.isPending}
            onClick={() => setDesativar(null)}
          >
            Cancelar
          </Button>
          <Button
            variant="secondary"
            disabled={todos.definirAtivo.isPending}
            onClick={() => {
              if (!desativar || todos.definirAtivo.isPending) return;
              const membro = desativar;
              setErroDesativar('');
              todos.definirAtivo.mutate(
                { id: membro.id, ativo: false },
                {
                  onSuccess: () => {
                    setDesativar(null);
                    showToast({ message: `${membro.nome} desativado.` });
                  },
                  onError: (e) => setErroDesativar(e.message),
                },
              );
            }}
          >
            {todos.definirAtivo.isPending ? 'Desativando…' : 'Confirmar desativação'}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
