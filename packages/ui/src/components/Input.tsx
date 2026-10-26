import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  /** Adorno à direita, dentro do campo (ex.: botão de revelar senha). */
  trailing?: ReactNode;
}

export function Input({ label, hint, error, id, className, trailing, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  const inputCls = [
    styles.input,
    error ? styles.hasError : '',
    trailing ? styles.comTrailing : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.wrap}>
        <input
          id={inputId}
          className={inputCls}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
      </div>
      {error ? (
        <span id={`${inputId}-error`} className={styles.error}>
          <Icon name="alert" size={14} />
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className={styles.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
