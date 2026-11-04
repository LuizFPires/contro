import {
  compilarPorPessoa,
  derivarAtribuicoes,
  estadoAcao,
  type Acao,
  type DataISO,
  type GrupoPessoa,
} from '@contro/core';
import { formatarDataCurta } from '../../lib/datas';

/**
 * "Quem faz o quê" do boletim: só ações abertas (tarefas e pendências).
 * Pendência resolvida e tarefa feita ficam fora; senão a data passada as
 * pintaria de atrasadas. Providência sem dono fica fora: o boletim já a mostra
 * em "Atenção"/providências e não muda com as providências como ações.
 */
export function quemFazOQueBoletim(acoes: Acao[], hoje: DataISO): GrupoPessoa[] {
  const tarefas = acoes
    .filter((a) => a.aberta && a.origem !== 'providencia')
    .map((a) => ({
      texto: a.texto,
      pessoa: a.responsavelNome ?? 'Sem responsável',
      prazo: a.prazo,
      atrasado: estadoAcao(a, hoje) === 'atrasada',
      concluido: false,
    }));
  const grupos = compilarPorPessoa(
    derivarAtribuicoes(
      {
        tarefas,
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
  return grupos.map((g) => ({
    pessoa: g.pessoa,
    itens: g.itens.map((it) => ({
      dataFmt: it.prazo ? formatarDataCurta(it.prazo) : null,
      texto: it.texto,
      data: it.prazo,
      atrasado: it.atrasado,
    })),
  }));
}
