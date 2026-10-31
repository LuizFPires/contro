import { useEffect, useState } from 'react';
import { Icon } from '@contro/ui';
import { VERSAO_APP, forcarAtualizacao, versaoNoServidor } from '../../lib/pwa';
import styles from './NovaVersao.module.css';

const INTERVALO = 10 * 60 * 1000; // 10 min

/**
 * Aviso provisório de versão nova (pedido do usuário, 31/10/2026): compara a
 * versão do app com a publicada e oferece "Atualizar". Checa ao abrir, ao voltar
 * para o app e a cada 10 min.
 */
export function NovaVersao() {
  const [nova, setNova] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    let vivo = true;
    const checar = async () => {
      const v = await versaoNoServidor();
      if (vivo && v && v !== VERSAO_APP) setNova(true);
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
      <span className={styles.texto}>Nova versão do CONTRO</span>
      <button
        type="button"
        className={styles.botao}
        disabled={atualizando}
        onClick={() => {
          setAtualizando(true);
          void forcarAtualizacao();
        }}
      >
        {atualizando ? 'Atualizando…' : 'Atualizar'}
      </button>
    </div>
  );
}
