import { useEffect, useMemo, useState } from 'react';
import { calcularCronograma, diaMes, faixasDeFases, type AtividadeEntrada } from '@contro/core';
import { Icon } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { useModelos } from '../modelos/useModelos';
import { useModeloCompleto } from '../modelos/useModeloDetalhe';
import { proximasSegundas, useGerarObra } from './useObras';
import styles from './NovaObraScreen.module.css';

/** Nova obra a partir de um modelo (protótipo · NOVA OBRA). */
export function NovaObraScreen({
  onVoltar,
  onCriada,
  onEditarModelos,
}: {
  onVoltar: () => void;
  onCriada: (obraId: string) => void;
  /** Só para o gestor: abre os modelos de obra. */
  onEditarModelos?: () => void;
}) {
  const { data: modelos } = useModelos();
  const gerar = useGerarObra();

  const segundas = useMemo(() => proximasSegundas(4), []);
  const [nome, setNome] = useState('');
  const [inicio, setInicio] = useState(segundas[0] ?? '');
  const [modeloId, setModeloId] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  // Começa com o primeiro modelo marcado, como no protótipo.
  useEffect(() => {
    if (!modeloId && modelos?.length) setModeloId(modelos[0].id);
  }, [modelos, modeloId]);

  const { data: modelo } = useModeloCompleto(modeloId || null);

  const previa = useMemo(() => {
    if (!modelo || !inicio) return null;
    const entrada: AtividadeEntrada[] = modelo.atividades.map((a) => ({
      id: a.id,
      duracao_du: a.duracao_du,
      pai_id: a.pai_id,
      em_sequencia: a.em_sequencia,
      predecessoras: a.predecessoras,
    }));
    try {
      const cron = calcularCronograma({ inicio, atividades: entrada });
      return {
        cron,
        faixas: faixasDeFases(modelo.fases, modelo.atividades, cron),
        nAtividades: modelo.atividades.filter((a) => !a.pai_id).length,
        nProvidencias: modelo.atividades.reduce((s, a) => s + a.providencias.length, 0),
      };
    } catch {
      return null;
    }
  }, [modelo, inicio]);

  const pronto = Boolean(nome.trim() && inicio && modeloId);

  function criar() {
    if (!nome.trim()) {
      setErro('Digite o nome da unidade.');
      return;
    }
    setErro(null);
    gerar.mutate(
      { inicio, nome: nome.trim(), modeloId },
      { onSuccess: (id) => onCriada(id), onError: (e) => setErro(mensagemErro(e)) },
    );
  }

  const total = previa?.cron.total || 1;
  const entrega = previa?.cron.entrega;

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronLeft" size={22} />
        </button>
        <h1 className={styles.titulo}>Nova obra</h1>
      </header>

      <div className={styles.corpo}>
        <div className={styles.campo}>
          <label htmlFor="nova-unidade" className={styles.rotulo}>
            Unidade
          </label>
          <input
            id="nova-unidade"
            className={styles.entrada}
            value={nome}
            placeholder="Ex.: CDC Sete Lagoas"
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        <div className={styles.campo}>
          <div className={styles.rotulo} id="nova-inicio">
            Início da obra
          </div>
          <div className={styles.inicios} role="group" aria-labelledby="nova-inicio">
            {segundas.map((s) => {
              const [dow, dm] = formatarDataCurta(s).split(' ');
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={inicio === s}
                  className={`${styles.inicio} ${inicio === s ? styles.inicioAtivo : ''}`}
                  onClick={() => setInicio(s)}
                >
                  <span className={styles.dow}>{dow}</span>
                  <strong>{dm}</strong>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.campo}>
          <div className={styles.rotulo} id="nova-modelo">
            Modelo a seguir
          </div>
          <div role="radiogroup" aria-labelledby="nova-modelo" className={styles.modelos}>
            {(modelos ?? []).map((m) => {
              const on = m.id === modeloId;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`${styles.modelo} ${on ? styles.modeloAtivo : ''}`}
                  onClick={() => setModeloId(m.id)}
                >
                  <span className={styles.radio}>
                    <span className={on ? styles.radioOn : ''} />
                  </span>
                  <span className={styles.modeloTexto}>
                    <span className={styles.modeloNome}>{m.nome}</span>
                    {m.subtitulo ? <span className={styles.modeloSub}>{m.subtitulo}</span> : null}
                  </span>
                  <span className={styles.modeloNums}>
                    {m.dias} d<span>{m.atividades} ativ.</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {previa && modelo ? (
          <div className={styles.previa}>
            <div className={styles.previaTopo}>
              <div>
                <div className={styles.previaRotulo}>Como a obra vai nascer</div>
                <div className={styles.previaTitulo}>{modelo.nome}</div>
              </div>
              {onEditarModelos ? (
                <button type="button" className={styles.editar} onClick={onEditarModelos}>
                  Editar modelos
                </button>
              ) : null}
            </div>
            <div className={styles.numeros}>
              <div>
                <strong>{previa.nAtividades}</strong>
                <span>atividades</span>
              </div>
              <div>
                <strong>{previa.nProvidencias}</strong>
                <span>providências</span>
              </div>
              <div>
                <strong>{previa.cron.total}</strong>
                <span>dias úteis</span>
              </div>
            </div>
            <div className={styles.faixas}>
              {previa.faixas.map((f, i) => (
                <div key={f.id} className={styles.faixa}>
                  <span className={styles.faixaNome}>
                    {f.n}. {f.titulo}
                  </span>
                  <span className={styles.faixaTrilho} aria-hidden="true">
                    <span
                      className={i % 2 ? styles.faixaPreta : styles.faixaTurquesa}
                      style={{
                        left: `${(f.es / total) * 100}%`,
                        width: `${((f.ef - f.es) / total) * 100}%`,
                      }}
                    />
                  </span>
                  <span className={styles.faixaDatas}>
                    {diaMes(f.inicio)}–{diaMes(f.fim)}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.explica}>
              A obra nasce com prazos, conexões e a lista de contratações, locações e compras de
              cada atividade, com a data limite para providenciar.
            </div>
          </div>
        ) : null}

        {entrega ? (
          <div className={styles.entrega}>
            <div>
              <div className={styles.entregaRotulo}>Entrega prevista</div>
              <div className={styles.entregaData}>
                {diaMes(entrega)}/{entrega.slice(0, 4)}
              </div>
            </div>
            <div className={styles.entregaSemanas}>
              cerca de {Math.ceil((previa?.cron.total ?? 0) / 5)} semanas
            </div>
          </div>
        ) : null}

        {erro ? (
          <p className={styles.erro} role="alert">
            <Icon name="alert" size={18} />
            {erro}
          </p>
        ) : null}
      </div>

      <div className={styles.rodape}>
        <button
          type="button"
          className={styles.criar}
          disabled={!modeloId || gerar.isPending}
          aria-disabled={!pronto}
          onClick={criar}
        >
          {gerar.isPending ? 'Gerando…' : 'Gerar cronograma e abrir obra'}
        </button>
      </div>
    </div>
  );
}

/** Mensagem legível a partir de um erro do Supabase/PostgREST. */
function mensagemErro(e: unknown): string {
  const err = e as { message?: string; code?: string } | null;
  const base = err?.message?.trim() || 'Não foi possível criar a obra. Tente de novo.';
  return err?.code ? `${base} (${err.code})` : base;
}
