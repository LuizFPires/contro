import { useEffect, useId, useMemo, useState } from 'react';
import { BottomSheet, Button, Icon, Input } from '@contro/ui';
import type { ObraCompleta } from './detalhe';
import { agruparPorFase, alvosMapa, nomesItensMapa } from './listaAtividades';
import { useObraCampo } from './useObraCampo';
import styles from './NovoMapaSheet.module.css';

const DIAS_PADRAO = 5;
const ANTECEDENCIA_PADRAO = 10;

/** Mensagem do erro do servidor (as RPCs já falam pt-BR), com um texto de reserva. */
function mensagemErro(e: unknown): string {
  const m = e && typeof e === 'object' && 'message' in e ? String(e.message) : '';
  return m.trim() || 'Não foi possível adicionar o item';
}

/**
 * Novo item do Mapa de coleta, só nesta obra: nome, quanto leva, antecedência
 * da contratação e as atividades que ele libera. O pré-obra se recalcula na volta.
 */
export function NovoMapaSheet({
  obra,
  aberto,
  onFechar,
  onAdicionado,
}: {
  obra: ObraCompleta;
  aberto: boolean;
  onFechar: () => void;
  /** Depois de salvo (para o toast com Desfazer). */
  onAdicionado: (id: string, nome: string) => void;
}) {
  const campo = useObraCampo(obra.id);
  const idNomes = useId();
  const [nome, setNome] = useState('');
  const [dias, setDias] = useState(DIAS_PADRAO);
  const [antecedencia, setAntecedencia] = useState(ANTECEDENCIA_PADRAO);
  const [libera, setLibera] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');

  // Fechou: volta tudo ao começo.
  useEffect(() => {
    if (!aberto) {
      setNome('');
      setDias(DIAS_PADRAO);
      setAntecedencia(ANTECEDENCIA_PADRAO);
      setLibera([]);
      setBusca('');
      setErro('');
    }
  }, [aberto]);

  const nomes = useMemo(() => nomesItensMapa(obra), [obra]);
  const grupos = useMemo(() => agruparPorFase(obra.fases, alvosMapa(obra, busca)), [obra, busca]);
  const salvando = campo.novoMapa.isPending;
  const nomeLimpo = nome.trim().replace(/\s+/g, ' ');
  const pode = Boolean(nomeLimpo) && libera.length > 0 && !salvando;

  function alternar(id: string, marcado: boolean) {
    setLibera((l) => (marcado ? [...l, id] : l.filter((x) => x !== id)));
  }

  function salvar() {
    if (!pode) return;
    setErro('');
    campo.novoMapa.mutate(
      { nome: nomeLimpo, duracaoDu: dias, antecedenciaDu: antecedencia, libera },
      {
        onSuccess: (id) => {
          onAdicionado(id, nomeLimpo);
          onFechar();
        },
        onError: (e) => setErro(mensagemErro(e)),
      },
    );
  }

  return (
    <BottomSheet open={aberto} title="Novo item do mapa" onClose={onFechar}>
      <div className={styles.corpo}>
        <Input
          label="Nome"
          value={nome}
          autoFocus
          list={idNomes}
          placeholder="Ex.: Ar-condicionado"
          onChange={(e) => setNome(e.target.value)}
        />
        <datalist id={idNomes}>
          {nomes.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        <Contador rotulo="Leva (dias úteis)" valor={dias} minimo={1} onMudar={setDias} />
        <Contador
          rotulo="Antecedência da contratação (dias úteis)"
          valor={antecedencia}
          minimo={0}
          onMudar={setAntecedencia}
        />

        <div>
          <div className={styles.rotulo} id={`${idNomes}-libera`}>
            Libera as atividades
          </div>
          <div className={styles.painel}>
            <div className={styles.buscaLinha}>
              <Icon name="search" size={18} />
              <input
                className={styles.busca}
                type="search"
                placeholder="Buscar por nome ou número (ex.: 24)"
                aria-label="Buscar atividade"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className={styles.lista} role="group" aria-labelledby={`${idNomes}-libera`}>
              {grupos.map((g) => (
                <div key={g.fase.id}>
                  <div className={styles.fase}>{g.fase.titulo}</div>
                  {g.itens.map((a) => {
                    const on = libera.includes(a.id);
                    return (
                      <label key={a.id} className={`${styles.item} ${on ? styles.itemOn : ''}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => alternar(a.id, e.target.checked)}
                        />
                        <span>
                          {a.numero ? <b>#{a.numero} </b> : null}
                          {a.nome}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
              {grupos.length === 0 ? (
                <div className={styles.semResultado}>
                  {busca.trim()
                    ? `Nenhuma atividade aberta com “${busca.trim()}”.`
                    : 'Nenhuma atividade aberta nas fases da obra.'}
                </div>
              ) : null}
            </div>
          </div>
          <p className={styles.miuda}>
            {libera.length === 0
              ? 'Escolha ao menos uma atividade.'
              : libera.length === 1
                ? '1 atividade escolhida'
                : `${libera.length} atividades escolhidas`}
          </p>
        </div>

        {erro ? (
          <p className={styles.erro} role="alert">
            <Icon name="alert" size={16} />
            {erro}
          </p>
        ) : null}

        <Button full disabled={!pode} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Adicionar'}
        </Button>
      </div>
    </BottomSheet>
  );
}

function Contador({
  rotulo,
  valor,
  minimo,
  onMudar,
}: {
  rotulo: string;
  valor: number;
  minimo: number;
  onMudar: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className={styles.rotulo} id={id}>
        {rotulo}
      </div>
      <div className={styles.linha} role="group" aria-labelledby={id}>
        <button
          type="button"
          className={styles.quadrado}
          aria-label="Menos um dia"
          disabled={valor <= minimo}
          onClick={() => onMudar(Math.max(minimo, valor - 1))}
        >
          −
        </button>
        <span className={styles.dias}>{valor}</span>
        <button
          type="button"
          className={styles.quadrado}
          aria-label="Mais um dia"
          onClick={() => onMudar(valor + 1)}
        >
          +
        </button>
        <span className={styles.miuda}>{valor === 1 ? 'dia útil' : 'dias úteis'}</span>
      </div>
    </div>
  );
}
