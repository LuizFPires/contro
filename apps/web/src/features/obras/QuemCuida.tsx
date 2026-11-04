import { Icon } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import type { TarefaObra } from './tarefasObra';
import styles from './QuemCuida.module.css';

/** "Quem cuida: <nome> · até <data>": a tarefa aberta vinculada, se houver (só leitura). */
export function QuemCuida({ tarefa: t }: { tarefa: TarefaObra | undefined }) {
  if (!t) return null;
  return (
    <span className={styles.quem}>
      <Icon name="pessoa" size={14} strokeWidth={2.2} />
      Quem cuida: {t.responsavelNome ?? 'Sem nome'} · até {formatarDataCurta(t.prazo)}
    </span>
  );
}
