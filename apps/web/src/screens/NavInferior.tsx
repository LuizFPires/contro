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
  // Badge do Hoje: tudo o que a lista do dia mostra (atrasados + para hoje), como a
  // soma dos cards das obras (pedido do usuário, 04/11/2026). Vermelho só se há atraso.
  const nAtrasos = (obras ?? []).reduce((s, o) => s + o.agenda.atrasados.length, 0);
  const nHoje = (obras ?? []).reduce(
    (s, o) => s + o.agenda.atrasados.length + o.agenda.hoje.length,
    0,
  );
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
          {it.id === 'hoje' && nHoje ? (
            <span className={`${styles.navBadge} ${nAtrasos ? styles.navBadgeAtraso : ''}`}>
              <span className="sr-only">
                {nAtrasos ? `itens do dia, ${nAtrasos} atrasados: ` : 'itens do dia: '}
              </span>
              {nHoje}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
