// Ata da reunião semanal (SPEC §8: textos no core). A pauta de cada obra tem
// quatro perguntas (decisão do usuário, 29/10/2026): cobrança da reunião
// anterior, o que estava previsto na semana passada (TERMINAR ou COMEÇAR), o que
// vem nesta semana (atividades e providências) e o fechamento. Cada resposta fica
// gravada (reuniao_resposta) e decide em que bloco o item sai na ata. Datas
// chegam já formatadas pela UI. Sem emoji; *negrito* do WhatsApp.
import type { DataISO } from './calendar';

/** Onde o item está na pauta (uma atividade pode estar em duas seções). */
export type SecaoResposta =
  | 'cobranca'
  | 'passada_concluir'
  | 'passada_comecar'
  | 'semana_concluir'
  | 'semana_comecar'
  | 'semana_providencia';

export type RespostaReuniao =
  | 'feita'
  | 'nao_feita'
  | 'terminou'
  | 'nao_terminou'
  | 'comecou'
  | 'nao_comecou'
  | 'segue'
  | 'acao'
  | 'ja_providenciado';

/** Os dois botões de cada seção: o primeiro não pede ação; o segundo pede quem e até quando. */
export const RESPOSTAS_POR_SECAO: Record<
  SecaoResposta,
  readonly [RespostaReuniao, RespostaReuniao]
> = {
  cobranca: ['feita', 'nao_feita'],
  passada_concluir: ['terminou', 'nao_terminou'],
  passada_comecar: ['comecou', 'nao_comecou'],
  semana_concluir: ['segue', 'acao'],
  semana_comecar: ['segue', 'acao'],
  semana_providencia: ['ja_providenciado', 'acao'],
};

export const ROTULO_RESPOSTA: Record<RespostaReuniao, string> = {
  feita: 'Feita',
  nao_feita: 'Não feita',
  terminou: 'Terminou',
  nao_terminou: 'Não terminou',
  comecou: 'Começou',
  nao_comecou: 'Não começou',
  segue: 'Segue o plano',
  acao: 'Precisa de ação',
  ja_providenciado: 'Já providenciado',
};

/** Etiqueta do card na pauta. */
export const ETIQUETA_SECAO: Record<Exclude<SecaoResposta, 'cobranca'>, string> = {
  passada_concluir: 'TERMINAR',
  passada_comecar: 'COMEÇAR',
  semana_concluir: 'TERMINAR',
  semana_comecar: 'COMEÇAR',
  semana_providencia: 'PROVIDENCIAR',
};

/** A resposta pede uma ação com responsável e prazo. */
export function respostaPedeAcao(r: RespostaReuniao): boolean {
  return r === 'nao_feita' || r === 'nao_terminou' || r === 'nao_comecou' || r === 'acao';
}

/**
 * Resposta que vale para o item: a gravada na reunião ou, sem ela, o que o app
 * já sabe (atividade concluída terminou e começou; com avanço, começou).
 */
export function respostaEfetiva(
  secao: SecaoResposta,
  gravada: RespostaReuniao | null | undefined,
  noApp: { concluida?: boolean; avancoPct?: number } = {},
): RespostaReuniao | null {
  if (gravada) return gravada;
  if (secao === 'passada_concluir' && noApp.concluida) return 'terminou';
  if (secao === 'passada_comecar' && (noApp.concluida || (noApp.avancoPct ?? 0) > 0))
    return 'comecou';
  return null;
}

/** "Na ata: …" — para onde o item vai depois de respondido. */
export function destinoNaAta(
  secao: SecaoResposta,
  resposta: RespostaReuniao,
  quem?: string | null,
): string {
  const deQuem = quem ? ` (${quem})` : '';
  if (secao === 'cobranca') {
    return resposta === 'feita' ? 'Cobrança · cumprida' : 'Cobrança · não cumprida, remarcada';
  }
  if (secao === 'passada_concluir' || secao === 'passada_comecar') {
    return respostaPedeAcao(resposta)
      ? `Planejado e não aconteceu · Quem faz o quê${deQuem}`
      : 'Planejado e aconteceu';
  }
  if (secao === 'semana_providencia') {
    return resposta === 'ja_providenciado'
      ? 'Providências · já providenciado'
      : `Providências · com ação${deQuem}`;
  }
  return resposta === 'segue'
    ? 'Próxima semana · segue o plano'
    : `Próxima semana · com ação${deQuem}`;
}

