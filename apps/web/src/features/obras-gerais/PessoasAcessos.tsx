import { useState } from 'react';
import { Chip, Icon } from '@contro/ui';
import { rotuloPapelGeral } from '@contro/core';
import { FichaPessoaGeral } from './FichaPessoaGeral';
import { NovaPessoaGeral } from './NovaPessoaGeral';
import { useObrasGerais } from './useObrasGerais';
import { usePessoasGerais, type PessoaGeral } from './usePessoasGerais';
import styles from './PessoasAcessos.module.css';

/** Pessoas e acessos de Obras gerais (só Administrador). */
export function PessoasAcessos({ onVoltar }: { onVoltar: () => void }) {
  const { query, pessoas, convites } = usePessoasGerais();
  const obrasQuery = useObrasGerais();
  const obras = obrasQuery.data ?? [];
  const [ficha, setFicha] = useState<PessoaGeral | null>(null);
  const [nova, setNova] = useState(false);

  const nomeObra = (id: string) => obras.find((o) => o.id === id)?.nome ?? 'Obra';
  const chips = (ids: string[]) => (ids.length === 0 ? ['sem obra'] : ids.map(nomeObra));

  return (
    <div className={styles.screen}>
      <div className={styles.topo}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronLeft" size={22} />
        </button>
        <div className={styles.titulos}>
          <h1 className={styles.titulo}>Pessoas e acessos</h1>
          <p className={styles.sub}>Obras gerais</p>
        </div>
        <button
          type="button"
          className={styles.nova}
          aria-label="Nova pessoa"
          onClick={() => setNova(true)}
        >
          <Icon name="plus" size={22} />
        </button>
      </div>

      {query.isError ? (
        <p role="alert" className={styles.aviso}>
          Não foi possível carregar as pessoas.
        </p>
      ) : query.isLoading ? (
        <p className={styles.aviso}>Carregando…</p>
      ) : pessoas.length === 0 && convites.length === 0 ? (
        <p className={styles.aviso}>Ninguém com acesso ainda. Toque em + para dar acesso.</p>
      ) : (
        <ul className={styles.lista}>
          {pessoas.map((p) => (
            <li key={p.id}>
              <button type="button" className={styles.card} onClick={() => setFicha(p)}>
                <span className={styles.nome}>{p.nome}</span>
                <span className={styles.meta}>
                  {rotuloPapelGeral(p.papel)} · {p.email}
                </span>
                <span className={styles.chips}>
                  {chips(p.obraIds).map((c, i) => (
                    <Chip key={`${c}-${i}`}>{c}</Chip>
                  ))}
                </span>
              </button>
            </li>
          ))}
          {convites.map((c) => (
            <li key={c.email}>
              <div className={styles.card}>
                <span className={styles.nome}>{c.nome}</span>
                <span className={styles.meta}>
                  {rotuloPapelGeral(c.papel)} · {c.email} · ainda não entrou
                </span>
                <span className={styles.chips}>
                  {chips(c.obraIds).map((x, i) => (
                    <Chip key={`${x}-${i}`}>{x}</Chip>
                  ))}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FichaPessoaGeral pessoa={ficha} obras={obras} onFechar={() => setFicha(null)} />
      <NovaPessoaGeral aberto={nova} obras={obras} onFechar={() => setNova(false)} />
    </div>
  );
}
