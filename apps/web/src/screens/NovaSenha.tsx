import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Icon, PasswordInput, Simbolo } from '@contro/ui';
import { supabase } from '../lib/supabase';
import styles from './Estado.module.css';

/** Tela de "definir nova senha" após o link de recuperação. */
export function NovaSenha({ onPronto }: { onPronto: () => void }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setMsg(null);
    if (!supabase) return;
    if (senha.length < 6) {
      setErro('A senha precisa de ao menos 6 caracteres.');
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) setErro(error.message);
    else {
      setMsg('Senha atualizada!');
      setTimeout(onPronto, 900);
    }
  }

  return (
    <div className={styles.wrap}>
      <Simbolo size={48} />
      <h1 className={styles.titulo}>Definir nova senha</h1>
      <form className={styles.form} onSubmit={salvar}>
        <PasswordInput
          label="Nova senha"
          autoComplete="new-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        {erro ? (
          <p className={styles.erro}>
            <Icon name="alert" size={18} />
            {erro}
          </p>
        ) : null}
        {msg ? <p className={styles.msg}>{msg}</p> : null}
        <Button type="submit" full disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>
    </div>
  );
}
