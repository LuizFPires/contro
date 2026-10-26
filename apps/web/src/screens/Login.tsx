import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Icon, Input, Logo, PasswordInput } from '@contro/ui';
import { supabase } from '../lib/supabase';
import { supabaseConfigurado } from '../lib/env';
import styles from './Login.module.css';

type Modo = 'login' | 'signup' | 'forgot';

const TITULO: Record<Modo, string> = {
  login: 'Entrar',
  signup: 'Criar conta',
  forgot: 'Recuperar senha',
};

export function Login() {
  const [modo, setModo] = useState<Modo>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function trocar(m: Modo) {
    setModo(m);
    setErro(null);
    setMsg(null);
    setConfirmar('');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setMsg(null);
    if (!supabase) {
      setErro('Supabase ainda não configurado neste ambiente.');
      return;
    }
    setEnviando(true);
    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) setErro('Não foi possível entrar. Confira e-mail e senha.');
      } else if (modo === 'signup') {
        if (!nome.trim()) {
          setErro('Informe seu nome.');
          return;
        }
        if (senha !== confirmar) {
          setErro('As senhas não conferem.');
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome: nome.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) {
          setErro(/registered/i.test(error.message) ? 'Esse e-mail já tem conta.' : error.message);
        } else if (!data.session) {
          // Confirmação de e-mail ligada: sem sessão até confirmar.
          setMsg('Conta criada. Confirme seu e-mail e aguarde a liberação do gestor.');
          setModo('login');
        }
        // Com sessão (confirmação desligada): o app assume e mostra "aguardando aprovação".
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) setErro(error.message);
        else {
          setMsg('Se o e-mail existir, enviamos um link para redefinir a senha.');
          setModo('login');
        }
      }
    } finally {
      setEnviando(false);
    }
  }

  const rotuloBotao =
    modo === 'login'
      ? enviando
        ? 'Entrando…'
        : 'Entrar'
      : modo === 'signup'
        ? enviando
          ? 'Criando…'
          : 'Criar conta'
        : enviando
          ? 'Enviando…'
          : 'Enviar link';

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.capsule}>
            <Logo on="preto" height={40} />
          </span>
        </div>

        {!supabaseConfigurado ? (
          <div className={styles.aviso}>
            Para ativar o login, preencha <code>VITE_SUPABASE_URL</code> e{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> em <code>apps/web/.env</code> com o projeto de
            desenvolvimento do Supabase.
          </div>
        ) : null}

        {msg ? <p className={styles.msg}>{msg}</p> : null}

        <form className={styles.form} onSubmit={onSubmit}>
          <p className={styles.modoTitulo}>{TITULO[modo]}</p>

          {modo === 'signup' ? (
            <Input
              label="Nome"
              autoComplete="name"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          ) : null}

          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {modo !== 'forgot' ? (
            <PasswordInput
              label="Senha"
              autoComplete={modo === 'signup' ? 'new-password' : 'current-password'}
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          ) : null}

          {modo === 'signup' ? (
            <PasswordInput
              label="Repita a senha"
              autoComplete="new-password"
              required
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
            />
          ) : null}

          {erro ? (
            <p className={styles.erro}>
              <Icon name="alert" size={18} />
              {erro}
            </p>
          ) : null}

          <Button type="submit" full disabled={enviando}>
            {rotuloBotao}
          </Button>
        </form>

        <div className={styles.acoes}>
          {modo === 'login' ? (
            <>
              <button type="button" className={styles.link} onClick={() => trocar('signup')}>
                Criar conta
              </button>
              <button type="button" className={styles.link} onClick={() => trocar('forgot')}>
                Esqueci a senha
              </button>
            </>
          ) : (
            <button type="button" className={styles.link} onClick={() => trocar('login')}>
              Já tenho conta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
