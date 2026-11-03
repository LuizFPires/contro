import { normalizarPrestador } from '../obras/nomesPrestador';
import { hojeISO } from '../obras/api';
import { formatarDataCurta } from '../../lib/datas';
import { montarAta, type AtaCompleta } from './ataDados';
import type { ReuniaoCompleta, ReuniaoObraDados } from './reuniaoApi';
const normalizar = normalizarPrestador;
function mapa(o: ReuniaoObraDados): Record<string, string> {
  return {
    ...Object.fromEntries(
      [...o.concluir, ...o.comecar, ...o.atividadesAtrasadas]
        .filter((a) => a.prestador)
        .map((a) => [a.atividadeId, a.prestador!]),
    ),
    ...o.contratadosPorVinculo,
  };
}
export function contratadosDaAta(r: ReuniaoCompleta): string[] {
  const nomes = new Map<string, string>();
  for (const o of r.obras) {
    const ids = new Set([
      ...o.passadaConcluir.map((a) => a.atividadeId),
      ...o.passadaComecar.map((a) => a.atividadeId),
      ...o.concluir.map((a) => a.atividadeId),
      ...o.comecar.map((a) => a.atividadeId),
      ...o.providenciar.map((p) => p.providenciaId),
      ...o.providenciasAtrasadas.map((p) => p.providenciaId),
      ...r.tarefas.filter((t) => t.obraId === o.obraId).map((t) => t.vinculoId),
    ]);
    for (const [id, nome] of Object.entries(mapa(o)))
      if (ids.has(id) && nome.trim()) nomes.set(normalizar(nome), nome.trim());
  }
  return [...nomes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
export function filtrarPorContratado(r: ReuniaoCompleta, nome: string): ReuniaoCompleta {
  const mapas = new Map(r.obras.map((o) => [o.obraId, mapa(o)]));
  const pertence = (obraId: string, id: string | null) =>
    Boolean(id && normalizar(mapas.get(obraId)?.[id] ?? '') === normalizar(nome) && nome.trim());
  const tarefas = r.tarefas.filter((t) => pertence(t.obraId, t.vinculoId));
  const obras = r.obras
    .map((o) => ({
      ...o,
      observacoes: '',
      passadaConcluir: o.passadaConcluir.filter((a) => pertence(o.obraId, a.atividadeId)),
      passadaComecar: o.passadaComecar.filter((a) => pertence(o.obraId, a.atividadeId)),
      concluir: o.concluir.filter((a) => pertence(o.obraId, a.atividadeId)),
      comecar: o.comecar.filter((a) => pertence(o.obraId, a.atividadeId)),
      atividadesAtrasadas: o.atividadesAtrasadas.filter((a) => pertence(o.obraId, a.atividadeId)),
      providenciar: o.providenciar.filter((p) => pertence(o.obraId, p.providenciaId)),
      providenciasAtrasadas: o.providenciasAtrasadas.filter((p) =>
        pertence(o.obraId, p.providenciaId),
      ),
    }))
    .filter(
      (o) =>
        o.passadaConcluir.length +
          o.passadaComecar.length +
          o.concluir.length +
          o.comecar.length +
          o.providenciar.length +
          o.providenciasAtrasadas.length >
          0 || tarefas.some((t) => t.obraId === o.obraId),
    );
  return { ...r, obras, tarefas };
}

/** Um documento, somente os prestadores com pendências na reunião, em ordem alfabética. */
export function resumoTodosContratados(r: ReuniaoCompleta): AtaCompleta {
  const nomes = new Map<string, string>();
  for (const o of r.obras)
    for (const nome of Object.values(mapa(o)))
      if (nome.trim()) nomes.set(normalizar(nome), nome.trim());
  const propostas = (r.propostas ?? []).filter(
    (p) => !p.recebida && r.obras.some((o) => o.obraId === p.obra_id),
  );
  for (const p of propostas)
    if (!nomes.has(normalizar(p.contratado))) nomes.set(normalizar(p.contratado), p.contratado);
  const obras = [...nomes.values()]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((nome) => {
      const filtrada = filtrarPorContratado(r, nome);
      const ata = montarAta(filtrada);
      const linhas = ata.obras.flatMap((o) =>
        [
          ...o.naoAconteceu,
          ...o.proximaSemana.map((l) => ({ ...l, ok: false })),
          ...o.providencias.filter((l) => !l.ok),
          ...o.cobranca.filter((l) => !l.ok),
        ].map((l) => ({ ...l, texto: `${o.nome} · ${l.texto}` })),
      );
      for (const p of propostas.filter((p) => normalizar(p.contratado) === normalizar(nome))) {
        const obra = r.obras.find((o) => o.obraId === p.obra_id)!;
        linhas.push({
          texto: `${obra.nome} · Envio de proposta · ${p.mapa.nome} · ${p.descricao} · ${p.prazo ? `até ${formatarDataCurta(p.prazo)}` : 'Sem prazo informado'}`,
          acao: null,
          atraso: Boolean(p.prazo && p.prazo < hojeISO()),
          nao: false,
          ok: false,
          semResposta: false,
          data: p.prazo,
        });
      }
      linhas.sort((a, b) => (a.data ?? '9999').localeCompare(b.data ?? '9999'));
      return {
        nome,
        indicador: `${linhas.length} pendência(s)`,
        atrasada: linhas.some((l) => l.atraso),
        situacao: 'Contratado',
        aconteceu: [],
        naoAconteceu: [],
        proximaSemana: [],
        providencias: linhas,
        cobranca: [],
        observacoes: '',
      };
    })
    .filter((o) => o.providencias.length > 0);
  return { obras, pessoas: [], totais: montarAta(r).totais };
}
