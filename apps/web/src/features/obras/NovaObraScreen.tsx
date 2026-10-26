import { useMemo, useState } from 'react';
import { calcularCronograma, type AtividadeEntrada } from '@contro/core';
import { Button, Icon, Input } from '@contro/ui';
import { formatarDataCompleta } from '../../lib/datas';
import { useModelos } from '../modelos/useModelos';
import { useModeloCompleto } from '../modelos/useModeloDetalhe';
import { proximasSegundas, useGerarObra } from './useObras';
import styles from './NovaObraScreen.module.css';

export function NovaObraScreen({
  onVoltar,
  onCriada,
}: {
  onVoltar: () => void;
  onCriada: () => void;
}) {
  const { data: modelos } = useModelos();
  const gerar = useGerarObra();

  const segundas = useMemo(() => proximasSegundas(8), []);
  const [nome, setNome] = useState('');
  const [inicio, setInicio] = useState(segundas[0] ?? '');
  const [modeloId, setModeloId] = useState('');

  const { data: modelo } = useModeloCompleto(modeloId || null);

  const previa = useMemo(() => {
    if (!modelo) return null;
    const entrada: AtividadeEntrada[] = modelo.atividades.map((a) => ({
      id: a.id,
      duracao_du: a.duracao_du,
      pai_id: a.pai_id,
      em_sequencia: a.em_sequencia,
      predecessoras: a.predecessoras,
    }));
    let total = 0;
    let entrega = inicio;
    try {
      const c = calcularCronograma({ inicio, atividades: entrada });
      total = c.total;
      entrega = c.entrega;
    } catch {
      /* ignora */
    }
    const nAtividades = modelo.atividades.filter((a) => !a.pai_id).length;
    const nLembretes = modelo.atividades.reduce((s, a) => s + a.providencias.length, 0);
    return { total, entrega, nAtividades, nLembretes };
  }, [modelo, inicio]);

  const [erro, setErro] = useState<string | null>(null);

  const pronto = nome.trim() && inicio && modeloId;

  function criar() {
    setErro(null);
    gerar.mutate(
      { inicio, nome: nome.trim(), modeloId },
      {
        onSuccess: onCriada,
        onError: (e) => setErro(mensagemErro(e)),
      },
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topo}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronRight" size={24} />
        </button>
        <h1 className={styles.titulo}>Nova obra</h1>
      </div>

      <Input label="Nome da obra" value={nome} onChange={(e) => setNome(e.target.value)} />

      <div className={styles.campo}>
        <label className={styles.label} htmlFor="nova-inicio">
          Começa na segunda
        </label>
        <select
          id="nova-inicio"
          className={styles.select}
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
        >
          {segundas.map((s) => (
            <option key={s} value={s}>
              {formatarDataCompleta(s)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.campo}>
        <label className={styles.label} htmlFor="nova-modelo">
          Modelo de obra
        </label>
        <select
          id="nova-modelo"
          className={styles.select}
          value={modeloId}
          onChange={(e) => setModeloId(e.target.value)}
        >
          <option value="">Escolha o modelo</option>
          {(modelos ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </div>

      {previa ? (
        <div className={styles.previa}>
          <p className={styles.previaTitulo}>Prévia</p>
          <div className={styles.previaLinha}>
            <span>Atividades</span>
            <strong>{previa.nAtividades}</strong>
          </div>
          <div className={styles.previaLinha}>
            <span>Lembretes</span>
            <strong>{previa.nLembretes}</strong>
          </div>
          <div className={styles.previaLinha}>
            <span>Dias úteis</span>
            <strong>{previa.total}</strong>
          </div>
          <div className={styles.previaLinha}>
            <span>Entrega</span>
            <strong>{formatarDataCompleta(previa.entrega)}</strong>
          </div>
        </div>
      ) : null}

      {erro ? (
        <p className={styles.erro}>
          <Icon name="alert" size={18} />
          {erro}
        </p>
      ) : null}

      <Button full disabled={!pronto || gerar.isPending} onClick={criar}>
        {gerar.isPending ? 'Criando…' : 'Criar obra'}
      </Button>
    </div>
  );
}

/** Mensagem legível a partir de um erro do Supabase/PostgREST. */
function mensagemErro(e: unknown): string {
  const err = e as { message?: string; code?: string } | null;
  const base = err?.message?.trim() || 'Não foi possível criar a obra. Tente de novo.';
  return err?.code ? `${base} (${err.code})` : base;
}
