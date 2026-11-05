import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ambienteInicial, ambientesDaPessoa, type Ambiente } from '@contro/core';
import { useLembrado } from '../../lib/useLembrado';
import type { PessoaAtual } from './usePerfil';

/**
 * Ambiente atual (Contorno ou Obras gerais). Lembra o último escolhido neste
 * aparelho; se a pessoa perdeu o acesso a ele, cai no primeiro disponível.
 * `aoTrocar` recebe o pedido de voltar a tela para o início (o App guarda a tela).
 */
export function useAmbiente(
  pessoa: PessoaAtual | null | undefined,
  aoTrocar?: () => void,
): { ambiente: Ambiente; disponiveis: Ambiente[]; trocar: (a: Ambiente) => void } {
  const qc = useQueryClient();
  const [ultimo, setUltimo] = useLembrado<Ambiente | null>('app:ambiente', null);
  const administrador = pessoa?.administrador ?? false;
  const acessoContorno = pessoa?.acessoContorno ?? true;
  const papelGeral = pessoa?.papelGeral ?? null;
  const disponiveis = useMemo(
    () => ambientesDaPessoa({ administrador, acessoContorno, papelGeral }),
    [administrador, acessoContorno, papelGeral],
  );
  const ambiente = ambienteInicial(disponiveis, ultimo);
  const trocar = useCallback(
    (a: Ambiente) => {
      if (!disponiveis.includes(a)) return;
      setUltimo(a);
      aoTrocar?.();
      void qc.invalidateQueries({ queryKey: ['obras'] });
    },
    [disponiveis, setUltimo, aoTrocar, qc],
  );
  return { ambiente, disponiveis, trocar };
}
