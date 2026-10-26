import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { planoRecuperacao, simularPlano, tarefasDoPlano, type Sugestao } from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import { aplicarPlanoRecuperacao } from './campo';
import type { ObraCompleta } from './detalhe';
import { entradaRecuperacao } from './recuperacaoObra';
import styles from './PlanoRecuperacao.module.css';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Plano de recuperação (opção A): sugestões de paralelismo e redução de prazo
 * nas próximas atividades críticas, com o quanto recuperam; aplicar grava no
 * cronograma e cria as providências.
 */
export function PlanoRecuperacao({ obra, onVoltar }: { obra: ObraCompleta; onVoltar: () => void }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const entrada = useMemo(() => entradaRecuperacao(obra, hojeISO()), [obra]);
  const plano = useMemo(() => planoRecuperacao(entrada), [entrada]);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(() => new Set(plano.recomendadas));

  const selecionadas = plano.sugestoes.filter((s) => escolhidas.has(s.chave));
  const depois = useMemo(() => simularPlano(entrada, selecionadas), [entrada, selecionadas]);
  const atraso = plano.previsao.atrasoDu;
  const recupera = Math.max(0, atraso - depois.atrasoDu);
  const nomeAtv = (id: string | null) => obra.atividades.find((a) => a.id === id)?.nome ?? '';

  const aplicar = useMutation({
    mutationFn: () =>
      aplicarPlanoRecuperacao(obra.id, {
        entregaOriginal: plano.previsao.entregaOriginal,
        duracoes: selecionadas
          .filter((s) => s.tipo === 'reducao' && s.duracaoDu !== null)
          .map((s) => ({ atividade_id: s.atividadeId, duracao_du: s.duracaoDu! })),
        defasagens: selecionadas
          .filter((s) => s.tipo === 'paralelismo' && s.predecessoraId && s.defasagemDu !== null)
          .map((s) => ({
            atividade_id: s.atividadeId,
            predecessora_id: s.predecessoraId!,
            defasagem_du: s.defasagemDu!,
          })),
        tarefas: tarefasDoPlano(entrada, selecionadas).map((t) => ({
          texto: t.texto,
          atividade_id: t.atividadeId,
          prazo: t.prazo,
        })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['obra', obra.id] });
      void qc.invalidateQueries({ queryKey: ['obras'] });
      showToast({
        message: `Plano aplicado · ${plural(selecionadas.length, 'providência criada', 'providências criadas')}`,
      });
      onVoltar();
    },
    onError: () => showToast({ message: 'Não foi possível aplicar o plano' }),
  });

  function alternar(s: Sugestao) {
    setEscolhidas((atual) => {
      const n = new Set(atual);
      if (n.has(s.chave)) n.delete(s.chave);
      else n.add(s.chave);
      return n;
    });
  }

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <button
          type="button"
          className={styles.voltar}
          aria-label="Voltar para a obra"
          onClick={onVoltar}
        >
          <Icon name="chevronLeft" size={22} />
        </button>
        <div>
          <h1 className={styles.titulo}>Plano de recuperação</h1>
          <div className={styles.sub}>{obra.nome} · atividades críticas</div>
        </div>
      </header>

      <div className={styles.conteudo}>
        {atraso === 0 ? (
          <div className={styles.ok}>
            <Icon name="checkGrosso" size={18} strokeWidth={3} />A inauguração está no prazo:{' '}
            {formatarDataCurta(plano.previsao.entregaOriginal)}.
          </div>
        ) : (
          <div className={styles.alerta}>
            <div className={styles.alertaTitulo}>
              <Icon name="relogio" size={16} strokeWidth={2.4} />A inauguração está em risco
            </div>
            <div>
              <s>{formatarDataCurta(plano.previsao.entregaOriginal)}</s> →{' '}
              <b className={styles.txtAtraso}>
                {formatarDataCurta(plano.previsao.entregaPrevista)} (+
                {plural(atraso, 'dia útil', 'dias úteis')})
              </b>
            </div>
            <div className={styles.miuda}>
              Atividades atrasadas no caminho crítico empurram a entrega. As sugestões abaixo agem
              nas próximas atividades críticas.
            </div>
          </div>
        )}

        {atraso > 0 ? (
          <>
            <h2 className={styles.secao}>Sugestões nas próximas atividades críticas</h2>
            {plano.sugestoes.length === 0 ? (
              <p className={styles.miuda}>
                Nenhuma sugestão automática: as próximas atividades críticas são curtas demais para
                encurtar ou sobrepor. Ajuste o prazo pela ficha da atividade.
              </p>
            ) : null}
            {plano.sugestoes.map((s) => {
              const on = escolhidas.has(s.chave);
              return (
                <button
                  key={s.chave}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className={`${styles.sugestao} ${on ? styles.sugestaoOn : ''}`}
                  onClick={() => alternar(s)}
                >
                  <span className={on ? styles.caixaOn : styles.caixa} aria-hidden="true">
                    {on ? <Icon name="checkGrosso" size={16} strokeWidth={3} /> : null}
                  </span>
                  <span className={styles.sugTexto}>
                    <span className={styles.sugTopo}>
                      <span className={styles.tag}>
                        {s.tipo === 'paralelismo' ? 'Paralelismo' : 'Reduzir prazo'}
                      </span>
                      <b>−{plural(s.ganhoDu, 'd.u.', 'd.u.')}</b>
                    </span>
                    <b className={styles.sugTitulo}>{s.titulo}</b>
                    <span className={styles.miuda}>
                      {s.tipo === 'paralelismo'
                        ? `${s.detalhe} Depende de ${nomeAtv(s.predecessoraId)}.`
                        : s.detalhe}
                    </span>
                    <span className={styles.precisa}>
                      <b>Precisa:</b> {s.precisa} · <b>Risco:</b> {s.risco}
                    </span>
                  </span>
                </button>
              );
            })}
          </>
        ) : null}
      </div>

      {atraso > 0 ? (
        <div className={styles.rodape}>
          <div className={styles.soma}>
            <span>
              Recupera{' '}
              <b>
                {recupera} de {atraso}
              </b>{' '}
              {atraso === 1 ? 'dia útil' : 'dias úteis'}
            </span>
            <span className={depois.atrasoDu === 0 ? styles.dataOk : styles.dataAtraso}>
              {depois.atrasoDu === 0
                ? `${formatarDataCurta(plano.previsao.entregaOriginal)} mantida`
                : `${formatarDataCurta(depois.entregaPrevista)} (+${depois.atrasoDu})`}
            </span>
          </div>
          <div className={styles.barra} aria-hidden="true">
            <div
              className={styles.barraFill}
              style={{ width: `${atraso ? (recupera / atraso) * 100 : 0}%` }}
            />
          </div>
          <button
            type="button"
            className={styles.aplicar}
            disabled={selecionadas.length === 0 || aplicar.isPending}
            onClick={() => aplicar.mutate()}
          >
            {aplicar.isPending ? 'Aplicando…' : 'Aplicar ao cronograma e criar providências'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
