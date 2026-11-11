import { temNomeESobrenome } from '@contro/core';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Icon, Input, Logo, PasswordInput } from '@contro/ui';
import { supabase } from '../lib/supabase';
import { supabaseConfigurado } from '../lib/env';
import styles from './Login.module.css';

type Modo = 'login' | 'signup' | 'forgot';
/** Onde a pessoa vai trabalhar: decide em que fila de aprovação ela cai. */
type Ambiente = 'contorno' | 'geral';

const AMBIENTES: { value: Ambiente; label: string }[] = [
  { value: 'contorno', label: 'Contorno do Corpo' },
  { value: 'geral', label: 'Obras gerais' },
];

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
  // Sem padrão: a pessoa escolhe, para não cair na fila errada.
  const [ambiente, setAmbiente] = useState<Ambiente | ''>('');
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Login recusado por e-mail ainda não confirmado: oferece reenviar o link.
  const [semConfirmar, setSemConfirmar] = useState(false);

  function trocar(m: Modo) {
    setModo(m);
    setErro(null);
    setMsg(null);
    setConfirmar('');
    setSemConfirmar(false);
  }

  async function reenviarConfirmacao() {
    if (!supabase) return;
    setEnviando(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setErro('Não foi possível reenviar agora. Tente de novo em alguns minutos.');
      else {
        setErro(null);
        setSemConfirmar(false);
        setMsg(`Enviamos de novo o link de confirmação para ${email}. Veja também o spam.`);
      }
    } finally {
      setEnviando(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setMsg(null);
    setSemConfirmar(false);
    if (!supabase) {
      setErro('Supabase ainda não configurado neste ambiente.');
      return;
    }
    setEnviando(true);
    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error?.code === 'email_not_confirmed' || /not confirmed/i.test(error?.message ?? '')) {
          setSemConfirmar(true);
          setErro(
            'Seu e-mail ainda não foi confirmado. Toque no link que enviamos ao criar a conta.',
          );
        } else if (error) setErro('Não foi possível entrar. Confira e-mail e senha.');
      } else if (modo === 'signup') {
        if (!temNomeESobrenome(nome)) {
          setErro('Informe nome e sobrenome.');
          return;
        }
        if (!ambiente) {
          setErro('Escolha onde você vai trabalhar.');
          return;
        }
        if (senha !== confirmar) {
          setErro('As senhas não conferem.');
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            data: { nome: nome.trim(), ambiente },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) {
          setErro(/registered/i.test(error.message) ? 'Esse e-mail já tem conta.' : error.message);
        } else if (!data.session) {
          // Confirmação de e-mail ligada: sem sessão até confirmar.
          setMsg(
            `Conta criada. Confirme seu e-mail e aguarde a liberação ${ambiente === 'geral' ? 'do acesso às Obras gerais' : 'do gestor'}.`,
          );
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
              label="Nome e sobrenome"
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

          {modo === 'signup' ? (
            <div className={styles.ambiente}>
              <p className={styles.ambienteRotulo}>Onde você vai trabalhar?</p>
              <div
                className={styles.ambienteOpcoes}
                role="radiogroup"
                aria-label="Onde você vai trabalhar?"
              >
                {AMBIENTES.map((o) => {
                  const marcado = ambiente === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={marcado}
                      className={`${styles.ambienteOpcao} ${marcado ? styles.ambienteMarcado : ''}`}
                      onClick={() => setAmbiente(o.value)}
                    >
                      {marcado ? <Icon name="checkGrosso" size={16} strokeWidth={3} /> : null}
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <p className={styles.ambienteDica}>
                {ambiente === 'geral'
                  ? 'Obras que não são das unidades Contorno do Corpo. O acesso é liberado por obra.'
                  : ambiente === 'contorno'
                    ? 'Obras de reforma das unidades Contorno do Corpo.'
                    : 'Escolha para seu cadastro chegar a quem libera o acesso.'}
              </p>
            </div>
          ) : null}

          {erro ? (
            <p className={styles.erro}>
              <Icon name="alert" size={18} />
              {erro}
            </p>
          ) : null}
          {semConfirmar ? (
            <button
              type="button"
              className={styles.link}
              disabled={enviando}
              onClick={reenviarConfirmacao}
            >
              Reenviar confirmação
            </button>
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
