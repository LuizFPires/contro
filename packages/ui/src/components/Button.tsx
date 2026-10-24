import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  full?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  full = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [styles.btn, styles[variant], full ? styles.full : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
