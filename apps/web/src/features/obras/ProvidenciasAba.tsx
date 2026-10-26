import { useMemo, useState } from 'react';
import { BottomSheet, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import type { ObraCompleta } from './detalhe';
import { classificarProvidencias, type ItemProvidencia } from './providenciasObra';
import { useObraCampo } from './useObraCampo';
import styles from './ProvidenciasAba.module.css';

type Tipo = 'contratacao' | 'locacao' | 'compra';
const TIPOS: { tipo: Tipo; rotulo: string }[] = [
  { tipo: 'contratacao', rotulo: 'Contratação' },
  { tipo: 'locacao', rotulo: 'Locação' },
  { tipo: 'compra', rotulo: 'Compra' },
];

/** Providências da obra (protótipo · SUPRIMENTOS, aqui chamada "Providências"). */
export function ProvidenciasAba({ obra }: { obra: ObraCompleta }) {
  const campo = useObraCampo(obra.id);
  const { showToast } = useToast();
  const [novo, setNovo] = useState<Tipo | null>(null);

  const { atrasadas, aProvidenciar, feitas } = useMemo(
    () => classificarProvidencias(obra, hojeISO()),
    [obra],
  );

  function marcar(it: ItemProvidencia) {
    campo.providencia.mutate(
      { id: it.id, feito: true },
      {
        onSuccess: () =>
          showToast({
            message: `${it.tipoTxt} providenciada`,
            onUndo: () => campo.providencia.mutate({ id: it.id, feito: false }),
          }),
      },
    );
  }

  const grupos = [
    { titulo: 'Atrasados', atraso: true, itens: atrasadas },
    { titulo: 'A providenciar', atraso: false, itens: aProvidenciar },
  ].filter((g) => g.itens.length);

  return (
    <div className={styles.aba}>
      <div>
        <h2 className={styles.titulo}>Providências da obra</h2>
        <div className={styles.explica}>
          Lembretes de contratação, locação e compra: o que precisa estar na obra e até quando
          providenciar para cada atividade começar.
        </div>
      </div>

      <div className={styles.novos}>
        {TIPOS.map((t) => (
          <button
            key={t.tipo}
            type="button"
            className={styles.novo}
            onClick={() => setNovo(t.tipo)}
          >
            + {t.rotulo}
          </button>
        ))}
      </div>

      {grupos.map((g) => (
        <section key={g.titulo} className={styles.grupo}>
          <h3 className={`${styles.grupoTitulo} ${g.atraso ? styles.atraso : ''}`}>
            {g.titulo} · {g.itens.length}
          </h3>
          {g.itens.map((it) => (
            <div key={it.id} className={`${styles.item} ${it.atrasada ? styles.itemAtraso : ''}`}>
              <div className={styles.linhaTipo}>
                <span className={styles.tipo}>{it.tipoTxt}</span>
                <span className={`${styles.situacao} ${it.atrasada ? styles.sitAtraso : ''}`}>
                  {it.atrasada ? 'Atrasado' : 'A providenciar'}
                </span>
              </div>
              <div className={styles.desc}>{it.descricao}</div>
              <div className={styles.para}>Para: {it.atividade}</div>
              <div className={styles.naObra}>
                Precisa estar na obra {formatarDataCurta(it.naObra)}
              </div>
              <div className={it.atrasada ? styles.quandoAtraso : styles.quando}>
                {it.atrasada
                  ? `ATRASADO · era para providenciar até ${formatarDataCurta(it.providenciarAte)}`
                  : `Providenciar até ${formatarDataCurta(it.providenciarAte)} (${it.antecedenciaDu} dias úteis antes)`}
              </div>
              <button type="button" className={styles.marcar} onClick={() => marcar(it)}>
                Marcar como providenciado
              </button>
            </div>
          ))}
        </section>
      ))}

      {grupos.length === 0 ? <div className={styles.vazio}>Nada a providenciar agora.</div> : null}

      <div className={styles.rodape}>
        {feitas} {feitas === 1 ? 'lembrete já providenciado' : 'lembretes já providenciados'}
      </div>

      <NovaProvidenciaSheet
        obra={obra}
        tipo={novo}
        pendente={campo.addProvidencia.isPending}
        onFechar={() => setNovo(null)}
        onSalvar={(v) =>
          campo.addProvidencia.mutate(v, {
            onSuccess: () => {
              setNovo(null);
              showToast({ message: 'Lembrete salvo' });
            },
            onError: () => showToast({ message: 'Não foi possível salvar o lembrete' }),
          })
        }
      />
    </div>
  );
}

/** Novo lembrete: só tipo, atividade e descrição (regra 4: sem valor nem fornecedor). */
export function NovaProvidenciaSheet({
  obra,
  tipo: tipoInicial,
  atividadeFixa,
  pendente,
  onFechar,
  onSalvar,
}: {
  obra: ObraCompleta;
  tipo: Tipo | null;
  /** Aberta pela ficha: a atividade já vem escolhida. */
  atividadeFixa?: string;
  pendente: boolean;
  onFechar: () => void;
  onSalvar: (v: { atividadeId: string; tipo: Tipo; descricao: string }) => void;
}) {
  const abertas = obra.atividades.filter((a) => !a.pai_id && !a.concluida_em);
  const [tipo, setTipo] = useState<Tipo>('contratacao');
  const [atividadeId, setAtividadeId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState('');
  const [abertoPara, setAbertoPara] = useState<Tipo | null>(null);

  // Cada abertura começa no tipo do botão tocado, sem atividade nem texto.
  if (tipoInicial !== abertoPara) {
    setAbertoPara(tipoInicial);
    if (tipoInicial) {
      setTipo(tipoInicial);
      setAtividadeId(atividadeFixa ?? '');
      setDescricao('');
      setErro('');
    }
  }

  function salvar() {
    if (!atividadeId) return setErro('Escolha a atividade que depende deste lembrete.');
    if (!descricao.trim()) return setErro('Descreva o que precisa ser providenciado.');
    onSalvar({ atividadeId, tipo, descricao: descricao.trim() });
  }

  const rotulo = TIPOS.find((t) => t.tipo === tipo)?.rotulo ?? '';

  return (
    <BottomSheet open={tipoInicial !== null} onClose={onFechar}>
      <div className={styles.form}>
        <h2 className={styles.formTitulo}>Nova {rotulo.toLowerCase()}</h2>

        <div className={styles.campo}>
          <div className={styles.campoRotulo}>Tipo</div>
          <div className={styles.tipos}>
            {TIPOS.map((t) => (
              <button
                key={t.tipo}
                type="button"
                aria-pressed={tipo === t.tipo}
                className={`${styles.tipoBtn} ${tipo === t.tipo ? styles.tipoAtivo : ''}`}
                onClick={() => setTipo(t.tipo)}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
        </div>

        {atividadeFixa ? (
          <div className={styles.para}>
            Para: {obra.atividades.find((a) => a.id === atividadeFixa)?.nome}
          </div>
        ) : (
          <div className={styles.campo}>
            <label htmlFor="nova-prov-atv" className={styles.campoRotulo}>
              Para a atividade
            </label>
            <select
              id="nova-prov-atv"
              className={styles.entrada}
              value={atividadeId}
              onChange={(e) => setAtividadeId(e.target.value)}
            >
              <option value="">Escolha a atividade</option>
              {abertas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.campo}>
          <label htmlFor="nova-prov-desc" className={styles.campoRotulo}>
            O que providenciar
          </label>
          <input
            id="nova-prov-desc"
            className={styles.entrada}
            value={descricao}
            placeholder="Ex.: andaime para a fachada"
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        <div className={styles.dica}>
          O lembrete avisa o que contratar, alugar ou comprar a tempo; não trava a atividade.
        </div>
        {erro ? (
          <div role="alert" className={styles.erro}>
            {erro}
          </div>
        ) : null}
        <button type="button" className={styles.salvar} disabled={pendente} onClick={salvar}>
          {pendente ? 'Salvando…' : 'Salvar lembrete'}
        </button>
      </div>
    </BottomSheet>
  );
}
