import { useRef, useState } from 'react';
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

/**
 * Um item da avaliação: Ok ou Não. O Não grava na hora (10/11/2026): o item
 * passa a tirar ponto e a pendência vai para o Check list, mesmo sem foto.
 * O detalhe (o que está errado, criticidade, foto do antes) fica aberto e cada
 * escolha é salva assim que feita; a foto pode vir depois.
 */
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
  const [camera, setCamera] = useState(false);
  const [confirmaReabrir, setConfirmaReabrir] = useState(false);
  const situacao = situacaoItem(item);
  const conforme = situacao === 'conforme' || situacao === 'resolvido';
  const naoConforme = situacao === 'nao_conforme';
  const pendencia = item.pendenciaId
    ? aval.pendencias.find((p) => p.id === item.pendenciaId)
    : undefined;
  const crit = (pendencia?.criticidade ?? item.criticidade ?? 'media') as Crit;

  function tocarOk() {
    enviado.current = null;
    setFormAberto(false);
    setConfirmaReabrir(false);
    if (naoConforme) {
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
    // Já é Não: abre ou fecha o detalhe (texto, criticidade, foto).
    enviado.current = null;
    if (naoConforme) {
      if (!formAberto)
        setTexto(pendencia && pendencia.titulo !== item.nome ? pendencia.titulo : '');
      setFormAberto((v) => !v);
      return;
    }
    // Já resolvida antes: reabrir tira a foto do depois, então pede confirmação.
    if (item.pendenciaId && item.pendenciaStatus === 'fechada') {
      setConfirmaReabrir((v) => !v);
      return;
    }
    // Grava o Não na hora: sair da tela não deixa o item "em aberto" sem ponto.
    const anterior = item.resultado === 'conforme' ? 'conforme' : null;
    const pendenciaId = crypto.randomUUID();
    aval.marcarNaoConforme.mutate({
      item,
      file: null,
      pendenciaId,
      dados: { titulo: null, local: item.secao, criticidade: 'media' },
    });
    setTexto('');
    setFormAberto(true);
    showToast({
      message: 'Não conforme · pendência criada no Check list',
      onUndo: () => {
        setFormAberto(false);
        aval.marcar.mutate({
          item: { ...item, pendenciaId, pendenciaStatus: 'aberta' },
          resultado: anterior,
        });
      },
    });
  }

  function reabrir() {
    setConfirmaReabrir(false);
    aval.marcarNaoConforme.mutate({
      item,
      file: null,
      dados: { titulo: null, local: null, criticidade: 'media' },
    });
    showToast({ message: 'Pendência reaberta no Check list' });
  }

  // Último texto/criticidade enviado (o cache otimista pode ainda não ter
  // re-renderizado entre o blur e o toque em "Pronto": não enviar duas vezes).
  const enviado = useRef<{ titulo: string; criticidade: string } | null>(null);

  /** Salva o texto e/ou a criticidade na pendência ligada. */
  function salvarDetalhe(novo: { titulo?: string; criticidade?: Crit }) {
    if (!pendencia) return;
    const atual = enviado.current ?? {
      titulo: pendencia.titulo,
      criticidade: pendencia.criticidade,
    };
    const titulo = novo.titulo ?? atual.titulo;
    const criticidade = (novo.criticidade ?? atual.criticidade) as Crit;
    if (titulo === atual.titulo && criticidade === atual.criticidade) return;
    enviado.current = { titulo, criticidade };
    aval.editarPendencia.mutate({
      id: pendencia.id,
      dados: {
        titulo,
        local: pendencia.local,
        criticidade,
        atividadeId: pendencia.atividade_id,
      },
      atividadeNome: pendencia.atividadeNome,
    });
  }

  const tituloDigitado = () => texto.trim() || item.nome;

  // Salva o texto também aqui: nem todo celular tira o foco do campo ao tocar.
  function pronto() {
    salvarDetalhe({ titulo: tituloDigitado() });
    setFormAberto(false);
  }

  const rotulo = naoConforme
    ? `Pendente no Check list · ${ROTULO_CRIT[crit]}`
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
          {naoConforme && item.faltaFotoAntes ? (
            <span className={styles.faltaFoto}>
              <Icon name="camera" size={14} strokeWidth={2} />
              Falta a foto do antes
            </span>
          ) : null}
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
          className={`${styles.op} ${naoConforme || confirmaReabrir ? styles.opNao : ''}`}
          onClick={tocarNao}
        >
          <Icon name="close" size={18} />
          Não
        </button>
      </div>

      {confirmaReabrir ? (
        <div className={styles.form}>
          <p className={styles.dica}>
            Voltou a dar problema? A pendência volta para o Check list e perde a foto do depois.
          </p>
          <button type="button" className={styles.primario} onClick={reabrir}>
            Reabrir pendência
          </button>
          <button
            type="button"
            className={styles.terciarioLargo}
            onClick={() => setConfirmaReabrir(false)}
          >
            Cancelar
          </button>
        </div>
      ) : null}

      {formAberto && naoConforme ? (
        <div className={styles.form}>
          <p className={styles.dica}>
            Já está como Não conforme no Check list. Complete agora ou depois.
          </p>
          <div className={styles.formLinha}>
            <input
              className={styles.campo}
              aria-label="O que está errado"
              placeholder="O que está errado?"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onBlur={() => salvarDetalhe({ titulo: tituloDigitado() })}
            />
            {item.faltaFotoAntes ? (
              <button type="button" className={styles.terciario} onClick={() => setCamera(true)}>
                <Icon name="camera" size={18} />
                Foto do antes
              </button>
            ) : (
              <span className={styles.fotoOk}>
                <Icon name="checkGrosso" size={14} strokeWidth={3} />
                Com foto
              </span>
            )}
          </div>
          <div className={styles.crits} role="group" aria-label="Criticidade">
            {CRITS.map((c) => (
              <button
                key={c.valor}
                type="button"
                aria-pressed={crit === c.valor}
                className={`${styles.crit} ${crit === c.valor ? styles.critOn : ''}`}
                onClick={() => salvarDetalhe({ titulo: tituloDigitado(), criticidade: c.valor })}
              >
                {c.rotulo}
              </button>
            ))}
          </div>
          <button type="button" className={styles.primario} onClick={pronto}>
            Pronto
          </button>
        </div>
      ) : null}

      {camera && pendencia ? (
        <Camera
          kicker={item.secao}
          titulo={item.nome}
          dica="Fotografe o problema: esta é a foto do antes da pendência."
          onCancelar={() => setCamera(false)}
          onCapturar={(file) => {
            setCamera(false);
            aval.anexarFotoAntes.mutate({ id: pendencia.id, file });
            showToast({ message: 'Foto do antes salva' });
          }}
        />
      ) : null}
    </div>
  );
}
