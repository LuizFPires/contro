import { describe, expect, it } from 'vitest';
import { textoAtaWhatsapp, type AtividadeGeral } from '@contro/core';
import type { TarefaAtrib } from '../../reuniao/reuniaoApi';
import type { ProvidenciaGeral } from '../obraGeral';
import {
  indicadorObraGeral,
  montarAtaGeral,
  montarPautaGeral,
  respostasDaPauta,
  semRespostaDaPauta,
} from './pautaGeral';
import type { ReuniaoGeral } from './reuniaoGeralApi';

let n = 0;
function ativ(p: Partial<AtividadeGeral>) {
  n += 1;
  return {
    id: `a${n}`,
    fase_id: 'f1',
    pai_id: null,
    ordem: n,
    nome: `Atividade ${n}`,
    data_prevista: null,
    data_prevista_original: null,
    replanejamentos: 0,
    responsavel_id: null,
    concluida_em: null,
    avanco_pct: 0,
    foto_conclusao_id: null,
    prestador: null,
    mapa_antecedencia_du: null,
    ...p,
  };
}

function tarefa(p: Partial<TarefaAtrib>): TarefaAtrib {
  n += 1;
  return {
    id: `t${n}`,
    obraId: 'o1',
    origem: null,
    texto: `Tarefa ${n}`,
    pessoa: 'Júlia',
    prazo: '2026-11-06',
    atrasado: false,
    concluido: false,
    responsavelId: 'p1',
    responsavelNome: null,
    observacao: null,
    vinculoTipo: null,
    vinculoId: null,
    prazoOriginal: null,
    replanejamentos: 0,
    avancoPct: 0,
    comentario: null,
    avancoEm: null,
    feitaEm: null,
    ...p,
  };
}

function prov(p: Partial<ProvidenciaGeral> & { atividade_id: string }): ProvidenciaGeral {
  n += 1;
  return {
    id: `p${n}`,
    tipo: 'compra',
    descricao: `Material ${n}`,
    status: 'pendente',
    antecedencia_du: 3,
    duracao_du: 0,
    na_obra_em: null,
    manual: true,
    feito_em: null,
    feito_por_nome: null,
    ...p,
  };
}

// Reunião na quarta 04/11/2026: semana 02/11-06/11, passada 26/10-30/10. Hoje = dia da reunião.
const HOJE = '2026-11-04';
const noPrazo = ativ({
  nome: 'Tapume',
  data_prevista: '2026-10-28',
  concluida_em: '2026-10-28T15:00:00',
});
const atrasadaAberta = ativ({ nome: 'Contrapiso', data_prevista: '2026-10-29' });
const daSemana = ativ({ nome: 'Pintura', data_prevista: '2026-11-05', prestador: 'Zé' });
const concluidaNaSemana = ativ({
  nome: 'Limpeza',
  data_prevista: '2026-11-03',
  concluida_em: '2026-11-03T10:00:00',
});
const futura = ativ({ nome: 'Piso', data_prevista: '2026-11-20' });

function reuniao(extra: Partial<ReuniaoGeral> = {}): ReuniaoGeral {
  return {
    id: 'r1',
    data: '2026-11-04',
    hora: '16:00',
    status: 'pauta',
    obras: [],
    tarefas: [],
    respostas: {},
    acoesResposta: {},
    obraId: 'o1',
    observacoes: '',
    obra: {
      id: 'o1',
      nome: 'Galpão SMS',
      cidade: null,
      fases: [{ id: 'f1', ordem: 1, titulo: 'Estrutura', preliminar: false }],
      atividades: [noPrazo, atrasadaAberta, daSemana, concluidaNaSemana, futura],
      pessoas: [{ id: 'p1', nome: 'Júlia Coordenadora', papel: 'coordenador', participa: true }],
      providencias: [
        // Pintura qui 05/11 − 3 d.u. = seg 02/11: atrasada.
        prov({ atividade_id: daSemana.id, descricao: 'tinta' }),
        // Piso sex 20/11 − 10 d.u. = sex 06/11: providenciar nesta semana.
        prov({ atividade_id: futura.id, descricao: 'porcelanato', antecedencia_du: 10 }),
        // Piso − 3 d.u. = ter 17/11: fora da semana.
        prov({ atividade_id: futura.id, descricao: 'rejunte' }),
        prov({
          atividade_id: futura.id,
          descricao: 'argamassa',
          status: 'feito',
          antecedencia_du: 10,
        }),
      ],
    },
    ...extra,
  };
}

