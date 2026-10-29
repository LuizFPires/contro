import { useEffect, useRef, useState } from 'react';
import {
  aplicarATodas,
  cardAberto,
  itemPronto,
  separarProntos,
  textoApontarLote,
  type ItemLote,
} from '@contro/core';
import { BottomSheet, Button, Icon, Input, useToast } from '@contro/ui';
import { AtividadePicker } from './AtividadePicker';
import { Camera } from './Camera';
import type { NovaPendencia } from './campo';
import type { ObraCompleta } from './detalhe';
import styles from './AdiarSheet.module.css';
import lote from './ApontarLote.module.css';

const CRITS: { valor: 'alta' | 'media' | 'baixa'; rotulo: string }[] = [
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'baixa', rotulo: 'Baixa' },
];

const VAZIA: NovaPendencia = { titulo: '', local: '', criticidade: 'media', atividadeId: null };

/** Campos da pendência (o que, local, criticidade, atividade): apontar e editar. */
function PendenciaCampos({
  obra,
  dados,
  onMudar,
}: {
  obra: ObraCompleta;
  dados: NovaPendencia;
  onMudar: (d: NovaPendencia) => void;
}) {
  return (
    <>
      <div className={styles.rodape} style={{ marginTop: 0 }}>
        <Input
          label="O que"
          value={dados.titulo}
          onChange={(e) => onMudar({ ...dados, titulo: e.target.value })}
        />
        <Input
          label="Local"
          value={dados.local ?? ''}
          onChange={(e) => onMudar({ ...dados, local: e.target.value })}
        />
      </div>

      <p className={styles.rotulo}>Criticidade</p>
      <div className={styles.pills}>
        {CRITS.map((c) => (
          <button
            key={c.valor}
            type="button"
            className={`${styles.pill} ${dados.criticidade === c.valor ? styles.ativo : ''}`}
            onClick={() => onMudar({ ...dados, criticidade: c.valor })}
          >
            {c.rotulo}
          </button>
        ))}
      </div>

      <p className={styles.rotulo}>Atividade (opcional)</p>
      <AtividadePicker
        obra={obra}
        valor={dados.atividadeId}
        onMudar={(atividadeId) => onMudar({ ...dados, atividadeId })}
      />
    </>
  );
}

/** Limpa os textos antes de gravar (local vazio = sem local). */
function limpar(d: NovaPendencia): NovaPendencia {
  return { ...d, titulo: d.titulo.trim(), local: d.local?.trim() || null };
}

type FotoLote = ItemLote & { file: File; url: string };
type Fase = 'escolher' | 'camera' | 'lista';

const paraNova = (it: ItemLote): NovaPendencia => ({
  titulo: it.titulo,
  local: it.local,
  criticidade: it.criticidade,
  atividadeId: it.atividadeId,
});

/**
 * Apontar pendências (pedido do usuário, 29/10/2026): a câmera abre a escolha
 * entre tirar várias fotos seguidas ou importar várias da galeria. Cada foto
 * vira uma pendência; na lista, "Para todas as fotos" preenche local,
 * criticidade e atividade de uma vez, e "Apontar" grava as prontas e mantém as
 * outras na lista.
 */
