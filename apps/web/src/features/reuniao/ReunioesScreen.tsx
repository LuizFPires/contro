import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { horaCurta, reuniaoQueVem, textoPreparoWhatsapp, totaisPreparo } from '@contro/core';
import { Icon } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { supabase } from '../../lib/supabase';
import { useConfigAvisos } from '../avisos/useConfigAvisos';
import { hojeISO } from '../obras/api';
import { montarPreparo } from './ataDados';
import { PrepararSheet } from './PrepararReuniao';
import { useReuniao } from './useReuniao';
import styles from './ReunioesScreen.module.css';

const DIA_NOME = ['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta'];

interface ReuniaoLista {
  id: string;
  data: string;
  hora: string;
  status: 'pauta' | 'em_andamento' | 'fechada';
  obras: number;
}

async function listarReunioes(antesDe: string): Promise<ReuniaoLista[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reuniao')
    .select('id,data,hora,status,reuniao_obra(count)')
    // Só as da Contorno (obra_id nulo); as de obra geral ficam nas Obras gerais.
    .is('obra_id', null)
    .lt('data', antesDe)
    .order('data', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (
    (data ?? []) as unknown as {
      id: string;
      data: string;
      hora: string | null;
      status: ReuniaoLista['status'];
      reuniao_obra: { count: number }[];
    }[]
  ).map((r) => ({
    id: r.id,
    data: r.data,
    hora: (r.hora ?? '16:00').slice(0, 5),
    status: r.status,
    obras: r.reuniao_obra?.[0]?.count ?? 0,
  }));
}

/**
 * Central de reuniões (opção C, aprovada em 03/11/2026): a próxima reunião, com
 * abrir a pauta, preparar (PDF) e WhatsApp, e a lista das reuniões passadas
 * para ver e baixar a ata.
 */
export function ReunioesScreen({
  onVoltar,
  onAbrir,
}: {
  onVoltar: () => void;
  /** Abre a pauta (ou a ata, se fechada) da reunião da data. */
  onAbrir: (data: string) => void;
}) {
  const hoje = hojeISO();
  const { config: agenda } = useConfigAvisos();
  const queVem = reuniaoQueVem(hoje, agenda.reuniaoDia);
  const horaFmt = horaCurta(agenda.reuniaoHora);
  const { query } = useReuniao(queVem);
  const passadas = useQuery({
    queryKey: ['reunioes', queVem],
    enabled: Boolean(supabase),
    queryFn: () => listarReunioes(queVem),
  });
  const [preparar, setPreparar] = useState(false);

  const preparo = useMemo(() => (query.data ? montarPreparo(query.data) : []), [query.data]);
  const t = totaisPreparo(preparo);
  const dataFmt = formatarDataCurta(queVem);
  const wa = `https://wa.me/?text=${encodeURIComponent(
    textoPreparoWhatsapp(dataFmt, horaFmt, preparo, hoje),
  )}`;

  return (
    <div className={styles.screen}>
      <header className={styles.cabecalho}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronLeft" size={22} />
        </button>
        <div>
          <h1 className={styles.titulo}>Reuniões</h1>
          <div className={styles.sub}>
            Toda {DIA_NOME[agenda.reuniaoDia]} às {horaFmt}
          </div>
        </div>
      </header>

      <div className={styles.conteudo}>
        <h2 className={styles.secao}>Próxima</h2>
        <div className={styles.proxima}>
          <div>
            <div className={styles.proximaData}>
              {dataFmt} · {horaFmt}
            </div>
            <div className={styles.proximaSub}>
              {query.isLoading
                ? 'Montando a pauta…'
                : `${preparo.length} ${preparo.length === 1 ? 'obra' : 'obras'} · ${t.cobrar} ${
                    t.cobrar === 1 ? 'ação' : 'ações'
                  } a cobrar${t.atrasadas ? ` · ${t.atrasadas} ${t.atrasadas === 1 ? 'atrasada' : 'atrasadas'}` : ''}`}
            </div>
          </div>
          <button type="button" className={styles.abrir} onClick={() => onAbrir(queVem)}>
            Abrir a pauta
          </button>
          <div className={styles.acoes}>
            <button
              type="button"
              className={styles.acao}
              disabled={!preparo.length}
              onClick={() => setPreparar(true)}
            >
              <Icon name="documento" size={18} />
              Preparar · PDF
            </button>
            <a
              className={`${styles.acao} ${!preparo.length ? styles.desligado : ''}`}
              href={preparo.length ? wa : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!preparo.length}
            >
              <Icon name="whatsapp" size={18} strokeWidth={2} />
              WhatsApp
            </a>
          </div>
        </div>

        <h2 className={styles.secao}>Atas</h2>
        {passadas.isLoading ? <p className={styles.vazio}>Carregando…</p> : null}
        {passadas.isError ? (
          <p className={styles.vazio}>Não foi possível carregar as reuniões.</p>
        ) : null}
        {passadas.data && passadas.data.length === 0 ? (
          <p className={styles.vazio}>Nenhuma reunião anterior ainda.</p>
        ) : null}
        {passadas.data?.length ? (
          <div className={styles.lista}>
            {passadas.data.map((r) => (
              <button
                key={r.id}
                type="button"
                className={styles.item}
                onClick={() => onAbrir(r.data)}
              >
                <span className={styles.itemIcone} aria-hidden="true">
                  <Icon name="documento" size={18} />
                </span>
                <span className={styles.itemTexto}>
                  <b>
                    {formatarDataCurta(r.data)} · {horaCurta(r.hora)}
                  </b>
                  <span>
                    {r.obras} {r.obras === 1 ? 'obra' : 'obras'}
                  </span>
                </span>
                <span className={r.status === 'fechada' ? styles.selo : styles.seloAberta}>
                  {r.status === 'fechada' ? 'Ata gerada' : 'Sem ata'}
                </span>
                <Icon name="chevronRight" size={18} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {preparar ? (
        <PrepararSheet data={queVem} horaFmt={horaFmt} onFechar={() => setPreparar(false)} />
      ) : null}
    </div>
  );
}
