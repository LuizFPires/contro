import { useCallback, useEffect } from 'react';
import { esquecerTelas, useLembrado } from './lib/useLembrado';
import { useQueryClient } from '@tanstack/react-query';
import { PullToRefresh } from './components/PullToRefresh';
import { verificarAtualizacao } from './lib/pwa';
import { useSession } from './auth/useSession';
import { usePerfil } from './features/perfil/usePerfil';
import { ModelosScreen } from './features/modelos/ModelosScreen';
import { SyncIndicator } from './features/offline/SyncIndicator';
import { ReuniaoScreen } from './features/reuniao/ReuniaoScreen';
import { ConfigBoletimScreen } from './features/boletim-auto/ConfigBoletimScreen';
import { ConfigAvisosScreen } from './features/avisos/ConfigAvisosScreen';
import { AprovarMembros } from './features/membros/AprovarMembros';
import { supabase } from './lib/supabase';
import { Login } from './screens/Login';
import { NovaSenha } from './screens/NovaSenha';
import { AguardandoAprovacao } from './screens/AguardandoAprovacao';
import { MinhasObras, type DestinoInicio } from './screens/MinhasObras';
import { TarefasScreen } from './features/obras/TarefasScreen';

export function App() {
  const { carregando, session, recovery, fecharRecovery } = useSession();
  const { data: pessoa, isLoading: perfilCarregando } = usePerfil();
  const qc = useQueryClient();
  // Lembrada: ao voltar ao app (ou à guia), continua na mesma tela.
  const [tela, setTela] = useLembrado<'inicio' | DestinoInicio>('app', 'inicio');

  // Toque num aviso por push abre a tela certa (/?ir=reuniao | tarefas | hoje).
  useEffect(() => {
    const ir = new URLSearchParams(window.location.search).get('ir');
    if (!ir) return;
    if (ir === 'reuniao' || ir === 'tarefas') setTela(ir);
    else if (ir === 'hoje') setTela('inicio');
    window.history.replaceState(null, '', window.location.pathname);
  }, [setTela]);

  // Recarrega o perfil quando a sessão muda (login/logout/recuperação), para o
  // roteamento de membro/pendente usar sempre o perfil do usuário atual.
  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'PASSWORD_RECOVERY'].includes(event)) {
        // Fora do callback: chamar o Supabase aqui dentro (o perfil faz getUser)
        // trava o lock do auth e o app fica em "Carregando…" para sempre.
        setTimeout(() => void qc.resetQueries({ queryKey: ['perfil'] }), 0);
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
  const voltar = () => setTela('inicio');

  return (
    <div className="app-shell">
      <PullToRefresh onRefresh={aoAtualizar}>
        {tela === 'modelos' && ehGestor ? (
          <ModelosScreen onVoltar={voltar} />
        ) : tela === 'reuniao' ? (
          <ReuniaoScreen onVoltar={voltar} />
        ) : tela === 'tarefas' ? (
          <TarefasScreen onVoltar={voltar} />
        ) : tela === 'avisos' && ehGestor ? (
          <ConfigAvisosScreen onVoltar={voltar} />
        ) : tela === 'config' && ehGestor ? (
          <ConfigBoletimScreen onVoltar={voltar} />
        ) : tela === 'membros' && ehGestor ? (
          <AprovarMembros onVoltar={voltar} />
        ) : (
          <MinhasObras
            onIr={setTela}
            onSair={() => {
              esquecerTelas();
              void supabase?.auth.signOut();
            }}
          />
        )}
      </PullToRefresh>
      <SyncIndicator />
    </div>
  );
}
