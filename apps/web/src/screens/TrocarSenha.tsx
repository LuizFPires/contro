import { useEffect, useState } from 'react';
import { BottomSheet, Button, PasswordInput, useToast } from '@contro/ui';
import { supabase } from '../lib/supabase';

/** "Trocar senha" no menu do perfil: a pessoa logada define a nova senha ali mesmo. */
export function TrocarSenha({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { showToast } = useToast();
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setSenha('');
      setRepetir('');
      setErro('');
    }
  }, [aberto]);

  async function salvar() {
    if (senha.length < 6) {
      setErro('A senha precisa de ao menos 6 caracteres.');
      return;
    }
    if (senha !== repetir) {
      setErro('As duas senhas não são iguais.');
      return;
    }
    if (!supabase) return;
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      setErro(
        /different from the old/i.test(error.message)
          ? 'A nova senha precisa ser diferente da atual.'
          : 'Não foi possível trocar a senha. Confira a conexão e tente de novo.',
      );
      return;
    }
    showToast({ message: 'Senha trocada' });
    onFechar();
  }

  return (
    <BottomSheet open={aberto} title="Trocar senha" onClose={onFechar}>
      <PasswordInput
        label="Nova senha"
        autoComplete="new-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
      />
      <div style={{ height: 12 }} />
      <PasswordInput
        label="Repita a nova senha"
        autoComplete="new-password"
        value={repetir}
        onChange={(e) => setRepetir(e.target.value)}
      />
      {erro ? (
        <p role="alert" style={{ margin: '12px 0 0', fontSize: 14, fontWeight: 700 }}>
          {erro}
        </p>
      ) : null}
      <p style={{ fontSize: 13, color: '#464646', margin: '12px 0 16px' }}>
        Ao menos 6 caracteres. Vale nos outros aparelhos no próximo acesso.
      </p>
      <Button full disabled={salvando} onClick={salvar}>
        {salvando ? 'Salvando…' : 'Trocar senha'}
      </Button>
    </BottomSheet>
  );
}
