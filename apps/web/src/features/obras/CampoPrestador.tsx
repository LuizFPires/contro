import { nomePrestadorExistente, normalizarPrestador } from './nomesPrestador';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon, useToast } from '@contro/ui';
import { useAutoSalvar } from '../../lib/useAutoSalvar';
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
      const todos: Sugestao[] = [];
      for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await supabase
          .from('sugestao')
          .select('texto,usos')
          .eq('tipo', 'prestador')
          .is('deleted_at', null)
          .order('created_at')
          .order('texto')
          .range(inicio, inicio + 999);
        if (error) throw error;
        todos.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      const unicos = new Map<string, Sugestao>();
      for (const s of todos) {
        const chave = normalizarPrestador(s.texto);
        const existente = unicos.get(chave);
        if (existente) existente.usos += s.usos;
        else unicos.set(chave, { ...s });
      }
      return [...unicos.values()];
    },
  });
}

/**
 * Prestador da atividade (protótipo "manter"): digita e o app sugere os nomes já
 * usados nas obras; o nome salvo vira sugestão (trigger no banco).
 */
export function CampoPrestador({
  atividadeId,
  valor,
  onSalvar,
  onAutoSalvar,
  onTexto,
  rotulo = 'Prestador da atividade',
  placeholder = 'Opcional · nome de quem executa',
  autoFocus = false,
  required = false,
}: {
  atividadeId: string;
  valor: string | null;
  onSalvar: (v: string | null) => void;
  onTexto?: (v: string) => void;
  /** Salvamento automático (app fechou ou campo saiu da tela). Padrão: onSalvar. */
  onAutoSalvar?: (v: string | null) => void;
  /** Mapa de coleta: "Quem foi contratado". */
  rotulo?: string;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
}) {
  const { data: sugestoes = [] } = useSugestoesPrestador();
  const [texto, setTexto] = useState(valor ?? '');
  const [aberto, setAberto] = useState(false);
  const [excluir, setExcluir] = useState<string | null>(null);
  const qc = useQueryClient();
  const { showToast } = useToast();
  const remover = useMutation({
    mutationFn: async (nome: string) => {
      if (!supabase) throw new Error('Sem conexão');
      const { error } = await supabase.rpc('excluir_sugestao_prestador', { p_nome: nome });
      if (error) throw error;
    },
    onSuccess: () => {
      setExcluir(null);
      void qc.invalidateQueries({ queryKey: ['sugestao', 'prestador'] });
      showToast({ message: 'Nome removido das sugestões' });
    },
    onError: () => showToast({ message: 'Não foi possível excluir o nome. Tente novamente.' }),
  });

  const busca = normalizarPrestador(texto.trim());
  const lista = sugestoes
    .filter((s) => !busca || normalizarPrestador(s.texto).includes(busca))
    .slice(0, 4);
  const novo =
    texto.trim() && !sugestoes.some((s) => normalizarPrestador(s.texto) === busca)
      ? texto.trim()
      : null;

  // Digitou e fechou o app (ou a ficha) sem confirmar: salva assim mesmo.
  useAutoSalvar(texto.trim(), valor ?? '', (t) =>
    (onAutoSalvar ?? onSalvar)(
      nomePrestadorExistente(
        t,
        sugestoes.map((s) => s.texto),
      ) || null,
    ),
  );

  function salvar(v: string) {
    const final =
      nomePrestadorExistente(
        v,
        sugestoes.map((s) => s.texto),
      ) || null;
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
          {rotulo}
        </label>
        <input
          id={`prest-${atividadeId}`}
          className={styles.prestadorInput}
          value={texto}
          placeholder={placeholder}
          autoFocus={autoFocus}
          required={required}
          maxLength={200}
          autoComplete="off"
          role="combobox"
          aria-expanded={aberto && (lista.length > 0 || Boolean(novo))}
          aria-controls={listaId}
          onFocus={() => setAberto(true)}
          onChange={(e) => {
            setTexto(e.target.value);
            onTexto?.(e.target.value);
            setAberto(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              salvar(texto);
            }
            if (e.key === 'Escape') setAberto(false);
          }}
          onBlur={(e) => {
            if (e.relatedTarget && e.currentTarget.parentElement?.contains(e.relatedTarget as Node))
              return;
            salvar(texto);
          }}
        />
        {aberto && (lista.length > 0 || novo) ? (
          <div id={listaId} role="listbox" className={styles.sugestoes}>
            {lista.length > 0 ? (
              <div className={styles.sugestoesTitulo}>Já usados nas obras</div>
            ) : null}
            {lista.map((s) => (
              <div key={s.texto} className={styles.sugestaoLinha}>
                <button
                  type="button"
                  role="option"
                  aria-selected={s.texto === texto.trim()}
                  className={styles.sugestao}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => salvar(s.texto)}
                >
                  <b>{s.texto}</b>
                  <span>{s.usos} usos</span>
                </button>
                <button
                  type="button"
                  aria-label={`Excluir sugestão ${s.texto}`}
                  className={styles.excluirSugestao}
                  disabled={remover.isPending}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setExcluir(s.texto)}
                >
                  <Icon name="lixeira" size={18} />
                </button>
              </div>
            ))}
            {excluir ? (
              <div
                className={styles.confirmarSugestao}
                role="group"
                aria-label="Confirmar exclusão da sugestão"
              >
                <p>Excluir “{excluir}” das sugestões? Os registros existentes serão mantidos.</p>
                <button
                  type="button"
                  disabled={remover.isPending}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => remover.mutate(excluir)}
                >
                  {remover.isPending ? 'Excluindo…' : 'Excluir nome'}
                </button>
                <button
                  type="button"
                  disabled={remover.isPending}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setExcluir(null)}
                >
                  Cancelar
                </button>
              </div>
            ) : null}
            {novo ? (
              <button
                type="button"
                role="option"
                aria-selected={false}
                className={`${styles.sugestao} ${styles.sugestaoNovo}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  salvar(novo);
                }}
                onClick={() => salvar(novo)}
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
