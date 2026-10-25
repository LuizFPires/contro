import { Button, Simbolo } from '@contro/ui';
import { supabase } from '../lib/supabase';
import styles from './Estado.module.css';

/** Mostrada quando a pessoa logou mas ainda não foi aprovada pelo gestor. */
export function AguardandoAprovacao({ nome }: { nome?: string }) {
  return (
    <div className={styles.wrap}>
      <Simbolo size={56} />
      <h1 className={styles.titulo}>Conta criada!</h1>
      <p className={styles.texto}>
        {nome ? `${nome}, sua` : 'Sua'} conta está <strong>aguardando a liberação do gestor</strong>
        . Assim que ele aprovar, você verá as obras aqui.
      </p>
      <Button variant="tertiary" onClick={() => supabase?.auth.signOut()}>
        Sair
      </Button>
    </div>
  );
}
