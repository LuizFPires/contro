import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  atalhosDataPrevista,
  diaCurto,
  VERBO_PROVIDENCIA,
  type TipoProvidencia,
} from '@contro/core';
import { BottomSheet, Button, Icon, TextoCrescente, useToast } from '@contro/ui';
import { AvisoRascunho } from '../../components/AvisoRascunho';
import { EscolherData } from '../../components/EscolherData';
import { useRascunho } from '../../lib/useRascunho';
import { hojeISO } from '../obras/api';
import { adicionarProvidencia } from '../obras/campo';
import provStyles from '../obras/ProvidenciasAba.module.css';
import { useObraCampo } from '../obras/useObraCampo';
import type { PessoaAtual } from '../perfil/usePerfil';
import { EscolherResponsavel } from './EscolherResponsavel';
import type { ObraGeral } from './obraGeral';
import { adicionarAtividadeGeral } from './planejamento';
import { ANTECEDENCIA_LEMBRETE_PADRAO, antecedenciaLembrete } from './antecedenciaLembrete';
import styles from './NovaAtividadeGeralSheet.module.css';

interface LinhaSub {
  nome: string;
  data: string;
}
/** Lembrete de contratação, locação ou compra (regra 4: sem valor nem fornecedor). */
interface LinhaLembrete {
  tipo: TipoProvidencia;
  descricao: string;
  /** Dias úteis antes da data prevista, como digitado. */
  antecedencia: string;
}
interface Rascunho {
  nome: string;
  quem: string | null;
  data: string;
  subitens: LinhaSub[];
  lembretes?: LinhaLembrete[];
}

const TIPOS = Object.keys(VERBO_PROVIDENCIA) as TipoProvidencia[];

const limpar = (s: string) => s.trim().replace(/\s+/g, ' ');

/**
 * Nova atividade da obra geral: nome, quem e para quando, ou subitens com data
 * própria (a data da atividade passa a ser a do último subitem).
 */
