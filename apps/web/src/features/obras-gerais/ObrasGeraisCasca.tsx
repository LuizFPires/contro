import { useEffect, useState } from 'react';
import { rotuloAmbiente, type Ambiente } from '@contro/core';
import { Icon, Logo, Simbolo } from '@contro/ui';
import { lembrar, useLembrado } from '../../lib/useLembrado';
import { chaveFiltroLog } from '../log/formatos';
import { LogScreen } from '../log/LogScreen';
import { ScoreScreen } from '../score/ScoreScreen';
import { ItemMenu, PerfilSheet } from '../perfil/PerfilSheet';
import type { PessoaAtual } from '../perfil/usePerfil';
import { abaGeralDaSessao, guardarAbaGeral, obraDaAbaGeral } from './abaObraGeral';
import { AcoesObraGeral } from './AcoesObraGeral';
import { HojeGeral } from './HojeGeral';
import { NavGeral, type AbaGeral } from './NavGeral';
import { ObraGeralDetalhe } from './ObraGeralDetalhe';
import { ObrasGeraisInicio } from './ObrasGeraisInicio';
import { PessoasDaObra } from './PessoasDaObra';
import { ConfigBoletimScreen } from '../boletim-auto/ConfigBoletimScreen';
import { ProntosParaEnviar } from '../boletim-auto/ProntosParaEnviar';
import { BoletimGeralScreen } from './boletim/BoletimGeralScreen';
import { ConfigAvisosObraScreen } from './reuniao/ConfigAvisosObraScreen';
import { ReuniaoGeralScreen } from './reuniao/ReuniaoGeralScreen';
import { ReunioesGeraisScreen } from './reuniao/ReunioesGeraisScreen';
import { TrocarObraSheet } from './TrocarObraSheet';
import { useObrasGerais } from './useObrasGerais';
import { useResumoObrasGerais } from './useResumoObrasGerais';
import inicio from './ObrasGeraisInicio.module.css';
import styles from './ObrasGeraisCasca.module.css';

/** Tela de ações da equipe: as obras, o chip escolhido e de onde foi aberta. */
interface TelaAcoes {
  obraIds: string[];
  filtro?: string;
  abaAnterior: AbaGeral;
  obraAnterior: string | null;
}

/**
 * Casca das obras gerais: cabeçalho (marca, ambiente, perfil), a aba (Hoje,
 * Obra/Obras, Score ou Log) e o menu de baixo. Abre no Hoje. Score e Log abrem aqui,
 * com o mesmo menu, e mostram só as obras gerais que a pessoa vê. O Administrador vê
 * a lista em Obras e abre a obra em tela própria; Coordenador e Membro têm a obra como
 * aba.
 */
