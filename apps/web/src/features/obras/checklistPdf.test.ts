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
    p('sem', 'baixa', { responsavel_id: null, responsavelNome: null }),
    p('ze', 'media', { responsavel_id: null, responsavelNome: 'Zé Eletricista' }),
  ];
  expect(pendenciasParaPdf(lista, 'ana', 'a').map((p) => p.id)).toEqual(['alta', 'media', 'baixa']);
  expect(pendenciasParaPdf(lista, '').map((p) => p.id)).toEqual(['sem']);
  expect(pendenciasParaPdf(lista, 'nome:Zé Eletricista').map((p) => p.id)).toEqual(['ze']);
  expect(pendenciasParaPdf(lista, 'todos')).toHaveLength(7);
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

const JPG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAoAB4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCeiiitzlCiiigAooooAKKKKACiiigAooooA//Z';
const paginas = async (b: Blob) =>
  (new TextDecoder('latin1').decode(await b.arrayBuffer()).match(/\/Type \/Page\b/g) ?? []).length;
it('capa, resumo e duas pendências por página; fonte do app quando carrega', async () => {
  const { readFileSync } = await import('node:fs');
  const fonte = async (peso: 400 | 700 | 900) =>
    readFileSync(new URL(`../../../public/fonts/NunitoSans-${peso}.ttf`, import.meta.url)).toString(
      'base64',
    );
  const foto = vi.fn().mockResolvedValue({ data: JPG, largura: 30, altura: 40 });
  const lista = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
    p(id, i ? 'media' : 'alta', {
      prazo: i === 1 ? '2026-11-10' : null,
      local: i === 2 ? null : 'Sala',
    }),
  );
  const blob = await gerarChecklistPdf('Obra Teste', 'Todos os responsáveis', lista, foto, {
    agora: new Date(2026, 10, 16, 17, 3),
    carregarFonte: fonte,
  });
  // 1 capa + 1 resumo + 3 páginas de pendências (2 + 2 + 1)
  expect(await paginas(blob)).toBe(5);
  expect(foto).toHaveBeenCalledTimes(5);
  const pdf = new TextDecoder('latin1').decode(await blob.arrayBuffer());
  expect(pdf).toContain('/BaseFont /Nunito900');
});
it('sem a fonte do app, gera com Helvetica', async () => {
  const foto = vi.fn().mockResolvedValue({ data: JPG, largura: 30, altura: 40 });
  const blob = await gerarChecklistPdf('Obra', 'Ana', [p('x', 'baixa')], foto, {
    carregarFonte: async () => null,
  });
  expect(await paginas(blob)).toBe(3);
  expect(new TextDecoder('latin1').decode(await blob.arrayBuffer())).not.toContain('Nunito');
});
