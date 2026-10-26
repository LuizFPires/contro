// Texto da ata para WhatsApp (SPEC §8: textos no core). Sem emoji; *negrito* do
// WhatsApp. O envio é por wa.me na UI.

export interface ObraAta {
  nome: string;
  indicador: string; // ex.: "47% · Atrasada · 3 dias"
  atrasos: string[]; // nomes de atividades atrasadas
  concluir: string[]; // "Esta semana · concluir"
  comecar: string[];
  providenciar: string[]; // "Compra: Porcelanato (na obra qua 28/10)"
  observacoes: string;
}

/** Monta o texto da ata (WhatsApp) a partir das obras já formatadas pela UI. */
export function textoAtaWhatsapp(dataFmt: string, obras: ObraAta[]): string {
  const L: string[] = [];
  L.push('*CONTRO · Ata da semana*');
  L.push(`${dataFmt} · 16h`);
  L.push(`${obras.length} ${obras.length === 1 ? 'obra' : 'obras'}`);

  for (const o of obras) {
    L.push('');
    L.push(`*${o.nome}* — ${o.indicador}`);
    if (o.atrasos.length) L.push(`ATENÇÃO · atrasos: ${o.atrasos.join('; ')}`);
    if (o.concluir.length) L.push(`Concluir: ${o.concluir.join('; ')}`);
    if (o.comecar.length) L.push(`Começar: ${o.comecar.join('; ')}`);
    if (o.providenciar.length) L.push(`Providenciar: ${o.providenciar.join('; ')}`);
    if (o.observacoes.trim()) L.push(`Obs: ${o.observacoes.trim()}`);
  }

  L.push('');
  L.push('Ata completa (PDF) no app CONTRO.');
  return L.join('\n');
}

/** Providência registrada em reunião (tarefa com origem "Reunião dd/mm"). */
export interface ProvidenciaReuniao {
  origem: string | null;
  concluida: boolean;
  atrasada: boolean;
}

/** Origem gravada nas providências criadas numa reunião ("Reunião seg 26/10"). */
export function origemReuniao(dataFmt: string): string {
  return `Reunião ${dataFmt}`;
}

/** É uma providência de reunião anterior: veio de reunião, mas não da atual. */
export function deReuniaoAnterior(
  p: Pick<ProvidenciaReuniao, 'origem'>,
  origemAtual: string,
): boolean {
  return Boolean(p.origem?.startsWith('Reunião ')) && p.origem !== origemAtual;
}

/**
 * Indicadores do topo da reunião e da ata (protótipo): providências de reuniões
 * anteriores cumpridas e atrasadas, e as novas registradas nesta reunião.
 */
export function resumoReuniao(
  providencias: ProvidenciaReuniao[],
  origemAtual: string,
): { cumpridas: number; atrasadas: number; novas: number } {
  const anteriores = providencias.filter((p) => deReuniaoAnterior(p, origemAtual));
  return {
    cumpridas: anteriores.filter((p) => p.concluida).length,
    atrasadas: anteriores.filter((p) => p.atrasada).length,
    novas: providencias.filter((p) => p.origem === origemAtual).length,
  };
}
