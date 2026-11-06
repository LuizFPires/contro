import { useMemo } from 'react';
import {
  classificarSemana,
  providenciaAtrasada,
  ritmoTexto,
  textoProvidencia,
  type AtividadeSemana,
  type BoletimDados,
} from '@contro/core';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import type { ObraCompleta } from './detalhe';
import { quemFazOQueBoletim } from './boletimAcoes';
import { useAcoesDasObras } from './useAcoesDasObras';
import { BoletimTela } from './BoletimTela';

function semanaFmt(): string {
  // Tudo em UTC, consistente com hojeISO()/formatarDataCurta (evita deslocar o dia à noite).
  const base = new Date(`${hojeISO()}T00:00:00Z`);
  const seg = new Date(base);
  seg.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));
  const sex = new Date(seg);
  sex.setUTCDate(seg.getUTCDate() + 4);
  return `${formatarDataCurta(seg.toISOString().slice(0, 10))} a ${formatarDataCurta(
    sex.toISOString().slice(0, 10),
  )}`;
}

/** Boletim da semana (protótipo · BOLETIM), dentro da tela da obra. */
export function BoletimView({ obra }: { obra: ObraCompleta }) {
  const { acoes } = useAcoesDasObras([obra.id]);

  const dados = useMemo<BoletimDados>(() => {
    const hoje = hojeISO();
    const dec = obra.decorridos;
    const iniciada = dec > 0 || hoje >= obra.inicio;
    const topo = obra.atividades.filter((a) => !a.pai_id && !a.preObra);
    const cronOf = (id: string) => obra.cron.porId[id];
    // Sem atividade bloqueada: o motivo de não ter começado é só o lembrete pendente.
    const motivo = (id: string): string | null =>
      obra.estados[id]?.lembretesPendentes ? 'falta providenciar' : null;

    const semEntrada: (AtividadeSemana & { nome: string })[] = topo.map((a) => ({
      id: a.id,
      nome: a.nome,
      es: cronOf(a.id)?.es ?? 0,
      ef: cronOf(a.id)?.ef ?? 0,
      concluida: Boolean(a.concluida_em),
      liberada: Boolean(obra.estados[a.id]?.liberada),
    }));
    const sem = classificarSemana(semEntrada, dec);

    const concluir = sem.concluir.map((a) => {
      const data = cronOf(a.id)?.fim_previsto ?? obra.inicio;
      return { dataFmt: formatarDataCurta(data), nome: a.nome, data };
    });
    const comecar = sem.comecar.map((a) => {
      const data = cronOf(a.id)?.inicio_previsto ?? obra.inicio;
      return { dataFmt: formatarDataCurta(data), nome: a.nome, motivo: motivo(a.id), data };
    });

    const atrasos: string[] = [];
    for (const a of topo) if (obra.estados[a.id]?.atrasada) atrasos.push(a.nome);
    for (const a of topo) {
      const es = cronOf(a.id)?.es ?? 0;
      for (const p of a.providencias) {
        if (
          providenciaAtrasada({
            status: p.status,
            atividadeConcluida: Boolean(a.concluida_em),
            obraIniciada: iniciada,
            decorridos: dec,
            esAtividade: es,
            antecedenciaDu: p.antecedencia_du,
          })
        ) {
          atrasos.push(textoProvidencia(p.tipo, p.descricao));
        }
      }
    }

    const quemFazOQue = quemFazOQueBoletim(acoes, hoje);

    const ritmo = ritmoTexto(obra.ritmoDias);
    return {
      obra: obra.nome,
      semanaFmt: semanaFmt(),
      realPct: obra.pct,
      previstoSextaPct: obra.previstoSexta,
      ritmoTexto: ritmo.texto,
      ritmoAtrasado: ritmo.atrasada,
      atrasos,
      concluir,
      comecar,
      quemFazOQue,
    };
  }, [obra, acoes]);

  return <BoletimTela dados={dados} />;
}
