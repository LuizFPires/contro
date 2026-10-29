import { useEffect, useState } from 'react';
import { textoReplanejamento } from '@contro/core';
import { BottomSheet, Button, Input } from '@contro/ui';
import { AvisoRascunho } from '../../components/AvisoRascunho';
import { EscolherData } from '../../components/EscolherData';
import { formatarDataCurta } from '../../lib/datas';
import { useRascunho } from '../../lib/useRascunho';
import type { PessoaResumo } from '../perfil/usePessoas';
import type { EntradaTarefa } from './campo';
import type { TarefaObra } from './tarefasObra';
import styles from './AdiarSheet.module.css';

function emDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
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
}) {
  const [texto, setTexto] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [prazo, setPrazo] = useState(emDias(1));
  const [obraId, setObraId] = useState('');
  const pedeObra = !tarefa && Boolean(obras?.length);
  // Rascunho da nova tarefa (a edição de uma tarefa existente não usa).
  const contexto = obras?.length === 1 ? obras[0].id : 'geral';
  const rascunho = useRascunho<{
    texto: string;
    responsavelId: string;
    prazo: string;
    obraId: string;
  }>(aberto && !tarefa ? `tarefa:${contexto}` : null);
  const [recuperado, setRecuperado] = useState(false);
  const lido = rascunho.lido;

  useEffect(() => {
    const r = tarefa ? null : lido;
    setTexto(tarefa?.texto ?? r?.texto ?? '');
    setResponsavelId(tarefa?.responsavel_id ?? r?.responsavelId ?? '');
    setPrazo(tarefa?.prazo ?? r?.prazo ?? emDias(1));
    setObraId(r?.obraId || (obras?.length === 1 ? obras[0].id : ''));
    setRecuperado(Boolean(r));
  }, [tarefa, aberto, obras, lido]);
  const guardarRascunho = rascunho.guardar;
  useEffect(() => {
    if (aberto && !tarefa) guardarRascunho({ texto, responsavelId, prazo, obraId }, !texto.trim());
  }, [aberto, tarefa, texto, responsavelId, prazo, obraId, guardarRascunho]);

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
    <BottomSheet open={aberto} title={tarefa ? 'Editar tarefa' : 'Nova tarefa'} onClose={onFechar}>
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

      <div className={styles.rodape} style={{ marginTop: pedeObra ? 12 : 0 }}>
        <Input label="O que" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>

      <p className={styles.rotulo}>Responsável</p>
      <select
        className={styles.data}
        style={{ width: '100%' }}
        value={responsavelId}
        onChange={(e) => setResponsavelId(e.target.value)}
        aria-label="Responsável"
      >
        <option value="">—</option>
        {pessoas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
            {p.papel_texto ? ` · ${p.papel_texto}` : ''}
          </option>
        ))}
      </select>

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
          disabled={!texto.trim() || !prazo || pendente || (pedeObra && !obraId)}
          onClick={() => {
            rascunho.limpar();
            onSalvar(
              {
                id: tarefa?.id ?? null,
                texto: texto.trim(),
                responsavelId: responsavelId || null,
                prazo,
              },
              pedeObra ? obraId : undefined,
            );
          }}
        >
          {pendente ? 'Salvando…' : tarefa ? 'Salvar' : 'Criar tarefa'}
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
