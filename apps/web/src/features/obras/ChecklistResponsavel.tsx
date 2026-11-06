import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BottomSheet, useToast } from '@contro/ui';
import { supabase } from '../../lib/supabase';
import type { PendenciaObra } from './pendenciasObra';
import styles from './ChecklistPdf.module.css';

export function ChecklistResponsavel({
  pendencia,
  pessoas: lista,
  onFechar,
  onSalvar,
}: {
  pendencia: PendenciaObra;
  /** Quem pode ser responsável (obra geral: as pessoas da obra). Sem ela, a equipe Contorno. */
  pessoas?: { id: string; nome: string }[];
  onFechar: () => void;
  onSalvar: (id: string | null, nome: string | null) => Promise<unknown>;
}) {
  const [id, setId] = useState(pendencia.responsavel_id ?? '');
  const [salvando, setSalvando] = useState(false);
  const { showToast } = useToast();
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
          </select>
        </label>
        {pessoas.isError ? (
          <button type="button" onClick={() => void pessoas.refetch()}>
            Não foi possível carregar os responsáveis. Tentar novamente
          </button>
        ) : null}
        <button
          type="button"
          disabled={salvando || pessoas.isLoading || pessoas.isError}
          onClick={async () => {
            setSalvando(true);
            try {
              await onSalvar(
                id || null,
                pessoas.data?.find((p) => p.id === id)?.nome ?? pendencia.responsavelNome ?? null,
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
