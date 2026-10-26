import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Logo, TabBar, type TabItem } from '@contro/ui';
import { PullToRefresh } from './components/PullToRefresh';
import { verificarAtualizacao } from './lib/pwa';
import { useSession } from './auth/useSession';
import { usePerfil } from './features/perfil/usePerfil';
import { ModelosScreen } from './features/modelos/ModelosScreen';
import { SyncIndicator } from './features/offline/SyncIndicator';
import { ReuniaoScreen } from './features/reuniao/ReuniaoScreen';
import { ConfigBoletimScreen } from './features/boletim-auto/ConfigBoletimScreen';
import { AprovarMembros } from './features/membros/AprovarMembros';
import { supabase } from './lib/supabase';
import { Login } from './screens/Login';
import { NovaSenha } from './screens/NovaSenha';
import { AguardandoAprovacao } from './screens/AguardandoAprovacao';
import { MinhasObras } from './screens/MinhasObras';

export function App() {
  const { carregando, session, recovery, fecharRecovery } = useSession();
  const { data: pessoa, isLoading: perfilCarregando } = usePerfil();
  const qc = useQueryClient();
  const [tab, setTab] = useState('inicio');
  const [maisTela, setMaisTela] = useState<'menu' | 'reuniao' | 'config' | 'membros'>('menu');

  // Recarrega o perfil quando a sessão muda (login/logout/recuperação), para o
  // roteamento de membro/pendente usar sempre o perfil do usuário atual.
  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'PASSWORD_RECOVERY'].includes(event)) {
        void qc.resetQueries({ queryKey: ['perfil'] });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  // "Puxar pra atualizar": primeiro procura uma versão nova do app; se houver,
  // o service worker assume e a página recarrega sozinha. Se já estiver na
  // última versão, só reconsulta os dados (um tempinho mínimo para o indicador
  // não piscar).
  const aoAtualizar = useCallback(async () => {
    const temVersaoNova = await verificarAtualizacao();
    if (temVersaoNova) return; // a página vai recarregar
    await Promise.all([
      qc.refetchQueries({ type: 'active' }),
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);
  }, [qc]);

  if (carregando) {
    return <div className="app-placeholder">Carregando…</div>;
  }

  // Sem sessão (ou Supabase não configurado): tela de login/cadastro.
  if (!session) {
    return <Login />;
  }

  // Chegou por link de recuperação de senha.
  if (recovery) {
    return <NovaSenha onPronto={fecharRecovery} />;
  }

  if (perfilCarregando) {
    return <div className="app-placeholder">Carregando…</div>;
  }

  // Logado, mas ainda não aprovado pelo gestor (ou sem pessoa).
  if (pessoa?.ativo !== true) {
    return <AguardandoAprovacao nome={pessoa?.nome} />;
  }

  const ehGestor = pessoa.perfil === 'gestor';

  const tabs: TabItem[] = [
    // "Início" já é a lista "Minhas obras" (não há aba "Obras" separada).
    { key: 'inicio', label: 'Início', icon: 'home' },
    // Modelos só aparece para o gestor (a RLS também bloqueia a escrita).
    ...(ehGestor ? [{ key: 'modelos', label: 'Modelos', icon: 'modelos' } as TabItem] : []),
    { key: 'mais', label: 'Mais', icon: 'more' },
  ];
  const tabAtiva = tabs.some((t) => t.key === tab) ? tab : 'inicio';

  return (
    <div className="app-shell">
      <header className="app-header">
        <Logo on="preto" height={22} />
      </header>

      <PullToRefresh onRefresh={aoAtualizar}>
        {tabAtiva === 'inicio' ? <MinhasObras /> : null}
        {tabAtiva === 'modelos' && ehGestor ? <ModelosScreen /> : null}
        {tabAtiva === 'mais' ? (
          maisTela === 'reuniao' ? (
            <ReuniaoScreen onVoltar={() => setMaisTela('menu')} />
          ) : maisTela === 'config' && ehGestor ? (
            <ConfigBoletimScreen onVoltar={() => setMaisTela('menu')} />
          ) : maisTela === 'membros' && ehGestor ? (
            <AprovarMembros onVoltar={() => setMaisTela('menu')} />
          ) : (
            <div className="app-mais">
              <p className="app-placeholder" style={{ padding: 0, textAlign: 'left' }}>
                {pessoa.nome}
              </p>
              <Button onClick={() => setMaisTela('reuniao')}>Reunião da semana</Button>
              {ehGestor ? (
                <Button variant="tertiary" onClick={() => setMaisTela('config')}>
                  Boletim automático
                </Button>
              ) : null}
              {ehGestor ? (
                <Button variant="tertiary" onClick={() => setMaisTela('membros')}>
                  Aprovar membros
                </Button>
              ) : null}
              <Button variant="tertiary" onClick={() => supabase?.auth.signOut()}>
                Sair
              </Button>
            </div>
          )
        ) : null}
      </PullToRefresh>

      <TabBar items={tabs} active={tabAtiva} onSelect={setTab} />
      <SyncIndicator />
    </div>
  );
}
