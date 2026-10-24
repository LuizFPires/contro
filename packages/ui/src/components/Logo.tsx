import iconeApp from '../brand/OBDC_icone_app.svg';
import logoPreto from '../brand/OBDC_logo_fundo_preto.svg';
import logoBranco from '../brand/OBDC_logo_fundo_branco.svg';

// Símbolo e lettering APROVADOS (não redesenhar). Artwork vindo da pasta do projeto.

export interface MonogramaProps {
  /** Lado do ícone em px. */
  size?: number;
  className?: string;
}

/** Monograma / ícone do app obdc (quadrado preto, símbolo branco com segmento turquesa). */
export function Monograma({ size = 40, className }: MonogramaProps) {
  return (
    <img
      src={iconeApp}
      width={size}
      height={size}
      className={className}
      alt="obdc"
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

/** Lettering completo "obdc". */
export function Logo({ on = 'branco', height = 28, className }: LogoProps) {
  return (
    <img
      src={on === 'preto' ? logoPreto : logoBranco}
      height={height}
      className={className}
      alt="obdc · obras da contorno"
      style={{ display: 'block', height, width: 'auto' }}
    />
  );
}
