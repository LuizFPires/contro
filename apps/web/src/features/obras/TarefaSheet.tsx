import { useEffect, useState } from 'react';
import { textoReplanejamento } from '@contro/core';
import { BottomSheet, Button, Input } from '@contro/ui';
import { AvisoRascunho } from '../../components/AvisoRascunho';
import { EscolherData } from '../../components/EscolherData';
import { formatarDataCurta } from '../../lib/datas';
import { useRascunho } from '../../lib/useRascunho';
import type { PessoaResumo } from '../perfil/usePessoas';
import { dataLocal } from './api';
import type { EntradaTarefa } from './campo';
import type { TarefaObra } from './tarefasObra';
import styles from './AdiarSheet.module.css';

/** Valor do select para digitar o nome de quem não tem login. */
const OUTRO = '__outro';

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
  useEffect(() => {
    setNomeDigitado('');
    if (atribuir) {
      setTexto(iTexto ?? '');
      setResponsavelId('');
      setPrazo(iPrazo ?? emDias(1));
      setObraId(iObra ?? '');
      setRecuperado(false);
      return;
    }
    const r = tarefa ? null : lido;
    setTexto(tarefa?.texto ?? r?.texto ?? '');
    setResponsavelId(tarefa?.responsavel_id ?? r?.responsavelId ?? '');
    setPrazo(tarefa?.prazo ?? r?.prazo ?? emDias(1));
    setObraId(r?.obraId || (obras?.length === 1 ? obras[0].id : ''));
    setRecuperado(Boolean(r));
  }, [tarefa, aberto, obras, lido, atribuir, iTexto, iPrazo, iObra]);
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
      >
        <option value="">{atribuir ? 'Escolha quem cuida' : '—'}</option>
        {pessoas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
            {p.papel_texto ? ` · ${p.papel_texto}` : ''}
          </option>
        ))}
        {atribuir ? <option value={OUTRO}>Outro nome (digitar)</option> : null}
      </select>
      {outro ? (
        <div style={{ marginTop: 8 }}>
          <Input
            label="Nome do responsável"
            value={nomeDigitado}
            onChange={(e) => setNomeDigitado(e.target.value)}
          />
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
              {
                id: tarefa?.id ?? null,
                texto: texto.trim(),
                responsavelId: outro ? null : responsavelId || null,
                ...(outro ? { responsavelNome: nomeDigitado.trim() } : {}),
                prazo,
              },
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
