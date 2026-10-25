import { PDF_SERVICE_URL } from './env';

/**
 * Baixa um PDF do pdf-service (POST com os dados já calculados). Lança em caso
 * de falha para a tela decidir o fallback (ex.: window.print()).
 */
export async function baixarPdf(
  endpoint: 'boletim' | 'ata',
  body: unknown,
  filename: string,
): Promise<void> {
  const resp = await fetch(`${PDF_SERVICE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`pdf-service respondeu ${resp.status}`);
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
