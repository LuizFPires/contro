import { Button, Simbolo } from '@contro/ui';
import { supabase } from '../lib/supabase';
import styles from './Estado.module.css';

export function FalhaPerfil({ tentando, onTentar }: { tentando: boolean; onTentar: () => void }) {
  return (
    <div className={styles.wrap} role="alert">
      <Simbolo size={56} />
      <h1 className={styles.titulo}>Não foi possível carregar seu acesso</h1>
      <p className={styles.texto}>
        Seu login foi identificado, mas não conseguimos consultar seu perfil. Tente novamente. Se
        continuar, saia e entre de novo.
      </p>
      <Button onClick={onTentar} disabled={tentando}>
        {tentando ? 'Tentando…' : 'Tentar novamente'}
      </Button>
      <Button variant="tertiary" onClick={() => supabase?.auth.signOut()}>
        Sair
      </Button>
    </div>
  );
}
