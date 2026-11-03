import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@contro/ui';
import { supabase } from '../../lib/supabase';
import { formatarDataCurta } from '../../lib/datas';
import { CampoPrestador } from './CampoPrestador';
import { carregarPropostas, type PropostaMapa } from './propostasMapaApi';
import styles from './PropostasMapa.module.css';

export function PropostasMapa({ obraId, atividadeId }: { obraId: string; atividadeId: string }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [form, setForm] = useState<{
    id: string;
    contratado: string;
    descricao: string;
    prazo: string;
  } | null>(null);
  const [excluir, setExcluir] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['propostas-mapa', obraId],
    queryFn: () => carregarPropostas([obraId]),
  });
  const salvar = useMutation({
    mutationFn: async (v: { id: string; novo?: boolean; patch: Record<string, unknown> }) => {
      if (!supabase) throw new Error('Sem conexão');
      const { error } = v.novo
        ? await supabase
            .from('mapa_proposta')
            .insert({ id: v.id, obra_id: obraId, atividade_id: atividadeId, ...v.patch })
        : await supabase
            .from('mapa_proposta')
            .update(v.patch)
            .eq('id', v.id)
            .eq('atividade_id', atividadeId);
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(null);
      setExcluir(null);
      void qc.invalidateQueries({ queryKey: ['propostas-mapa', obraId] });
      void qc.invalidateQueries({ queryKey: ['reuniao'] });
      void qc.invalidateQueries({ queryKey: ['sugestao', 'prestador'] });
      showToast({ message: 'Proposta atualizada' });
    },
    onError: () =>
      showToast({
        message: 'Não foi possível salvar a proposta. Confira a conexão e tente novamente.',
      }),
  });
  const itens = (query.data ?? []).filter((p) => p.atividade_id === atividadeId);
  const editar = (p: PropostaMapa) =>
    setForm({ id: p.id, contratado: p.contratado, descricao: p.descricao, prazo: p.prazo ?? '' });
  return (
    <section className={styles.secao}>
      <h3>Envio de propostas · {itens.filter((p) => !p.recebida).length} pendentes</h3>
      {query.isLoading ? <p>Carregando propostas…</p> : null}
      {query.isError ? (
        <button type="button" onClick={() => void query.refetch()}>
          Não foi possível carregar. Tentar novamente
        </button>
      ) : null}
      {itens.map((p) => (
        <div key={p.id} className={styles.item}>
          <strong>{p.contratado}</strong>
          <div>{p.descricao}</div>
          <small>
            {p.recebida
              ? p.solucionada_por_contratacao
                ? 'Solucionada · contratação definida'
                : 'Proposta recebida'
              : 'Aguardando proposta'}{' '}
            · {p.prazo ? `até ${formatarDataCurta(p.prazo)}` : 'Sem prazo informado'}
          </small>
          <div className={styles.acoes}>
            <button
              type="button"
              disabled={salvar.isPending}
              onClick={() =>
                salvar.mutate({
                  id: p.id,
                  patch: { recebida: !p.recebida, solucionada_por_contratacao: false },
                })
              }
            >
              {p.recebida ? 'Reabrir pendência' : 'Proposta recebida'}
            </button>
            <button type="button" disabled={salvar.isPending} onClick={() => editar(p)}>
              Editar
            </button>
            <button type="button" disabled={salvar.isPending} onClick={() => setExcluir(p.id)}>
              Excluir
            </button>
          </div>
          {excluir === p.id ? (
            <div role="group" aria-label="Confirmar exclusão">
              <p>Excluir esta pendência de proposta?</p>
              <button
                type="button"
                disabled={salvar.isPending}
                onClick={() =>
                  salvar.mutate({ id: p.id, patch: { deleted_at: new Date().toISOString() } })
                }
              >
                Confirmar exclusão
              </button>
              <button type="button" onClick={() => setExcluir(null)}>
                Cancelar
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {!form ? (
        <button
          type="button"
          onClick={() =>
            setForm({
              id: crypto.randomUUID(),
              contratado: '',
              descricao: 'Envio de proposta',
              prazo: '',
            })
          }
        >
          + Proposta pendente
        </button>
      ) : (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.contratado.trim() || !form.descricao.trim()) return;
            salvar.mutate({
              id: form.id,
              novo: !itens.some((p) => p.id === form.id),
              patch: {
                contratado: form.contratado,
                descricao: form.descricao,
                prazo: form.prazo || null,
              },
            });
          }}
        >
          <CampoPrestador
            key={form.id}
            atividadeId={`proposta-${form.id}`}
            valor={form.contratado}
            required
            rotulo="Provável contratado"
            placeholder="Nome do fornecedor ou prestador"
            onSalvar={(nome) => setForm((f) => (f ? { ...f, contratado: nome ?? '' } : f))}
            onTexto={(nome) => setForm((f) => (f ? { ...f, contratado: nome } : f))}
            onAutoSalvar={() => {}}
          />
          <label>
            Descrição
            <textarea
              required
              maxLength={2000}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </label>
          <label>
            Prazo de envio
            <input
              type="date"
              value={form.prazo}
              onChange={(e) => setForm({ ...form, prazo: e.target.value })}
            />
          </label>
          <div className={styles.acoes}>
            <button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : 'Salvar proposta'}
            </button>
            <button type="button" disabled={salvar.isPending} onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
