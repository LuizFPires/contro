// Check-in por obra: leitura (check-ins com fotos, frequências e pessoas) e as
// operações de campo (otimistas, pela fila offline em lib/sync.ts).
import { useQuery } from '@tanstack/react-query';
import {
  type FrequenciaCheckin,
  type MudancaFrequencia,
  type PresencaObraEntrada,
  type SituacaoLocal,
  type ValidacaoCheckin,
  checkinValido,
} from '@contro/core';
import { supabase } from '../../lib/supabase';

export interface FotoCheckin {
  fotoId: string;
  ordem: number;
  tiradaEm: string;
  url: string | null;
  /** Foto ainda no aparelho (check-in não sincronizado). */
  localUrl?: string;
}

export interface Checkin {
  id: string;
  obraId: string;
  pessoaId: string;
  pessoaNome: string;
  papel: string;
  feitoEm: string;
  dia: string;
  enviadoDepois: boolean;
  ajusteRelogioS: number;
  situacao: SituacaoLocal;
  distanciaM: number | null;
  observacao: string | null;
  validacao: ValidacaoCheckin;
  validadoPorNome: string | null;
  fotos: FotoCheckin[];
  /** Ainda na fila do aparelho. */
  pendente?: boolean;
}

export interface PessoaFrequencia {
  pessoaId: string;
  nome: string;
  papel: string;
  frequencias: MudancaFrequencia[];
}

export interface DadosCheckin {
  checkins: Checkin[];
  pessoas: PessoaFrequencia[];
  ponto: { lat: number; lng: number } | null;
}

export const PAPEL: Record<string, string> = {
  gestor: 'Gestor',
  equipe: 'Equipe',
  administrador: 'Gestor',
  coordenador: 'Coordenador',
  membro: 'Equipe',
};

interface LinhaCheckin {
  id: string;
  obra_id: string;
  pessoa_id: string;
  feito_em: string;
  dia: string;
  enviado_depois: boolean;
  ajuste_relogio_s: number;
  situacao: SituacaoLocal;
  distancia_m: number | null;
  observacao: string | null;
  validacao: ValidacaoCheckin;
  pessoa: { nome: string; perfil: string; coordenador_contorno: boolean | null } | null;
  validador: { nome: string } | null;
  fotos: {
    foto_id: string;
    ordem: number;
    tirada_em: string;
    foto: { storage_path: string } | null;
  }[];
}

const papelDe = (p: LinhaCheckin['pessoa']) =>
  p?.coordenador_contorno ? 'Coordenador' : (PAPEL[p?.perfil ?? ''] ?? 'Equipe');

/** Check-ins da obra (últimos 60 dias), frequências e as pessoas da Contorno. */
export async function carregarCheckins(obraId: string): Promise<DadosCheckin> {
  if (!supabase) return { checkins: [], pessoas: [], ponto: null };
  const desde = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const [cRes, fRes, pRes, oRes] = await Promise.all([
    supabase
      .from('obra_checkin')
      .select(
        'id,obra_id,pessoa_id,feito_em,dia,enviado_depois,ajuste_relogio_s,situacao,distancia_m,observacao,validacao,' +
          'pessoa:pessoa!pessoa_id(nome,perfil,coordenador_contorno),validador:pessoa!validado_por(nome),' +
          'fotos:obra_checkin_foto(foto_id,ordem,tirada_em,foto(storage_path))',
      )
      .eq('obra_id', obraId)
      .is('deleted_at', null)
      .gte('dia', desde)
      .order('feito_em', { ascending: false }),
    supabase
      .from('obra_checkin_frequencia')
      .select('pessoa_id,desde,frequencia')
      .eq('obra_id', obraId)
      .order('desde'),
    supabase
      .from('pessoa')
      .select('id,nome,perfil,coordenador_contorno')
      .eq('ativo', true)
      .eq('acesso_contorno', true)
      .is('deleted_at', null)
      .order('nome'),
    supabase.from('obra').select('checkin_lat,checkin_lng').eq('id', obraId).maybeSingle(),
  ]);
  const erro = cRes.error ?? fRes.error ?? pRes.error ?? oRes.error;
  if (erro) throw erro;
  const linhas = (cRes.data ?? []) as unknown as LinhaCheckin[];

  const caminhos = new Set<string>();
  for (const l of linhas)
    for (const f of l.fotos) if (f.foto?.storage_path) caminhos.add(f.foto.storage_path);
  const url = new Map<string, string>();
  if (caminhos.size) {
    const { data } = await supabase.storage.from('fotos').createSignedUrls([...caminhos], 3600);
    for (const a of data ?? []) if (a.signedUrl && a.path) url.set(a.path, a.signedUrl);
  }

  const freq = (fRes.data ?? []) as {
    pessoa_id: string;
    desde: string;
    frequencia: FrequenciaCheckin;
  }[];
  const pessoas = (
    (pRes.data ?? []) as {
      id: string;
      nome: string;
      perfil: string;
      coordenador_contorno: boolean | null;
    }[]
  ).map((p) => ({
    pessoaId: p.id,
    nome: p.nome,
    papel: papelDe(p),
    frequencias: freq
      .filter((f) => f.pessoa_id === p.id)
      .map((f) => ({ desde: f.desde, frequencia: f.frequencia })),
  }));
  const o = oRes.data as { checkin_lat: number | null; checkin_lng: number | null } | null;

  return {
    ponto:
      o?.checkin_lat != null && o.checkin_lng != null
        ? { lat: o.checkin_lat, lng: o.checkin_lng }
        : null,
    pessoas,
    checkins: linhas.map((l) => ({
      id: l.id,
      obraId: l.obra_id,
      pessoaId: l.pessoa_id,
      pessoaNome: l.pessoa?.nome ?? 'Sem nome',
      papel: papelDe(l.pessoa),
      feitoEm: l.feito_em,
      dia: l.dia,
      enviadoDepois: l.enviado_depois,
      ajusteRelogioS: l.ajuste_relogio_s,
      situacao: l.situacao,
      distanciaM: l.distancia_m,
      observacao: l.observacao,
      validacao: l.validacao,
      validadoPorNome: l.validador?.nome ?? null,
      fotos: [...l.fotos]
        .sort((a, b) => a.ordem - b.ordem)
        .map((f) => ({
          fotoId: f.foto_id,
          ordem: f.ordem,
          tiradaEm: f.tirada_em,
          url: f.foto?.storage_path ? (url.get(f.foto.storage_path) ?? null) : null,
        })),
    })),
  };
}

