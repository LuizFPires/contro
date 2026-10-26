import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Icon } from './Icon';
import { Input } from './Input';
import styles from './PasswordInput.module.css';

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  error?: string;
}

/** Campo de senha com botão de olho para revelar/ocultar o que foi digitado. */
export function PasswordInput({ label, hint, error, ...rest }: PasswordInputProps) {
  const [visivel, setVisivel] = useState(false);
  return (
    <Input
      {...rest}
      label={label}
      hint={hint}
      error={error}
      type={visivel ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          className={styles.toggle}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visivel}
          onClick={() => setVisivel((v) => !v)}
        >
          <Icon name={visivel ? 'olhoFechado' : 'olho'} size={20} />
        </button>
      }
    />
  );
}
