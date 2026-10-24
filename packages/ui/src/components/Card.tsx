import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

type DivProps = HTMLAttributes<HTMLDivElement> & { onClick?: never };
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { onClick: () => void };

export type CardProps = (DivProps | ButtonProps) & { children: ReactNode };

export function Card({ className, children, ...rest }: CardProps) {
  if (typeof (rest as ButtonProps).onClick === 'function') {
    const cls = [styles.card, styles.interactive, className ?? ''].filter(Boolean).join(' ');
    return (
      <button type="button" className={cls} {...(rest as ButtonProps)}>
        {children}
      </button>
    );
  }
  const cls = [styles.card, className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={cls} {...(rest as DivProps)}>
      {children}
    </div>
  );
}