/** Quantos itens da obra já têm resposta (contador da pauta e ✓ no chip da obra). */
export function contarRespondidos(respostas: (RespostaReuniao | null)[]): {
  respondidos: number;
  total: number;
} {
  return { respondidos: respostas.filter(Boolean).length, total: respostas.length };
}

// ---------- Montagem da ata ----------

const VERBO_PROVIDENCIA: Record<string, string> = {
  contratacao: 'Contratar',
  locacao: 'Alugar',
  compra: 'Comprar',
};

export interface ItemPautaAta {
  id: string;
  nome: string;
  secao: Exclude<SecaoResposta, 'cobranca'>;
  /** Resposta efetiva (ver respostaEfetiva); null = sem resposta. */
  resposta: RespostaReuniao | null;
  avancoPct?: number;
  prestador?: string | null;
  tipoProvidencia?: 'contratacao' | 'locacao' | 'compra';
  naObraEmFmt?: string | null;
}

/** Ação (tarefa) criada nesta reunião, ligada ou não a um item da pauta. */
export interface AcaoAtaEntrada {
  vinculoId: string | null;
  /** Seção da pauta a que a ação responde (a mesma atividade pode estar em duas). */
  secao?: SecaoResposta | null;
  texto: string;
  pessoa: string;
  prazoFmt: string | null;
}

/** Ação de reunião anterior, cobrada nesta. */
export interface CobrancaAtaEntrada {
  texto: string;
  pessoa: string;
  feita: boolean;
  atrasada: boolean;
  prazoFmt: string | null;
  replanejamentos: number;
  avancoPct: number;
}

export interface ObraAtaEntrada {
  nome: string;
  /** "47% · atrasada 3 dias". */
  indicador: string;
  atrasada: boolean;
  /** "Fase 3 · Fechamentos · previsto 52% · inauguração seg 21/12". */
  situacao: string;
  itens: ItemPautaAta[];
  acoes: AcaoAtaEntrada[];
  cobranca: CobrancaAtaEntrada[];
  observacoes: string;
}

/** Uma linha da ata: o item e, quando houver, a ação "texto — pessoa, até data". */
export interface LinhaAta {
  texto: string;
  acao: string | null;
  /** Vermelho (atraso): não aconteceu, cobrança vencida. */
  atraso: boolean;
  /** ✗ (planejado e não aconteceu). Cobrança vencida é atraso, mas não ✗. */
  nao: boolean;
  /** ✓ (aconteceu, cumprida, segue o plano, já providenciado). */
  ok: boolean;
  semResposta: boolean;
}

export interface ObraAta {
  nome: string;
  indicador: string;
  atrasada: boolean;
  situacao: string;
  aconteceu: LinhaAta[];
  naoAconteceu: LinhaAta[];
  proximaSemana: LinhaAta[];
  /** Contratar, alugar, comprar e as ações avulsas da obra. */
  providencias: LinhaAta[];
  cobranca: LinhaAta[];
  observacoes: string;
}

export function textoAcao(a: Pick<AcaoAtaEntrada, 'texto' | 'pessoa' | 'prazoFmt'>): string {
  return `${a.texto} — ${a.pessoa}, até ${a.prazoFmt ?? '—'}`;
}

const linha = (texto: string, p: Partial<LinhaAta> = {}): LinhaAta => ({
  texto,
  acao: p.acao ?? null,
  atraso: p.atraso ?? false,
  nao: p.nao ?? false,
  ok: p.ok ?? false,
  semResposta: p.semResposta ?? false,
});

