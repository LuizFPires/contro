import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BottomSheet, useToast } from '@contro/ui';
import { supabase } from '../../lib/supabase';
import { useNomesSugeridos } from '../reuniao/useNomesSugeridos';
import { OUTRO } from './entradaTarefa';
import type { PendenciaObra } from './pendenciasObra';
import styles from './ChecklistPdf.module.css';

/**
 * Responsável pela pendência: alguém do app ou, na Contorno, um nome digitado
 * (prestador sem login, pedido de campo em 10/11/2026), que vira sugestão.
 */
export function ChecklistResponsavel({
  pendencia,
  pessoas: lista,
  onFechar,
  onSalvar,
}: {
  pendencia: PendenciaObra;
  /** Quem pode ser responsável (obra geral: as pessoas da obra). Sem ela, a equipe Contorno e nome livre. */
  pessoas?: { id: string; nome: string }[];
  onFechar: () => void;
  onSalvar: (id: string | null, nome: string | null) => Promise<unknown>;
}) {
  const nomeLivre = !lista;
  const nomeAtual = !pendencia.responsavel_id ? (pendencia.responsavelNome?.trim() ?? '') : '';
  const [id, setId] = useState(pendencia.responsavel_id ?? (nomeLivre && nomeAtual ? OUTRO : ''));
  const [nomeDigitado, setNomeDigitado] = useState(nomeAtual);
  const [salvando, setSalvando] = useState(false);
  const { showToast } = useToast();
  const { data: sugeridos = [] } = useNomesSugeridos('contorno');
  const idNomes = useId();
  const consulta = useQuery({
    queryKey: ['responsaveis-checklist'],
    enabled: !lista,
    queryFn: async () => {
      if (!supabase) throw new Error('Sem conexão');
      const { data, error } = await supabase
        .from('pessoa')
        .select('id,nome')
        .eq('ativo', true)
        .eq('acesso_contorno', true)
        .is('deleted_at', null)
        .order('nome');
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });
  const pessoas = lista
    ? { data: lista, isLoading: false, isError: false, refetch: consulta.refetch }
    : consulta;
  const outro = id === OUTRO;
  const faltaNome = outro && !nomeDigitado.trim();
  return (
    <BottomSheet
      open
      title="Responsável pela pendência"
      onClose={() => {
        if (!salvando) onFechar();
      }}
    >
      <div className={styles.conteudo}>
        <p>{pendencia.titulo}</p>
        <label>
          Responsável
          <select
            value={id}
            disabled={salvando || pessoas.isLoading}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="">Sem responsável</option>
            {pendencia.responsavel_id &&
            !pessoas.data?.some((p) => p.id === pendencia.responsavel_id) ? (
              <option value={pendencia.responsavel_id}>{pendencia.responsavelNome} (atual)</option>
            ) : null}
            {pessoas.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
            {nomeLivre ? <option value={OUTRO}>Prestador ou outro nome (digitar)</option> : null}
          </select>
        </label>
        {outro ? (
          <label>
            Nome do responsável
            <input
              className={styles.campoTexto}
              list={idNomes}
              placeholder="Ex.: Zé Eletricista"
              value={nomeDigitado}
              disabled={salvando}
              onChange={(e) => setNomeDigitado(e.target.value)}
            />
            <datalist id={idNomes}>
              {sugeridos.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <span className={styles.dicaCampo}>
              Sem conta no app: aparece no card e no PDF por responsável.
            </span>
          </label>
        ) : null}
        {pessoas.isError ? (
          <button type="button" onClick={() => void pessoas.refetch()}>
            Não foi possível carregar os responsáveis. Tentar novamente
          </button>
        ) : null}
        <button
          type="button"
          disabled={salvando || pessoas.isLoading || pessoas.isError || faltaNome}
          onClick={async () => {
            setSalvando(true);
            try {
              if (outro) await onSalvar(null, nomeDigitado.trim());
              else
                await onSalvar(
                  id || null,
                  id
                    ? (pessoas.data?.find((p) => p.id === id)?.nome ??
                        pendencia.responsavelNome ??
                        null)
                    : null,
                );
              showToast({ message: 'Responsável salvo · sincronização automática' });
              onFechar();
            } catch {
              showToast({ message: 'Não foi possível salvar o responsável' });
            } finally {
              setSalvando(false);
            }
          }}
        >
          {salvando ? 'Salvando…' : 'Salvar responsável'}
        </button>
      </div>
    </BottomSheet>
  );
}
