import simbolo from '../brand/simbolo-192.png';
import logoEscuro from '../brand/CONTRO_logo_escuro.svg';
import logoClaro from '../brand/CONTRO_logo_claro.svg';

// Símbolo e lettering APROVADOS (não redesenhar). Artwork vindo da pasta do projeto.

export interface MonogramaProps {
  /** Lado do ícone em px. */
  size?: number;
  className?: string;
}

/** Monograma / ícone do app CONTRO (quadrado escuro, símbolo da marca). */
export function Monograma({ size = 40, className }: MonogramaProps) {
  return (
    <img
      src={simbolo}
      width={size}
      height={size}
      className={className}
      alt="CONTRO"
      style={{ display: 'block', objectFit: 'contain' }}
    />
  );
}

export interface LogoProps {
  /** 'preto' = lettering sobre fundo escuro; 'branco' = lettering sobre fundo claro. */
  on?: 'preto' | 'branco';
  /** Altura em px. */
  height?: number;
  className?: string;
}

/** Lettering completo "CONTRO". */
export function Logo({ on = 'branco', height = 28, className }: LogoProps) {
  return (
    <img
      src={on === 'preto' ? logoEscuro : logoClaro}
      height={height}
      className={className}
      alt="CONTRO · obras da contorno"
      style={{ display: 'block', height, width: 'auto' }}
    />
  );
}
