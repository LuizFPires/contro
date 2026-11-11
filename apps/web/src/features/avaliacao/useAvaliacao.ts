import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemCongelado, topoFila, type ItemAvaliacao } from '@contro/core';
import { supabase } from '../../lib/supabase';
import { enfileirar } from '../../lib/sync';
import { guardarFotoLocal } from '../obras/foto';
import type { PendenciaObra } from '../obras/pendenciasObra';
import { pendenciaOtimista, useObraPendencias } from '../obras/useObraPendencias';
import {
  abrirRevisao,
  fecharRevisao,
  lancarOficial,
  loadAvaliacao,
  reabrirRevisao,
  type DadosAvaliacao,
  type LinhaItem,
  type LinhaRevisao,
} from './avaliacaoApi';

export interface ItemTela extends ItemAvaliacao {
  pendenciaId: string | null;
  criticidade: string | null;
  /** Pendência ligada sem a foto do antes (o Não grava na hora; a foto vem depois). */
  faltaFotoAntes: boolean;
}

export interface RevisaoTela {
  id: string;
  numero: number;
  aberta: boolean;
  /** Data em que fechou ou, aberta, em que começou (AAAA-MM-DD, fuso do Brasil). */
  data: string;
  /** Quem fechou ou, aberta, quem abriu. */
  quem: string | null;
  itens: ItemTela[];
  /** Itens com a situação de hoje no Check list (base da próxima revisão). */
  itensAgora: ItemTela[];
}

