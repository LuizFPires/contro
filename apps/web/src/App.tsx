import { useState } from 'react';
import { Button, Monograma, TabBar, type TabItem } from '@obdc/ui';
import { useSession } from './auth/useSession';
import { supabase } from './lib/supabase';
import { Login } from './screens/Login';
import { MinhasObras } from './screens/MinhasObras';

const TABS: TabItem[] = [
  { key: 'inicio', label: 'Início', icon: 'home' },
  { key: 'obras', label: 'Obras', icon: 'obras' },
  { key: 'mais', label: 'Mais', icon: 'more' },
];

export function App() {
  const { carregando, session } = useSession();
  const [tab, setTab] = useState('inicio');

  if (carregando) {
    return <div className="app-placeholder">Carregando…</div>;
  }

  // Sem sessão (ou Supabase não configurado): tela de login.
  if (!session) {
    return <Login />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Monograma size={28} />
        <span className="app-wordmark">obdc</span>
      </header>

      <main className="app-main">
        {tab === 'inicio' ? <MinhasObras /> : null}
        {tab === 'obras' ? <div className="app-placeholder">Obras chegam no M2.</div> : null}
        {tab === 'mais' ? (
          <div className="app-mais">
            <Button variant="tertiary" onClick={() => supabase?.auth.signOut()}>
              Sair
            </Button>
          </div>
        ) : null}
      </main>

      <TabBar items={TABS} active={tab} onSelect={setTab} />
    </div>
  );
}
