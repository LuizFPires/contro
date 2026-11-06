import { useMemo, useState } from 'react';
import { filtrarAtividades } from '@contro/core';
import { Icon } from '@contro/ui';
import { agruparPorFase, itensAtividadesObra, type ObraListavel } from './listaAtividades';
import styles from './AtividadePicker.module.css';

/**
 * Atividade relacionada à pendência (opcional). Fechado, mostra a escolhida;
 * aberto, tem busca por nome ou número (#24) e a lista agrupada por fase.
 */
export function AtividadePicker({
  obra,
  valor,
  onMudar,
}: {
  obra: ObraListavel;
  valor: string | null;
  onMudar: (id: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const itens = useMemo(() => itensAtividadesObra(obra), [obra]);

  const escolhida = itens.find((a) => a.id === valor) ?? null;
  const achadas = filtrarAtividades(itens, busca);
  const grupos = agruparPorFase(obra.fases, achadas);

  function escolher(id: string | null) {
    onMudar(id);
    setAberto(false);
    setBusca('');
  }

  if (!aberto) {
    return (
      <button type="button" className={styles.campo} onClick={() => setAberto(true)}>
        <span className={styles.campoTexto}>
          {escolhida ? (
            <>
              {escolhida.numero ? <b>#{escolhida.numero} </b> : null}
              {escolhida.nome}
            </>
          ) : (
            <span className={styles.vazio}>Nenhuma · toque para escolher</span>
          )}
        </span>
        <Icon name="chevronDown" size={18} />
      </button>
    );
  }

  return (
    <div className={styles.painel}>
      <div className={styles.buscaLinha}>
        <Icon name="search" size={18} />
        <input
          className={styles.busca}
          type="search"
          autoFocus
          placeholder="Buscar por nome ou número (ex.: 24)"
          aria-label="Buscar atividade"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button
          type="button"
          className={styles.fechar}
          aria-label="Fechar lista de atividades"
          onClick={() => {
            setAberto(false);
            setBusca('');
          }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className={styles.lista} role="listbox" aria-label="Atividades da obra">
        {!busca.trim() ? (
          <button
            type="button"
            role="option"
            aria-selected={valor === null}
            className={`${styles.item} ${valor === null ? styles.itemOn : ''}`}
            onClick={() => escolher(null)}
          >
            <span>Nenhuma (geral)</span>
            {valor === null ? <Icon name="checkGrosso" size={16} strokeWidth={3} /> : null}
          </button>
        ) : null}
        {grupos.map((g) => (
          <div key={g.fase.id}>
            <div className={styles.fase}>{g.fase.titulo}</div>
            {g.itens.map((a) => (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={valor === a.id}
                className={`${styles.item} ${valor === a.id ? styles.itemOn : ''}`}
                onClick={() => escolher(a.id)}
              >
                <span>
                  {a.numero ? <b>#{a.numero} </b> : null}
                  {a.nome}
                </span>
                {valor === a.id ? <Icon name="checkGrosso" size={16} strokeWidth={3} /> : null}
              </button>
            ))}
          </div>
        ))}
        {grupos.length === 0 ? (
          <div className={styles.semResultado}>Nenhuma atividade com “{busca.trim()}”.</div>
        ) : null}
      </div>
    </div>
  );
}
