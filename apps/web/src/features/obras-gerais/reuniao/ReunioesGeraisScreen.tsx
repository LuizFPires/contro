import { useQuery } from '@tanstack/react-query';
import { horaCurta, reuniaoQueVem } from '@contro/core';
import { Icon } from '@contro/ui';
import { formatarDataCurta } from '../../../lib/datas';
import { supabase } from '../../../lib/supabase';
import { hojeISO } from '../../obras/api';
import styles from '../../reuniao/ReunioesScreen.module.css';
import { listarReunioesGerais } from './reuniaoGeralApi';
import { useAgendasObrasGerais } from './useConfigAvisosObra';

const DIA_NOME = ['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta'];

/**
 * Reuniões das obras gerais (A15): uma reunião por obra, cada uma com a próxima (abrir a
 * pauta) e as atas passadas. O Administrador vê todas; da obra, só a dela.
 */
export function ReunioesGeraisScreen({
  obras,
  onVoltar,
  onAbrir,
}: {
  obras: { id: string; nome: string }[];
  onVoltar: () => void;
  /** Abre a pauta (ou a ata, se fechada) da reunião da obra na data. */
  onAbrir: (obraId: string, data: string) => void;
}) {
  const hoje = hojeISO();
  const ids = obras.map((o) => o.id);
  const agendas = useAgendasObrasGerais(ids);
  const reunioes = useQuery({
    queryKey: ['reunioes-gerais', [...ids].sort()],
    enabled: Boolean(supabase) && ids.length > 0,
    queryFn: () => listarReunioesGerais(ids),
  });
  const uma = obras.length === 1 ? obras[0] : null;
  const agendaUma = uma ? agendas.data?.get(uma.id) : undefined;

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronLeft" size={22} />
        </button>
        <div>
          <h1 className={styles.titulo}>Reuniões</h1>
          <div className={styles.sub}>
            {uma
              ? agendaUma
                ? `${uma.nome} · toda ${DIA_NOME[agendaUma.reuniaoDia]} às ${horaCurta(agendaUma.reuniaoHora)}`
                : uma.nome
              : 'Uma reunião por obra'}
          </div>
        </div>
      </header>

      <div className={styles.conteudo}>
        {agendas.isLoading || reunioes.isLoading ? (
          <p className={styles.vazio}>Carregando…</p>
        ) : agendas.isError || reunioes.isError ? (
          <p className={styles.vazio}>Não foi possível carregar as reuniões.</p>
        ) : obras.length === 0 ? (
          <p className={styles.vazio}>Nenhuma obra geral ainda.</p>
        ) : (
          obras.map((o) => {
            const ag = agendas.data?.get(o.id);
            if (!ag) return null;
            const queVem = reuniaoQueVem(hoje, ag.reuniaoDia);
            const passadas = (reunioes.data ?? []).filter(
              (x) => x.obraId === o.id && x.data < queVem,
            );
            return (
              <section key={o.id}>
                {uma ? null : <h2 className={styles.secao}>{o.nome}</h2>}
                {uma ? <h2 className={styles.secao}>Próxima</h2> : null}
                <div className={styles.proxima}>
                  <div>
                    <div className={styles.proximaData}>
                      {formatarDataCurta(queVem)} · {horaCurta(ag.reuniaoHora)}
                    </div>
                    <div className={styles.proximaSub}>
                      Toda {DIA_NOME[ag.reuniaoDia]} às {horaCurta(ag.reuniaoHora)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.abrir}
                    aria-label={uma ? 'Abrir a pauta' : `Abrir a pauta · ${o.nome}`}
                    onClick={() => onAbrir(o.id, queVem)}
                  >
                    Abrir a pauta
                  </button>
                </div>

                {uma ? <h2 className={styles.secao}>Atas</h2> : null}
                {passadas.length === 0 ? (
                  <p className={styles.vazio}>Nenhuma reunião anterior ainda.</p>
                ) : (
                  <div className={styles.lista}>
                    {passadas.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        className={styles.item}
                        onClick={() => onAbrir(o.id, x.data)}
                      >
                        <span className={styles.itemIcone} aria-hidden="true">
                          <Icon name="documento" size={18} />
                        </span>
                        <span className={styles.itemTexto}>
                          <b>
                            {formatarDataCurta(x.data)} · {horaCurta(x.hora)}
                          </b>
                          <span>{o.nome}</span>
                        </span>
                        <span className={x.status === 'fechada' ? styles.selo : styles.seloAberta}>
                          {x.status === 'fechada' ? 'Ata gerada' : 'Sem ata'}
                        </span>
                        <Icon name="chevronRight" size={18} />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
