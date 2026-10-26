import { useEffect, useMemo, useState } from 'react';
import {
  avisoProvidencia,
  datasProvidencia,
  proximaReuniao,
  voltaNaProximaReuniao,
  type ImpactoConclusao,
} from '@contro/core';
import { BottomSheet, Icon } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import type { PessoaResumo } from '../perfil/usePessoas';
import styles from './ProvidenciaSheet.module.css';

export interface ValoresProvidencia {
  texto: string;
  responsavelId: string | null;
  /** Nome digitado (quem não tem login no app). */
  responsavelNome: string | null;
  prazo: string;
  observacao: string;
}

export interface CabecalhoProvidencia {
  /** "Não feito", "Não feita", "Esta semana"… */
  rotulo: string;
  /** Rótulo em vermelho com ✕ (atraso). */
  atraso: boolean;
  nome: string;
  /** "Atrasada · prevista seg 26/10". */
  etiquetaAtraso?: string | null;
}

/**
 * Providência da pauta (opção A): o que fazer, responsável, data e observação.
 * Abre por cima da pauta; com `impacto`, mostra o efeito no cronograma da data
 * escolhida, só simulado.
 */
export function ProvidenciaSheet({
  aberto,
  titulo,
  cabecalho,
  info,
  inicial,
  hoje,
  dataReuniao,
  pessoas,
  nomesSugeridos,
  impacto,
  pendente,
  rotuloSalvar = 'Salvar providência',
  onSalvar,
  onFechar,
}: {
  aberto: boolean;
  titulo: string;
  cabecalho?: CabecalhoProvidencia | null;
  /** Linha miúda acima do formulário (ex.: "Remarcada 1 vez · prazo original…"). */
  info?: string | null;
  inicial: ValoresProvidencia;
  hoje: string;
  dataReuniao: string;
  pessoas: PessoaResumo[];
  nomesSugeridos: string[];
  impacto?: ((prazo: string) => ImpactoConclusao | null) | null;
  pendente?: boolean;
  rotuloSalvar?: string;
  onSalvar: (v: ValoresProvidencia) => void;
  onFechar: () => void;
}) {
  const datas = useMemo(() => datasProvidencia(hoje, 5), [hoje]);
  const [v, setV] = useState<ValoresProvidencia>(inicial);
  const [outroNome, setOutroNome] = useState(false);
  const [outraData, setOutraData] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    // Sem prazo (ou já vencido, ao remarcar): marca o 3º dia útil, como no protótipo.
    const prazo = inicial.prazo && inicial.prazo > hoje ? inicial.prazo : datas[2];
    setV({ ...inicial, prazo });
    setOutroNome(!inicial.responsavelId && Boolean(inicial.responsavelNome));
    setOutraData(!datas.includes(prazo));
    // Reinicia só ao abrir (inicial muda de identidade a cada render do pai).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const quem = outroNome
    ? v.responsavelNome?.trim() || null
    : (pessoas.find((p) => p.id === v.responsavelId)?.nome ?? null);
  const imp = impacto && v.prazo ? impacto(v.prazo) : null;
  const aviso = v.prazo
    ? avisoProvidencia({
        responsavel: quem,
        prazoFmt: formatarDataCurta(v.prazo),
        proximaFmt: formatarDataCurta(proximaReuniao(dataReuniao)),
        volta: voltaNaProximaReuniao(dataReuniao, v.prazo),
      })
    : null;
  const valido = v.texto.trim().length > 0 && Boolean(v.prazo);

  return (
    <BottomSheet open={aberto} title={titulo} onClose={onFechar}>
      <div className={styles.corpo}>
        {cabecalho ? (
          <div className={styles.cabecalho}>
            <span className={cabecalho.atraso ? styles.rotuloAtraso : styles.rotulo}>
              {cabecalho.atraso ? (
                <span className={styles.icNao} aria-hidden="true">
                  <Icon name="close" size={12} strokeWidth={3} />
                </span>
              ) : null}
              {cabecalho.rotulo}
            </span>
            <span className={styles.nome}>{cabecalho.nome}</span>
            {cabecalho.etiquetaAtraso ? (
              <span className={styles.etiquetaAtraso}>
                <Icon name="relogio" size={14} strokeWidth={2.4} />
                {cabecalho.etiquetaAtraso}
              </span>
            ) : null}
          </div>
        ) : null}

        {imp ? (
          <div className={styles.impacto}>
            <div className={styles.impactoTopo}>
              <b>Impacto no cronograma</b>
              <span>só simulação</span>
            </div>
            <div className={styles.impactoLinha}>
              <span>Conclui em</span>
              <span>
                <s>{formatarDataCurta(imp.fimAntes)}</s> → <b>{formatarDataCurta(imp.fimDepois)}</b>
              </span>
            </div>
            <div className={styles.impactoLinha}>
              <span>Inauguração</span>
              <span>
                <s>{formatarDataCurta(imp.entregaAntes)}</s> →{' '}
                <b className={imp.deltaEntrega > 0 ? styles.txtAtraso : undefined}>
                  {formatarDataCurta(imp.entregaDepois)}
                  {imp.deltaEntrega > 0 ? ` (+${imp.deltaEntrega} d.u.)` : ''}
                </b>
              </span>
            </div>
            <div className={styles.miuda}>
              Para mudar o cronograma de verdade, use "Ajustar prazo" na atividade.
            </div>
          </div>
        ) : null}

        {info ? <div className={styles.miuda}>{info}</div> : null}

        <label className={styles.rotuloCampo} htmlFor="prov-texto">
          O que precisa ser feito
        </label>
        <input
          id="prov-texto"
          className={styles.campo}
          value={v.texto}
          onChange={(e) => setV({ ...v, texto: e.target.value })}
        />

        <div className={styles.rotuloCampo}>Responsável</div>
        <div className={styles.chips} role="group" aria-label="Responsável">
          {pessoas.map((p) => {
            const on = !outroNome && v.responsavelId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                className={`${styles.chip} ${on ? styles.chipOn : ''}`}
                onClick={() => {
                  setOutroNome(false);
                  setV({ ...v, responsavelId: p.id, responsavelNome: null });
                }}
              >
                {p.nome}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={outroNome}
            className={`${styles.chip} ${outroNome ? styles.chipOn : ''}`}
            onClick={() => {
              setOutroNome(true);
              setV({ ...v, responsavelId: null });
            }}
          >
            + Outro nome
          </button>
        </div>
        {outroNome ? (
          <>
            <input
              className={styles.campo}
              aria-label="Nome do responsável"
              placeholder="Nome (fica de sugestão nas próximas)"
              list="prov-nomes"
              value={v.responsavelNome ?? ''}
              onChange={(e) => setV({ ...v, responsavelNome: e.target.value })}
            />
            <datalist id="prov-nomes">
              {nomesSugeridos.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </>
        ) : null}

        <div className={styles.rotuloCampo}>Data da providência</div>
        <div className={styles.chips} role="group" aria-label="Data da providência">
          {datas.map((d) => {
            const on = !outraData && v.prazo === d;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                className={`${styles.data} ${on ? styles.dataOn : ''}`}
                onClick={() => {
                  setOutraData(false);
                  setV({ ...v, prazo: d });
                }}
              >
                {formatarDataCurta(d)}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={outraData}
            className={`${styles.data} ${outraData ? styles.dataOn : ''}`}
            onClick={() => setOutraData(true)}
          >
            Outra data
          </button>
        </div>
        {outraData ? (
          <input
            type="date"
            className={styles.campo}
            aria-label="Escolher outra data"
            min={hoje}
            value={v.prazo}
            onChange={(e) => setV({ ...v, prazo: e.target.value })}
          />
        ) : null}

        <label className={styles.rotuloCampo} htmlFor="prov-obs">
          Observação
        </label>
        <textarea
          id="prov-obs"
          className={styles.obs}
          rows={2}
          placeholder="Opcional"
          value={v.observacao}
          onChange={(e) => setV({ ...v, observacao: e.target.value })}
        />

        {aviso ? <div className={styles.aviso}>{aviso}</div> : null}
      </div>

      <div className={styles.rodape}>
        <button type="button" className={styles.cancelar} onClick={onFechar}>
          Cancelar
        </button>
        <button
          type="button"
          className={styles.salvar}
          disabled={!valido || pendente}
          onClick={() =>
            onSalvar({
              ...v,
              texto: v.texto.trim(),
              responsavelId: outroNome ? null : v.responsavelId,
              responsavelNome: outroNome ? v.responsavelNome?.trim() || null : null,
              observacao: v.observacao.trim(),
            })
          }
        >
          {pendente ? 'Salvando…' : rotuloSalvar}
        </button>
      </div>
    </BottomSheet>
  );
}
