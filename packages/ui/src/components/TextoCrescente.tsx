import { useId, useLayoutEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent, TextareaHTMLAttributes } from 'react';
import inputStyles from './Input.module.css';
import styles from './TextoCrescente.module.css';

export interface TextoCrescenteProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value' | 'rows'> {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  /** Com rótulo, tem o visual do Input; sem, só o campo (o estilo vem de className). */
  label?: string;
}

/**
 * Campo de uma linha que cresce para baixo conforme o texto: texto longo quebra em
 * várias linhas em vez de sumir à esquerda. Enter não cria linha (é um nome, não um
 * parágrafo); quebra colada vira espaço.
 */
export function TextoCrescente({
  value,
  onChange,
  label,
  id,
  className,
  onKeyDown,
  style,
  ...rest
}: TextoCrescenteProps) {
  const autoId = useId();
  const campoId = id ?? autoId;
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const campo = (
    <textarea
      ref={ref}
      id={campoId}
      rows={1}
      // O Input e os campos das telas têm padding só lateral; o vertical vem daqui.
      style={{ paddingTop: 12, paddingBottom: 12, ...style }}
      value={value}
      className={[styles.campo, label ? inputStyles.input : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      onChange={(e) => {
        if (/[\r\n]/.test(e.target.value)) e.target.value = e.target.value.replace(/[\r\n]+/g, ' ');
        onChange(e);
      }}
      onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') e.preventDefault();
        onKeyDown?.(e);
      }}
      {...rest}
    />
  );

  if (!label) return campo;
  return (
    <div className={inputStyles.field}>
      <label className={inputStyles.label} htmlFor={campoId}>
        {label}
      </label>
      <div className={inputStyles.wrap}>{campo}</div>
    </div>
  );
}
