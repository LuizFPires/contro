// "Hoje" na tela inicial (opção A): por obra, o que está atrasado e o que é
// para hoje. Atraso = lembrete não providenciado no prazo, atividade que devia
// ter terminado ou tarefa vencida.
import type { DataISO } from './calendar';
import { providenciaAtrasada, providenciarAte } from './providencias';

export type TipoItemDia = 'concluir' | 'comecar' | 'contratacao' | 'locacao' | 'compra' | 'tarefa';

export interface ItemDia {
  /** Única na obra (tipo + id). */
  chave: string;
  tipo: TipoItemDia;
  nome: string;
  /** Data de referência: prazo vencido (atraso) ou a de hoje. */
  data: DataISO;
  atraso: boolean;
  /** Responsável (só tarefa). */
  pessoa: string | null;
}

export interface AgendaObra {
  atrasados: ItemDia[];
  hoje: ItemDia[];
}

export interface EntradaAgenda {
  inicio: DataISO;
  hoje: DataISO;
  /** Dias úteis decorridos desde o início da obra. */
  decorridos: number;
  /** Atividades de topo, com o cronograma e o estado já calculados. */
  atividades: {
    id: string;
    nome: string;
    es: number;
    inicio_previsto: DataISO;
    fim_previsto: DataISO;
    concluida: boolean;
    atrasada: boolean;
  }[];
  providencias: {
    id: string;
    atividadeId: string;
    tipo: 'contratacao' | 'locacao' | 'compra';
    descricao: string;
    status: 'pendente' | 'feito';
    antecedenciaDu: number;
  }[];
  tarefas: { id: string; texto: string; prazo: DataISO; aberta: boolean; pessoa: string | null }[];
}

const ORDEM: Record<TipoItemDia, number> = {
  concluir: 0,
  comecar: 1,
  contratacao: 2,
  locacao: 3,
  compra: 4,
  tarefa: 5,
};

export function agendaDoDia(e: EntradaAgenda): AgendaObra {
  const atrasados: ItemDia[] = [];
  const hoje: ItemDia[] = [];
  const iniciada = e.hoje >= e.inicio;
  const atvPorId = new Map(e.atividades.map((a) => [a.id, a]));

  for (const a of e.atividades) {
    if (a.concluida) continue;
    if (a.atrasada)
      atrasados.push({
        chave: `concluir-${a.id}`,
        tipo: 'concluir',
        nome: a.nome,
        data: a.fim_previsto,
        atraso: true,
        pessoa: null,
      });
    else if (a.fim_previsto === e.hoje)
      hoje.push({
        chave: `concluir-${a.id}`,
        tipo: 'concluir',
        nome: a.nome,
        data: e.hoje,
        atraso: false,
        pessoa: null,
      });
    else if (a.inicio_previsto === e.hoje)
      hoje.push({
        chave: `comecar-${a.id}`,
        tipo: 'comecar',
        nome: a.nome,
        data: e.hoje,
        atraso: false,
        pessoa: null,
      });
  }

  for (const p of e.providencias) {
    const a = atvPorId.get(p.atividadeId);
    if (!a || p.status === 'feito' || a.concluida) continue;
    const ate = providenciarAte(e.inicio, a.es, p.antecedenciaDu);
    const item = { chave: `${p.tipo}-${p.id}`, tipo: p.tipo, nome: p.descricao, pessoa: null };
    const atrasada = providenciaAtrasada({
      status: p.status,
      atividadeConcluida: a.concluida,
      obraIniciada: iniciada,
      decorridos: e.decorridos,
      esAtividade: a.es,
      antecedenciaDu: p.antecedenciaDu,
    });
    if (atrasada) atrasados.push({ ...item, data: ate, atraso: true });
    else if (ate === e.hoje) hoje.push({ ...item, data: e.hoje, atraso: false });
  }

  for (const t of e.tarefas) {
    if (!t.aberta) continue;
    const item = {
      chave: `tarefa-${t.id}`,
      tipo: 'tarefa' as const,
      nome: t.texto,
      pessoa: t.pessoa,
    };
    if (t.prazo < e.hoje) atrasados.push({ ...item, data: t.prazo, atraso: true });
    else if (t.prazo === e.hoje) hoje.push({ ...item, data: e.hoje, atraso: false });
  }

  // Atrasados: o mais antigo primeiro. Hoje: atividades, depois lembretes, depois tarefas.
  atrasados.sort((x, y) => x.data.localeCompare(y.data) || ORDEM[x.tipo] - ORDEM[y.tipo]);
  hoje.sort((x, y) => ORDEM[x.tipo] - ORDEM[y.tipo]);
  return { atrasados, hoje };
}

/** "4 atrasos e 5 coisas para hoje em 3 obras" (resumo do topo do Hoje). */
export function resumoDoDia(agendas: AgendaObra[]): string {
  const at = agendas.reduce((s, a) => s + a.atrasados.length, 0);
  const hj = agendas.reduce((s, a) => s + a.hoje.length, 0);
  const obras = agendas.filter((a) => a.atrasados.length + a.hoje.length > 0).length;
  if (at + hj === 0) return 'Nada atrasado nem previsto para hoje.';
  const partes = [
    at ? `${at} ${at === 1 ? 'atraso' : 'atrasos'}` : null,
    hj ? `${hj} ${hj === 1 ? 'coisa' : 'coisas'} para hoje` : null,
  ].filter(Boolean);
  return `${partes.join(' e ')} em ${obras} ${obras === 1 ? 'obra' : 'obras'}`;
}
