import { formatarNumero, rotuloDia, type CurvaAvanco as Curva } from '@contro/core';
import { geometriaCurva } from './geometria';

const caminho = (pts: readonly (readonly [number, number])[]) =>
  'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');

export function CurvaAvanco({
  curva,
  unidade,
  prazo,
  atrasada,
  rotulo,
}: {
  curva: Curva;
  unidade: string;
  /** Fim planejado (rótulo da linha de prazo). */
  prazo: string;
  /** Projeção depois do prazo: tracejado vermelho. */
  atrasada: boolean;
  rotulo: string;
}) {
  const g = geometriaCurva(curva);
  const medido = curva.pontos.length > 1;
  const corProj = atrasada ? 'var(--contro-late)' : 'var(--contro-turquoise)';
  return (
    <svg
      viewBox="0 0 320 132"
      width="100%"
      role="img"
      aria-label={rotulo}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <line x1={g.X0} y1={g.Y0} x2={g.X1} y2={g.Y0} stroke="rgb(24 24 24 / 18%)" />
      <line
        x1={g.X0}
        y1={g.yTotal}
        x2={g.X1}
        y2={g.yTotal}
        stroke="rgb(24 24 24 / 18%)"
        strokeDasharray="2 3"
      />
      <text x={10} y={g.yTotal - 5} fontSize="11" fontWeight="700" fill="rgb(24 24 24 / 65%)">
        {formatarNumero(curva.total)} {unidade}
      </text>
      {medido ? (
        <path
          d={`${caminho(g.real)} L${g.ultimo[0].toFixed(1)} ${g.Y0} L${g.X0} ${g.Y0} Z`}
          fill="rgb(84 180 176 / 18%)"
        />
      ) : null}
      <path
        d={caminho(g.plano)}
        fill="none"
        stroke="rgb(24 24 24 / 45%)"
        strokeWidth="1.6"
        strokeDasharray="5 4"
      />
      <line
        x1={g.xPrazo}
        y1={14}
        x2={g.xPrazo}
        y2={g.Y0}
        stroke="var(--contro-black)"
        strokeWidth="1.2"
        strokeDasharray="1 3"
      />
      {g.projecao ? (
        <>
          <path
            d={caminho(g.projecao)}
            fill="none"
            stroke={corProj}
            strokeWidth="2.2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <circle cx={g.projecao[1][0]} cy={g.projecao[1][1]} r="5" fill={corProj} />
        </>
      ) : null}
      {medido ? (
        <>
          <path
            d={caminho(g.real)}
            fill="none"
            stroke="var(--contro-turquoise)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle
            cx={g.ultimo[0]}
            cy={g.ultimo[1]}
            r="4"
            fill="#fff"
            stroke="var(--contro-black)"
            strokeWidth="2"
          />
        </>
      ) : null}
      <text
        x={g.xPrazo}
        y={125}
        fontSize="11"
        fontWeight="700"
        fill="var(--contro-black)"
        textAnchor="middle"
      >
        prazo {rotuloDia(prazo)}
      </text>
      <text x={10} y={125} fontSize="11" fill="rgb(24 24 24 / 65%)">
        {rotuloDia(curva.x0)}
      </text>
    </svg>
  );
}
