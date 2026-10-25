import { useState } from 'react';
import { Button, Monograma, TabBar, type TabItem } from '@contro/ui';
import { useSession } from './auth/useSession';
import { usePerfil } from './features/perfil/usePerfil';
import { ModelosScreen } from './features/modelos/ModelosScreen';
import { SyncIndicator } from './features/offline/SyncIndicator';
import { ReuniaoScreen } from './features/reuniao/ReuniaoScreen';
import { ConfigBoletimScreen } from './features/boletim-auto/ConfigBoletimScreen';
import { supabase } from './lib/supabase';
import { Login } from './screens/Login';
import { MinhasObras } from './screens/MinhasObras';

export function App() {
  const { carregando, session } = useSession();
  const { data: pessoa } = usePerfil();
  const [tab, setTab] = useState('inicio');
  const [maisTela, setMaisTela] = useState<'menu' | 'reuniao' | 'config'>('menu');

  if (carregando) {
    return <div className="app-placeholder">Carregando…</div>;
  }

  // Sem sessão (ou Supabase não configurado): tela de login.
  if (!session) {
    return <Login />;
  }

  const ehGestor = pessoa?.perfil === 'gestor';

  const tabs: TabItem[] = [
    { key: 'inicio', label: 'Início', icon: 'home' },
    { key: 'obras', label: 'Obras', icon: 'obras' },
    // Modelos só aparece para o gestor (a RLS também bloqueia a escrita).
    ...(ehGestor ? [{ key: 'modelos', label: 'Modelos', icon: 'modelos' } as TabItem] : []),
    { key: 'mais', label: 'Mais', icon: 'more' },
  ];
  const tabAtiva = tabs.some((t) => t.key === tab) ? tab : 'inicio';

  return (
    <div className="app-shell">
      <header className="app-header">
        <Monograma size={28} />
        <span className="app-wordmark">CONTRO</span>
      </header>

      <main className="app-main">
        {tabAtiva === 'inicio' ? <MinhasObras /> : null}
        {tabAtiva === 'obras' ? <div className="app-placeholder">Obras chegam no M2.</div> : null}
        {tabAtiva === 'modelos' && ehGestor ? <ModelosScreen /> : null}
        {tabAtiva === 'mais' ? (
          maisTela === 'reuniao' ? (
            <ReuniaoScreen onVoltar={() => setMaisTela('menu')} />
          ) : maisTela === 'config' && ehGestor ? (
            <ConfigBoletimScreen onVoltar={() => setMaisTela('menu')} />
          ) : (
            <div className="app-mais">
              {pessoa ? (
                <p className="app-placeholder" style={{ padding: 0, textAlign: 'left' }}>
                  {pessoa.nome}
                </p>
              ) : null}
              <Button onClick={() => setMaisTela('reuniao')}>Reunião da semana</Button>
              {ehGestor ? (
                <Button variant="tertiary" onClick={() => setMaisTela('config')}>
                  Boletim automático
                </Button>
              ) : null}
              <Button variant="tertiary" onClick={() => supabase?.auth.signOut()}>
                Sair
              </Button>
            </div>
          )
        ) : null}
      </main>

      <TabBar items={tabs} active={tabAtiva} onSelect={setTab} />
      <SyncIndicator />
    </div>
  );
}
