import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Icon, Input, Monograma } from '@obdc/ui';
import { supabase } from '../lib/supabase';
import { supabaseConfigurado } from '../lib/env';
import styles from './Login.module.css';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!supabase) {
      setErro('Supabase ainda não configurado neste ambiente.');
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) {
      setErro('Não foi possível entrar. Confira e-mail e senha.');
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.brand}>
        <Monograma size={72} />
        <p className={styles.tagline}>obras da contorno</p>
      </div>

      {!supabaseConfigurado ? (
        <div className={styles.aviso}>
          Para ativar o login, preencha <code>VITE_SUPABASE_URL</code> e{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> em <code>apps/web/.env</code> com o projeto de
          desenvolvimento do Supabase.
        </div>
      ) : null}

      <form className={styles.form} onSubmit={entrar}>
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
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
        <Button type="submit" full disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}
