import { useState } from 'react';
import { Button, Monograma, TabBar, type TabItem } from '@contro/ui';
import { useSession } from './auth/useSession';
import { usePerfil } from './features/perfil/usePerfil';
import { ModelosScreen } from './features/modelos/ModelosScreen';
import { SyncIndicator } from './features/offline/SyncIndicator';
import { ReuniaoScreen } from './features/reuniao/ReuniaoScreen';
import { supabase } from './lib/supabase';
import { Login } from './screens/Login';
import { MinhasObras } from './screens/MinhasObras';

export function App() {
  const { carregando, session } = useSession();
  const { data: pessoa } = usePerfil();
  const [tab, setTab] = useState('inicio');
  const [reuniaoAberta, setReuniaoAberta] = useState(false);

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
          reuniaoAberta ? (
            <ReuniaoScreen onVoltar={() => setReuniaoAberta(false)} />
          ) : (
            <div className="app-mais">
              {pessoa ? (
                <p className="app-placeholder" style={{ padding: 0, textAlign: 'left' }}>
                  {pessoa.nome}
                </p>
              ) : null}
              <Button onClick={() => setReuniaoAberta(true)}>Reunião da semana</Button>
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