function dataBrasil(ts: string): string {
  return new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function paraTela(l: LinhaItem, pend: PendenciaObra | undefined, status: string | null): ItemTela {
  return {
    id: l.id,
    modeloItemId: l.modelo_item_id,
    secaoOrdem: l.secao_ordem,
    secao: l.secao,
    ordem: l.ordem,
    codigo: l.codigo,
    nome: l.nome,
    pontos: l.pontos,
    resultado: l.resultado,
    reconfirmar: l.reconfirmar,
    pendenciaStatus: status,
    pendenciaId: l.pendencia_id,
    criticidade: pend?.criticidade ?? null,
    faltaFotoAntes: pend?.temFotoAntes === false,
  };
}

function montarRevisao(
  r: LinhaRevisao,
  linhas: LinhaItem[],
  pendencias: Map<string, PendenciaObra>,
): RevisaoTela {
  const aberta = r.status === 'aberta';
  const agora = linhas.map((l) => {
    const p = l.pendencia_id ? pendencias.get(l.pendencia_id) : undefined;
    return paraTela(l, p, p?.status ?? null);
  });
  return {
    id: r.id,
    numero: r.numero,
    aberta,
    data: dataBrasil(r.fechada_em ?? r.created_at),
    quem: (aberta ? r.criador?.nome : r.fechador?.nome) ?? null,
    itens: aberta ? agora : agora.map(itemCongelado),
    itensAgora: agora,
  };
}

type Dados = {
  titulo: string | null;
  local: string | null;
  criticidade: 'alta' | 'media' | 'baixa';
};

export function useAvaliacao(obraId: string) {
  const qc = useQueryClient();
  const pendencias = useObraPendencias(obraId);
  const chave = useMemo(() => ['avaliacao', obraId], [obraId]);
  const chavePend = useMemo(() => ['pendencias', obraId], [obraId]);
  const query = useQuery({
    queryKey: chave,
    enabled: Boolean(supabase) && Boolean(obraId),
    queryFn: () => loadAvaliacao(obraId),
  });

  const listaPend = pendencias.query.data;
  const revisoes = useMemo<RevisaoTela[]>(() => {
    if (!query.data) return [];
    const mapa = new Map((listaPend ?? []).map((p) => [p.id, p]));
    const porRevisao = new Map<string, LinhaItem[]>();
    for (const l of query.data.itens) {
      const g = porRevisao.get(l.revisao_id);
      if (g) g.push(l);
      else porRevisao.set(l.revisao_id, [l]);
    }
    return query.data.revisoes.map((r) => montarRevisao(r, porRevisao.get(r.id) ?? [], mapa));
  }, [query.data, listaPend]);

  // Patch otimista nos dois caches (item da revisão e pendência do Check list).
  const aplicar = async (
    itemId: string,
    troca: (l: LinhaItem) => LinhaItem,
    trocaPend?: (l: PendenciaObra[]) => PendenciaObra[],
  ) => {
    await Promise.all([
      qc.cancelQueries({ queryKey: chave }),
      qc.cancelQueries({ queryKey: chavePend }),
    ]);
    const prev = qc.getQueryData<DadosAvaliacao>(chave);
    const prevPend = qc.getQueryData<PendenciaObra[]>(chavePend);
    if (prev) {
      qc.setQueryData<DadosAvaliacao>(chave, {
        ...prev,
        itens: prev.itens.map((l) => (l.id === itemId ? troca(l) : l)),
      });
    }
    if (prevPend && trocaPend) qc.setQueryData(chavePend, trocaPend(prevPend));
    return { prev, prevPend };
  };
  const reverter = (ctx?: { prev?: DadosAvaliacao; prevPend?: PendenciaObra[] }) => {
    if (ctx?.prev) qc.setQueryData(chave, ctx.prev);
    if (ctx?.prevPend) qc.setQueryData(chavePend, ctx.prevPend);
  };

  const marcar = useMutation({
    networkMode: 'always',
    mutationFn: (v: { item: ItemTela; resultado: 'conforme' | null }) =>
      enfileirar('marcar_avaliacao_item', { obraId, itemId: v.item.id, resultado: v.resultado }),
    onMutate: (v: { item: ItemTela; resultado: 'conforme' | null }) => {
      const retira = v.item.pendenciaId && v.item.pendenciaStatus !== 'fechada';
      return aplicar(
        v.item.id,
        (l) => ({
          ...l,
          resultado: v.resultado,
          reconfirmar: l.reconfirmar && v.resultado === null,
          pendencia_id: retira ? null : l.pendencia_id,
        }),
        retira ? (ps) => ps.filter((p) => p.id !== v.item.pendenciaId) : undefined,
      );
    },
    onError: (_e, _v, ctx) => reverter(ctx),
  });

  type NcVars = { item: ItemTela; file: File | null; dados: Dados; pendenciaId?: string };
  const marcarNaoConforme = useMutation({
    networkMode: 'always',
    mutationFn: async (v: NcVars) => {
      const fotoLocalId = v.file ? await guardarFotoLocal(obraId, v.file) : null;
      await enfileirar('avaliacao_nao_conforme', {
        obraId,
        itemId: v.item.id,
        pendenciaId: v.pendenciaId,
        dados: v.dados,
        fotoLocalId,
      });
    },
    onMutate: (v: NcVars) => {
      const existente = v.item.pendenciaStatus === 'fechada' ? v.item.pendenciaId : null;
      const id = existente ?? v.pendenciaId ?? crypto.randomUUID();
      v.pendenciaId = id;
      return aplicar(
        v.item.id,
        (l) => ({ ...l, resultado: 'nao_conforme', reconfirmar: false, pendencia_id: id }),
        (ps) =>
          existente
            ? ps.map((p) => (p.id === existente ? { ...p, status: 'aberta' } : p))
            : [
                ...ps,
                pendenciaOtimista(
                  obraId,
                  id,
                  {
                    titulo: v.dados.titulo?.trim() || v.item.nome,
                    local: v.dados.local || v.item.secao,
                    criticidade: v.dados.criticidade,
                    atividadeId: null,
                  },
                  topoFila(ps.map((p) => p.ordem_fila)),
                  Boolean(v.file),
                ),
              ],
      );
    },
    onError: (_e, _v, ctx) => reverter(ctx),
  });

  /** Desfazer de tirar o "Não": a tela guarda a pendência que saiu do Check list. */
  const restaurar = useMutation({
    networkMode: 'always',
    mutationFn: (v: { itemId: string; pendencia: PendenciaObra }) =>
      enfileirar('restaurar_nc_avaliacao', {
        obraId,
        itemId: v.itemId,
        pendenciaId: v.pendencia.id,
      }),
    onMutate: (v: { itemId: string; pendencia: PendenciaObra }) =>
      aplicar(
        v.itemId,
        (l) => ({ ...l, resultado: 'nao_conforme', pendencia_id: v.pendencia.id }),
        (ps) => [...ps.filter((p) => p.id !== v.pendencia.id), v.pendencia],
      ),
    onError: (_e, _v, ctx) => reverter(ctx),
  });

  const atualizar = () => qc.invalidateQueries({ queryKey: chave });
  // Precisam de conexão: sem sinal, falham na hora (não ficam pausadas para depois).
  const abrir = useMutation({
    networkMode: 'always',
    mutationFn: (refazer: boolean) => abrirRevisao(obraId, refazer),
    onSuccess: atualizar,
  });
  const fechar = useMutation({
    networkMode: 'always',
    mutationFn: fecharRevisao,
    onSuccess: atualizar,
  });
  const reabrir = useMutation({
    networkMode: 'always',
    mutationFn: reabrirRevisao,
    onSuccess: atualizar,
  });
  const oficial = useMutation({
    networkMode: 'always',
    mutationFn: (v: { data: string; pontos: number; total: number }) => lancarOficial(obraId, v),
    onSuccess: atualizar,
  });

  return {
    revisoes,
    oficial: query.data?.oficial ?? null,
    carregando: query.isLoading || pendencias.query.isLoading,
    // Sem sinal e sem nada guardado: não dá para dizer que nunca houve avaliação.
    semConexao: query.data === undefined && query.fetchStatus === 'paused',
    erro: query.isError,
    pendencias: listaPend ?? [],
    marcar,
    marcarNaoConforme,
    // Detalhes da pendência criada pelo Não (texto, criticidade, foto do antes).
    editarPendencia: pendencias.editar,
    anexarFotoAntes: pendencias.anexarFotoAntes,
    restaurar,
    abrir,
    fechar,
    reabrir,
    lancar: oficial,
  };
}
