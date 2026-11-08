import { useEffect, useState } from 'react';
import { ROTULO_SITUACAO, situacaoItem } from '@contro/core';
import { Icon, useToast } from '@contro/ui';
import { Camera } from '../obras/Camera';
import type { useAvaliacao, ItemTela } from './useAvaliacao';
import styles from './Avaliacao.module.css';

type Crit = 'alta' | 'media' | 'baixa';
const CRITS: { valor: Crit; rotulo: string }[] = [
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'baixa', rotulo: 'Baixa' },
];
const ROTULO_CRIT: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

/** Um item da avaliação: Ok ou Não; o Não pede a foto do antes e cria a pendência. */
export function ItemLinha({
  item,
  aval,
}: {
  item: ItemTela;
  aval: ReturnType<typeof useAvaliacao>;
}) {
  const { showToast } = useToast();
  const [formAberto, setFormAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [crit, setCrit] = useState<Crit>('media');
  const [foto, setFoto] = useState<{ file: File; url: string } | null>(null);
  const [camera, setCamera] = useState(false);
  const situacao = situacaoItem(item);
  const conforme = situacao === 'conforme' || situacao === 'resolvido';
  const naoConforme = situacao === 'nao_conforme';

  useEffect(() => {
    return () => {
      if (foto) URL.revokeObjectURL(foto.url);
    };
  }, [foto]);

  function limparForm() {
    setFormAberto(false);
    setTexto('');
    setCrit('media');
    setFoto(null);
  }

  function tocarOk() {
    limparForm();
    if (naoConforme) {
      const pendencia = aval.pendencias.find((p) => p.id === item.pendenciaId);
      aval.marcar.mutate({ item, resultado: 'conforme' });
      showToast({
        message: 'Pendência retirada do Check list',
        onUndo: pendencia ? () => aval.restaurar.mutate({ itemId: item.id, pendencia }) : undefined,
      });
      return;
    }
    aval.marcar.mutate({ item, resultado: item.resultado === 'conforme' ? null : 'conforme' });
  }

  function tocarNao() {
    if (naoConforme) return;
    // Já resolvida antes e voltou a dar problema: reabre a mesma pendência.
    if (item.pendenciaId && item.pendenciaStatus === 'fechada') {
      aval.marcarNaoConforme.mutate({
        item,
        file: null,
        dados: { titulo: null, local: null, criticidade: 'media' },
      });
      showToast({ message: 'Pendência reaberta no Check list' });
      return;
    }
    setFormAberto((v) => !v);
  }

  function criar() {
    if (!foto) return;
    const anterior = item.resultado === 'conforme' ? 'conforme' : null;
    const pendenciaId = crypto.randomUUID();
    aval.marcarNaoConforme.mutate({
      item,
      file: foto.file,
      pendenciaId,
      dados: { titulo: texto.trim() || null, local: item.secao, criticidade: crit },
    });
    limparForm();
    showToast({
      message: 'Pendência criada no Check list',
      onUndo: () =>
        aval.marcar.mutate({
          item: { ...item, pendenciaId, pendenciaStatus: 'aberta' },
          resultado: anterior,
        }),
    });
  }

  const rotulo = naoConforme
    ? `Pendente no Check list · ${ROTULO_CRIT[item.criticidade ?? 'media']}`
    : situacao === 'resolvido'
      ? 'Resolvido no Check list'
      : ROTULO_SITUACAO[situacao];

  return (
    <div className={styles.item}>
      <div className={styles.itemLinha}>
        <div className={styles.itemTexto}>
          <b>{item.nome}</b>
          <span>
            {item.codigo ? `${item.codigo} · ` : ''}
            {rotulo}
          </span>
        </div>
        <button
          type="button"
          aria-label={`${item.nome}: conforme`}
          aria-pressed={conforme}
          className={`${styles.op} ${conforme ? styles.opOk : ''}`}
          onClick={tocarOk}
        >
          <Icon name="check" size={18} />
          Ok
        </button>
        <button
          type="button"
          aria-label={`${item.nome}: não conforme`}
          aria-pressed={naoConforme}
          className={`${styles.op} ${naoConforme || formAberto ? styles.opNao : ''}`}
          onClick={tocarNao}
        >
          <Icon name="close" size={18} />
          Não
        </button>
      </div>

      {formAberto ? (
        <div className={styles.form}>
          <div className={styles.formLinha}>
            <input
              className={styles.campo}
              aria-label="O que está errado"
              placeholder="O que está errado?"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <button type="button" className={styles.terciario} onClick={() => setCamera(true)}>
              <Icon name="camera" size={18} />
              {foto ? 'Trocar foto' : 'Foto do antes'}
            </button>
          </div>
          {foto ? <img className={styles.miniatura} src={foto.url} alt="Foto do antes" /> : null}
          <div className={styles.crits} role="group" aria-label="Criticidade">
            {CRITS.map((c) => (
              <button
                key={c.valor}
                type="button"
                aria-pressed={crit === c.valor}
                className={`${styles.crit} ${crit === c.valor ? styles.critOn : ''}`}
                onClick={() => setCrit(c.valor)}
              >
                {c.rotulo}
              </button>
            ))}
          </div>
          <button type="button" className={styles.primario} disabled={!foto} onClick={criar}>
            {foto ? 'Criar pendência' : 'Tire a foto do antes para criar a pendência'}
          </button>
        </div>
      ) : null}

      {camera ? (
        <Camera
          kicker={item.secao}
          titulo={item.nome}
          dica="Fotografe o problema: esta é a foto do antes da pendência."
          onCancelar={() => setCamera(false)}
          onCapturar={(file) => {
            setFoto({ file, url: URL.createObjectURL(file) });
            setCamera(false);
          }}
        />
      ) : null}
    </div>
  );
}
