// Dependências com atividades excluídas da obra (exclusão lógica, regra 7): a
// ligação fica guardada no banco (o Desfazer volta tudo como era), e no cálculo
// a sucessora passa a depender das predecessoras da excluída, para o
// cronograma não "pular" para o dia 0.

export interface Dependencia {
  atividade_id: string;
  predecessora_id: string;
  /** Defasagem em dias úteis (≤ 0 = paralelismo). Some na herança. */
  defasagem_du: number;
}

/**
 * Só as dependências entre atividades ativas. Predecessora excluída é trocada
 * pelas predecessoras dela (em cadeia, se também excluídas), sem repetir.
 */
export function dependenciasAtivas(deps: Dependencia[], ativas: Set<string>): Dependencia[] {
  const predsDe = new Map<string, string[]>();
  for (const d of deps)
    predsDe.set(d.atividade_id, [...(predsDe.get(d.atividade_id) ?? []), d.predecessora_id]);

  // Predecessoras ativas de uma excluída (subindo pela cadeia de excluídas).
  const herdadas = (id: string, vistos: Set<string>): string[] => {
    if (vistos.has(id)) return [];
    vistos.add(id);
    return (predsDe.get(id) ?? []).flatMap((p) => (ativas.has(p) ? [p] : herdadas(p, vistos)));
  };

  const out: Dependencia[] = [];
  const ja = new Set<string>();
  const add = (d: Dependencia) => {
    const k = `${d.atividade_id}>${d.predecessora_id}`;
    if (ja.has(k) || d.atividade_id === d.predecessora_id) return;
    ja.add(k);
    out.push(d);
  };
  for (const d of deps) {
    if (!ativas.has(d.atividade_id)) continue;
    if (ativas.has(d.predecessora_id)) add(d);
  }
  for (const d of deps) {
    if (!ativas.has(d.atividade_id) || ativas.has(d.predecessora_id)) continue;
    for (const p of herdadas(d.predecessora_id, new Set()))
      add({ atividade_id: d.atividade_id, predecessora_id: p, defasagem_du: 0 });
  }
  return out;
}
