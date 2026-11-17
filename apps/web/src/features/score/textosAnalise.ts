// Textos do analisador do Score: como cada indicador é medido, o que dizer de
// cada ação que tirou pontos e o que fazer para chegar a 100. Os números vêm
// do core (scoreAnalise); aqui só a redação.
import {
  rotuloDia,
  type AcaoAnalisada,
  type AnaliseIndicador,
  type Indicador,
  type PerdaIndicador,
} from '@contro/core';
import { decimal, du, pct } from './formato';

const vezes = (n: number) => (n === 1 ? '1 vez' : `${n} vezes`);
const dus = (n: number) => (n === 1 ? '1 d.u.' : `${n} d.u.`);
const mediana = (xs: number[]) => {
  if (!xs.length) return 0;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
};
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const listaAtrasos = (xs: number[]) =>
  xs.length > 12 ? `${xs.slice(0, 12).join(' · ')} …` : xs.join(' · ');

export interface TextoIndicador {
  nome: string;
  como: string;
  conta: (a: AnaliseIndicador) => string;
  /** Uma frase para o ranking ("10 de 23 ações passaram do primeiro prazo"). */
  frase: (a: AnaliseIndicador) => string;
  titulo: (a: AnaliseIndicador) => string;
  /** Rótulos das duas linhas da ação: prazo que conta e o que aconteceu. */
  prazoRotulo: string;
  fim: (x: AcaoAnalisada) => { rotulo: string; valor: string; atraso: boolean };
  chip: (x: AcaoAnalisada) => string;
  dica: (x: AcaoAnalisada) => string;
  dicas: (a: AnaliseIndicador, valePorAcao: number) => string[];
  simulacao: (quantas: number) => string;
  vazio: string;
}

const fimPadrao = (concluiu: string) => (x: AcaoAnalisada) =>
  x.concluidaDia
    ? { rotulo: concluiu, valor: rotuloDia(x.concluidaDia), atraso: false }
    : { rotulo: 'Situação', valor: 'aberta, vencida', atraso: true };
const chipAtraso = (x: AcaoAnalisada) => (x.concluidaDia ? `+${dus(x.du)}` : `há ${dus(x.du)}`);

