import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Chip.module.css';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Realce de atraso (vermelho). Use só para atraso. */
  late?: boolean;
  children: ReactNode;
}

export function Chip({ late = false, className, children, ...rest }: ChipProps) {
  const cls = [styles.chip, late ? styles.late : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
