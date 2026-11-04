import { Icon, type IconName } from '@contro/ui';
import { useObras } from '../features/obras/useObras';
import styles from './NavInferior.module.css';

export type ItemNav = 'hoje' | 'obras' | 'score' | 'log';

const ITENS: { id: ItemNav; rotulo: string; icone: IconName }[] = [
  { id: 'hoje', rotulo: 'Hoje', icone: 'calendario' },
  { id: 'obras', rotulo: 'Obras', icone: 'obras' },
  { id: 'score', rotulo: 'Score', icone: 'score' },
  { id: 'log', rotulo: 'Log', icone: 'relogio' },
];

/**
 * Menu inferior (tela inicial, Score e Log): quatro itens com ícone; o ativo
 * fica com fundo preto e ícone/texto brancos. O selo vermelho do Hoje conta os
 * atrasos de todas as obras.
 */
export function NavInferior({
  ativo,
  onEscolher,
}: {
  ativo: ItemNav;
  onEscolher: (item: ItemNav) => void;
}) {
  const { data: obras } = useObras();
  const nAtrasos = (obras ?? []).reduce((s, o) => s + o.agenda.atrasados.length, 0);
  return (
    <nav className={styles.nav} aria-label="Menu principal">
      {ITENS.map((it) => (
        <button
          key={it.id}
          type="button"
          className={`${styles.navBtn} ${ativo === it.id ? styles.navAtivo : ''}`}
          aria-current={ativo === it.id ? 'page' : undefined}
          onClick={() => onEscolher(it.id)}
        >
          <Icon name={it.icone} size={22} />
          {it.rotulo}
          {it.id === 'hoje' && nAtrasos ? (
            <span className={styles.navBadge}>
              <span className="sr-only">atrasos: </span>
              {nAtrasos}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
