import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { atalhosDataPrevista, type SubitemGeral } from '@contro/core';
import { BottomSheet, Button, Input, useToast } from '@contro/ui';
import { EscolherData } from '../../components/EscolherData';
import { hojeISO } from '../obras/api';
import {
  adicionarSubitemGeral,
  editarSubitemGeral,
  excluirSubitemGeral,
  restaurarSubitemGeral,
} from './planejamento';
import styles from './FichaAtividadeGeral.module.css';

/** Editar subitem (subitem preenchido) ou criar um novo (subitem nulo). Só quem planeja abre. */
export function EditarSubitemSheet({
  aberto,
  obraId,
  atividadeId,
  subitem,
  onFechar,
}: {
  aberto: boolean;
  obraId: string;
  atividadeId: string;
  subitem: SubitemGeral | null;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [nome, setNome] = useState('');
  const [data, setData] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const hoje = hojeISO();

  useEffect(() => {
    if (aberto) {
      setNome(subitem?.nome ?? '');
      setData(subitem?.prazo ?? '');
      setOcupado(false);
      setErro('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, subitem?.id]);

  const limpo = nome.trim().replace(/\s+/g, ' ');
  const atualizar = () => qc.invalidateQueries({ queryKey: ['obra', obraId] });
  const avisarErro = (e: unknown) =>
    showToast({ message: e instanceof Error ? e.message : 'Não foi possível desfazer.' });

  async function salvar() {
    if (!limpo || ocupado) return;
    setOcupado(true);
    setErro('');
    try {
      if (subitem) {
        const antes = { nome: subitem.nome, data: subitem.prazo };
        await editarSubitemGeral(subitem.id, limpo, data || null);
        await atualizar();
        showToast({
          message: 'Subitem salvo.',
          onUndo: () =>
            void editarSubitemGeral(subitem.id, antes.nome, antes.data)
              .then(atualizar)
              .catch(avisarErro),
        });
      } else {
        const id = await adicionarSubitemGeral(atividadeId, limpo, data || null);
        await atualizar();
        showToast({
          message: 'Subitem adicionado.',
          onUndo: () => void excluirSubitemGeral(id).then(atualizar).catch(avisarErro),
        });
      }
      onFechar();
    } catch (e) {
      setOcupado(false);
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o subitem.');
    }
  }

  async function excluir() {
    if (!subitem || ocupado) return;
    setOcupado(true);
    setErro('');
    try {
      await excluirSubitemGeral(subitem.id);
      await atualizar();
      showToast({
        message: 'Subitem excluído.',
        onUndo: () => void restaurarSubitemGeral(subitem.id).then(atualizar).catch(avisarErro),
      });
      onFechar();
    } catch (e) {
      setOcupado(false);
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir o subitem.');
    }
  }

  return (
    <BottomSheet
      open={aberto}
      title={subitem ? 'Editar subitem' : 'Novo subitem'}
      onClose={onFechar}
    >
      <div className={styles.sheetCorpo}>
        <Input
          label="Texto"
          value={nome}
          autoFocus={!subitem}
          onChange={(e) => setNome(e.target.value)}
        />
        <div>
          <div className={styles.rotulo}>Data prevista</div>
          <EscolherData
            valor={data}
            onEscolher={setData}
            sugestoes={atalhosDataPrevista(hoje)}
            hoje={hoje}
            rotulo="Data prevista do subitem"
          />
        </div>
        <p className={styles.nota}>A data da atividade acompanha a do último subitem.</p>
        {erro ? (
          <p role="alert" className={styles.erro}>
            {erro}
          </p>
        ) : null}
        <Button onClick={() => void salvar()} disabled={!limpo || ocupado}>
          Salvar
        </Button>
        {subitem ? (
          <button
            type="button"
            className={styles.excluirSub}
            disabled={ocupado}
            onClick={() => void excluir()}
          >
            Excluir subitem
          </button>
        ) : null}
      </div>
    </BottomSheet>
  );
}