export const chaveCheckins = (obraId: string) => ['checkins', obraId] as const;

export function useCheckins(obraId: string) {
  return useQuery({
    queryKey: chaveCheckins(obraId),
    queryFn: () => carregarCheckins(obraId),
    staleTime: 30_000,
  });
}

/** Presenças de todas as obras da Contorno (Score), numa ida. */
export async function carregarPresencas(): Promise<PresencaObraEntrada[]> {
  if (!supabase) return [];
  const desde = new Date(Date.now() - 100 * 86_400_000).toISOString().slice(0, 10);
  const emb = 'o:obra!inner(nome,ambiente,deleted_at)';
  const [cRes, fRes] = await Promise.all([
    supabase
      .from('obra_checkin')
      .select(`obra_id,pessoa_id,dia,situacao,validacao,${emb}`)
      .eq('o.ambiente', 'contorno')
      .is('o.deleted_at', null)
      .is('deleted_at', null)
      .gte('dia', desde),
    supabase
      .from('obra_checkin_frequencia')
      .select(`obra_id,pessoa_id,desde,frequencia,${emb}`)
      .eq('o.ambiente', 'contorno')
      .is('o.deleted_at', null),
  ]);
  const erro = cRes.error ?? fRes.error;
  if (erro) throw erro;
  type L = { obra_id: string; pessoa_id: string; o: { nome: string } };
  const mapa = new Map<string, PresencaObraEntrada>();
  const entrada = (l: L) => {
    const k = `${l.pessoa_id}|${l.obra_id}`;
    let e = mapa.get(k);
    if (!e) {
      e = {
        chavePessoa: l.pessoa_id,
        obraId: l.obra_id,
        obraNome: l.o.nome,
        frequencias: [],
        dias: [],
      };
      mapa.set(k, e);
    }
    return e;
  };
  for (const f of (fRes.data ?? []) as unknown as (L & {
    desde: string;
    frequencia: FrequenciaCheckin;
  })[])
    entrada(f).frequencias.push({ desde: f.desde, frequencia: f.frequencia });
  for (const c of (cRes.data ?? []) as unknown as (L & {
    dia: string;
    situacao: SituacaoLocal;
    validacao: ValidacaoCheckin;
  })[]) {
    // Só conta o check-in válido (na obra, ou fora/sem local validado pelo Gestor).
    if (checkinValido(c)) entrada(c).dias.push(c.dia);
  }
  // Só interessa quem tem frequência definida nesta obra.
  return [...mapa.values()].filter((e) => e.frequencias.length);
}

export function usePresencas(ativo: boolean) {
  return useQuery({
    queryKey: ['presencas-checkin'],
    queryFn: carregarPresencas,
    enabled: ativo,
    staleTime: 60_000,
  });
}
