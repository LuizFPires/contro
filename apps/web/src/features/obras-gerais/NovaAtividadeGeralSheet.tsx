import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { atalhosDataPrevista, diaCurto } from '@contro/core';
import { BottomSheet, Button, Icon, useToast } from '@contro/ui';
import { AvisoRascunho } from '../../components/AvisoRascunho';
import { EscolherData } from '../../components/EscolherData';
import { useRascunho } from '../../lib/useRascunho';
import { hojeISO } from '../obras/api';
import { useObraCampo } from '../obras/useObraCampo';
import type { PessoaAtual } from '../perfil/usePerfil';
import { EscolherResponsavel } from './EscolherResponsavel';
import type { ObraGeral } from './obraGeral';
import { adicionarAtividadeGeral } from './planejamento';
import styles from './NovaAtividadeGeralSheet.module.css';

interface LinhaSub {
  nome: string;
  data: string;
}
interface Rascunho {
  nome: string;
  quem: string | null;
  data: string;
  subitens: LinhaSub[];
}

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
  const [recuperado, setRecuperado] = useState(Boolean(lido));
  const [dataDoSub, setDataDoSub] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  const guardar = rascunho.guardar;
  useEffect(() => {
    const vazio = !nome.trim() && !subitens.some((s) => s.nome.trim());
    guardar({ nome, quem, data, subitens }, vazio);
  }, [nome, quem, data, subitens, guardar]);

  const comSubitens = subitens.length > 0;
  const nomeLimpo = limpar(nome);

  function alternar() {
    setSubitens((s) => (s.length ? [] : [{ nome: '', data: '' }]));
  }
  function mudarSub(i: number, parte: Partial<LinhaSub>) {
    setSubitens((arr) => arr.map((x, j) => (j === i ? { ...x, ...parte } : x)));
  }
  function descartar() {
    rascunho.limpar();
    setRecuperado(false);
    setNome('');
    setQuem(null);
    setData('');
    setSubitens([]);
  }

  async function adicionar() {
    if (!nomeLimpo || ocupado) return;
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
      rascunho.limpar();
      void qc.invalidateQueries({ queryKey: ['obras-gerais', 'resumo'] });
      await qc.invalidateQueries({ queryKey: ['obra', obra.id] });
      showToast({ message: 'Atividade adicionada.', onUndo: () => campo.excluir.mutate(id) });
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
              <div key={i} className={styles.linha}>
                <input
                  className={styles.campo}
                  value={s.nome}
                  aria-label={`Nome do subitem ${i + 1}`}
                  placeholder="Subitem"
                  onChange={(e) => mudarSub(i, { nome: e.target.value })}
                />
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
                  {s.data ? diaCurto(s.data) : null}
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
