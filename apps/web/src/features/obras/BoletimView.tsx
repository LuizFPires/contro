import { useMemo, useState } from 'react';
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

/** Boletim da semana (protótipo · BOLETIM), dentro da tela da obra. */
export function BoletimView({ obra }: { obra: ObraCompleta }) {
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
  const [baixando, setBaixando] = useState(false);

  // Com o pdf-service configurado, baixa o PDF real; senão, imprime pelo navegador.
  async function baixar() {
    if (!pdfServiceConfigurado) {
      window.print();
      return;
    }
    setBaixando(true);
    try {
      await baixarPdf('boletim', dados, `boletim-${dados.obra}.pdf`);
    } catch {
      showToast({ message: 'Não foi possível gerar o PDF. Abrindo a impressão.' });
      window.print();
    } finally {
      setBaixando(false);
    }
  }

  const iniciais = (nome: string) =>
    nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');

  return (
    <div className={styles.boletim}>
      <div>
        <h2 className={styles.titulo}>Boletim da semana</h2>
        <div className={styles.periodo}>{dados.semanaFmt}</div>
      </div>

      <div className={styles.acoes}>
        <a className={styles.wa} href={wa} target="_blank" rel="noreferrer">
          <Icon name="whatsapp" size={18} strokeWidth={2} />
          WhatsApp
        </a>
        <button type="button" className={styles.pdf} onClick={baixar} disabled={baixando}>
          <Icon name="baixar" size={18} strokeWidth={2} />
          {baixando ? 'Gerando…' : 'Baixar PDF'}
        </button>
      </div>

      <div className={styles.ind}>
        Real {Math.round(dados.realPct * 100)}% · previsto até sexta{' '}
        {Math.round(dados.previstoSextaPct * 100)}% ·{' '}
        <span className={ritmoTexto(obra.ritmoDias).atrasada ? styles.indAtraso : ''}>
          {dados.ritmoTexto}
        </span>
      </div>

      {dados.atrasos.length > 0 ? (
        <div className={styles.atencao}>
          <div className={styles.atencaoTopo}>
            <Icon name="alert" size={18} strokeWidth={2.2} />
            Atenção · {dados.atrasos.length} em atraso
          </div>
          <div className={styles.atencaoLista}>
            {dados.atrasos.map((a, i) => (
              <div key={i} className={styles.atencaoItem}>
                {a}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {dados.quemFazOQue.length > 0 ? (
        <div className={styles.cartao}>
          <div className={styles.cartaoTitulo}>Quem faz o quê nesta semana</div>
          {dados.quemFazOQue.map((g) => (
            <div key={g.pessoa} className={styles.pessoa}>
              <div className={styles.pessoaTopo}>
                <span className={styles.avatar} aria-hidden="true">
                  {iniciais(g.pessoa)}
                </span>
                <b>{g.pessoa}</b>
              </div>
              {g.itens.map((it, i) => (
                <div key={i} className={styles.tarefa}>
                  <span className={styles.quando}>{it.dataFmt ?? ''}</span>
                  <span>{it.texto}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div className={`${styles.cartao} ${styles.previaCartao}`}>
        <div className={styles.rotulo}>Prévia da mensagem no WhatsApp</div>
        <div className={styles.previa}>{texto}</div>
      </div>
    </div>
  );
}