export function ApontarSheet({
  aberto,
  obra,
  onFechar,
  onApontar,
  onDesfazer,
}: {
  aberto: boolean;
  obra: ObraCompleta;
  onFechar: () => void;
  /** Grava uma pendência (otimista e offline) e devolve o id. */
  onApontar: (dados: NovaPendencia, file: File) => Promise<string>;
  /** Desfazer: exclusão lógica das que acabaram de ser apontadas. */
  onDesfazer: (ids: string[]) => void;
}) {
  const { showToast } = useToast();
  const [fase, setFase] = useState<Fase>('escolher');
  const [itens, setItens] = useState<FotoLote[]>([]);
  // Card aberto: fica fixo enquanto se escreve (não fecha ao ficar "pronto").
  // null = escolher o próximo sem descrição; '' = todos fechados pelo usuário.
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [descartar, setDescartar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());

  // Libera as miniaturas (object URLs) ao sair.
  useEffect(() => {
    const set = urls.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // Cada apontamento começa do zero, mesmo depois de um envio.
  useEffect(() => {
    if (!aberto) return;
    setFase('escolher');
    setItens([]);
    setEscolhido(null);
    setDescartar(false);
  }, [aberto]);

  // Escolha automática (o primeiro sem descrição) vira escolha fixa.
  useEffect(() => {
    if (escolhido === '' || (escolhido && itens.some((it) => it.id === escolhido))) return;
    const prox = cardAberto(itens, null);
    if (prox) setEscolhido(prox);
  }, [itens, escolhido]);

  function liberar(lista: FotoLote[]) {
    for (const it of lista) {
      URL.revokeObjectURL(it.url);
      urls.current.delete(it.url);
    }
  }

  function fechar() {
    liberar(itens);
    setItens([]);
    onFechar();
  }

  function adicionar(files: File[]) {
    const novos = files.map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      return { id: crypto.randomUUID(), file, url };
    });
    // Herda local, criticidade e atividade da última foto (mesmo ambiente).
    setItens((prev) => {
      const base = prev[prev.length - 1];
      return [
        ...prev,
        ...novos.map((n) => ({
          ...n,
          titulo: '',
          local: base?.local ?? '',
          criticidade: base?.criticidade ?? ('media' as const),
          atividadeId: base?.atividadeId ?? null,
        })),
      ];
    });
  }

  function mudar(id: string, d: NovaPendencia) {
    setItens((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              titulo: d.titulo,
              local: d.local ?? '',
              criticidade: d.criticidade,
              atividadeId: d.atividadeId,
            }
          : it,
      ),
    );
  }

  function remover(it: FotoLote) {
    const pos = itens.findIndex((x) => x.id === it.id);
    setItens((prev) => prev.filter((x) => x.id !== it.id));
    showToast({
      message: 'Foto removida',
      onUndo: () =>
        setItens((prev) => {
          const n = [...prev];
          n.splice(Math.min(pos, n.length), 0, it);
          return n;
        }),
    });
  }

  async function apontar() {
    const { prontos, faltam } = separarProntos(itens);
    if (prontos.length === 0) return;
    setEnviando(true);
    const ids: string[] = [];
    try {
      for (const it of prontos) {
        ids.push(await onApontar(limpar(paraNova(it)), it.file));
      }
    } catch {
      showToast({ message: 'Não foi possível apontar todas. Tente de novo.' });
    } finally {
      setEnviando(false);
    }
    const feitas = new Set(prontos.slice(0, ids.length).map((it) => it.id));
    liberar(itens.filter((it) => feitas.has(it.id)));
    const resto = itens.filter((it) => !feitas.has(it.id));
    setItens(resto);
    if (ids.length) {
      showToast({
        message: ids.length === 1 ? 'Pendência apontada' : `${ids.length} pendências apontadas`,
        onUndo: () => onDesfazer(ids),
      });
    }
    if (faltam.length === 0 && resto.length === 0) onFechar();
  }

  if (!aberto) return null;

  const inputGaleria = (
    <input
      ref={galeriaRef}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = '';
        if (files.length) {
          adicionar(files);
          setFase('lista');
        }
      }}
    />
  );

  if (fase === 'escolher') {
    return (
      <BottomSheet
        open
        title="Nova pendência"
        onClose={() => (itens.length ? setFase('lista') : fechar())}
      >
        <p className={lote.dica}>Uma foto por pendência. Pode ser várias de uma vez.</p>
        <div className={lote.escolhas}>
          <button type="button" className={lote.escolhaCamera} onClick={() => setFase('camera')}>
            <Icon name="camera" size={30} />
            Tirar fotos
            <span>uma atrás da outra</span>
          </button>
          <button
            type="button"
            className={lote.escolhaGaleria}
            onClick={() => galeriaRef.current?.click()}
          >
            <Icon name="galeria" size={30} />
            Da galeria
            <span>escolha várias</span>
          </button>
        </div>
        {inputGaleria}
      </BottomSheet>
    );
  }

  if (fase === 'camera') {
    return (
      <Camera
        kicker="Novo apontamento"
        titulo="Fotografe os problemas"
        dica="Uma foto por pendência. Tire quantas precisar e toque em Pronto."
        onCapturar={(file) => adicionar([file])}
        onCancelar={() => (itens.length ? setFase('lista') : fechar())}
        lote={{
          miniaturas: itens.map((it) => it.url),
          onPronto: () => setFase('lista'),
          onGaleria: (files) => {
            adicionar(files);
            setFase('lista');
          },
        }}
      />
    );
  }

  const { prontos, faltam } = separarProntos(itens);
  const aberta = escolhido === '' ? null : cardAberto(itens, escolhido);

  return (
    <div className={lote.tela} role="dialog" aria-label="Novas pendências">
      <header className={lote.cabecalho}>
        <button
          type="button"
          className={lote.fechar}
          aria-label="Descartar fotos"
          onClick={() => (itens.length ? setDescartar(true) : fechar())}
        >
          <Icon name="close" size={22} />
        </button>
        <div className={lote.titulos}>
          <div className={lote.titulo}>
            {itens.length} {itens.length === 1 ? 'nova pendência' : 'novas pendências'}
          </div>
          <div className={lote.sub}>
            {obra.nome} · {prontos.length} de {itens.length}{' '}
            {itens.length === 1 ? 'pronta' : 'prontas'}
          </div>
        </div>
        <button type="button" className={lote.maisFoto} onClick={() => setFase('escolher')}>
          <Icon name="camera" size={16} />+ Foto
        </button>
      </header>

      <div className={lote.lista}>
        {itens.length >= 2 ? (
          <ParaTodas
            obra={obra}
            n={itens.length}
            onAplicar={(campos) => {
              setItens((prev) => aplicarATodas(prev, campos));
              showToast({ message: `Aplicado às ${itens.length} fotos` });
            }}
          />
        ) : null}

        {itens.length === 0 ? (
          <p className={lote.vazio}>Nenhuma foto. Toque em “+ Foto” para adicionar.</p>
        ) : null}

        {itens.map((it, i) => {
          const pronta = itemPronto(it);
          const aberto = it.id === aberta;
          return (
            <div key={it.id} className={lote.card}>
              <div className={lote.cardTopo}>
                <button
                  type="button"
                  className={lote.cardResumo}
                  aria-expanded={aberto}
                  onClick={() => setEscolhido(aberto ? '' : it.id)}
                >
                  <img src={it.url} alt={`Foto ${i + 1}`} className={lote.miniatura} />
                  <span className={lote.cardTexto}>
                    <b>Foto {i + 1}</b>
                    {pronta ? (
                      <span className={lote.pronta}>
                        <Icon name="checkGrosso" size={12} strokeWidth={3} /> Pronta
                      </span>
                    ) : (
                      <span className={lote.falta}>Falta descrever</span>
                    )}
                    {!aberto && pronta ? (
                      <span className={lote.resumo}>
                        {[it.titulo, it.local, ROTULO_CRIT[it.criticidade]]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    ) : null}
                  </span>
                </button>
                <button
                  type="button"
                  className={lote.remover}
                  aria-label={`Remover foto ${i + 1}`}
                  onClick={() => remover(it)}
                >
                  <Icon name="lixeira" size={18} />
                </button>
              </div>
              {aberto ? (
                <div className={lote.campos}>
                  <PendenciaCampos
                    obra={obra}
                    dados={paraNova(it)}
                    onMudar={(d) => mudar(it.id, d)}
                  />
                  {pronta && faltam.length > 0 ? (
                    <button
                      type="button"
                      className={lote.proxima}
                      onClick={() => setEscolhido(faltam.find((f) => f.id !== it.id)?.id ?? null)}
                    >
                      Próxima foto
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className={lote.rodape}>
        {descartar ? (
          <>
            <span className={lote.pergunta}>
              Descartar {itens.length} {itens.length === 1 ? 'foto' : 'fotos'}?
            </span>
            <button type="button" className={lote.secundario} onClick={() => setDescartar(false)}>
              Voltar
            </button>
            <button type="button" className={lote.escuro} onClick={fechar}>
              Descartar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={lote.secundario}
              onClick={() => (itens.length ? setDescartar(true) : fechar())}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={lote.apontar}
              disabled={prontos.length === 0 || enviando}
              onClick={() => void apontar()}
            >
              {enviando ? 'Apontando…' : textoApontarLote(prontos.length, faltam.length)}
            </button>
          </>
        )}
      </div>
      {inputGaleria}
    </div>
  );
}

const ROTULO_CRIT: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

/** "Para todas as fotos": local, criticidade e atividade de uma vez. */
function ParaTodas({
  obra,
  n,
  onAplicar,
}: {
  obra: ObraCompleta;
  n: number;
  onAplicar: (campos: Partial<Pick<ItemLote, 'local' | 'criticidade' | 'atividadeId'>>) => void;
}) {
  const [local, setLocal] = useState('');
  const [crit, setCrit] = useState<ItemLote['criticidade'] | null>(null);
  const [atividadeId, setAtividadeId] = useState<string | null>(null);
  const algum = Boolean(local.trim() || crit || atividadeId);

  return (
    <div className={lote.todas}>
      <div className={lote.todasTitulo}>Para todas as fotos</div>
      <div className={lote.todasDica}>
        Preencha o que se repete; dá para mudar em cada foto depois.
      </div>
      <Input label="Local" value={local} onChange={(e) => setLocal(e.target.value)} />
      <p className={styles.rotulo}>Criticidade</p>
      <div className={styles.pills}>
        {CRITS.map((c) => (
          <button
            key={c.valor}
            type="button"
            aria-pressed={crit === c.valor}
            className={`${styles.pill} ${crit === c.valor ? styles.ativo : ''}`}
            onClick={() => setCrit(crit === c.valor ? null : c.valor)}
          >
            {c.rotulo}
          </button>
        ))}
      </div>
      <p className={styles.rotulo}>Atividade</p>
      <AtividadePicker obra={obra} valor={atividadeId} onMudar={setAtividadeId} />
      <button
        type="button"
        className={lote.aplicar}
        disabled={!algum}
        onClick={() =>
          onAplicar({
            ...(local.trim() ? { local: local.trim() } : {}),
            ...(crit ? { criticidade: crit } : {}),
            ...(atividadeId ? { atividadeId } : {}),
          })
        }
      >
        Aplicar às {n} fotos
      </button>
    </div>
  );
}

/** Editar pendência da lista completa (texto, local, criticidade, atividade). */
export function EditarPendenciaSheet({
  obra,
  inicial,
  onFechar,
  onSalvar,
}: {
  obra: ObraCompleta;
  /** Pendência em edição (null = fechado). */
  inicial: NovaPendencia | null;
  onFechar: () => void;
  onSalvar: (dados: NovaPendencia) => void;
}) {
  const [dados, setDados] = useState<NovaPendencia>(inicial ?? VAZIA);
  useEffect(() => {
    if (inicial) setDados(inicial);
  }, [inicial]);

  return (
    <BottomSheet open={Boolean(inicial)} title="Editar pendência" onClose={onFechar}>
      {inicial ? (
        <>
          <PendenciaCampos obra={obra} dados={dados} onMudar={setDados} />
          <div className={styles.rodape}>
            <Button full disabled={!dados.titulo.trim()} onClick={() => onSalvar(limpar(dados))}>
              Salvar
            </Button>
          </div>
        </>
      ) : null}
    </BottomSheet>
  );
}
