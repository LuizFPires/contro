import { useMemo } from 'react';
import {
  classificarSemana,
  compilarPorPessoa,
  derivarAtribuicoes,
  providenciaAtrasada,
  ritmoTexto,
  tarefaAtrasada,
  textoBoletimWhatsapp,
  type AtividadeSemana,
  type BoletimDados,
} from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { pdfServiceConfigurado } from '../../lib/env';
import { baixarPdf } from '../../lib/pdf';
import { hojeISO } from './api';
import type { ObraCompleta } from './detalhe';
import { useObraTarefas } from './useObraTarefas';
import styles from './BoletimView.module.css';

const TIPO: Record<string, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};

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

export function BoletimView({ obra, onFechar }: { obra: ObraCompleta; onFechar: () => void }) {
  const tarefas = useObraTarefas(obra.id);

  const dados = useMemo<BoletimDados>(() => {
    const hoje = hojeISO();
    const dec = obra.decorridos;
    const iniciada = dec > 0 || hoje >= obra.inicio;
    const topo = obra.atividades.filter((a) => !a.pai_id);
    const cronOf = (id: string) => obra.cron.porId[id];
    const motivo = (id: string): string | null => {
      const e = obra.estados[id];
      if (!e || e.concluida) return null;
      if (!e.predsOk) return 'aguarda predecessoras';
      if (!e.provOk) return 'aguarda providências';
      return null;
    };

    const semEntrada: (AtividadeSemana & { nome: string })[] = topo.map((a) => ({
      id: a.id,
      nome: a.nome,
      es: cronOf(a.id)?.es ?? 0,
      ef: cronOf(a.id)?.ef ?? 0,
      concluida: Boolean(a.concluida_em),
      liberada: Boolean(obra.estados[a.id]?.liberada),
    }));
    const sem = classificarSemana(semEntrada, dec);

    const concluir = sem.concluir.map((a) => ({
      dataFmt: formatarDataCurta(cronOf(a.id)?.fim_previsto ?? obra.inicio),
      nome: a.nome,
    }));
    const comecar = sem.comecar.map((a) => ({
      dataFmt: formatarDataCurta(cronOf(a.id)?.inicio_previsto ?? obra.inicio),
      nome: a.nome,
      motivo: motivo(a.id),
    }));

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
          atrasos.push(`${TIPO[p.tipo]}: ${p.descricao}`);
        }
      }
    }

    const tabTarefas = (tarefas.query.data ?? []).map((t) => ({
      texto: t.texto,
      pessoa: t.responsavelNome ?? 'Sem responsável',
      prazo: t.prazo,
      atrasado: tarefaAtrasada(t, hoje),
      concluido: t.status === 'feita',
    }));
    const grupos = compilarPorPessoa(
      derivarAtribuicoes(
        {
          tarefas: tabTarefas,
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
    const quemFazOQue = grupos.map((g) => ({
      pessoa: g.pessoa,
      itens: g.itens.map((it) => ({
        dataFmt: it.prazo ? formatarDataCurta(it.prazo) : null,
        texto: it.texto,
      })),
    }));

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
  }, [obra, tarefas.query.data]);

  const texto = textoBoletimWhatsapp(dados);
  const wa = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  const { showToast } = useToast();

  // Com o pdf-service configurado, baixa o PDF real; senão, imprime pelo navegador.
  async function baixar() {
    if (!pdfServiceConfigurado) {
      window.print();
      return;
    }
    try {
      await baixarPdf('boletim', dados, `boletim-${dados.obra}.pdf`);
    } catch {
      showToast({ message: 'Não foi possível gerar o PDF. Abrindo a impressão.' });
      window.print();
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.barra}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onFechar}>
          <Icon name="chevronRight" size={22} />
        </button>
        <span className={styles.barraTitulo}>Boletim</span>
        <div className={styles.acoes}>
          <a className={styles.wa} href={wa} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <button type="button" className={styles.print} onClick={baixar}>
            Baixar PDF
          </button>
        </div>
      </div>

      <article className={styles.corpo}>
        <h1 className={styles.titulo}>{dados.obra}</h1>
        <p className={styles.semana}>{dados.semanaFmt}</p>
        <p className={styles.ind}>
          Real {Math.round(dados.realPct * 100)}% · previsto até sexta{' '}
          {Math.round(dados.previstoSextaPct * 100)}% ·{' '}
          <span className={ritmoTexto(obra.ritmoDias).atrasada ? styles.atraso : ''}>
            {dados.ritmoTexto}
          </span>
        </p>

        {dados.atrasos.length > 0 ? (
          <Bloco titulo={`Atenção · ${dados.atrasos.length} em atraso`} atraso>
            {dados.atrasos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </Bloco>
        ) : null}

        {dados.quemFazOQue.length > 0 ? (
          <Bloco titulo="Quem faz o quê">
            {dados.quemFazOQue.map((g) => (
              <li key={g.pessoa}>
                <strong>{g.pessoa}</strong>
                <ul>
                  {g.itens.map((it, i) => (
                    <li key={i}>
                      {it.dataFmt ? `${it.dataFmt} · ` : ''}
                      {it.texto}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </Bloco>
        ) : null}

        <p className={styles.rotulo}>Prévia da mensagem</p>
        <pre className={styles.previa}>{texto}</pre>
      </article>
    </div>
  );
}

function Bloco({
  titulo,
  atraso,
  children,
}: {
  titulo: string;
  atraso?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.bloco}>
      <p className={`${styles.blocoTitulo} ${atraso ? styles.atraso : ''}`}>{titulo}</p>
      <ul>{children}</ul>
    </div>
  );
}
