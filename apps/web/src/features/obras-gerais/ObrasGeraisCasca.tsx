import { useEffect, useState } from 'react';
import { rotuloAmbiente, type Ambiente } from '@contro/core';
import { Icon, Logo, Simbolo } from '@contro/ui';
import { useLembrado } from '../../lib/useLembrado';
import { ItemMenu, PerfilSheet } from '../perfil/PerfilSheet';
import type { PessoaAtual } from '../perfil/usePerfil';
import { abaGeralDaSessao, guardarAbaGeral, obraDaAbaGeral } from './abaObraGeral';
import { AcoesObraGeral } from './AcoesObraGeral';
import { HojeGeral } from './HojeGeral';
import { NavGeral, type AbaGeral } from './NavGeral';
import { ObraGeralDetalhe } from './ObraGeralDetalhe';
import { ObrasGeraisInicio } from './ObrasGeraisInicio';
import { PessoasDaObra } from './PessoasDaObra';
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
 * Casca das obras gerais: cabeçalho (marca, ambiente, perfil), a aba (Hoje ou
 * Obra/Obras) e o menu de baixo. Abre no Hoje. O Administrador vê a lista em Obras e
 * abre a obra em tela própria; Coordenador e Membro têm a obra como aba.
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
  const [escolhendo, setEscolhendo] = useState(false);
  // A obra aberta fica lembrada: ao voltar ao app, reabre nela.
  const [obraAberta, setObraAberta] = useLembrado<string | null>('obrasgerais:obra', null);
  // Tela de ações da equipe (de uma obra ou de todas), só nesta sessão, com a aba e a obra de
  // onde foi aberta (o Voltar volta para lá). `retornoAcoes` guarda a tela (com o chip) ao abrir
  // uma ficha: fechar a ficha volta para ela.
  const [acoesAberta, setAcoesAberta] = useState<TelaAcoes | null>(null);
  const [retornoAcoes, setRetornoAcoes] = useState<TelaAcoes | null>(null);
  // Linha tocada no Hoje: fechar a ficha ou voltar da obra volta ao Hoje (e à obra lembrada).
  const [retornoHoje, setRetornoHoje] = useState<{ obraAnterior: string | null } | null>(null);
  // Linha tocada no Hoje: a obra abre na ficha dessa atividade (uma vez).
  const [atalho, setAtalho] = useState<{ obraId: string; atividadeId: string } | null>(null);
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
  }, [pessoasObraId, podePessoasDaObra, setPessoasObraId]);

  const abrirAtividade = (obraId: string, atividadeId: string) => {
    setAtalho({ obraId, atividadeId });
    setObraAberta(obraId);
    setAba('obra');
  };
  const abrirAcoes = (obraIds: string[]) => {
    setRetornoHoje(null);
    setAcoesAberta({ obraIds, abaAnterior: aba, obraAnterior: obraAberta });
  };
  const voltarAoHoje = (r: { obraAnterior: string | null }) => {
    setRetornoHoje(null);
    setObraAberta(r.obraAnterior);
    setAba('hoje');
  };
  // Tocar numa aba do menu esquece de onde a tela veio.
  const escolherAba = (a: AbaGeral) => {
    setRetornoAcoes(null);
    setRetornoHoje(null);
    setAba(a);
  };
  const lista = obras ?? [];
  const agendas = (resumo ?? []).map((o) => o.agenda);
  const nav = (
    <NavGeral ativo={aba} administrador={admin} agendas={agendas} onEscolher={escolherAba} />
  );

  const detalhe = (id: string, semVoltar: boolean) => (
    <ObraGeralDetalhe
      id={id}
      pessoa={pessoa}
      semVoltar={semVoltar}
      abrirAtividadeId={atalho?.obraId === id ? atalho.atividadeId : undefined}
      onAtalhoUsado={() => setAtalho(null)}
      onVoltar={retornoHoje ? () => voltarAoHoje(retornoHoje) : () => setObraAberta(null)}
      onTrocarObra={setObraAberta}
      onAbrirPessoas={() => setPessoasObraId(id)}
      onAbrirPerfil={admin ? undefined : () => setPerfilAberto(true)}
      onAbrirAcoes={() => abrirAcoes([id])}
      onFichaFechada={
        retornoAcoes
          ? () => {
              setAcoesAberta(retornoAcoes);
              setRetornoAcoes(null);
            }
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
        aberto={escolhendo}
        obras={lista}
        atualId=""
        papel="Coordenador"
        onEscolher={(id) => {
          setEscolhendo(false);
          setPessoasObraId(id);
        }}
        onFechar={() => setEscolhendo(false)}
      />

      <PerfilSheet
        aberto={perfilAberto}
        onFechar={() => setPerfilAberto(false)}
        pessoa={pessoa}
        ambiente={ambiente}
        disponiveis={disponiveis}
        onTrocarAmbiente={onTrocarAmbiente}
        itensDoAmbiente={
          admin ? (
            <ItemMenu
              icon="pessoa"
              rotulo="Pessoas e acessos"
              onClick={() => {
                setPerfilAberto(false);
                onPessoas();
              }}
            />
          ) : coordenador ? (
            <ItemMenu
              icon="pessoa"
              rotulo="Pessoas da obra"
              onClick={() => {
                setPerfilAberto(false);
                if (lista.length === 1) setPessoasObraId(lista[0]!.id);
                else if (lista.length > 1) setEscolhendo(true);
              }}
            />
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
        <button
          type="button"
          className={inicio.perfil}
          aria-label="Perfil e ajustes"
          onClick={() => setPerfilAberto(true)}
        >
          <Icon name="pessoa" size={22} />
        </button>
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
          />
        ) : (
          <div className={inicio.vazio}>
            <Simbolo size={56} />
            <h2>Nenhuma obra geral ainda.</h2>
          </div>
        )
      ) : (
        <ObrasGeraisInicio pessoa={pessoa} onAbrirObra={setObraAberta} onAbrirAcoes={abrirAcoes} />
      )}

      {nav}

      {folhas}
    </div>
  );
}
