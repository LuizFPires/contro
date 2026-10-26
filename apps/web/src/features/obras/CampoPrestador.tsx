import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@contro/ui';
import { supabase } from '../../lib/supabase';
import styles from './FichaAtividade.module.css';

interface Sugestao {
  texto: string;
  usos: number;
}

/** Prestadores já usados nas obras (sugestao tipo prestador), mais usados primeiro. */
function useSugestoesPrestador() {
  return useQuery<Sugestao[]>({
    queryKey: ['sugestao', 'prestador'],
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) return [];
      const { data } = await supabase
        .from('sugestao')
        .select('texto,usos')
        .eq('tipo', 'prestador')
        .order('usos', { ascending: false })
        .limit(100);
      return (data ?? []) as Sugestao[];
    },
  });
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Prestador da atividade (protótipo "manter"): digita e o app sugere os nomes já
 * usados nas obras; o nome salvo vira sugestão (trigger no banco).
 */
export function CampoPrestador({
  atividadeId,
  valor,
  onSalvar,
}: {
  atividadeId: string;
  valor: string | null;
  onSalvar: (v: string | null) => void;
}) {
  const { data: sugestoes = [] } = useSugestoesPrestador();
  const [texto, setTexto] = useState(valor ?? '');
  const [aberto, setAberto] = useState(false);

  const busca = semAcento(texto.trim());
  const lista = sugestoes
    .filter((s) => !busca || semAcento(s.texto).includes(busca))
    .filter((s) => s.texto !== texto.trim())
    .slice(0, 4);
  const novo =
    texto.trim() && !sugestoes.some((s) => semAcento(s.texto) === busca) ? texto.trim() : null;

  function salvar(v: string) {
    const final = v.trim() || null;
    setTexto(final ?? '');
    setAberto(false);
    if (final !== (valor ?? null)) onSalvar(final);
  }

  const listaId = `prest-lista-${atividadeId}`;
  return (
    <div className={`${styles.prestador} ${valor ? styles.prestadorDefinido : ''}`}>
      <Icon name="pessoa" size={24} />
      <div className={styles.prestadorCorpo}>
        <label htmlFor={`prest-${atividadeId}`} className={styles.prestadorRotulo}>
          Prestador da atividade
        </label>
        <input
          id={`prest-${atividadeId}`}
          className={styles.prestadorInput}
          value={texto}
          placeholder="Opcional · nome de quem executa"
          autoComplete="off"
          role="combobox"
          aria-expanded={aberto && (lista.length > 0 || Boolean(novo))}
          aria-controls={listaId}
          onFocus={() => setAberto(true)}
          onChange={(e) => {
            setTexto(e.target.value);
            setAberto(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvar(texto);
            if (e.key === 'Escape') setAberto(false);
          }}
          onBlur={() => salvar(texto)}
        />
        {aberto && (lista.length > 0 || novo) ? (
          <div id={listaId} role="listbox" className={styles.sugestoes}>
            {lista.length > 0 ? (
              <div className={styles.sugestoesTitulo}>Já usados nas obras</div>
            ) : null}
            {lista.map((s) => (
              <button
                key={s.texto}
                type="button"
                role="option"
                aria-selected={false}
                className={styles.sugestao}
                // mousedown: escolhe antes do blur do campo salvar o texto digitado
                onMouseDown={(e) => {
                  e.preventDefault();
                  salvar(s.texto);
                }}
              >
                <b>{s.texto}</b>
                <span>
                  {s.usos} {s.usos === 1 ? 'atividade' : 'atividades'}
                </span>
              </button>
            ))}
            {novo ? (
              <button
                type="button"
                role="option"
                aria-selected={false}
                className={`${styles.sugestao} ${styles.sugestaoNovo}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  salvar(novo);
                }}
              >
                Usar “{novo}” como novo nome
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
