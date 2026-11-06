import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { iniciais, rotuloPapelGeral } from '@contro/core';
import { BottomSheet, Button, Icon, useToast } from '@contro/ui';
import type { PessoaAtual } from '../perfil/usePerfil';
import { AdicionarMembroSheet } from './AdicionarMembroSheet';
import type { PessoaDaObra } from './obraGeral';
import { adicionarMembroObra, removerDaObra } from './planejamento';
import { useObraGeral } from './useObraGeral';
import { usePessoasGerais } from './usePessoasGerais';
import styles from './PessoasDaObra.module.css';

const ROTULO: Record<PessoaDaObra['papel'], string> = {
  administrador: 'Administrador',
  coordenador: rotuloPapelGeral('coordenador'),
  membro: rotuloPapelGeral('membro'),
};

/** Pessoas da obra (Coordenador e Administrador): quem participa, tirar e adicionar membro. */
export function PessoasDaObra({
  obraId,
  pessoa,
  onVoltar,
}: {
  obraId: string;
  pessoa: PessoaAtual;
  onVoltar: () => void;
}) {
  const { data: obra, isLoading, isError } = useObraGeral(obraId);
  // E-mails só vêm da função de Administrador; o Coordenador não os vê.
  const { pessoas: acessos } = usePessoasGerais(pessoa.administrador);
  const emailDe = (id: string) => acessos.find((a) => a.id === id)?.email;
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [tirar, setTirar] = useState<PessoaDaObra | null>(null);
  const [tirando, setTirando] = useState(false);
  const [erro, setErro] = useState('');
  const [adicionando, setAdicionando] = useState(false);

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ['obra', obraId] });
    void qc.invalidateQueries({ queryKey: ['obras-gerais'] });
  };

  // O Administrador mexe em qualquer um; o Coordenador só em Membros (o banco também barra).
  const podeTirar = (p: PessoaDaObra) =>
    p.id !== pessoa.id && (pessoa.administrador || p.papel === 'membro');

  async function confirmarTirar() {
    if (!tirar || tirando) return;
    const alvo = tirar;
    setTirando(true);
    setErro('');
    try {
      await removerDaObra(obraId, alvo.id);
    } catch (e) {
      setTirando(false);
      setErro(e instanceof Error ? e.message : 'Não foi possível tirar da obra.');
      return;
    }
    setTirando(false);
    setTirar(null);
    atualizar();
    showToast({
      message: `${alvo.nome} saiu da obra`,
      onUndo: () =>
        void adicionarMembroObra(obraId, alvo.id)
          .then(atualizar)
          .catch((e: unknown) =>
            showToast({
              message: e instanceof Error ? e.message : 'Não foi possível desfazer',
            }),
          ),
    });
  }

  const participantes = (obra?.pessoas ?? []).filter((p) => p.participa);

  return (
    <div className={styles.screen}>
      <div className={styles.topo}>
        <button type="button" className={styles.voltar} onClick={onVoltar}>
          <Icon name="chevronLeft" size={22} />
          {obra?.nome ?? 'Voltar'}
        </button>
      </div>
      <div className={styles.cabecalho}>
        <h1 className={styles.titulo}>Pessoas da obra</h1>
        <p className={styles.nota}>Administradores sempre veem</p>
      </div>

      {isError ? (
        <p role="alert" className={styles.aviso}>
          Não foi possível carregar as pessoas.
        </p>
      ) : isLoading || !obra ? (
        <p className={styles.aviso}>Carregando…</p>
      ) : (
        <>
          <h2 className={styles.secao}>Na obra</h2>
          <ul className={styles.lista}>
            {participantes.map((p) => {
              const conteudo = (
                <>
                  <span className={styles.iniciais} aria-hidden="true">
                    {iniciais(p.nome)}
                  </span>
                  <span className={styles.texto}>
                    <span className={styles.nome}>
                      {p.nome}
                      {p.id === pessoa.id ? ' (você)' : ''}
                    </span>
                    <span className={styles.meta}>{ROTULO[p.papel]}</span>
                    {p.papel === 'membro' && emailDe(p.id) ? (
                      <span className={styles.meta}>{emailDe(p.id)}</span>
                    ) : null}
                  </span>
                  {podeTirar(p) ? <Icon name="seta" size={18} /> : null}
                </>
              );
              return (
                <li key={p.id}>
                  {podeTirar(p) ? (
                    <button
                      type="button"
                      className={styles.linha}
                      aria-label={`${p.nome}, ${ROTULO[p.papel]}. Tirar da obra`}
                      onClick={() => {
                        setErro('');
                        setTirar(p);
                      }}
                    >
                      {conteudo}
                    </button>
                  ) : (
                    <div className={styles.linha}>{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className={styles.rodape}>
            <Button onClick={() => setAdicionando(true)}>Adicionar membro</Button>
          </div>
        </>
      )}

      <BottomSheet
        open={tirar !== null}
        title={tirar ? `Tirar ${tirar.nome} da obra?` : ''}
        onClose={() => setTirar(null)}
      >
        <p className={styles.texto2}>As atividades abertas dele ficam sem responsável.</p>
        {erro ? (
          <p role="alert" className={styles.erro}>
            {erro}
          </p>
        ) : null}
        <div className={styles.botoes}>
          <Button variant="tertiary" disabled={tirando} onClick={() => setTirar(null)}>
            Cancelar
          </Button>
          <Button variant="secondary" disabled={tirando} onClick={() => void confirmarTirar()}>
            {tirando ? 'Tirando…' : 'Tirar da obra'}
          </Button>
        </div>
      </BottomSheet>

      {obra ? (
        <AdicionarMembroSheet
          aberto={adicionando}
          obra={obra}
          pessoa={pessoa}
          onFechar={() => setAdicionando(false)}
          onAtualizar={atualizar}
        />
      ) : null}
    </div>
  );
}