export function ObrasGeraisCasca({
  pessoa,
  ambiente,
  disponiveis,
  onTrocarAmbiente,
  onSair,
  onPessoas,
}: {
  pessoa: PessoaAtual;
  ambiente: Ambiente;
  disponiveis: Ambiente[];
  onTrocarAmbiente: (a: Ambiente) => void;
  onSair: () => void;
  onPessoas: () => void;
}) {
  // Abre sempre no Hoje; a aba escolhida vale até o app fechar.
  const [aba, setAbaEstado] = useState<AbaGeral>(abaGeralDaSessao);
  const setAba = (a: AbaGeral) => {
    guardarAbaGeral(a);
    setAbaEstado(a);
  };
  const [perfilAberto, setPerfilAberto] = useState(false);
  // Pessoas da obra (Coordenador e Administrador): a obra aberta nessa tela e o seletor de obra.
  const [pessoasObraId, setPessoasObraId] = useLembrado<string | null>('obrasgerais:pessoas', null);
  // Seletor de obra do perfil: para Pessoas da obra ou para Reunião e avisos.
  const [escolhendo, setEscolhendo] = useState<'pessoas' | 'avisos' | 'boletim' | null>(null);
  // Reunião e avisos da obra (Coordenador e Administrador).
  const [avisosObraId, setAvisosObraId] = useLembrado<string | null>('obrasgerais:avisos', null);
  // Boletim da obra aberto (ícone da obra, "Prontos para enviar" ou o aviso) e, para o
  // Administrador, a configuração do boletim automático de uma obra.
  const [boletimObraId, setBoletimObraId] = useLembrado<string | null>('obrasgerais:boletim', null);
  const [boletimConfigObraId, setBoletimConfigObraId] = useLembrado<string | null>(
    'obrasgerais:boletimConfig',
    null,
  );
  // Reunião da obra aberta (o aviso de reunião abre direto nela) e a lista das reuniões
  // (Administrador: todas as obras; da reunião: só a obra dela).
  const [reuniaoAberta, setReuniaoAberta] = useLembrado<{
    obraId: string;
    data: string | null;
  } | null>('obrasgerais:reuniao', null);
  const [reunioesAberta, setReunioesAberta] = useState<string[] | null>(null);
  // A obra aberta fica lembrada: ao voltar ao app, reabre nela.
  const [obraAberta, setObraAberta] = useLembrado<string | null>('obrasgerais:obra', null);
  // Tela de ações da equipe (de uma obra ou de todas), só nesta sessão, com a aba e a obra de
  // onde foi aberta (o Voltar volta para lá). `retornoAcoes` guarda a tela (com o chip) ao abrir
  // uma ficha: fechar a ficha volta para ela.
  const [acoesAberta, setAcoesAberta] = useState<TelaAcoes | null>(null);
  const [retornoAcoes, setRetornoAcoes] = useState<TelaAcoes | null>(null);
  // Linha tocada no Hoje: fechar a ficha ou voltar da obra volta ao Hoje (e à obra lembrada).
  const [retornoHoje, setRetornoHoje] = useState<{ obraAnterior: string | null } | null>(null);
  // Linha tocada no Hoje (ou card nas ações): a obra abre na ficha dessa atividade ou no
  // Check list com a pendência (uma vez).
  const [atalho, setAtalho] = useState<{
    obraId: string;
    atividadeId?: string;
    pendenciaId?: string;
  } | null>(null);
  const { data: obras } = useObrasGerais();
  const {
    data: resumo,
    isLoading: resumoCarregando,
    isError: resumoErro,
    refetch,
  } = useResumoObrasGerais();

  const admin = pessoa.administrador;
  const coordenador = !admin && pessoa.papelGeral === 'coordenador';
  const podePessoasDaObra = admin || coordenador;
  // Chave lembrada de quem já não tem o papel: limpa.
  useEffect(() => {
    if (pessoasObraId && !podePessoasDaObra) setPessoasObraId(null);
    if (avisosObraId && !podePessoasDaObra) setAvisosObraId(null);
    if (boletimConfigObraId && !admin) setBoletimConfigObraId(null);
  }, [
    pessoasObraId,
    avisosObraId,
    boletimConfigObraId,
    podePessoasDaObra,
    admin,
    setPessoasObraId,
    setAvisosObraId,
    setBoletimConfigObraId,
  ]);

  // Abrir a ficha ou a pendência fecha as telas que ficam por cima da obra (reunião, lista
  // das reuniões, boletim): sem isso o card tocado nas ações da ata voltava para a reunião.
  const irParaObra = (obraId: string) => {
    setReuniaoAberta(null);
    setReunioesAberta(null);
    setBoletimObraId(null);
    setObraAberta(obraId);
    setAba('obra');
  };
  const abrirAtividade = (obraId: string, atividadeId: string) => {
    setAtalho({ obraId, atividadeId });
    irParaObra(obraId);
  };
  const abrirPendencia = (obraId: string, pendenciaId: string) => {
    setAtalho({ obraId, pendenciaId });
    irParaObra(obraId);
  };
  // Volta às ações de onde a ficha ou a pendência foi aberta.
  const voltarAsAcoes = (r: TelaAcoes) => {
    setAcoesAberta(r);
    setRetornoAcoes(null);
  };
  const abrirAcoes = (obraIds: string[], filtro?: string) => {
    setRetornoHoje(null);
    setAcoesAberta({ obraIds, filtro, abaAnterior: aba, obraAnterior: obraAberta });
  };
  const voltarAoHoje = (r: { obraAnterior: string | null }) => {
    setRetornoHoje(null);
    setObraAberta(r.obraAnterior);
    setAba('hoje');
  };
  // Tocar numa aba do menu esquece de onde a tela veio. O Log pelo menu começa em
  // todas as obras (como na Contorno); a remontagem relê o filtro lembrado.
  const [logEntrada, setLogEntrada] = useState(0);
  const escolherAba = (a: AbaGeral) => {
    setRetornoAcoes(null);
    setRetornoHoje(null);
    if (a === 'log') {
      lembrar(chaveFiltroLog('geral', 'obra'), null);
      setLogEntrada((n) => n + 1);
    }
    setAba(a);
  };
  const lista = obras ?? [];
  const agendas = (resumo ?? []).map((o) => o.agenda);
  // `antesDeIr`: o detalhe do Score fecha antes de trocar de aba.
  const navCom = (antesDeIr?: () => void) => (
    <NavGeral
      ativo={aba}
      administrador={admin}
      agendas={agendas}
      onEscolher={(a) => {
        antesDeIr?.();
        escolherAba(a);
      }}
    />
  );
  const nav = navCom();

  const detalhe = (id: string, semVoltar: boolean) => (
    <ObraGeralDetalhe
      id={id}
      pessoa={pessoa}
      semVoltar={semVoltar}
      abrirAtividadeId={atalho?.obraId === id ? atalho.atividadeId : undefined}
      abrirPendenciaId={atalho?.obraId === id ? atalho.pendenciaId : undefined}
      onAtalhoUsado={() => setAtalho(null)}
      onVoltar={
        retornoAcoes
          ? () => voltarAsAcoes(retornoAcoes)
          : retornoHoje
            ? () => voltarAoHoje(retornoHoje)
            : () => setObraAberta(null)
      }
      onTrocarObra={setObraAberta}
      onAbrirPessoas={() => setPessoasObraId(id)}
      onAbrirPerfil={admin ? undefined : () => setPerfilAberto(true)}
      onAbrirAcoes={() => abrirAcoes([id])}
      onAbrirReuniao={() => setReuniaoAberta({ obraId: id, data: null })}
      onAbrirBoletim={() => setBoletimObraId(id)}
      onFichaFechada={
        retornoAcoes
          ? () => voltarAsAcoes(retornoAcoes)
          : retornoHoje
            ? () => voltarAoHoje(retornoHoje)
            : undefined
      }
    />
  );

  // Gavetas de perfil e de escolha de obra: as mesmas no Hoje, na lista e na obra.
  const folhas = (
    <>
      <TrocarObraSheet
        aberto={escolhendo !== null}
        obras={lista}
        atualId=""
        papel={admin ? 'Administrador' : 'Coordenador'}
        onEscolher={(id) => {
          if (escolhendo === 'avisos') setAvisosObraId(id);
          else if (escolhendo === 'boletim') setBoletimConfigObraId(id);
          else setPessoasObraId(id);
          setEscolhendo(null);
        }}
        onFechar={() => setEscolhendo(null)}
      />

      <PerfilSheet
        aberto={perfilAberto}
        onFechar={() => setPerfilAberto(false)}
        pessoa={pessoa}
        ambiente={ambiente}
        disponiveis={disponiveis}
        onTrocarAmbiente={onTrocarAmbiente}
        itensDoAmbiente={
          admin || coordenador ? (
            <>
              <ItemMenu
                icon="calendario"
                rotulo="Reunião e avisos"
                onClick={() => {
                  setPerfilAberto(false);
                  if (lista.length === 1) setAvisosObraId(lista[0]!.id);
                  else if (lista.length > 1) setEscolhendo('avisos');
                }}
              />
              {admin ? (
                <ItemMenu
                  icon="documento"
                  rotulo="Boletim automático"
                  onClick={() => {
                    setPerfilAberto(false);
                    if (lista.length === 1) setBoletimConfigObraId(lista[0]!.id);
                    else if (lista.length > 1) setEscolhendo('boletim');
                  }}
                />
              ) : null}
              {admin ? (
                <ItemMenu
                  icon="pessoa"
                  rotulo="Pessoas e acessos"
                  onClick={() => {
                    setPerfilAberto(false);
                    onPessoas();
                  }}
                />
              ) : (
                <ItemMenu
                  icon="pessoa"
                  rotulo="Pessoas da obra"
                  onClick={() => {
                    setPerfilAberto(false);
                    if (lista.length === 1) setPessoasObraId(lista[0]!.id);
                    else if (lista.length > 1) setEscolhendo('pessoas');
                  }}
                />
              )}
            </>
          ) : null
        }
        onSair={onSair}
      />
    </>
  );

  if (acoesAberta) {
    return (
      <AcoesObraGeral
        obraIds={acoesAberta.obraIds}
        pessoa={pessoa}
        filtroInicial={acoesAberta.filtro}
        onVoltar={() => {
          setAcoesAberta(null);
          setRetornoAcoes(null);
          setObraAberta(acoesAberta.obraAnterior);
          setAba(acoesAberta.abaAnterior);
        }}
        onAbrirAtividade={(obraId, atividadeId, filtro) => {
          setRetornoAcoes({ ...acoesAberta, filtro });
          setAcoesAberta(null);
          abrirAtividade(obraId, atividadeId);
        }}
        onAbrirPendencia={(obraId, pendenciaId, filtro) => {
          setRetornoAcoes({ ...acoesAberta, filtro });
          setAcoesAberta(null);
          abrirPendencia(obraId, pendenciaId);
        }}
      />
    );
  }

  if (boletimObraId) {
    return <BoletimGeralScreen obraId={boletimObraId} onVoltar={() => setBoletimObraId(null)} />;
  }

  const obraBoletimConfig = boletimConfigObraId
    ? lista.find((o) => o.id === boletimConfigObraId)
    : undefined;
  if (boletimConfigObraId && admin) {
    return (
      <ConfigBoletimScreen
        key={boletimConfigObraId}
        obra={{ id: boletimConfigObraId, nome: obraBoletimConfig?.nome ?? 'a obra' }}
        onVoltar={() => setBoletimConfigObraId(null)}
      />
    );
  }

  if (reuniaoAberta) {
    const { obraId } = reuniaoAberta;
    return (
      <ReuniaoGeralScreen
        key={`${obraId}:${reuniaoAberta.data ?? 'proxima'}`}
        obraId={obraId}
        data={reuniaoAberta.data}
        pessoa={pessoa}
        onVoltar={() => setReuniaoAberta(null)}
        onReunioes={() => {
          setReunioesAberta([obraId]);
          setReuniaoAberta(null);
        }}
        onMinhas={() => abrirAcoes([obraId], pessoa.id)}
      />
    );
  }

  if (reunioesAberta) {
    return (
      <ReunioesGeraisScreen
        obras={lista.filter((o) => reunioesAberta.includes(o.id))}
        onVoltar={() => setReunioesAberta(null)}
        onAbrir={(obraId, data) => setReuniaoAberta({ obraId, data })}
      />
    );
  }

  const obraAvisos = avisosObraId ? lista.find((o) => o.id === avisosObraId) : undefined;
  if (avisosObraId && podePessoasDaObra) {
    return (
      <ConfigAvisosObraScreen
        obraId={avisosObraId}
        obraNome={obraAvisos?.nome ?? ''}
        onVoltar={() => setAvisosObraId(null)}
      />
    );
  }

  if (pessoasObraId && podePessoasDaObra) {
    return (
      <PessoasDaObra
        obraId={pessoasObraId}
        pessoa={pessoa}
        onVoltar={() => setPessoasObraId(null)}
      />
    );
  }

  // Score e Log: telas próprias com o menu (antes da obra aberta, que é da aba Obra).
  if (aba === 'score') return <ScoreScreen ambiente="geral" menu={navCom} />;
  if (aba === 'log') return <LogScreen key={logEntrada} ambiente="geral" menu={nav} />;

  // Administrador: na aba Obras, a obra abre em tela própria (sem o menu); o Voltar
  // volta à lista. Fora dela, a obra lembrada espera o toque em Obras.
  if (admin && aba === 'obra' && obraAberta) return detalhe(obraAberta, false);

  // Coordenador e Membro: a obra é a aba Obra (com uma só, sem Voltar).
  const obraDaAba = !admin && aba === 'obra' ? obraDaAbaGeral(lista, obraAberta) : null;
  if (obraDaAba) {
    return (
      <div className={styles.screen}>
        <div className={styles.conteudo}>{detalhe(obraDaAba, lista.length <= 1)}</div>
        {nav}
        {folhas}
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <header className={inicio.cabecalho}>
        <div className={inicio.marca}>
          <Logo on="preto" height={30} />
          {disponiveis.length > 1 ? (
            <span className={inicio.ambiente}>{rotuloAmbiente(ambiente)}</span>
          ) : null}
        </div>
        <div className={inicio.acoesCabecalho}>
          {podePessoasDaObra ? (
            <ProntosParaEnviar ambiente="geral" onAbrirBoletim={setBoletimObraId} />
          ) : null}
          <button
            type="button"
            className={inicio.perfil}
            aria-label="Perfil e ajustes"
            onClick={() => setPerfilAberto(true)}
          >
            <Icon name="pessoa" size={22} />
          </button>
        </div>
      </header>

      {aba === 'hoje' ? (
        resumoCarregando ? (
          <p className={inicio.aviso}>Carregando…</p>
        ) : resumoErro && !resumo ? (
          <div className={inicio.vazio}>
            <h2>Sem conexão. Tente de novo.</h2>
            <button type="button" className={inicio.tentar} onClick={() => void refetch()}>
              Tentar de novo
            </button>
          </div>
        ) : resumo && resumo.length > 0 ? (
          <HojeGeral
            obras={resumo}
            onAbrirAtividade={(obraId, atividadeId) => {
              setRetornoAcoes(null);
              setRetornoHoje({ obraAnterior: obraAberta });
              abrirAtividade(obraId, atividadeId);
            }}
            onAbrirAcoes={(obraId) => abrirAcoes([obraId])}
          />
        ) : (
          <div className={inicio.vazio}>
            <Simbolo size={56} />
            <h2>Nenhuma obra geral ainda.</h2>
          </div>
        )
      ) : (
        <ObrasGeraisInicio
          pessoa={pessoa}
          onAbrirObra={setObraAberta}
          onAbrirAcoes={abrirAcoes}
          onAbrirReunioes={() => setReunioesAberta(lista.map((o) => o.id))}
        />
      )}

      {nav}

      {folhas}
    </div>
  );
}
