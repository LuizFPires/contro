import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { iniciais, normalizarNome } from '@contro/core';
import { BottomSheet, Button, Icon, Input, useToast } from '@contro/ui';
import { supabase } from '../../lib/supabase';
import type { PessoaAtual } from '../perfil/usePerfil';
import type { ObraGeral } from './obraGeral';
import { adicionarMembroObra, convidarMembroObra } from './planejamento';
import styles from './PessoasDaObra.module.css';

interface Candidata {
  id: string;
  nome: string;
  papel_geral: 'coordenador' | 'membro';
}

/** Pessoas de Obras gerais que a RLS deixa esta pessoa ver (administradores ficam de fora). */
function useCandidatas(aberto: boolean) {
  return useQuery({
    queryKey: ['pessoas-gerais-visiveis'],
    enabled: aberto && Boolean(supabase),
    queryFn: async (): Promise<Candidata[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('pessoa')
        .select('id,nome,papel_geral')
        .not('papel_geral', 'is', null)
        .eq('administrador', false)
        .eq('ativo', true)
        .is('deleted_at', null)
        .order('nome');
      if (error) throw error;
      return (data ?? []) as Candidata[];
    },
  });
}

/** Adicionar ao {obra}: busca entre as pessoas visíveis ou pessoa nova por e-mail. */
export function AdicionarMembroSheet({
  aberto,
  obra,
  pessoa,
  onFechar,
  onAtualizar,
}: {
  aberto: boolean;
  obra: ObraGeral;
  pessoa: PessoaAtual;
  onFechar: () => void;
  onAtualizar: () => void;
}) {
  const { showToast } = useToast();
  const { data, isLoading, isError } = useCandidatas(aberto);
  const [busca, setBusca] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setBusca('');
      setNome('');
      setEmail('');
      setOcupado(false);
      setErro('');
    }
  }, [aberto]);

  const resultados = useMemo(() => {
    const dentro = new Set(obra.pessoas.filter((p) => p.participa).map((p) => p.id));
    const q = normalizarNome(busca);
    return (data ?? []).filter(
      (c) =>
        !dentro.has(c.id) &&
        // O Coordenador não coloca outro Coordenador (o banco também barra).
        (pessoa.administrador || c.papel_geral !== 'coordenador') &&
        (q === '' || normalizarNome(c.nome).includes(q)),
    );
  }, [data, obra.pessoas, busca, pessoa.administrador]);

  async function adicionar(c: Candidata) {
    if (ocupado) return;
    setOcupado(true);
    setErro('');
    try {
      await adicionarMembroObra(obra.id, c.id);
    } catch (e) {
      setOcupado(false);
      setErro(e instanceof Error ? e.message : 'Não foi possível adicionar.');
      return;
    }
    onAtualizar();
    onFechar();
    showToast({ message: `${c.nome} entrou na obra.` });
  }

  async function convidar() {
    if (ocupado) return;
    const n = nome.trim().replace(/\s+/g, ' ');
    const e = email.trim().toLowerCase();
    if (!n) return setErro('Informe o nome.');
    if (!e) return setErro('Informe o e-mail.');
    if (!e.includes('@')) return setErro('O e-mail precisa ter @.');
    setOcupado(true);
    setErro('');
    let id: string | null;
    try {
      id = await convidarMembroObra(obra.id, n, e);
    } catch (err) {
      setOcupado(false);
      setErro(err instanceof Error ? err.message : 'Não foi possível adicionar.');
      return;
    }
    onAtualizar();
    onFechar();
    showToast({
      message: id
        ? `${n} entrou na obra.`
        : `Convite salvo. ${n} entra na obra ao se cadastrar com esse e-mail.`,
    });
  }

  return (
    <BottomSheet open={aberto} title={`Adicionar ao ${obra.nome}`} onClose={onFechar}>
      <div className={styles.busca}>
        <Input
          label="Buscar pelo nome"
          value={busca}
          autoComplete="off"
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      {isError ? (
        <p role="alert" className={styles.erro}>
          Não foi possível carregar as pessoas.
        </p>
      ) : isLoading ? (
        <p className={styles.meta}>Carregando…</p>
      ) : resultados.length === 0 ? (
        <p className={styles.meta}>Ninguém para adicionar com esse nome.</p>
      ) : (
        <ul className={styles.resultados}>
          {resultados.map((c) => (
            <li key={c.id} className={styles.linha}>
              <span className={styles.iniciais} aria-hidden="true">
                {iniciais(c.nome)}
              </span>
              <span className={styles.texto}>
                <span className={styles.nome}>{c.nome}</span>
              </span>
              <button
                type="button"
                className={styles.add}
                aria-label={`Adicionar ${c.nome}`}
                disabled={ocupado}
                onClick={() => void adicionar(c)}
              >
                <Icon name="plus" size={22} strokeWidth={2.4} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.rotulo}>Pessoa nova</p>
      <div className={styles.campos}>
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input
          label="E-mail"
          type="email"
          placeholder="nome e e-mail de login"
          value={email}
          autoCapitalize="none"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {erro ? (
        <p role="alert" className={styles.erro}>
          {erro}
        </p>
      ) : null}
      <Button disabled={ocupado} onClick={() => void convidar()}>
        Adicionar como membro
      </Button>
    </BottomSheet>
  );
}
