import { useCallback, useEffect, useState } from 'react';
import { esquecerTelas, lembrar, useLembrado } from './lib/useLembrado';
import { useQueryClient } from '@tanstack/react-query';
import { PullToRefresh } from './components/PullToRefresh';
import { usePush } from './lib/usePush';
import { verificarAtualizacao } from './lib/pwa';
import { useSession } from './auth/useSession';
import { usePerfil } from './features/perfil/usePerfil';
import { ModelosScreen } from './features/modelos/ModelosScreen';
import { SyncIndicator } from './features/offline/SyncIndicator';
import { NovaVersao } from './features/offline/NovaVersao';
import { ReuniaoScreen } from './features/reuniao/ReuniaoScreen';
import { ReunioesScreen } from './features/reuniao/ReunioesScreen';
import { ConfigBoletimScreen } from './features/boletim-auto/ConfigBoletimScreen';
import { ConfigAvisosScreen } from './features/avisos/ConfigAvisosScreen';
import { AprovarMembros } from './features/membros/AprovarMembros';
import { supabase } from './lib/supabase';
import { Login } from './screens/Login';
import { NovaSenha } from './screens/NovaSenha';
import { AguardandoAprovacao } from './screens/AguardandoAprovacao';
import { MinhasObras, type AbrirObra, type DestinoInicio } from './screens/MinhasObras';
import { TarefasScreen } from './features/obras/TarefasScreen';
import { MinhasAcoesScreen } from './features/obras/MinhasAcoesScreen';
import { LogScreen } from './features/log/LogScreen';
import { ScoreScreen } from './features/score/ScoreScreen';
import type { ItemNav } from './screens/NavInferior';

export function App() {
  const { carregando, session, recovery, fecharRecovery } = useSession();
  const { data: pessoa, isLoading: perfilCarregando } = usePerfil();
  const qc = useQueryClient();
  usePush(Boolean(session && pessoa?.ativo), session?.user.id);
  // Lembrada: ao voltar ao app (ou à guia), continua na mesma tela.
  const [tela, setTela] = useLembrado<'inicio' | DestinoInicio>('app', 'inicio');

  // Reunião escolhida na central (null = a que vem).
  const [reuniaoData, setReuniaoData] = useState<string | null>(null);

  // Minhas ações abre da ata e das Tarefas: o Voltar retorna para lá.
  const [voltarMinhas, setVoltarMinhas] = useState<'inicio' | DestinoInicio>('inicio');
  const irMinhas = (de: 'reuniao' | 'tarefas') => {
    setVoltarMinhas(de);
    setTela('minhas');
  };

  // Toque numa pendência (Tarefas / Minhas ações) abre o Check list da obra
  // naquela pendência; o Voltar da obra retorna para a tela de origem.
  const [abrirObra, setAbrirObra] = useState<AbrirObra | null>(null);
  const abrirPendencia = (de: 'tarefas' | 'minhas') => (obraId: string, pendenciaId: string) => {
    setAbrirObra({ id: obraId, aba: 'pendencias', pendenciaId, voltar: de });
    setTela('inicio');
  };

  // Log aberto pelo relógio do cabeçalho da obra: começa filtrado por ela e o
  // Voltar devolve à obra.
  const [logObra, setLogObra] = useLembrado<string | null>('app:logObra', null);
  const abrirLog = (obraId: string) => {
    setLogObra(obraId);
    setTela('log');
  };
  // Menu inferior no Score e no Log: Hoje/Obras voltam ao início naquela aba.
  const irNav = (item: ItemNav) => {
    setLogObra(null);
    if (item === 'score' || item === 'log') {
      setTela(item);
      return;
    }
    lembrar('inicio:aba', item);
    setTela('inicio');
  };

  // Toque num aviso por push abre a tela certa (/?ir=reuniao | tarefas | minhas | hoje | score | log).
  useEffect(() => {
    const ir = new URLSearchParams(window.location.search).get('ir');
    if (!ir) return;
    if (ir === 'reuniao' || ir === 'tarefas' || ir === 'minhas' || ir === 'score' || ir === 'log')
      setTela(ir);
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
      <NovaVersao />
      <PullToRefresh onRefresh={aoAtualizar}>
        {tela === 'modelos' && ehGestor ? (
          <ModelosScreen onVoltar={voltar} />
        ) : tela === 'reuniao' ? (
          <ReuniaoScreen
            data={reuniaoData}
            onVoltar={() => setTela('reunioes')}
            onMinhas={() => irMinhas('reuniao')}
            onReunioes={() => setTela('reunioes')}
          />
        ) : tela === 'reunioes' ? (
          <ReunioesScreen
            onVoltar={voltar}
            onAbrir={(d) => {
              setReuniaoData(d);
              setTela('reuniao');
            }}
          />
        ) : tela === 'tarefas' ? (
          <TarefasScreen
            onVoltar={voltar}
            onMinhas={() => irMinhas('tarefas')}
            onAbrirPendencia={abrirPendencia('tarefas')}
          />
        ) : tela === 'minhas' ? (
          <MinhasAcoesScreen
            onVoltar={() => setTela(voltarMinhas)}
            onAbrirPendencia={abrirPendencia('minhas')}
          />
        ) : tela === 'score' ? (
          <ScoreScreen onNav={irNav} />
        ) : tela === 'log' ? (
          <LogScreen
            obraInicial={logObra}
            onNav={irNav}
            onVoltar={
              logObra
                ? () => {
                    setAbrirObra({ id: logObra });
                    setLogObra(null);
                    setTela('inicio');
                  }
                : undefined
            }
            onAbrirObra={(o) => {
              setAbrirObra({ ...o, voltar: 'log' });
              setTela('inicio');
            }}
          />
        ) : tela === 'avisos' && ehGestor ? (
          <ConfigAvisosScreen onVoltar={voltar} />
        ) : tela === 'config' && ehGestor ? (
          <ConfigBoletimScreen onVoltar={voltar} />
        ) : tela === 'membros' && ehGestor ? (
          <AprovarMembros onVoltar={voltar} />
        ) : (
          <MinhasObras
            abrirObra={abrirObra}
            onAbrirObraConsumida={() => setAbrirObra(null)}
            onIr={setTela}
            onAbrirLog={abrirLog}
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
