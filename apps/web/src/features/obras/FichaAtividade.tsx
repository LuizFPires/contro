import { useMemo, useRef, useState } from 'react';
import { BottomSheet, Button, Chip, Icon, Input, useToast } from '@obdc/ui';
import { formatarDataCurta } from '../../lib/datas';
import type { ObraCompleta } from './detalhe';
import { useObraCampo } from './useObraCampo';

const TIPO_ROTULO: Record<string, string> = {
  contratacao: 'Contratação',
  locacao: 'Locação',
  compra: 'Compra',
};

import styles from './FichaAtividade.module.css';

export function FichaAtividade({
  obra,
  atividadeId,
  onClose,
  onConcluida,
}: {
  obra: ObraCompleta;
  atividadeId: string | null;
  onClose: () => void;
  onConcluida: (r: { xp: number; fase_fechada: boolean }, nome: string, libera: string[]) => void;
}) {
  const campo = useObraCampo(obra.id);
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const duracaoRef = useRef<HTMLInputElement>(null);
  const [inicioData, setInicioData] = useState('');
  const [novoTipo, setNovoTipo] = useState<'contratacao' | 'locacao' | 'compra'>('compra');
  const [novaDesc, setNovaDesc] = useState('');
  const [novaPred, setNovaPred] = useState('');

  const dados = useMemo(() => {
    if (!atividadeId) return null;
    const a = obra.atividades.find((x) => x.id === atividadeId);
    if (!a) return null;
    const est = obra.estados[a.id];
    const cron = obra.cron.porId[a.id];
    const subitens = obra.atividades.filter((x) => x.pai_id === a.id);
    const nomePorId = new Map(obra.atividades.map((x) => [x.id, x.nome]));
    const dependePreds = a.predecessoras.map((p) => ({ id: p, nome: nomePorId.get(p) ?? p }));
    const predsDisponiveis = obra.atividades.filter(
      (x) => !x.pai_id && x.id !== a.id && !a.predecessoras.includes(x.id),
    );
    const libera = obra.atividades
      .filter((x) => !x.pai_id && x.predecessoras.includes(a.id))
      .map((x) => x.nome);
    const subsOk = subitens.every((s) => s.concluida_em);
    const podeConcluir = Boolean(est?.liberada) && subsOk && !a.concluida_em;
    return { a, est, cron, subitens, dependePreds, predsDisponiveis, libera, subsOk, podeConcluir };
  }, [obra, atividadeId]);

  if (!dados) return <BottomSheet open={false} onClose={onClose} children={null} />;
  const { a, est, cron, subitens, dependePreds, predsDisponiveis, libera, subsOk, podeConcluir } =
    dados;

  const situacao = a.concluida_em
    ? 'Concluída'
    : est?.atrasada
      ? 'Atrasada'
      : est?.liberada
        ? 'Liberada'
        : est?.aguardandoProvidencia
          ? 'Aguardando providência'
          : 'Planejada';

  function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    campo.concluir.mutate(
      { atividadeId: a.id, file },
      {
        onSuccess: (r) => onConcluida(r, a.nome, libera),
      },
    );
  }

  return (
    <BottomSheet open={Boolean(atividadeId)} title={a.nome} onClose={onClose}>
      <div className={styles.secao}>
        <Chip late={Boolean(est?.atrasada)}>{situacao}</Chip>
      </div>

      {cron ? (
        <div className={styles.secao}>
          <p className={styles.rotulo}>Datas previstas</p>
          <div className={styles.datas}>
            <span>
              <strong>Início</strong>
              {formatarDataCurta(cron.inicio_previsto)}
            </span>
            <span>
              <strong>Fim</strong>
              {formatarDataCurta(cron.fim_previsto)}
            </span>
          </div>
        </div>
      ) : null}

      <div className={styles.secao}>
        <Input
          label="Prestador"
          defaultValue={a.prestador ?? ''}
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== (a.prestador ?? null)) campo.prestador.mutate({ id: a.id, prestador: v });
          }}
        />
      </div>

      {!a.concluida_em ? (
        <div className={styles.secao}>
          <p className={styles.rotulo}>Para começar</p>
          {a.providencias.map((p) => (
            <div key={p.id} className={styles.prov}>
              <span className={p.status === 'feito' ? styles.feito : ''}>
                {TIPO_ROTULO[p.tipo]}: {p.descricao}
              </span>
              <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  type="button"
                  className={`${styles.provToggle} ${p.status === 'feito' ? styles.provFeito : ''}`}
                  onClick={() =>
                    campo.providencia.mutate({ id: p.id, feito: p.status !== 'feito' })
                  }
                >
                  {p.status === 'feito' ? 'Providenciado' : 'Marcar'}
                </button>
                {p.manual ? (
                  <button
                    type="button"
                    className={styles.remover}
                    aria-label="Remover lembrete"
                    onClick={() =>
                      campo.removerProv.mutate(p.id, {
                        onSuccess: () =>
                          showToast({
                            message: 'Lembrete removido',
                            onUndo: () =>
                              campo.addProvidencia.mutate({
                                atividadeId: a.id,
                                tipo: p.tipo,
                                descricao: p.descricao,
                              }),
                          }),
                      })
                    }
                  >
                    <Icon name="close" size={16} />
                  </button>
                ) : null}
              </span>
            </div>
          ))}
          <div className={styles.ajuste} style={{ marginTop: 8 }}>
            <select
              className={styles.input}
              style={{ flex: '0 0 40%' }}
              value={novoTipo}
              onChange={(e) => setNovoTipo(e.target.value as typeof novoTipo)}
              aria-label="Tipo do lembrete"
            >
              <option value="contratacao">Contratação</option>
              <option value="locacao">Locação</option>
              <option value="compra">Compra</option>
            </select>
            <input
              className={styles.input}
              placeholder="O que"
              value={novaDesc}
              onChange={(e) => setNovaDesc(e.target.value)}
              aria-label="Descrição do lembrete"
            />
            <Button
              variant="tertiary"
              disabled={!novaDesc.trim()}
              onClick={() =>
                campo.addProvidencia.mutate(
                  { atividadeId: a.id, tipo: novoTipo, descricao: novaDesc.trim() },
                  { onSuccess: () => setNovaDesc('') },
                )
              }
            >
              + Lembrete
            </Button>
          </div>
        </div>
      ) : null}

      {subitens.length > 0 ? (
        <div className={styles.secao}>
          <p className={styles.rotulo}>Subitens</p>
          {subitens.map((s) => (
            <label key={s.id} className={styles.linhaCheck}>
              <input
                type="checkbox"
                checked={Boolean(s.concluida_em)}
                disabled={Boolean(a.concluida_em)}
                onChange={(e) => campo.subitem.mutate({ id: s.id, feito: e.target.checked })}
              />
              <span className={s.concluida_em ? styles.feito : ''}>
                {s.nome} · {s.duracao_du} du
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {!a.pai_id ? (
        <div className={styles.secao}>
          <p className={styles.rotulo}>Depende de</p>
          {dependePreds.length > 0 ? (
            dependePreds.map((p) => (
              <div key={p.id} className={styles.prov}>
                <span>{p.nome}</span>
                {!a.concluida_em ? (
                  <button
                    type="button"
                    className={styles.remover}
                    aria-label={`Remover dependência ${p.nome}`}
                    onClick={() =>
                      campo.removerPred.mutate(
                        { atividadeId: a.id, predecessoraId: p.id },
                        { onError: () => showToast({ message: 'Não foi possível remover' }) },
                      )
                    }
                  >
                    <Icon name="close" size={16} />
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className={styles.aviso}>Sem predecessoras.</p>
          )}
          {!a.concluida_em && predsDisponiveis.length > 0 ? (
            <div className={styles.ajuste} style={{ marginTop: 8 }}>
              <select
                className={styles.input}
                value={novaPred}
                onChange={(e) => setNovaPred(e.target.value)}
                aria-label="Adicionar predecessora"
              >
                <option value="">Adicionar…</option>
                {predsDisponiveis.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </select>
              <Button
                variant="tertiary"
                disabled={!novaPred}
                onClick={() =>
                  campo.addPred.mutate(
                    { atividadeId: a.id, predecessoraId: novaPred },
                    {
                      onSuccess: () => setNovaPred(''),
                      onError: (e) => {
                        const err = e as { message?: string; code?: string };
                        const ciclo = err.code === '23514' || /ciclo/i.test(err.message ?? '');
                        showToast({
                          message: ciclo
                            ? 'Essa dependência criaria um ciclo'
                            : 'Não foi possível salvar a dependência',
                        });
                      },
                    },
                  )
                }
              >
                Adicionar
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {libera.length > 0 ? (
        <div className={styles.secao}>
          <p className={styles.rotulo}>Libera</p>
          <ul className={styles.lista}>
            {libera.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!a.concluida_em && subitens.length === 0 ? (
        <div className={styles.secao}>
          <p className={styles.rotulo}>Duração (dias úteis)</p>
          <div className={styles.ajuste}>
            <input
              key={a.id}
              ref={duracaoRef}
              type="number"
              min={1}
              defaultValue={a.duracao_du}
              className={styles.input}
              aria-label="Duração em dias úteis"
            />
            <Button
              variant="tertiary"
              onClick={() => {
                const du = Number(duracaoRef.current?.value);
                if (Number.isInteger(du) && du >= 1)
                  campo.duracao.mutate(
                    { id: a.id, du },
                    { onError: () => showToast({ message: 'Não foi possível ajustar a duração' }) },
                  );
              }}
            >
              Ajustar
            </Button>
          </div>
        </div>
      ) : null}

      {!a.concluida_em ? (
        <div className={styles.secao}>
          <p className={styles.rotulo}>Ajustar início</p>
          <div className={styles.ajuste}>
            <input
              type="date"
              className={styles.input}
              value={inicioData}
              onChange={(e) => setInicioData(e.target.value)}
            />
            <Button
              variant="tertiary"
              disabled={!inicioData}
              onClick={() =>
                campo.inicio.mutate(
                  { id: a.id, data: inicioData },
                  { onSuccess: () => setInicioData('') },
                )
              }
            >
              Ajustar
            </Button>
          </div>
        </div>
      ) : null}

      {!a.concluida_em ? (
        <>
          {!podeConcluir ? (
            <p className={styles.aviso}>
              {subitens.length > 0 && !subsOk
                ? 'Marque todos os subitens para concluir.'
                : 'Conclua as predecessoras e as providências para liberar.'}
            </p>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className={styles.oculto}
            onChange={escolherFoto}
          />
          <Button
            full
            disabled={!podeConcluir || campo.concluir.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {campo.concluir.isPending ? 'Enviando foto…' : 'Concluir com foto'}
          </Button>
        </>
      ) : null}
    </BottomSheet>
  );
}
