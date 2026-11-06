import type { AgendaObra } from '@contro/core';
import { Icon, type IconName } from '@contro/ui';
import styles from '../../screens/NavInferior.module.css';

export type AbaGeral = 'hoje' | 'obra' | 'score' | 'log';

/**
 * Menu inferior das obras gerais: Hoje · Obra (Coordenador e Membro) ou Obras
 * (Administrador) · Score · Log. Mesmo visual e mesma regra de selo do menu da Contorno: o selo do
 * Hoje soma atrasados e para hoje das obras, vermelho só quando há atraso.
 */
export function NavGeral({
  ativo,
  administrador,
  agendas,
  onEscolher,
}: {
  ativo: AbaGeral;
  administrador: boolean;
  agendas: AgendaObra[];
  onEscolher: (aba: AbaGeral) => void;
}) {
  const itens: { id: AbaGeral; rotulo: string; icone: IconName }[] = [
    { id: 'hoje', rotulo: 'Hoje', icone: 'calendario' },
    { id: 'obra', rotulo: administrador ? 'Obras' : 'Obra', icone: 'obras' },
    { id: 'score', rotulo: 'Score', icone: 'score' },
    { id: 'log', rotulo: 'Log', icone: 'relogio' },
  ];
  const nAtrasos = agendas.reduce((s, a) => s + a.atrasados.length, 0);
  const nHoje = agendas.reduce((s, a) => s + a.atrasados.length + a.hoje.length, 0);
  return (
    <nav className={styles.nav} aria-label="Menu principal">
      {itens.map((it) => (
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
