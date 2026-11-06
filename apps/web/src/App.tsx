import { useCallback, useEffect, useState } from 'react';
import type { Ambiente } from '@contro/core';
import { esquecerTelas, lembrar, useLembrado } from './lib/useLembrado';
import { useQueryClient } from '@tanstack/react-query';
import { PullToRefresh } from './components/PullToRefresh';
import { usePush } from './lib/usePush';
import { verificarAtualizacao } from './lib/pwa';
import { useSession } from './auth/useSession';
import { usePerfil } from './features/perfil/usePerfil';
import { useAmbiente } from './features/perfil/useAmbiente';
import { ObrasGeraisCasca } from './features/obras-gerais/ObrasGeraisCasca';
import { guardarAbaGeral } from './features/obras-gerais/abaObraGeral';
import { PessoasAcessos } from './features/obras-gerais/PessoasAcessos';
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
  const [tela, setTela] = useLembrado<'inicio' | 'pessoas-gerais' | DestinoInicio>('app', 'inicio');
  // Contorno ou Obras gerais (o último escolhido fica lembrado); trocar volta ao início.
  const voltarAoInicio = useCallback(() => setTela('inicio'), [setTela]);
  const {
    ambiente,
    disponiveis,
    trocar: trocarAmbiente,
    irPara,
  } = useAmbiente(pessoa, voltarAoInicio);

  // Aviso tocado: o ambiente do destino é ajustado quando o perfil carregar.
  const [avisoPendente, setAvisoPendente] = useState<Ambiente | null>(null);
  // Cada entrada pelo aviso do Hoje geral remonta a casca para reler a aba da sessão.
  const [entradaGeral, setEntradaGeral] = useState(0);

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
  // Cada entrada no Log (relógio, menu, aviso) remonta a tela para reler o filtro lembrado.
  const [logEntrada, setLogEntrada] = useState(0);
  const abrirLog = (obraId: string) => {
    setLogObra(obraId);
    lembrar('log:obra', obraId); // o Log começa filtrado por ela (uma vez)
    setLogEntrada((n) => n + 1);
    setTela('log');
  };
  // Menu inferior no Score e no Log: Hoje/Obras voltam ao início naquela aba.
  const irNav = (item: ItemNav) => {
    setLogObra(null);
    // Log pelo menu: todas as obras (o filtro da obra é do relógio da obra).
    if (item === 'log') {
      lembrar('log:obra', null);
      setLogEntrada((n) => n + 1);
    }
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
    // Aviso de reunião de obra geral: abre a reunião da obra (a que vem).
    if (ir === 'geral-reuniao') {
      const obra = new URLSearchParams(window.location.search).get('obra');
      if (obra) {
        lembrar('obrasgerais:reuniao', { obraId: obra, data: null });
        lembrar('obrasgerais:avisos', null);
        lembrar('obrasgerais:boletim', null);
        lembrar('obrasgerais:boletimConfig', null);
      }
      setAvisoPendente('geral');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    // Aviso de boletim de obra geral: abre o boletim da obra.
    if (ir === 'geral-boletim') {
      const obra = new URLSearchParams(window.location.search).get('obra');
      lembrar('obrasgerais:reuniao', null);
      lembrar('obrasgerais:avisos', null);
      lembrar('obrasgerais:boletimConfig', null);
      if (obra) lembrar('obrasgerais:boletim', obra);
      setAvisoPendente('geral');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    // Avisos das obras gerais: abrem o Hoje de Obras gerais.
    if (ir === 'geral-hoje') {
      lembrar('obrasgerais:reuniao', null);
      lembrar('obrasgerais:avisos', null);
      lembrar('obrasgerais:boletim', null);
      lembrar('obrasgerais:boletimConfig', null);
      setAvisoPendente('geral');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    // Aviso não vem de uma obra: o Log abre em todas as obras.
    setLogObra(null);
    if (ir === 'log') {
      lembrar('log:obra', null);
      setLogEntrada((n) => n + 1);
    }
    if (ir === 'reuniao' || ir === 'tarefas' || ir === 'minhas' || ir === 'score' || ir === 'log')
      setTela(ir);
    else if (ir === 'hoje') setTela('inicio');
    // Os avisos são da Contorno: o ambiente é ajustado quando o perfil carregar.
    setAvisoPendente('contorno');
    window.history.replaceState(null, '', window.location.pathname);
  }, [setTela, setLogObra]);

  // Aviso tocado, depois do perfil carregado: vai ao ambiente do destino.
  // Aviso da Contorno: vai para a Contorno sem perder o destino (sem acesso, fica em
  // Obras gerais). Aviso das obras gerais: vai para Obras gerais na aba Hoje, com a obra
  // lembrada intacta (sem acesso, ignora o link).
  useEffect(() => {
    if (!avisoPendente || perfilCarregando || !pessoa) return;
    if (disponiveis.length === 0) return;
    setAvisoPendente(null);
    if (avisoPendente === 'geral') {
      if (!disponiveis.includes('geral')) {
        lembrar('obrasgerais:reuniao', null);
        lembrar('obrasgerais:boletim', null);
        return;
      }
      guardarAbaGeral('hoje');
      lembrar('obrasgerais:pessoas', null);
      irPara('geral');
      setTela('inicio');
      setEntradaGeral((n) => n + 1);
      return;
    }
    if (disponiveis.includes('contorno')) irPara('contorno');
    else setTela('inicio');
  }, [avisoPendente, perfilCarregando, pessoa, disponiveis, irPara, setTela]);

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
  const sair = () => {
    esquecerTelas();
    guardarAbaGeral('hoje');
    void supabase?.auth.signOut();
  };

  // Ativa, mas sem Contorno e sem papel em Obras gerais: nada a mostrar ainda.
  if (disponiveis.length === 0) {
    return <AguardandoAprovacao nome={pessoa.nome} />;
  }

  // Obras gerais: tela própria. As telas da Contorno só para quem tem a Contorno.
  if (ambiente === 'geral' || !disponiveis.includes('contorno')) {
    return (
      <div className="app-shell">
        <NovaVersao />
        <PullToRefresh onRefresh={aoAtualizar}>
          {tela === 'pessoas-gerais' && pessoa.administrador ? (
            <PessoasAcessos onVoltar={voltar} />
          ) : (
            <ObrasGeraisCasca
              key={entradaGeral}
              pessoa={pessoa}
              ambiente={ambiente}
              disponiveis={disponiveis}
              onTrocarAmbiente={trocarAmbiente}
              onSair={sair}
              onPessoas={() => setTela('pessoas-gerais')}
            />
          )}
        </PullToRefresh>
        <SyncIndicator />
      </div>
    );
  }

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
            key={`${logObra ?? 'todas'}:${logEntrada}`}
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
            onNav={irNav}
            onAbrirLog={abrirLog}
            onSair={sair}
            ambiente={ambiente}
            disponiveis={disponiveis}
            onTrocarAmbiente={trocarAmbiente}
          />
        )}
      </PullToRefresh>
      <SyncIndicator />
    </div>
  );
}
