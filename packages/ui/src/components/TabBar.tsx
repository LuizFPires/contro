import { Icon, type IconName } from './Icon';
import styles from './TabBar.module.css';

export interface TabItem {
  key: string;
  label: string;
  icon: IconName;
}

export interface TabBarProps {
  items: TabItem[];
  active: string;
  onSelect: (key: string) => void;
}

export function TabBar({ items, active, onSelect }: TabBarProps) {
  return (
    <nav className={styles.bar} aria-label="Navegação principal">
      {items.map((item) => {
        const isActive = item.key === active;
        const cls = [styles.tab, isActive ? styles.active : ''].filter(Boolean).join(' ');
        return (
          <button
            key={item.key}
            type="button"
            className={cls}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(item.key)}
          >
            <Icon name={item.icon} size={24} />
            <span className={styles.label}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
