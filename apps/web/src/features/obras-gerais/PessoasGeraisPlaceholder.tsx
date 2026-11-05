import { Icon } from '@contro/ui';

/** Provisória: a tela "Pessoas e acessos" de Obras gerais chega na próxima tarefa. */
export function PessoasGeraisPlaceholder({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          aria-label="Voltar"
          onClick={onVoltar}
          style={{
            width: 44,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <Icon name="chevronLeft" size={22} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Pessoas e acessos</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#696969' }}>Obras gerais</p>
        </div>
      </div>
    </div>
  );
}