/** Monta os blocos de uma obra na ata a partir das respostas da pauta. */
export function montarObraAta(e: ObraAtaEntrada): ObraAta {
  const ids = new Set(e.itens.map((i) => i.id));
  const acaoDe = (id: string, secao: SecaoResposta) => {
    const a = e.acoes.find((x) => x.vinculoId === id && (!x.secao || x.secao === secao));
    return a ? textoAcao(a) : null;
  };
  const aconteceu: LinhaAta[] = [];
  const naoAconteceu: LinhaAta[] = [];
  const proximaSemana: LinhaAta[] = [];
  const providencias: LinhaAta[] = [];

  for (const it of e.itens) {
    const r = it.resposta;
    if (it.secao === 'passada_concluir' || it.secao === 'passada_comecar') {
      const comecar = it.secao === 'passada_comecar';
      if (!r) {
        naoAconteceu.push(linha(`${it.nome} · sem resposta`, { semResposta: true }));
      } else if (respostaPedeAcao(r)) {
        const p = it.avancoPct ?? 0;
        const estado = comecar
          ? 'não começou'
          : p > 0 && p < 100
            ? `está em ${p}%`
            : 'não terminou';
        naoAconteceu.push(
          linha(`${it.nome} · ${estado}`, {
            acao: acaoDe(it.id, it.secao),
            atraso: true,
            nao: true,
          }),
        );
      } else {
        aconteceu.push(linha(comecar ? `${it.nome} · começou` : it.nome, { ok: true }));
      }
      continue;
    }
    if (it.secao === 'semana_providencia') {
      const naObra = it.naObraEmFmt ? ` (na obra ${it.naObraEmFmt})` : '';
      const base = `${VERBO_PROVIDENCIA[it.tipoProvidencia ?? 'compra']} ${it.nome}${naObra}`;
      if (!r) providencias.push(linha(`${base} · sem resposta`, { semResposta: true }));
      else if (r === 'ja_providenciado')
        providencias.push(linha(`${base} · já providenciado`, { ok: true }));
      else providencias.push(linha(base, { acao: acaoDe(it.id, it.secao) }));
      continue;
    }
    const verbo = it.secao === 'semana_concluir' ? 'Terminar' : 'Começar';
    const base = `${verbo} ${it.nome}`;
    if (!r) proximaSemana.push(linha(`${base} · sem resposta`, { semResposta: true }));
    else if (r === 'segue')
      proximaSemana.push(
        linha(`${base} · segue o plano${it.prestador ? ` (${it.prestador})` : ''}`, { ok: true }),
      );
    else proximaSemana.push(linha(base, { acao: acaoDe(it.id, it.secao) }));
  }

  // Ações avulsas (sem item da pauta): entram em Providências.
  for (const a of e.acoes) {
    if (a.vinculoId && ids.has(a.vinculoId)) continue;
    providencias.push(linha(textoAcao(a)));
  }

  const cobranca = e.cobranca.map((c) => {
    if (c.feita) return linha(`${c.texto} — ${c.pessoa}`, { ok: true });
    const partes = [`${c.texto} — ${c.pessoa}`];
    if (c.avancoPct > 0 && c.avancoPct < 100) partes.push(`${c.avancoPct}% feito`);
    partes.push(
      c.replanejamentos > 0
        ? `remarcada (${c.replanejamentos}x), até ${c.prazoFmt ?? '—'}`
        : `até ${c.prazoFmt ?? '—'}`,
    );
    return linha(partes.join(' · '), { atraso: c.atrasada });
  });

  return {
    nome: e.nome,
    indicador: e.indicador,
    atrasada: e.atrasada,
    situacao: e.situacao,
    aconteceu,
    naoAconteceu,
    proximaSemana,
    providencias,
    cobranca,
    observacoes: e.observacoes.trim(),
  };
}

export interface TotaisAta {
  aconteceram: number;
  naoAconteceram: number;
  semResposta: number;
  acoesNovas: number;
  cobrancaCumprida: number;
  cobrancaTotal: number;
}

/** Números do topo da ata e do resumo em tabela. */
export function totaisAta(entradas: ObraAtaEntrada[], obras: ObraAta[]): TotaisAta {
  const todas = obras.flatMap((o) => [...o.naoAconteceu, ...o.proximaSemana, ...o.providencias]);
  return {
    aconteceram: obras.reduce((s, o) => s + o.aconteceu.length, 0),
    naoAconteceram: obras.reduce(
      (s, o) => s + o.naoAconteceu.filter((l) => !l.semResposta).length,
      0,
    ),
    semResposta: todas.filter((l) => l.semResposta).length,
    acoesNovas: entradas.reduce((s, e) => s + e.acoes.length, 0),
    cobrancaCumprida: obras.reduce((s, o) => s + o.cobranca.filter((l) => l.ok).length, 0),
    cobrancaTotal: obras.reduce((s, o) => s + o.cobranca.length, 0),
  };
}

export function textosTotais(t: TotaisAta): string[] {
  const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const out = [
    pl(t.aconteceram, 'aconteceu', 'aconteceram'),
    pl(t.naoAconteceram, 'não aconteceu', 'não aconteceram'),
    pl(t.acoesNovas, 'ação nova', 'ações novas'),
  ];
  if (t.cobrancaTotal > 0) out.push(`cobrança ${t.cobrancaCumprida} de ${t.cobrancaTotal}`);
  if (t.semResposta > 0) out.push(pl(t.semResposta, 'sem resposta', 'sem resposta'));
  return out;
}

