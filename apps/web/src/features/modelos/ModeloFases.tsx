import { useState } from 'react';
import { faixasDeFases } from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { FaseModelo } from './FaseModelo';
import { ModeloEditor } from './ModeloEditor';
import { useEdicaoModelo } from './useEdicaoModelo';
import { useModeloCompleto } from './useModeloDetalhe';
import { useModelos, useModelosMutations } from './useModelos';
import styles from './Modelos.module.css';

/** Um modelo e suas fases (protótipo · ModeloCel · LISTA DE FASES). */
export function ModeloFases({
  id,
  onVoltar,
  onAbrir,
}: {
  id: string;
  onVoltar: () => void;
  /** Abre outro modelo (após duplicar). */
  onAbrir: (id: string) => void;
}) {
  const { data: modelo, isLoading } = useModeloCompleto(id);
  const { data: modelos } = useModelos();
  const { duplicar, renomear, excluir, restaurar } = useModelosMutations();
  const ed = useEdicaoModelo(id);
  const { showToast } = useToast();
  const [faseAberta, setFaseAberta] = useState<string | null>(null);
  const [editar, setEditar] = useState(false);
  const [nome, setNome] = useState('');
  const [sub, setSub] = useState('');
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [tabela, setTabela] = useState(false);

  if (isLoading || !modelo) {
    return (
      <div className={styles.screen}>
        <header className={styles.cabecalho}>
          <div className={styles.barraTopo}>
            <button
              type="button"
              className={styles.iconeBtn}
              aria-label="Voltar aos modelos"
              onClick={onVoltar}
            >
              <Icon name="chevronLeft" size={22} />
            </button>
            <div className={styles.sobretitulo}>Carregando…</div>
          </div>
        </header>
      </div>
    );
  }

  // Visão complementar (computador): tabela por fase com Gantt e caminho crítico.
  if (tabela) {
    return <ModeloEditor id={id} onVoltar={() => setTabela(false)} />;
  }

  if (faseAberta && modelo.fases.some((f) => f.id === faseAberta)) {
    return <FaseModelo modelo={modelo} faseId={faseAberta} onVoltar={() => setFaseAberta(null)} />;
  }

  const topo = modelo.atividades.filter((a) => !a.pai_id);
  const total = modelo.cronograma.total || 1;
  const faixas = new Map(
    faixasDeFases(modelo.fases, modelo.atividades, modelo.cronograma).map((f) => [f.id, f]),
  );
  const unico = (modelos?.length ?? 0) < 2;

  function abrirEditar() {
    setNome(modelo?.nome ?? '');
    setSub(modelo?.subtitulo ?? '');
    setConfirmaExcluir(false);
    setEditar(true);
  }

  function salvarNome() {
    if (!nome.trim()) return;
    renomear.mutate(
      { id, nome: nome.trim(), subtitulo: sub.trim() || null },
      {
        onSuccess: () => setEditar(false),
        onError: (e) => showToast({ message: (e as Error).message }),
      },
    );
  }

  function excluirModelo() {
    if (!confirmaExcluir) {
      setConfirmaExcluir(true);
      return;
    }
    excluir.mutate(id, {
      onSuccess: () => {
        setEditar(false);
        onVoltar();
        showToast({
          message: `"${modelo?.nome}" excluído · obras que já usam continuam iguais`,
          onUndo: () => restaurar.mutate(id),
        });
      },
      onError: (e) => showToast({ message: (e as Error).message }),
    });
  }

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <div className={styles.barraTopo}>
          <button
            type="button"
            className={styles.iconeBtn}
            aria-label="Voltar aos modelos"
            onClick={onVoltar}
          >
            <Icon name="chevronLeft" size={22} />
          </button>
          <div className={styles.sobretitulo}>Modelo de obra</div>
          <button
            type="button"
            className={styles.editar}
            aria-label="Editar nome e subtítulo"
            onClick={abrirEditar}
          >
            <Icon name="editar" size={16} strokeWidth={2} />
            Editar
          </button>
        </div>
        <div className={styles.titulos}>
          <h1 className={styles.titulo}>{modelo.nome}</h1>
          {modelo.subtitulo ? <div className={styles.subtitulo}>{modelo.subtitulo}</div> : null}
          <div className={styles.miudo}>
            {topo.length} atividades · {modelo.cronograma.total} dias úteis até a entrega
          </div>
        </div>
      </header>

      <div className={styles.lista}>
        {modelo.fases.map((f, i) => {
          const fx = faixas.get(f.id);
          const n = topo.filter((a) => a.fase_id === f.id).length;
          return (
            <button
              key={f.id}
              type="button"
              className={styles.cartao}
              onClick={() => setFaseAberta(f.id)}
            >
              <span className={`${styles.numero} ${styles.numeroP}`}>{i + 1}</span>
              <span className={styles.cartaoCorpo}>
                <span className={styles.cartaoNomeP}>{f.titulo}</span>
                <span className={styles.cartaoInfo}>
                  {fx
                    ? `${n} ${n === 1 ? 'atividade' : 'atividades'} · D${fx.es + 1} a D${fx.ef}`
                    : 'sem atividades'}
                </span>
                <span className={styles.faixa} aria-hidden="true">
                  {fx ? (
                    <span
                      style={{
                        left: `${(fx.es / total) * 100}%`,
                        width: `${((fx.ef - fx.es) / total) * 100}%`,
                      }}
                    />
                  ) : null}
                </span>
              </span>
              <Icon name="seta" size={20} className={styles.seta} />
            </button>
          );
        })}
        <button
          type="button"
          className={styles.tracejado}
          disabled={ed.criarFase.isPending}
          onClick={() =>
            ed.criarFase.mutate(
              { titulo: 'Nova fase', ordem: modelo.fases.length + 1 },
              {
                onSuccess: () => showToast({ message: 'Fase criada · toque nela para dar nome' }),
                onError: (e) => showToast({ message: (e as Error).message }),
              },
            )
          }
        >
          + Nova fase
        </button>
        <button type="button" className={styles.linkTabela} onClick={() => setTabela(true)}>
          Ver tabela completa com Gantt (melhor no computador)
        </button>
      </div>

      <div className={styles.rodape}>
        <div className={styles.nota}>
          <Icon name="check" size={16} strokeWidth={2.4} />
          Alterações salvas no modelo. Obras já iniciadas não mudam.
        </div>
        <button
          type="button"
          className={styles.btnPreto}
          disabled={duplicar.isPending}
          onClick={() =>
            duplicar.mutate(
              { origem: id, nome: `Cópia de ${modelo.nome}`, subtitulo: modelo.subtitulo },
              {
                onSuccess: (novoId) => {
                  onAbrir(novoId);
                  showToast({ message: 'Modelo duplicado · toque em Editar para dar nome' });
                },
                onError: (e) => showToast({ message: (e as Error).message }),
              },
            )
          }
        >
          Duplicar como novo modelo
        </button>
      </div>

      <BottomSheet open={editar} onClose={() => setEditar(false)}>
        <div className={styles.folha}>
          <label className={styles.rotulo}>
            Nome do modelo
            <input
              className={styles.campo}
              value={nome}
              placeholder="Ex.: Modelo 2"
              onChange={(e) => setNome(e.target.value)}
            />
          </label>
          <label className={styles.rotulo}>
            Subtítulo
            <input
              className={styles.campo}
              value={sub}
              placeholder="Ex.: CDC sem vestiários"
              onChange={(e) => setSub(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={confirmaExcluir ? styles.btnConfirma : styles.btnContorno}
            disabled={unico || excluir.isPending}
            onClick={excluirModelo}
          >
            {unico
              ? 'Único modelo · não pode excluir'
              : confirmaExcluir
                ? 'Toque de novo para excluir'
                : 'Excluir modelo'}
          </button>
          <button
            type="button"
            className={styles.btnPrimario}
            disabled={!nome.trim() || renomear.isPending}
            onClick={salvarNome}
          >
            Salvar
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
