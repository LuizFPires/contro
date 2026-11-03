import { useEffect, useState } from 'react';
import { Icon, useToast } from '@contro/ui';
import { VERSAO_APP, forcarAtualizacao, versaoNoServidor } from '../../lib/pwa';
import styles from './NovaVersao.module.css';

const INTERVALO = 60 * 1000; // 1 min

/**
 * Aviso provisório de versão nova (pedido do usuário, 31/10/2026): compara a
 * versão do app com a publicada e oferece "Atualizar". Checa ao abrir, ao voltar
 * para o app e a cada minuto.
 */
export function NovaVersao() {
  const { showToast } = useToast();
  const [nova, setNova] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    let vivo = true;
    const checar = async () => {
      const v = await versaoNoServidor();
      if (vivo && v) setNova(v !== VERSAO_APP);
    };
    void checar();
    const t = window.setInterval(() => void checar(), INTERVALO);
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void checar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      vivo = false;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, []);

  if (!nova) return null;

  return (
    <div className={styles.aviso} role="status">
      <Icon name="sync" size={18} />
      <span className={styles.texto}>Nova versão disponível</span>
      <button
        type="button"
        className={styles.botao}
        disabled={atualizando}
        onClick={async () => {
          setAtualizando(true);
          const versao = await versaoNoServidor();
          if (!versao) {
            setAtualizando(false);
            showToast({
              message: 'Não foi possível conectar. Tente atualizar quando estiver online.',
            });
            return;
          }
          try {
            await forcarAtualizacao();
          } catch {
            setAtualizando(false);
            showToast({ message: 'Não foi possível atualizar agora. Tente novamente.' });
          }
        }}
      >
        {atualizando ? 'Atualizando…' : 'Atualizar versão'}
      </button>
    </div>
  );
}
