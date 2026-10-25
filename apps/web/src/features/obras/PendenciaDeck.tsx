import { useRef, useState } from 'react';
import { Icon } from '@contro/ui';
import type { PendenciaObra } from './pendenciasObra';
import styles from './PendenciaDeck.module.css';

const LIMIAR = 100; // px (SPEC §5.7)

const CRIT_ROTULO: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

export function PendenciaDeck({
  pendencias,
  onResolver,
  onAdiar,
}: {
  pendencias: PendenciaObra[];
  onResolver: (p: PendenciaObra) => void;
  onAdiar: (p: PendenciaObra) => void;
}) {
  const [dx, setDx] = useState(0);
  const inicio = useRef<number | null>(null);

  if (pendencias.length === 0) {
    return (
      <div className={styles.vazio}>
        <Icon name="check" size={28} />
        <p>Fila vazia. Nada pendente agora.</p>
      </div>
    );
  }

  const topo = pendencias[0];
  const atras = pendencias.slice(1, 3);

  function soltar() {
    if (dx >= LIMIAR) onResolver(topo);
    else if (dx <= -LIMIAR) onAdiar(topo);
    setDx(0);
    inicio.current = null;
  }

  return (
    <div className={styles.deck}>
      {atras
        .map((p, i) => (
          <div
            key={p.id}
            className={styles.cardAtras}
            style={{ transform: `translateY(${(i + 1) * 8}px) scale(${1 - (i + 1) * 0.04})` }}
            aria-hidden="true"
          >
            <CardConteudo p={p} />
          </div>
        ))
        .reverse()}

      <div
        className={styles.cardTopo}
        style={{
          transform: `translateX(${dx}px) rotate(${dx / 22}deg)`,
          transition: inicio.current === null ? 'transform 0.2s' : 'none',
        }}
        onPointerDown={(e) => {
          inicio.current = e.clientX;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (inicio.current !== null) setDx(e.clientX - inicio.current);
        }}
        onPointerUp={soltar}
        onPointerCancel={() => {
          setDx(0);
          inicio.current = null;
        }}
      >
        {dx >= LIMIAR ? <span className={`${styles.selo} ${styles.seloOk}`}>RESOLVIDA</span> : null}
        {dx <= -LIMIAR ? <span className={`${styles.selo} ${styles.seloAdiar}`}>ADIAR</span> : null}
        <CardConteudo p={topo} />
      </div>

      <div className={styles.botoes}>
        <button type="button" className={styles.btnAdiar} onClick={() => onAdiar(topo)}>
          <Icon name="chevronRight" size={18} />
          Adiar
        </button>
        <button type="button" className={styles.btnResolver} onClick={() => onResolver(topo)}>
          <Icon name="check" size={18} />
          Resolver
        </button>
      </div>
    </div>
  );
}

function CardConteudo({ p }: { p: PendenciaObra }) {
  return (
    <>
      {p.fotoAntesUrl ? (
        <img src={p.fotoAntesUrl} alt="" className={styles.foto} />
      ) : (
        <div className={styles.fotoVazia}>
          <Icon name="alert" size={24} />
        </div>
      )}
      <div className={styles.corpo}>
        <div className={styles.linha}>
          <span className={`${styles.crit} ${styles[`crit_${p.criticidade}`]}`}>
            {CRIT_ROTULO[p.criticidade]}
          </span>
          {p.local ? <span className={styles.local}>{p.local}</span> : null}
        </div>
        <p className={styles.titulo}>{p.titulo}</p>
        <p className={styles.meta}>
          {p.atividadeNome ? `${p.atividadeNome} · ` : ''}
          {p.apontouNome ? `por ${p.apontouNome}` : ''}
        </p>
      </div>
    </>
  );
}
