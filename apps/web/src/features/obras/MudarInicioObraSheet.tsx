import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deslocarDU, diaUtilAPartir, mudarInicioObra, type AtividadeEntrada } from '@contro/core';
import { BottomSheet, Button, useToast } from '@contro/ui';
import { EscolherData } from '../../components/EscolherData';
import { formatarDataCompleta, formatarDataCurta } from '../../lib/datas';
import { hojeISO } from './api';
import { mudarInicioDaObra } from './campo';
import type { ObraCompleta } from './detalhe';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Mudar o início da obra (pedido do João, 28/11/2026): a obra inteira anda junto
 * (cronograma, datas ajustadas à mão e inauguração planejada). Qualquer membro;
 * prévia da inauguração antes de salvar e Desfazer no aviso.
 */
export function MudarInicioObraSheet({
  obra,
  aberto,
  onFechar,
}: {
  obra: ObraCompleta;
  aberto: boolean;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [data, setData] = useState(obra.inicio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (aberto) {
      setData(obra.inicio);
      setErro('');
    }
  }, [aberto, obra.inicio]);

  const entrada: AtividadeEntrada[] = useMemo(
    () =>
      obra.atividades
        .filter((x) => !x.preObra)
        .map((x) => ({
          id: x.id,
          duracao_du: x.duracao_du,
          pai_id: x.pai_id,
          em_sequencia: x.em_sequencia,
          inicio_manual: x.inicio_manual,
          predecessoras: x.predecessoras,
          defasagens: x.defasagens,
        })),
    [obra.atividades],
  );
  const provs = useMemo(
    () =>
      obra.atividades.flatMap((a) =>
        a.providencias.map((p) => ({ id: p.id, na_obra_em: p.na_obra_em })),
      ),
    [obra.atividades],
  );
  const m = useMemo(
    () => mudarInicioObra(obra.inicio, data, entrada, provs, obra.entrega_original),
    [obra.inicio, data, entrada, provs, obra.entrega_original],
  );

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ['obra', obra.id] });
    void qc.invalidateQueries({ queryKey: ['obras'] });
  };

  async function salvar() {
    if (m.deltaDu === 0) return;
    setSalvando(true);
    setErro('');
    // O "antes" para o Desfazer: as mesmas atividades e providências, com as datas de agora.
    const ids = new Set(m.atividades.map((a) => a.id));
    const antes = {
      obraId: obra.id,
      inicio: obra.inicio,
      entregaOriginal: obra.entrega_original,
      atividades: obra.atividades
        .filter((a) => ids.has(a.id))
        .map((a) => ({ id: a.id, inicio_manual: a.inicio_manual })),
      providencias: provs.filter((p) => p.na_obra_em),
    };
    try {
      await mudarInicioDaObra({
        obraId: obra.id,
        inicio: m.inicio,
        entregaOriginal: m.entregaOriginal,
        atividades: m.atividades,
        providencias: m.providencias,
      });
    } catch {
      setSalvando(false);
      setErro('Não foi possível mudar o início. Confira a conexão e tente de novo.');
      return;
    }
    setSalvando(false);
    atualizar();
    onFechar();
    showToast({
      message: `Obra começa ${formatarDataCurta(m.inicio)}`,
      onUndo: () =>
        void mudarInicioDaObra(antes).then(atualizar, () =>
          showToast({ message: 'Não foi possível desfazer' }),
        ),
    });
  }

  const hoje = hojeISO();
  const sugestoes = [
    { valor: deslocarDU(obra.inicio, -5), rotulo: '1 semana antes' },
    { valor: diaUtilAPartir(hoje), rotulo: 'Hoje' },
    { valor: deslocarDU(obra.inicio, 5), rotulo: '1 semana depois' },
  ].filter((s, i, arr) => arr.findIndex((x) => x.valor === s.valor) === i);

  const efeito =
    m.deltaDu === 0
      ? 'Escolha a nova data de início.'
      : `${m.deltaDu < 0 ? 'Adianta' : 'Atrasa'} a obra em ${plural(Math.abs(m.deltaDu), 'dia útil', 'dias úteis')}: inauguração ${formatarDataCurta(m.entregaDepois)} (era ${formatarDataCurta(m.entregaAntes)}).`;

  return (
    <BottomSheet open={aberto} title="Mudar início da obra" onClose={onFechar}>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: '#464646' }}>
        Hoje a obra começa {formatarDataCompleta(obra.inicio)}. Todo o cronograma anda junto,
        inclusive as datas ajustadas à mão e a inauguração planejada.
      </p>
      <EscolherData
        valor={m.inicio}
        onEscolher={setData}
        sugestoes={sugestoes}
        hoje={hoje}
        rotulo="Novo início"
      />
      {data !== m.inicio ? (
        <p style={{ margin: '8px 0 0', fontSize: 13 }}>
          {formatarDataCurta(data)} não é dia útil: a obra começa {formatarDataCurta(m.inicio)}.
        </p>
      ) : null}
      <p role="status" style={{ margin: '12px 0 16px', fontSize: 14, fontWeight: 700 }}>
        {efeito}
      </p>
      {erro ? (
        <p role="alert" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
          {erro}
        </p>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Button variant="tertiary" disabled={salvando} onClick={onFechar}>
          Cancelar
        </Button>
        <Button disabled={salvando || m.deltaDu === 0} onClick={() => void salvar()}>
          {salvando ? 'Salvando…' : 'Mudar início'}
        </Button>
      </div>
    </BottomSheet>
  );
}
