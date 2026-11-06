import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { aplicarOrdem, moverId, type FaseGeral } from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import type { ObraGeral } from './obraGeral';
import { reordenarAtividadesGeral, reordenarFasesGeral } from './planejamento';
import styles from './OrganizarObraGeral.module.css';

/**
 * Organizar a obra geral (quem planeja): arrastar as fases pela alça para mudar a
 * sequência e, dentro de cada fase, as atividades. O número da fase acompanha a ordem.
 * Cada soltura salva na hora, com Desfazer por 5 s.
 */
export function OrganizarObraGeral({
  obraId,
  fases,
  onPronto,
}: {
  obraId: string;
  fases: FaseGeral[];
  onPronto: () => void;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [aberta, setAberta] = useState<string | null>(null);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const chave = ['obra', obraId];

  /** Mostra a ordem nova na hora, salva e oferece Desfazer; se falhar, volta. */
  function salvar(
    mudar: (o: ObraGeral, ids: string[]) => ObraGeral,
    enviar: (ids: string[]) => Promise<void>,
    antes: string[],
    depois: string[],
  ) {
    const aplicar = (ids: string[]) =>
      qc.setQueryData<ObraGeral | null>(chave, (o) => (o ? mudar(o, ids) : o));
    const enviarE = (ids: string[], desfazendo: boolean) => {
      aplicar(ids);
      enviar(ids)
        .then(() => {
          void qc.invalidateQueries({ queryKey: ['obras-gerais'] });
          if (!desfazendo)
            showToast({ message: 'Ordem salva.', onUndo: () => enviarE(antes, true) });
        })
        .catch((e: Error) => {
          void qc.invalidateQueries({ queryKey: chave });
          showToast({ message: e.message || 'Não foi possível salvar a ordem.' });
        });
    };
    enviarE(depois, false);
  }

  function soltarFase(ev: DragEndEvent) {
    const antes = fases.map((f) => f.id);
    const depois = moverId(antes, String(ev.active.id), String(ev.over?.id ?? ''));
    if (depois === antes) return;
    salvar(
      (o, ids) => ({ ...o, fases: aplicarOrdem(o.fases, ids) }),
      (ids) => reordenarFasesGeral(obraId, ids),
      antes,
      depois,
    );
  }

  function soltarAtividade(fase: FaseGeral, ev: DragEndEvent) {
    const antes = fase.atividades.map((a) => a.id);
    const depois = moverId(antes, String(ev.active.id), String(ev.over?.id ?? ''));
    if (depois === antes) return;
    salvar(
      (o, ids) => ({ ...o, atividades: aplicarOrdem(o.atividades, ids) }),
      (ids) => reordenarAtividadesGeral(fase.id, ids),
      antes,
      depois,
    );
  }

  return (
    <div className={styles.organizar}>
      <div className={styles.topo}>
        <p className={styles.dica}>
          Arraste pela alça <Icon name="arrastar" size={16} /> para mudar a ordem. Toque na fase
          para ver as atividades dela.
        </p>
        <button type="button" className={styles.pronto} onClick={onPronto}>
          Pronto
        </button>
      </div>
      <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltarFase}>
        <SortableContext items={fases.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ul className={styles.lista}>
            {fases.map((f) => (
              <Item
                key={f.id}
                id={f.id}
                rotulo={`Fase ${f.n}: ${f.titulo}`}
                classe={styles.fase}
                principal={
                  <button
                    type="button"
                    className={styles.faseBtn}
                    aria-expanded={aberta === f.id}
                    onClick={() => setAberta(aberta === f.id ? null : f.id)}
                  >
                    <span className={styles.num}>{f.n}</span>
                    <span className={styles.titulo}>{f.titulo}</span>
                    <span className={styles.qtd}>
                      {f.atividades.length === 1
                        ? '1 atividade'
                        : `${f.atividades.length} atividades`}
                    </span>
                    <Icon name={aberta === f.id ? 'chevronDown' : 'chevronRight'} size={18} />
                  </button>
                }
              >
                {aberta === f.id ? (
                  f.atividades.length === 0 ? (
                    <p className={styles.vazio}>Sem atividades.</p>
                  ) : (
                    <DndContext
                      sensors={sensores}
                      collisionDetection={closestCenter}
                      onDragEnd={(ev) => soltarAtividade(f, ev)}
                    >
                      <SortableContext
                        items={f.atividades.map((a) => a.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className={styles.atividades}>
                          {f.atividades.map((a) => (
                            <Item
                              key={a.id}
                              id={a.id}
                              rotulo={a.nome}
                              classe={styles.atividade}
                              principal={<span className={styles.atvNome}>{a.nome}</span>}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  )
                ) : null}
              </Item>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function Item({
  id,
  rotulo,
  classe,
  principal,
  children,
}: {
  id: string;
  rotulo: string;
  classe: string;
  principal: React.ReactNode;
  children?: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      className={`${classe} ${isDragging ? styles.arrastando : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className={styles.linha}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={styles.alca}
          aria-label={`Mover ${rotulo}`}
          {...attributes}
          {...listeners}
        >
          <Icon name="arrastar" size={20} />
        </button>
        {principal}
      </div>
      {children}
    </li>
  );
}