describe('montarPautaGeral', () => {
  it('semana passada: a concluída e a aberta atrasada, só para terminar', () => {
    const p = montarPautaGeral(reuniao(), HOJE);
    expect(p.passada.map((x) => [x.nome, x.ok, x.secao])).toEqual([
      ['Tapume', true, 'passada_concluir'],
      ['Contrapiso', false, 'passada_concluir'],
    ]);
    expect(p.atrasadas).toBe(1);
  });

  it('esta semana: as abertas com prazo na semana e as providências atrasadas e da semana', () => {
    const p = montarPautaGeral(reuniao(), HOJE);
    expect(p.semana.map((x) => [x.secao, x.nome])).toEqual([
      ['semana_concluir', 'Pintura'],
      ['semana_providencia', 'tinta'],
      ['semana_providencia', 'porcelanato'],
    ]);
    const [pintura, tinta, porcelanato] = p.semana;
    expect(pintura.sub).toBe('data prevista qui 05/11');
    expect(pintura.sugestao).toBe('Confirmar com Zé a conclusão');
    expect(tinta.atraso).toBe('Atrasado · era até seg 02/11');
    expect(porcelanato.atraso).toBeNull();
    expect(porcelanato.sub).toBe('providenciar até sex 06/11');
    expect(porcelanato.sugestao).toBe('Comprar porcelanato');
  });

  it('cobrança: as tarefas abertas da obra, sem as criadas nesta reunião', () => {
    const aberta = tarefa({});
    const desta = tarefa({ origem: 'Reunião qua 04/11' });
    const feitaAntes = tarefa({ concluido: true, feitaEm: '2026-10-20T10:00:00' });
    const p = montarPautaGeral(reuniao({ tarefas: [aberta, desta, feitaAntes] }), HOJE);
    expect(p.cobranca.map((t) => t.id)).toEqual([aberta.id]);
  });
});

describe('respostas da pauta', () => {
  it('conta a concluída no app como respondida e lista o que falta', () => {
    const t = tarefa({});
    const r = reuniao({ tarefas: [t], respostas: { [`cobranca:${t.id}`]: 'feita' } });
    const p = montarPautaGeral(r, HOJE);
    const respostas = respostasDaPauta(r, p);
    expect(respostas.filter(Boolean)).toHaveLength(2); // cobrança + Tapume concluída
    expect(semRespostaDaPauta(r, p).map((s) => [s.nome, s.passo])).toEqual([
      ['Contrapiso', 1],
      ['Pintura', 2],
      ['tinta', 2],
      ['porcelanato', 2],
    ]);
  });
});

describe('ata da obra geral', () => {
  it('indicador pela eficiência e pelos atrasos, sem % de avanço', () => {
    const ind = indicadorObraGeral(reuniao(), HOJE);
    expect(ind.atrasada).toBe(true);
    // No prazo: Tapume e Limpeza; fora: Contrapiso (aberta atrasada).
    expect(ind.indicador).toBe('67% no prazo · 1 atrasada');
    expect(ind.situacao).toBe('Fase 1 de 1 · Estrutura');
  });

  it('monta os blocos e o texto do WhatsApp com o nome da obra', () => {
    const acao = tarefa({
      origem: 'Reunião qua 04/11',
      texto: 'Concluir contrapiso',
      vinculoTipo: 'atividade',
      vinculoId: atrasadaAberta.id,
    });
    const r = reuniao({
      tarefas: [acao],
      respostas: { [`passada_concluir:${atrasadaAberta.id}`]: 'nao_terminou' },
      acoesResposta: { [`passada_concluir:${atrasadaAberta.id}`]: acao.id },
      observacoes: 'Caçamba atrasou',
    });
    const ata = montarAtaGeral(r, montarPautaGeral(r, HOJE), HOJE);
    const [o] = ata.obras;
    expect(o.nome).toBe('Galpão SMS');
    expect(o.aconteceu.map((l) => l.texto)).toEqual(['Tapume']);
    expect(o.naoAconteceu[0].texto).toBe('Contrapiso · não terminou');
    expect(o.naoAconteceu[0].acao).toBe('Concluir contrapiso — Júlia, até sex 06/11');
    expect(o.observacoes).toBe('Caçamba atrasou');
    expect(ata.totais.acoesNovas).toBe(1);
    expect(ata.pessoas.map((p) => p.pessoa)).toEqual(['Júlia']);
    const texto = textoAtaWhatsapp('qua 04/11', '16h', ata.obras, ata.pessoas, HOJE);
    expect(texto).toContain('GALPÃO SMS');
    expect(texto).toContain('Concluir contrapiso');
  });
});
