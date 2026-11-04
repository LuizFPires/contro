import { useEffect, useId, useState } from 'react';
import { textoReplanejamento } from '@contro/core';
import { BottomSheet, Button, Input } from '@contro/ui';
import { AvisoRascunho } from '../../components/AvisoRascunho';
import { EscolherData } from '../../components/EscolherData';
import { formatarDataCurta } from '../../lib/datas';
import { useRascunho } from '../../lib/useRascunho';
import type { PessoaResumo } from '../perfil/usePessoas';
import { useNomesSugeridos } from '../reuniao/useNomesSugeridos';
import { VidaDoItem } from '../log/VidaDoItem';
import { dataLocal } from './api';
import type { EntradaTarefa } from './campo';
import { entradaDaFolha, OUTRO, responsavelDaTarefa } from './entradaTarefa';
import type { TarefaObra } from './tarefasObra';
import styles from './AdiarSheet.module.css';

function emDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dataLocal(d);
}

export function TarefaSheet({
  aberto,
  tarefa,
  pessoas,
  pendente,
  onFechar,
  onSalvar,
  onExcluir,
  obras,
  modo,
  inicial,
}: {
  aberto: boolean;
  tarefa: TarefaObra | null; // null = nova
  pessoas: PessoaResumo[];
  pendente?: boolean;
  onFechar: () => void;
  /** Na nova tarefa: escolha a obra (devolvida em `onSalvar`). */
  onSalvar: (e: EntradaTarefa, obraId?: string) => void;
  onExcluir?: () => void;
  /** Tela geral de Tarefas: a nova tarefa pede a obra. */
  obras?: { id: string; nome: string }[];
  /**
   * Atribuir providência: obra fixa, texto e prazo vindos de `inicial`,
   * responsável obrigatório e sem rascunho.
   */
  modo?: 'atribuir';
  inicial?: { texto: string; prazo: string; obraId: string };
}) {
  const atribuir = modo === 'atribuir';
  const [texto, setTexto] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [nomeDigitado, setNomeDigitado] = useState('');
  const [prazo, setPrazo] = useState(emDias(1));
  const [obraId, setObraId] = useState('');
  const { data: nomesSugeridos = [] } = useNomesSugeridos();
  const idNomes = useId();
  const pedeObra = !tarefa && !atribuir && Boolean(obras?.length);
  // Rascunho da nova tarefa (a edição de uma tarefa existente não usa).
  const contexto = obras?.length === 1 ? obras[0].id : 'geral';
  const rascunho = useRascunho<{
    texto: string;
    responsavelId: string;
    prazo: string;
    obraId: string;
  }>(aberto && !tarefa && !atribuir ? `tarefa:${contexto}` : null);
  const [recuperado, setRecuperado] = useState(false);
  const lido = rascunho.lido;

  // Primitivos de `inicial`: um objeto novo a cada render não reinicia o formulário.
  const iTexto = inicial?.texto;
  const iPrazo = inicial?.prazo;
  const iObra = inicial?.obraId;
  // Atribuir: reinicia só ao abrir ou trocar de providência (um refetch de
  // `obras` com a folha aberta não apaga o responsável escolhido nem o texto).
  useEffect(() => {
    if (!atribuir) return;
    setNomeDigitado('');
    setTexto(iTexto ?? '');
    setResponsavelId('');
    setPrazo(iPrazo ?? emDias(1));
    setObraId(iObra ?? '');
    setRecuperado(false);
  }, [aberto, atribuir, iTexto, iPrazo, iObra]);
  useEffect(() => {
    if (atribuir) return;
    const r = tarefa ? null : lido;
    const resp = tarefa
      ? responsavelDaTarefa(tarefa)
      : { responsavelId: r?.responsavelId ?? '', nomeDigitado: '' };
    setTexto(tarefa?.texto ?? r?.texto ?? '');
    setResponsavelId(resp.responsavelId);
    setNomeDigitado(resp.nomeDigitado);
    setPrazo(tarefa?.prazo ?? r?.prazo ?? emDias(1));
    setObraId(r?.obraId || (obras?.length === 1 ? obras[0].id : ''));
    setRecuperado(Boolean(r));
  }, [tarefa, aberto, obras, lido, atribuir]);
  const guardarRascunho = rascunho.guardar;
  useEffect(() => {
    if (aberto && !tarefa && !atribuir)
      guardarRascunho({ texto, responsavelId, prazo, obraId }, !texto.trim());
  }, [aberto, tarefa, atribuir, texto, responsavelId, prazo, obraId, guardarRascunho]);
  const outro = responsavelId === OUTRO;
  const temResponsavel = outro ? Boolean(nomeDigitado.trim()) : Boolean(responsavelId);
  const nomeObraFixa = atribuir ? obras?.find((o) => o.id === iObra)?.nome : null;

  const atalhos = [
    { rotulo: 'Hoje', valor: emDias(0) },
    { rotulo: 'Amanhã', valor: emDias(1) },
    { rotulo: 'Em 1 semana', valor: emDias(7) },
  ];
  const repl = tarefa
    ? textoReplanejamento(
        tarefa.replanejamentos,
        tarefa.prazo_original ? formatarDataCurta(tarefa.prazo_original) : null,
      )
    : null;

  return (
    <BottomSheet
      open={aberto}
      title={atribuir ? 'Atribuir providência' : tarefa ? 'Editar tarefa' : 'Nova tarefa'}
      onClose={onFechar}
    >
      {recuperado ? (
        <AvisoRascunho
          onDescartar={() => {
            rascunho.limpar();
            setRecuperado(false);
            setTexto('');
            setResponsavelId('');
            setPrazo(emDias(1));
          }}
        />
      ) : null}
      {pedeObra ? (
        <>
          <p className={styles.rotulo} style={{ marginTop: 0 }}>
            Obra
          </p>
          <select
            className={styles.data}
            style={{ width: '100%' }}
            value={obraId}
            onChange={(e) => setObraId(e.target.value)}
            aria-label="Obra"
          >
            <option value="">Escolha a obra</option>
            {obras?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </>
      ) : null}
      {nomeObraFixa ? (
        <p className={styles.resumo} style={{ marginTop: 0 }}>
          Obra: {nomeObraFixa}
        </p>
      ) : null}

      <div className={styles.rodape} style={{ marginTop: pedeObra ? 12 : 0 }}>
        <Input label="O que" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>

      <p className={styles.rotulo}>{atribuir ? 'Responsável · obrigatório' : 'Responsável'}</p>
      <select
        className={styles.data}
        style={{ width: '100%' }}
        value={responsavelId}
        onChange={(e) => setResponsavelId(e.target.value)}
        aria-label="Responsável"
        required={atribuir}
        aria-required={atribuir || undefined}
      >
        <option value="">{atribuir ? 'Escolha quem cuida' : '—'}</option>
        {pessoas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
            {p.papel_texto ? ` · ${p.papel_texto}` : ''}
          </option>
        ))}
        <option value={OUTRO}>Outro nome (digitar)</option>
      </select>
      {outro ? (
        <div style={{ marginTop: 8 }}>
          <Input
            label="Nome do responsável"
            placeholder="Nome (fica de sugestão nas próximas)"
            list={idNomes}
            value={nomeDigitado}
            onChange={(e) => setNomeDigitado(e.target.value)}
          />
          <datalist id={idNomes}>
            {nomesSugeridos.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
      ) : null}

      <p className={styles.rotulo}>Prazo</p>
      <EscolherData
        rotulo="Prazo"
        valor={prazo}
        onEscolher={setPrazo}
        sugestoes={atalhos}
        hoje={emDias(0)}
      />

      {repl ? (
        <p className={styles.resumo} style={{ marginTop: 8 }}>
          {repl}
        </p>
      ) : null}

      {tarefa && !atribuir ? (
        <div style={{ marginTop: 16 }}>
          <VidaDoItem itemId={tarefa.id} />
        </div>
      ) : null}

      <div className={styles.rodape}>
        <Button
          full
          disabled={
            !texto.trim() ||
            !prazo ||
            pendente ||
            (pedeObra && !obraId) ||
            (atribuir && !temResponsavel)
          }
          onClick={() => {
            if (!atribuir) rascunho.limpar();
            onSalvar(
              entradaDaFolha({ texto, responsavelId, nomeDigitado, prazo }, tarefa),
              pedeObra ? obraId : atribuir ? obraId || undefined : undefined,
            );
          }}
        >
          {pendente ? 'Salvando…' : atribuir ? 'Atribuir' : tarefa ? 'Salvar' : 'Criar tarefa'}
        </Button>
        {tarefa && onExcluir ? (
          <Button variant="tertiary" disabled={pendente} onClick={onExcluir}>
            Excluir
          </Button>
        ) : null}
      </div>
    </BottomSheet>
  );
}