export const TEXTOS: Record<Indicador, TextoIndicador> = {
  pontualidade: {
    nome: 'Pontualidade',
    como: 'Das ações que venceram ou foram concluídas no período, conta quantas foram concluídas até o prazo original: o primeiro definido, antes de qualquer replanejamento. Ação aberta e vencida conta como fora do prazo.',
    conta: (a) =>
      `${a.acertos} no prazo ÷ ${a.base} ações = ${pct(a.base ? a.acertos / a.base : null)}`,
    frase: (a) => `${a.base - a.acertos} de ${a.base} ações passaram do primeiro prazo`,
    titulo: (a) =>
      `${a.acoes.length === 1 ? 'A que tirou' : `As ${a.acoes.length} que tiraram`} pontos · maior atraso primeiro`,
    prazoRotulo: 'Prazo original',
    fim: fimPadrao('Concluída'),
    chip: chipAtraso,
    dica: (x) =>
      x.concluidaDia
        ? `Para ter contado: concluir até ${rotuloDia(x.prazo)}.${
            x.replanejamentos
              ? ` Replanejar ${vezes(x.replanejamentos)} não muda isso: vale sempre o primeiro prazo.`
              : ''
          }`
        : `Ainda aberta. Para ter contado: concluir até ${rotuloDia(x.prazo)}. Concluir hoje para de aumentar o atraso.`,
    dicas: (_a, vale) => [
      'Conclua até o primeiro prazo. Replanejar não salva a pontualidade e ainda conta em Replanejamentos.',
      'Ao receber a ação, confira se o prazo é possível. Se não for, ajuste no mesmo dia, antes de vencer.',
      `Comece pelas que vencem primeiro no Hoje: cada ação no prazo vale cerca de ${decimal(vale)} ponto no score.`,
    ],
    simulacao: (q) =>
      q === 1
        ? 'se a de maior atraso tivesse saído no prazo'
        : `se as ${q} de maior atraso tivessem saído no prazo`,
    vazio: 'Todas as ações saíram até o prazo original.',
  },
  conclusaoDoDia: {
    nome: 'Conclusão do dia',
    como: 'Das ações cujo prazo atual caiu no período, conta quantas foram concluídas até esse dia. Aqui vale o prazo atual: replanejar antes de vencer não tira ponto deste indicador (mas conta em Replanejamentos).',
    conta: (a) =>
      `${a.acertos} feitas no dia ÷ ${a.base} = ${pct(a.base ? a.acertos / a.base : null)}`,
    frase: (a) => `${a.base - a.acertos} de ${a.base} ações do dia ficaram para depois`,
    titulo: () => 'As que ficaram para depois do dia',
    prazoRotulo: 'Prazo do dia',
    fim: fimPadrao('Concluída'),
    chip: chipAtraso,
    dica: (x) =>
      x.concluidaDia
        ? `Para ter contado: concluir até ${rotuloDia(x.prazo)}.`
        : `Ainda aberta. Para ter contado: concluir até ${rotuloDia(x.prazo)}.`,
    dicas: () => [
      'Olhe o Hoje toda manhã: o que vence hoje tem que sair hoje.',
      'Não vai dar? Ajuste o prazo antes do dia acabar, não depois.',
      'Conclua no app na hora em que terminou: anotar no dia seguinte conta como atraso.',
    ],
    simulacao: (q) =>
      q === 1 ? 'se ela tivesse saído no dia' : `se as ${q} tivessem saído no dia`,
    vazio: 'Tudo que vencia no dia saiu no dia.',
  },
  respostaAtraso: {
    nome: 'Resposta ao atraso',
    como: 'Quando uma ação passa do prazo original, mede quantos dias úteis levam até ela ser concluída (aberta conta até hoje). Usa a mediana, o atraso do meio, para um caso extremo não dominar. 0 d.u. é nota cheia; 5 d.u. ou mais zera.',
    conta: (a) => `Atrasos: ${listaAtrasos(a.atrasos)} → mediana ${du(mediana(a.atrasos))}`,
    frase: (a) => `quando atrasa, leva ${du(mediana(a.atrasos))} para concluir`,
    titulo: (a) =>
      `${a.acoes.length === 1 ? 'O atraso' : `Os ${a.acoes.length} atrasos`} · maior primeiro`,
    prazoRotulo: 'Venceu em',
    fim: fimPadrao('Concluída'),
    chip: chipAtraso,
    dica: (x) =>
      x.concluidaDia
        ? `Saiu ${dus(x.du)} depois de vencer. Para nota cheia, concluir no mesmo dia em que venceu.`
        : `Aberta há ${dus(x.du)} desde o vencimento. Quanto antes concluir, menor a mediana.`,
    dicas: (a) => {
      const abertas = a.acoes.filter((x) => !x.concluidaDia).length;
      return [
        'Venceu e não deu? Conclua no dia seguinte: até 1 d.u. ainda deixa a nota alta.',
        abertas
          ? `${abertas === 1 ? 'A ação aberta e vencida puxa' : `As ${abertas} ações abertas e vencidas puxam`} a mediana para cima a cada dia.`
          : 'Não deixe ação vencida esquecida: aberta conta o atraso até hoje.',
        'Atraso de 5 d.u. ou mais zera este indicador: não deixe nenhuma passar disso.',
      ];
    },
    simulacao: () => 'se nenhuma ação passasse de 1 d.u. depois de vencer',
    vazio: 'Nenhuma ação atrasada no período.',
  },
  replanejamentos: {
    nome: 'Replanejamentos',
    como: 'Média de mudanças de prazo por tarefa no período. 0 é nota cheia; 2 ou mais por tarefa zera. Pendências não entram aqui.',
    conta: (a) => {
      const soma = a.acoes.reduce((s, x) => s + x.replanejamentos, 0);
      return `${soma} ${soma === 1 ? 'replanejamento' : 'replanejamentos'} ÷ ${a.base} tarefas = ${decimal(a.base ? soma / a.base : 0)}`;
    },
    frase: (a) =>
      `${decimal(a.base ? a.acoes.reduce((s, x) => s + x.replanejamentos, 0) / a.base : 0)} replanejamento por tarefa`,
    titulo: () => 'As tarefas replanejadas · mais vezes primeiro',
    prazoRotulo: 'Prazo original',
    fim: (x) => ({ rotulo: 'Replanejada', valor: vezes(x.replanejamentos), atraso: false }),
    chip: (x) => vezes(x.replanejamentos),
    dica: (x) =>
      `O prazo mudou ${vezes(x.replanejamentos)}. Um prazo possível já na criação evita replanejar.`,
    dicas: () => [
      'Defina o prazo com quem vai fazer: prazo realista na criação evita replanejar.',
      'Se precisar mudar, mude uma vez só, para uma data que dá.',
      'Replanejar não salva a Pontualidade: o primeiro prazo continua valendo lá.',
    ],
    simulacao: (q) =>
      q === 1
        ? 'se ela não tivesse sido replanejada'
        : `se essas ${q} não tivessem sido replanejadas`,
    vazio: 'Nenhuma tarefa replanejada no período.',
  },
  pendencias: {
    nome: 'Pendências',
    como: 'Das pendências com você de responsável que venceram ou foram resolvidas no período, conta quantas foram resolvidas (foto do depois) até o prazo.',
    conta: (a) =>
      `${a.acertos} resolvidas no prazo ÷ ${a.base} = ${pct(a.base ? a.acertos / a.base : null)}`,
    frase: (a) => `${a.base - a.acertos} de ${a.base} pendências passaram do prazo`,
    titulo: () => 'As que passaram do prazo',
    prazoRotulo: 'Prazo',
    fim: fimPadrao('Resolvida'),
    chip: chipAtraso,
    dica: (x) =>
      x.concluidaDia
        ? `Para ter contado: tirar a foto do depois até ${rotuloDia(x.prazo)}.`
        : `Ainda aberta. Para ter contado: resolver até ${rotuloDia(x.prazo)}.`,
    dicas: () => [
      'Resolva pela foto do depois no Check list assim que corrigir.',
      'Comece pelas de criticidade alta: o prazo delas é o mais curto.',
      'Pendência que não é sua? Peça para reatribuir: ela conta para quem está como responsável.',
    ],
    simulacao: (q) =>
      q === 1
        ? 'se ela tivesse sido resolvida no prazo'
        : `se as ${q} tivessem sido resolvidas no prazo`,
    vazio: 'Todas as pendências saíram no prazo.',
  },
  presenca: {
    nome: 'Presença na obra',
    como: 'Em cada obra, conta os dias com check-in contra a frequência que o Gestor definiu para você. Todo dia útil: cada dia útil conta. Por semana: até o número de visitas pedido, de segunda a sexta. Check-in fora da obra só conta depois de validado pelo Gestor.',
    conta: (a) =>
      `${a.acertos} de ${a.base} ${a.base === 1 ? 'dia esperado' : 'dias esperados'} com check-in = ${pct(a.base ? a.acertos / a.base : null)}`,
    frase: (a) => `${a.base - a.acertos} de ${a.base} dias esperados sem check-in`,
    titulo: () => 'Por obra',
    prazoRotulo: '',
    fim: () => ({ rotulo: '', valor: '', atraso: false }),
    chip: () => '',
    dica: () => '',
    dicas: () => [
      'Faça o check-in assim que chegar: com foto e hora do sistema, não dá para registrar depois.',
      'Nas obras com frequência por semana, faça as visitas até sexta: semana fechada não volta.',
      'Check-in fora da obra precisa da validação do Gestor para contar.',
    ],
    simulacao: () => 'com check-in em todos os dias esperados',
    vazio: 'Nenhuma falta de check-in no período.',
  },
  noFimPrevisto: {
    nome: 'No fim previsto',
    como: 'Das atividades do prestador que terminaram ou venceram no período, conta quantas foram concluídas até o fim previsto do cronograma. Aberta e vencida conta como fora.',
    conta: (a) =>
      `${a.acertos} no fim previsto ÷ ${a.base} atividades = ${pct(a.base ? a.acertos / a.base : null)}`,
    frase: (a) => `${a.base - a.acertos} de ${a.base} atividades passaram do fim previsto`,
    titulo: () => 'As que passaram do fim previsto · maior atraso primeiro',
    prazoRotulo: 'Fim previsto',
    fim: fimPadrao('Concluída'),
    chip: chipAtraso,
    dica: (x) =>
      x.concluidaDia
        ? `Para ter contado: concluir até ${rotuloDia(x.prazo)}.`
        : `Ainda aberta. Para ter contado: concluir até ${rotuloDia(x.prazo)}.`,
    dicas: () => [
      'Combine o prazo da atividade com o prestador antes de começar.',
      'Acompanhe o avanço na semana: atraso pequeno se recupera, grande não.',
      'Atividade pronta? Conclua no app no mesmo dia.',
    ],
    simulacao: (q) =>
      q === 1
        ? 'se a de maior atraso tivesse terminado no fim previsto'
        : `se as ${q} de maior atraso tivessem terminado no fim previsto`,
    vazio: 'Todas terminaram até o fim previsto.',
  },
  atrasoMedio: {
    nome: 'Atraso médio',
    como: 'Média de dias úteis de atraso por atividade (as no prazo contam 0). 0 é nota cheia; 5 d.u. ou mais zera.',
    conta: (a) => `Atrasos: ${listaAtrasos(a.atrasos)} → média ${du(media(a.atrasos))}`,
    frase: (a) => `${du(media(a.atrasos))} de atraso por atividade`,
    titulo: () => 'As atividades atrasadas · maior primeiro',
    prazoRotulo: 'Fim previsto',
    fim: fimPadrao('Concluída'),
    chip: chipAtraso,
    dica: (x) =>
      x.concluidaDia
        ? `Terminou ${dus(x.du)} depois do fim previsto.`
        : `Aberta há ${dus(x.du)} depois do fim previsto: cada dia aumenta a média.`,
    dicas: () => [
      'Uma atividade muito atrasada pesa mais que várias com 1 d.u.: priorize a mais atrasada.',
      'Atividade aberta e vencida aumenta o atraso todo dia até ser concluída.',
      'Atraso médio de 5 d.u. ou mais zera este indicador.',
    ],
    simulacao: (q) =>
      q === 1
        ? 'se a mais atrasada tivesse terminado no fim previsto'
        : `se as ${q} mais atrasadas tivessem terminado no fim previsto`,
    vazio: 'Nenhuma atividade atrasada no período.',
  },
  comFoto: {
    nome: 'Com foto',
    como: 'Das atividades concluídas no período, conta quantas têm foto.',
    conta: (a) =>
      `${a.acertos} com foto ÷ ${a.base} concluídas = ${pct(a.base ? a.acertos / a.base : null)}`,
    frase: (a) => `${a.base - a.acertos} de ${a.base} concluídas sem foto`,
    titulo: () => 'Concluídas sem foto',
    prazoRotulo: 'Fim previsto',
    fim: fimPadrao('Concluída'),
    chip: () => 'sem foto',
    dica: () => 'Anexe a foto pela ficha da atividade: ainda dá, e passa a contar.',
    dicas: () => [
      'Conclua com foto: o botão Concluir já abre a câmera.',
      'Concluiu sem foto? Anexe depois pela ficha da atividade.',
      'A foto também serve de registro da entrega para a obra.',
    ],
    simulacao: (q) => (q === 1 ? 'se ela tivesse foto' : `se essas ${q} tivessem foto`),
    vazio: 'Todas as concluídas têm foto.',
  },
};

/** Rótulo do quanto o indicador tirou ("−17 pts", "cheio" ou "peso dividido"). */
export function rotuloPerda(p: PerdaIndicador | undefined): string {
  if (!p || p.nota == null) return 'peso dividido';
  return p.perdidos ? `−${p.perdidos} pts` : 'cheio';
}
