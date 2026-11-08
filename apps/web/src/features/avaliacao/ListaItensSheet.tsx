import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BottomSheet, Button, Icon, Input, useToast } from '@contro/ui';
import { loadLista, removerItemLista, salvarItemLista, type ItemLista } from './avaliacaoApi';
import styles from './Avaliacao.module.css';

/**
 * Itens da avaliação (só Gestor; a RLS também bloqueia). Mudanças valem da próxima
 * revisão em diante: cada revisão guarda a própria cópia dos itens.
 */
export function ListaItensSheet({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { data: lista = [], isLoading } = useQuery({
    queryKey: ['avaliacao-lista'],
    queryFn: loadLista,
  });
  const [editando, setEditando] = useState<ItemLista | 'novo' | null>(null);
  const [nome, setNome] = useState('');
  const [secao, setSecao] = useState('');

  const secoes = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of lista) m.set(i.secao, i.secao_ordem);
    return [...m.entries()].sort(([, a], [, b]) => a - b);
  }, [lista]);

  const atualizar = () => qc.invalidateQueries({ queryKey: ['avaliacao-lista'] });
  const salvar = useMutation({
    mutationFn: salvarItemLista,
    onSuccess: () => {
      void atualizar();
      setEditando(null);
    },
    onError: () => showToast({ message: 'Não foi possível salvar. Tente de novo.' }),
  });
  const remover = useMutation({
    mutationFn: (v: { id: string; removido: boolean }) => removerItemLista(v.id, v.removido),
    onSuccess: atualizar,
    onError: () => showToast({ message: 'Não foi possível remover. Tente de novo.' }),
  });

  function abrir(alvo: ItemLista | 'novo') {
    setEditando(alvo);
    setNome(alvo === 'novo' ? '' : alvo.nome);
    setSecao(alvo === 'novo' ? (secoes[0]?.[0] ?? '') : alvo.secao);
  }

  function gravar() {
    const nomeLimpo = nome.trim();
    const secaoLimpa = secao.trim();
    if (!nomeLimpo || !secaoLimpa || !editando) return;
    const maiorSecao = Math.max(0, ...secoes.map(([, o]) => o));
    const secaoOrdem = secoes.find(([s]) => s === secaoLimpa)?.[1] ?? maiorSecao + 1;
    const mantemLugar = editando !== 'novo' && editando.secao_ordem === secaoOrdem;
    const maiorOrdem = Math.max(
      0,
      ...lista.filter((i) => i.secao_ordem === secaoOrdem).map((i) => i.ordem),
    );
    salvar.mutate({
      id: editando === 'novo' ? undefined : editando.id,
      secao_ordem: secaoOrdem,
      secao: secaoLimpa,
      ordem: mantemLugar ? (editando as ItemLista).ordem : maiorOrdem + 1,
      nome: nomeLimpo,
    });
  }

  if (editando) {
    return (
      <BottomSheet
        open
        title={editando === 'novo' ? 'Novo item' : 'Editar item'}
        onClose={() => setEditando(null)}
      >
        <div className={styles.formSheet}>
          <Input label="Item" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input
            label="Ambiente"
            list="avaliacao-ambientes"
            value={secao}
            onChange={(e) => setSecao(e.target.value)}
          />
          <datalist id="avaliacao-ambientes">
            {secoes.map(([s]) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <Button
            full
            disabled={!nome.trim() || !secao.trim() || salvar.isPending}
            onClick={gravar}
          >
            Salvar
          </Button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open title="Itens da avaliação" onClose={onFechar}>
      <p className={styles.dica}>
        {lista.length} itens. Mudanças valem da próxima revisão em diante.
      </p>
      <button type="button" className={styles.terciarioLargo} onClick={() => abrir('novo')}>
        <Icon name="plus" size={18} />
        Novo item
      </button>
      {isLoading ? <p className={styles.dica}>Carregando…</p> : null}
      {secoes.map(([s, ordem]) => (
        <section key={s}>
          <h3 className={styles.listaSecao}>{s}</h3>
          {lista
            .filter((i) => i.secao_ordem === ordem)
            .map((i) => (
              <div key={i.id} className={styles.listaLinha}>
                <span>{i.nome}</span>
                <button
                  type="button"
                  className={styles.icone}
                  aria-label={`Editar ${i.nome}`}
                  onClick={() => abrir(i)}
                >
                  <Icon name="editar" size={18} />
                </button>
                <button
                  type="button"
                  className={styles.icone}
                  aria-label={`Remover ${i.nome}`}
                  onClick={() => {
                    remover.mutate({ id: i.id, removido: true });
                    showToast({
                      message: 'Item removido',
                      onUndo: () => remover.mutate({ id: i.id, removido: false }),
                    });
                  }}
                >
                  <Icon name="lixeira" size={18} />
                </button>
              </div>
            ))}
        </section>
      ))}
    </BottomSheet>
  );
}
