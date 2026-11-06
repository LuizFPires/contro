// Pauta e ata da reunião de uma obra geral (decisão 2): por datas, sem cronograma. A regra
// (quem entra em cada semana, cobrança, providência, para onde vai cada resposta) está no
// core; aqui só se junta o que veio do banco e se formatam as datas, como em
// reuniao/ataDados para a Contorno.
import {
  compilarPorPessoa,
  derivarAtribuicoes,
  eficienciaObraGeral,
  entraNaCobrancaGeral,
  filhosPorPai,
  montarObraAta,
  prazoAtividadeGeral,
  semanaDaReuniaoGeral,
  situacaoProvidenciaGeral,
  textoEficiencia,
  totaisAta,
  trilhaObraGeral,
  type AtividadeGeral,
  type DataISO,
  type ItemPautaAta,
  type ObraAtaEntrada,
  type PessoaAta,
  type RespostaReuniao,
} from '@contro/core';
import { formatarDataCurta } from '../../../lib/datas';
import { dataLocal } from '../../obras/api';
import {
  VERBO_PROV,
  acoesDaObra,
  origemDa,
  respostaCobranca,
  respostaDe,
  type AtaCompleta,
  type ItemPassadaPauta,
  type ItemSemanaPauta,
} from '../../reuniao/ataDados';
import type { TarefaAtrib } from '../../reuniao/reuniaoApi';
import type { ReuniaoGeral } from './reuniaoGeralApi';

export interface PautaGeral {
  /** Semana passada: concluídas (no prazo ou com atraso) e as abertas atrasadas. */
  passada: ItemPassadaPauta[];
  /** Esta semana: atividades abertas com prazo na semana e as providências. */
  semana: ItemSemanaPauta[];
  /** Tarefas abertas da obra (e as feitas desde a reunião anterior). */
  cobranca: TarefaAtrib[];
  /** Atividades abertas atrasadas (para o snapshot e o indicador). */
  atrasadas: number;
}