/** "Quem faz o quê" já formatado: por pessoa, "qua 04/11 · Concluir contrapiso (CDC Ressaca)". */
export interface PessoaAta {
  pessoa: string;
  itens: { texto: string; atrasado: boolean }[];
}

/** Monta o texto da ata (WhatsApp) a partir das obras já montadas. */
export function textoAtaWhatsapp(
  dataFmt: string,
  horaFmt: string,
  obras: ObraAta[],
  pessoas: PessoaAta[] = [],
): string {
  const L: string[] = [];
  const itens = (ls: LinhaAta[]) =>
    ls.map((l) => (l.acao ? `${l.texto} → ${l.acao}` : l.texto)).join('; ');
  L.push('*CONTRO · Ata da semana*');
  L.push(`${dataFmt} · ${horaFmt}`);
  L.push(`${obras.length} ${obras.length === 1 ? 'obra' : 'obras'}`);

  for (const o of obras) {
    L.push('');
    L.push(`*${o.nome}* — ${o.indicador}`);
    if (o.aconteceu.length) L.push(`Aconteceu: ${itens(o.aconteceu)}`);
    if (o.naoAconteceu.length) L.push(`Não aconteceu: ${itens(o.naoAconteceu)}`);
    if (o.proximaSemana.length) L.push(`Próxima semana: ${itens(o.proximaSemana)}`);
    if (o.providencias.length) L.push(`Providências: ${itens(o.providencias)}`);
    if (o.cobranca.length)
      L.push(
        `Cobrança: ${o.cobranca.map((l) => (l.ok ? `${l.texto} (cumprida)` : l.texto)).join('; ')}`,
      );
    if (o.observacoes) L.push(`Obs: ${o.observacoes}`);
  }

  if (pessoas.length) {
    L.push('');
    L.push('*Quem faz o quê*');
    for (const p of pessoas) L.push(`${p.pessoa}: ${p.itens.map((i) => i.texto).join('; ')}`);
  }

  L.push('');
  L.push('Ata completa (PDF) no app CONTRO.');
  return L.join('\n');
}

// ---------- Origem e cobrança ----------

/** Providência registrada em reunião (tarefa com origem "Reunião dd/mm"). */
export interface ProvidenciaReuniao {
  origem: string | null;
  concluida: boolean;
  atrasada: boolean;
}

/** Origem gravada nas providências criadas numa reunião ("Reunião seg 26/10"). */
export function origemReuniao(dataFmt: string): string {
  return `Reunião ${dataFmt}`;
}

/** É uma providência de reunião anterior: veio de reunião, mas não da atual. */
export function deReuniaoAnterior(
  p: Pick<ProvidenciaReuniao, 'origem'>,
  origemAtual: string,
): boolean {
  return Boolean(p.origem?.startsWith('Reunião ')) && p.origem !== origemAtual;
}

/**
 * Cobrança da reunião: ações de reuniões anteriores que ainda estão abertas ou
 * que foram feitas desde a reunião passada (7 dias antes). As feitas há mais
 * tempo já foram cobradas e não voltam.
 */
export function entraNaCobranca(
  t: { origem: string | null; concluido: boolean; feitaEm: string | null },
  origemAtual: string,
  dataReuniao: DataISO,
): boolean {
  if (!deReuniaoAnterior(t, origemAtual)) return false;
  if (!t.concluido) return true;
  if (!t.feitaEm) return false;
  const d = new Date(`${dataReuniao}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  // Feita no dia da reunião passada já foi cobrada lá.
  return t.feitaEm.slice(0, 10) > d.toISOString().slice(0, 10);
}

/**
 * Indicadores do topo da reunião e da ata (protótipo): providências de reuniões
 * anteriores cumpridas e atrasadas, e as novas registradas nesta reunião.
 */
export function resumoReuniao(
  providencias: ProvidenciaReuniao[],
  origemAtual: string,
): { cumpridas: number; atrasadas: number; novas: number } {
  const anteriores = providencias.filter((p) => deReuniaoAnterior(p, origemAtual));
  return {
    cumpridas: anteriores.filter((p) => p.concluida).length,
    atrasadas: anteriores.filter((p) => p.atrasada).length,
    novas: providencias.filter((p) => p.origem === origemAtual).length,
  };
}