export function NovaAtividadeGeralSheet({
  obra,
  faseId,
  pessoa,
  onFechar,
}: {
  obra: ObraGeral;
  faseId: string;
  pessoa: PessoaAtual;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const campo = useObraCampo(obra.id);
  const { showToast } = useToast();
  const hoje = hojeISO();
  const fase = obra.fases.find((f) => f.id === faseId);

  const rascunho = useRascunho<Rascunho>(`atividadeGeral:${obra.id}:${faseId}`);
  const lido = rascunho.lido;
  const [nome, setNome] = useState(lido?.nome ?? '');
  const [quem, setQuem] = useState<string | null>(lido?.quem ?? null);
  const [data, setData] = useState(lido?.data ?? '');
  const [subitens, setSubitens] = useState<LinhaSub[]>(lido?.subitens ?? []);
  const [lembretes, setLembretes] = useState<LinhaLembrete[]>(lido?.lembretes ?? []);
  const [recuperado, setRecuperado] = useState(Boolean(lido));
  const [dataDoSub, setDataDoSub] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  const guardar = rascunho.guardar;
  useEffect(() => {
    const vazio =
      !nome.trim() && !subitens.some((s) => s.nome.trim()) && !lembretes.some((l) => l.descricao);
    guardar({ nome, quem, data, subitens, lembretes }, vazio);
  }, [nome, quem, data, subitens, lembretes, guardar]);

  const comSubitens = subitens.length > 0;
  const nomeLimpo = limpar(nome);

  function alternar() {
    setSubitens((s) => (s.length ? [] : [{ nome: '', data: '' }]));
  }
  function mudarSub(i: number, parte: Partial<LinhaSub>) {
    setSubitens((arr) => arr.map((x, j) => (j === i ? { ...x, ...parte } : x)));
  }
  function mudarLembrete(i: number, parte: Partial<LinhaLembrete>) {
    setLembretes((arr) => arr.map((x, j) => (j === i ? { ...x, ...parte } : x)));
  }
  function descartar() {
    rascunho.limpar();
    setRecuperado(false);
    setNome('');
    setQuem(null);
    setData('');
    setSubitens([]);
    setLembretes([]);
  }

  async function adicionar() {
    if (!nomeLimpo || ocupado) return;
    // Lembretes com texto: antecedência vazia vale 5; fora de 0 a 60 não salva nada.
    const comTexto = lembretes
      .map((l) => ({
        ...l,
        descricao: limpar(l.descricao),
        du: antecedenciaLembrete(l.antecedencia),
      }))
      .filter((l) => l.descricao);
    if (comTexto.some((l) => l.du === null)) {
      setErro('Informe a antecedência em dias úteis (0 a 60).');
      return;
    }
    setOcupado(true);
    setErro('');
    try {
      const subs = comSubitens
        ? subitens
            .map((s) => ({ nome: limpar(s.nome), data_prevista: s.data || null }))
            .filter((s) => s.nome)
        : [];
      const id = await adicionarAtividadeGeral({
        obraId: obra.id,
        faseId,
        nome: nomeLimpo,
        responsavelId: quem,
        // Chave ligada mas todo subitem vazio: vale o "Para quando" digitado.
        dataPrevista: subs.length > 0 ? null : data || null,
        subitens: subs,
      });
      // Lembretes depois da atividade (precisam dela); o banco calcula o "providenciar até".
      let lembreteFalhou = false;
      for (const l of comTexto) {
        try {
          await adicionarProvidencia(
            obra.id,
            id,
            l.tipo,
            l.descricao,
            l.du ?? ANTECEDENCIA_LEMBRETE_PADRAO,
          );
        } catch {
          lembreteFalhou = true;
        }
      }
      rascunho.limpar();
      void qc.invalidateQueries({ queryKey: ['obras-gerais', 'resumo'] });
      await qc.invalidateQueries({ queryKey: ['obra', obra.id] });
      showToast({
        message: lembreteFalhou
          ? 'Atividade adicionada. Não foi possível salvar um lembrete: lance pela ficha.'
          : 'Atividade adicionada.',
        onUndo: () => campo.excluir.mutate(id),
      });
      onFechar();
    } catch (e) {
      setOcupado(false);
      setErro(e instanceof Error ? e.message : 'Não foi possível adicionar a atividade.');
    }
  }

  return (
    <>
      <BottomSheet
        open
        title={fase ? `Nova atividade · ${fase.titulo}` : 'Nova atividade'}
        onClose={onFechar}
      >
        <div className={styles.corpo}>
          {recuperado ? <AvisoRascunho onDescartar={descartar} /> : null}
          <div>
            <label className={styles.rotulo} htmlFor="nova-atv-geral-nome">
              Nome da atividade
            </label>
            <input
              id="nova-atv-geral-nome"
              className={`${styles.campo} ${styles.campoNome}`}
              value={nome}
              autoFocus
              placeholder="Ex.: Contratar o empreiteiro civil"
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <div>
            <div className={styles.rotulo}>Quem</div>
            <EscolherResponsavel
              pessoas={obra.pessoas}
              pessoaId={pessoa.id}
              valor={quem}
              onEscolher={setQuem}
            />
          </div>

          {comSubitens ? null : (
            <div>
              <div className={styles.rotulo}>Para quando</div>
              <EscolherData
                valor={data}
                onEscolher={setData}
                sugestoes={atalhosDataPrevista(hoje)}
                hoje={hoje}
                rotulo="Para quando"
              />
            </div>
          )}

          <div className={styles.caixa}>
            <div className={styles.caixaTopo}>
              <b>Dividir em subitens</b>
              <button
                type="button"
                role="switch"
                aria-checked={comSubitens}
                aria-label="Dividir em subitens"
                className={styles.chaveBox}
                onClick={alternar}
              >
                <span className={`${styles.chave} ${comSubitens ? styles.chaveOn : ''}`}>
                  <span />
                </span>
              </button>
            </div>
            {subitens.map((s, i) => (
              <div key={i} className={styles.subItem}>
                <TextoCrescente
                  className={styles.campo}
                  value={s.nome}
                  aria-label={`Nome do subitem ${i + 1}`}
                  placeholder="Subitem"
                  onChange={(e) => mudarSub(i, { nome: e.target.value })}
                />
                <div className={styles.subAcoes}>
                  <button
                    type="button"
                    className={styles.dataSub}
                    aria-label={
                      s.data
                        ? `Data do subitem ${i + 1}: ${diaCurto(s.data)}`
                        : `Data do subitem ${i + 1}`
                    }
                    onClick={() => setDataDoSub(i)}
                  >
                    <Icon name="calendario" size={16} />
                    {s.data ? diaCurto(s.data) : 'Data'}
                  </button>
                  <button
                    type="button"
                    className={styles.remover}
                    aria-label={`Remover subitem ${i + 1}`}
                    onClick={() => setSubitens((arr) => arr.filter((_, j) => j !== i))}
                  >
                    <Icon name="close" size={20} />
                  </button>
                </div>
              </div>
            ))}
            {comSubitens ? (
              <>
                <button
                  type="button"
                  className={styles.maisSub}
                  onClick={() => setSubitens((arr) => [...arr, { nome: '', data: '' }])}
                >
                  + subitem
                </button>
                <p className={styles.nota}>Data da atividade: a do último subitem</p>
              </>
            ) : null}
          </div>

          {lembretes.map((l, i) => (
            <div key={i} className={styles.caixa}>
              <div className={styles.caixaTopo}>
                <b>Lembrete de providência</b>
                <button
                  type="button"
                  className={styles.remover}
                  aria-label={`Remover lembrete ${i + 1}`}
                  onClick={() => setLembretes((arr) => arr.filter((_, j) => j !== i))}
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
              <div
                className={provStyles.tipos}
                role="group"
                aria-label={`Tipo do lembrete ${i + 1}`}
              >
                {TIPOS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={l.tipo === t}
                    className={`${provStyles.tipoBtn} ${l.tipo === t ? provStyles.tipoAtivo : ''}`}
                    onClick={() => mudarLembrete(i, { tipo: t })}
                  >
                    {VERBO_PROVIDENCIA[t]}
                  </button>
                ))}
              </div>
              <input
                className={styles.campo}
                value={l.descricao}
                aria-label={`O que providenciar no lembrete ${i + 1}`}
                placeholder="O que providenciar (ex.: caminhão Munk)"
                onChange={(e) => mudarLembrete(i, { descricao: e.target.value })}
              />
              <div className={styles.linha}>
                <input
                  className={`${styles.campo} ${styles.campoDu}`}
                  inputMode="numeric"
                  value={l.antecedencia}
                  aria-label={`Dias úteis antes da data prevista, lembrete ${i + 1}`}
                  onChange={(e) =>
                    mudarLembrete(i, {
                      antecedencia: e.target.value.replace(/\D/g, '').slice(0, 2),
                    })
                  }
                />
                <span className={styles.nota}>dias úteis antes da data prevista</span>
              </div>
            </div>
          ))}
          <button
            type="button"
            className={styles.maisSub}
            onClick={() =>
              setLembretes((arr) => [
                ...arr,
                {
                  tipo: 'contratacao',
                  descricao: '',
                  antecedencia: String(ANTECEDENCIA_LEMBRETE_PADRAO),
                },
              ])
            }
          >
            + lembrete de providência
          </button>

          {erro ? (
            <p role="alert" className={styles.erro}>
              {erro}
            </p>
          ) : null}
          <Button full disabled={!nomeLimpo || ocupado} onClick={() => void adicionar()}>
            Adicionar
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={dataDoSub !== null}
        title="Data do subitem"
        onClose={() => setDataDoSub(null)}
      >
        {dataDoSub !== null && subitens[dataDoSub] ? (
          <EscolherData
            valor={subitens[dataDoSub].data}
            onEscolher={(iso) => {
              mudarSub(dataDoSub, { data: iso });
              setDataDoSub(null);
            }}
            sugestoes={atalhosDataPrevista(hoje)}
            hoje={hoje}
            rotulo="Data do subitem"
          />
        ) : null}
      </BottomSheet>
    </>
  );
}