function sexta(dia: DataISO): DataISO {
  const d = new Date(`${dia}T12:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7) + 4);
  return d.toISOString().slice(0, 10);
}

/** Itens da pauta da obra geral na data da reunião. */
export function montarPautaGeral(r: ReuniaoGeral, hoje: DataISO): PautaGeral {
  const atividades = r.obra.atividades;
  const filhos = filhosPorPai(atividades);
  const prazoDe = (a: AtividadeGeral) => prazoAtividadeGeral(a, filhos.get(a.id) ?? []);
  const sem = semanaDaReuniaoGeral({ atividades, dataReuniao: r.data, hoje });

  const passadaItem = (a: AtividadeGeral): ItemPassadaPauta => ({
    atividadeId: a.id,
    nome: a.nome,
    tipo: 'concluir',
    data: prazoDe(a) ?? r.data,
    ok: a.concluida_em !== null,
    avancoPct: a.concluida_em !== null ? 100 : a.avanco_pct,
    liberada: true,
    motivo: null,
    secao: 'passada_concluir',
  });
  const passada = [...sem.passadaNoPrazo, ...sem.passadaComAtraso, ...sem.atrasadasAbertas].map(
    passadaItem,
  );

  const semana: ItemSemanaPauta[] = sem.daSemana
    .filter((a) => a.concluida_em === null)
    .map((a) => {
      const data = prazoDe(a) ?? r.data;
      return {
        id: a.id,
        secao: 'semana_concluir',
        vinculoTipo: 'atividade',
        nome: a.nome,
        sub: `data prevista ${formatarDataCurta(data)}`,
        prestador: a.prestador,
        atraso: null,
        sugestao: a.prestador
          ? `Confirmar com ${a.prestador} a conclusão`
          : `Garantir conclusão: ${a.nome}`,
        naObraEm: null,
        data,
      };
    });

  // Providências pendentes de atividades abertas: as atrasadas e as que vencem até a sexta.
  const ateSexta = sexta(r.data);
  const porId = new Map(atividades.map((a) => [a.id, a]));
  const provs = r.obra.providencias
    .map((p) => {
      const a = porId.get(p.atividade_id);
      if (!a || p.status !== 'pendente' || a.concluida_em !== null) return null;
      const s = situacaoProvidenciaGeral({
        status: p.status,
        atividadeConcluida: false,
        prazoAtividade: prazoDe(a),
        antecedenciaDu: p.antecedencia_du,
        hoje,
      });
      if (!s.ate || (!s.atrasada && s.ate > ateSexta)) return null;
      return { p, ate: s.ate, atrasada: s.atrasada };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((x, y) => Number(y.atrasada) - Number(x.atrasada) || x.ate.localeCompare(y.ate));
  for (const { p, ate, atrasada } of provs) {
    semana.push({
      id: p.id,
      secao: 'semana_providencia',
      vinculoTipo: 'providencia',
      nome: p.descricao,
      sub: atrasada
        ? 'era para já estar providenciado'
        : `providenciar até ${formatarDataCurta(ate)}`,
      prestador: null,
      atraso: atrasada ? `Atrasado · era até ${formatarDataCurta(ate)}` : null,
      sugestao: `${VERBO_PROV[p.tipo]} ${p.descricao}`,
      tipoProvidencia: p.tipo,
      naObraEm: p.na_obra_em,
      data: ate,
    });
  }

  const origem = origemDa(r);
  const cobranca = r.tarefas.filter((t) =>
    entraNaCobrancaGeral(
      {
        origem: t.origem,
        concluido: t.concluido,
        feitaEm: t.feitaEm ? dataLocal(t.feitaEm) : null,
      },
      origem,
      r.data,
    ),
  );

  return { passada, semana, cobranca, atrasadas: sem.atrasadasAbertas.length };
}

/** Resposta de um item da semana passada (o app já sabe das concluídas). */
export const respostaPassada = (r: ReuniaoGeral, it: ItemPassadaPauta) =>
  respostaDe(r, it.secao, it.atividadeId, { concluida: it.ok, avancoPct: it.avancoPct });

/** Todas as respostas da pauta (contador "N de M respondidos"). */
export function respostasDaPauta(r: ReuniaoGeral, p: PautaGeral): (RespostaReuniao | null)[] {
  return [
    ...p.cobranca.map((t) => respostaCobranca(r, t)),
    ...p.passada.map((it) => respostaPassada(r, it)),
    ...p.semana.map((it) => respostaDe(r, it.secao, it.id)),
  ];
}

/** Itens ainda sem resposta, com o passo da pauta onde respondê-los. */
export function semRespostaDaPauta(
  r: ReuniaoGeral,
  p: PautaGeral,
): { nome: string; passo: number }[] {
  return [
    ...p.cobranca.filter((t) => !respostaCobranca(r, t)).map((t) => ({ nome: t.texto, passo: 0 })),
    ...p.passada.filter((it) => !respostaPassada(r, it)).map((it) => ({ nome: it.nome, passo: 1 })),
    ...p.semana
      .filter((it) => !respostaDe(r, it.secao, it.id))
      .map((it) => ({ nome: it.nome, passo: 2 })),
  ];
}

/** Indicador da obra na ata: o que o topo da obra já mostra (fase, atrasos, % no prazo). */
export function indicadorObraGeral(
  r: ReuniaoGeral,
  hoje: DataISO,
): { indicador: string; atrasada: boolean; situacao: string } {
  const fases = trilhaObraGeral({
    fases: r.obra.fases,
    atividades: r.obra.atividades,
    hoje,
    pessoaId: null,
    nomes: {},
  });
  const atrasadas = fases.reduce((s, f) => s + f.atrasadas, 0);
  const eficiencia = textoEficiencia(eficienciaObraGeral(r.obra.atividades, hoje));
  const partes = [
    eficiencia,
    atrasadas > 0 ? `${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}` : null,
  ].filter(Boolean);
  const atual = fases.find((f) => !f.concluida);
  return {
    indicador: partes.length ? partes.join(' · ') : 'em dia',
    atrasada: atrasadas > 0,
    situacao:
      fases.length === 0
        ? 'Nenhuma fase ainda'
        : atual
          ? `Fase ${atual.n} de ${fases.length} · ${atual.titulo}`
          : 'Todas as fases concluídas',
  };
}

const fmt = (d: string | null) => (d ? formatarDataCurta(d) : null);

/** Seção da pauta a que cada ação desta reunião responde (tarefaId → seção). */
function secaoDasAcoes(r: ReuniaoGeral) {
  const m = new Map<string, string>();
  for (const [k, tarefaId] of Object.entries(r.acoesResposta)) m.set(tarefaId, k.split(':')[0]);
  return m;
}

export function entradaAtaGeral(r: ReuniaoGeral, p: PautaGeral, hoje: DataISO): ObraAtaEntrada {
  const ind = indicadorObraGeral(r, hoje);
  const secoes = secaoDasAcoes(r);
  const itens: ItemPautaAta[] = [
    ...p.passada.map((it) => ({
      id: it.atividadeId,
      nome: it.nome,
      secao: it.secao,
      resposta: respostaPassada(r, it),
      avancoPct: it.avancoPct,
      data: it.data,
    })),
    ...p.semana.map((it) => ({
      id: it.id,
      nome: it.nome,
      secao: it.secao,
      resposta: respostaDe(r, it.secao, it.id),
      prestador: it.prestador,
      tipoProvidencia: it.tipoProvidencia,
      naObraEmFmt: fmt(it.naObraEm),
      data: it.data,
    })),
  ];
  return {
    nome: r.obra.nome,
    indicador: ind.indicador,
    atrasada: ind.atrasada,
    situacao: ind.situacao,
    itens,
    acoes: acoesDaObra(r, r.obraId).map((t) => ({
      vinculoId: t.vinculoId,
      secao: (secoes.get(t.id) as ItemPautaAta['secao'] | undefined) ?? null,
      texto: t.texto,
      pessoa: t.pessoa,
      prazoFmt: fmt(t.prazo),
      prazo: t.prazo,
    })),
    cobranca: p.cobranca.map((t) => ({
      texto: t.texto,
      pessoa: t.pessoa,
      feita: t.concluido,
      atrasada: t.atrasado,
      prazoFmt: fmt(t.prazo),
      prazo: t.prazo,
      replanejamentos: t.replanejamentos,
      avancoPct: t.avancoPct,
    })),
    observacoes: r.observacoes,
  };
}

/** A ata da obra geral: os blocos da obra, os totais e "Quem faz o quê" por pessoa. */
export function montarAtaGeral(r: ReuniaoGeral, p: PautaGeral, hoje: DataISO): AtaCompleta {
  const entrada = entradaAtaGeral(r, p, hoje);
  const obras = [montarObraAta(entrada)];
  const grupos = compilarPorPessoa(
    derivarAtribuicoes(
      {
        tarefas: r.tarefas.filter((t) => !t.concluido),
        engenheiroNome: null,
        comprasNome: null,
        atividadesAtrasadas: [],
        concluirSemana: [],
        comecarSemana: [],
        providenciasAtrasadas: [],
        providenciarSemana: [],
      },
      hoje,
    ),
  );
  const pessoas: PessoaAta[] = grupos.map((g) => ({
    pessoa: g.pessoa,
    itens: g.itens.map((it) => ({
      texto: `${it.prazo ? formatarDataCurta(it.prazo) : 'sem prazo'} · ${it.texto}`,
      atrasado: it.atrasado,
      data: it.prazo,
    })),
  }));
  return { obras, totais: totaisAta([entrada], obras), pessoas };
}
