import { expect, it, vi } from 'vitest';
import { gerarChecklistPdf, pendenciasParaPdf } from './checklistPdf';
import type { PendenciaObra } from './pendenciasObra';
const p = (
  id: string,
  criticidade: PendenciaObra['criticidade'],
  extra: Partial<PendenciaObra> = {},
): PendenciaObra => ({
  id,
  criticidade,
  status: 'aberta',
  responsavel_id: 'ana',
  responsavelNome: 'Ana Silva',
  titulo: `Pendência ${id}`,
  obra_id: 'obra',
  atividade_id: 'a',
  local: 'Sala técnica',
  ordem_fila: 0,
  apontada_em: '2026-11-03T12:00:00Z',
  adiada_ate: null,
  motivo_adiamento: null,
  resolvida_por: null,
  resolvida_em: null,
  vistoriada_por: null,
  vistoriada_em: null,
  fotoAntesUrl: 'foto',
  fotoDepoisUrl: null,
  apontouNome: 'Bruno',
  resolveuNome: null,
  atividadeNome: 'Instalações',
  ...extra,
});
it('filtra pessoa, atividade e abertas, ordenando alta, média e baixa sem alterar a lista', () => {
  const lista = [
    p('baixa', 'baixa'),
    p('media', 'media'),
    p('alta', 'alta'),
    p('outro', 'alta', { responsavel_id: 'bruno' }),
    p('feita', 'alta', { status: 'fechada' }),
    p('vistoria', 'alta', { status: 'em_vistoria' }),
    p('atividade', 'alta', { atividade_id: 'b' }),
    p('sem', 'baixa', { responsavel_id: null }),
  ];
  expect(pendenciasParaPdf(lista, 'ana', 'a').map((p) => p.id)).toEqual(['alta', 'media', 'baixa']);
  expect(pendenciasParaPdf(lista, '').map((p) => p.id)).toEqual(['sem']);
  expect(pendenciasParaPdf(lista, 'todos')).toHaveLength(6);
  expect(lista[0].id).toBe('baixa');
});
it('não gera um relatório incompleto quando falta foto ou o download falha', async () => {
  await expect(
    gerarChecklistPdf('Obra', 'Ana', [p('sem foto', 'alta', { fotoAntesUrl: null })]),
  ).rejects.toThrow('ainda não está disponível');
  const carregar = vi.fn().mockRejectedValue(new Error('offline'));
  await expect(gerarChecklistPdf('Obra', 'Ana', [p('foto', 'alta')], carregar)).rejects.toThrow(
    'Não foi possível carregar a foto',
  );
});
