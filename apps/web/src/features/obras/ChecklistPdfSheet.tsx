import { useMemo, useState } from 'react';
import { BottomSheet, useToast } from '@contro/ui';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/db';
import { loadPendencias, type PendenciaObra } from './pendenciasObra';
import { gerarChecklistPdf, pendenciasParaPdf } from './checklistPdf';
import styles from './ChecklistPdf.module.css';

export function ChecklistPdfSheet({
  obra,
  lista,
  atividadeId,
  onFechar,
}: {
  obra: { id: string; nome: string };
  lista: PendenciaObra[];
  atividadeId?: string;
  onFechar: () => void;
}) {
  const [responsavel, setResponsavel] = useState('todos');
  const [gerando, setGerando] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const { showToast } = useToast();
  const nomes = useMemo(
    () =>
      [
        ...new Map(
          lista
            .filter((p) => p.responsavel_id)
            .map((p) => [p.responsavel_id!, p.responsavelNome || 'Responsável não identificado']),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')),
    [lista],
  );
  const selecionadas = pendenciasParaPdf(lista, responsavel, atividadeId);
  const titulo =
    responsavel === 'todos'
      ? 'Todos os responsáveis'
      : responsavel === ''
        ? 'Sem responsável'
        : nomes.find((n) => n[0] === responsavel)?.[1] || 'Responsável';
  async function gerar() {
    setGerando(true);
    setArquivo(null);
    try {
      const sessao = await supabase?.auth.getSession();
      const uid = sessao?.data.session?.user.id;
      if (!uid) throw new Error('Entre novamente para gerar o PDF.');
      const verificarFila = async () => {
        const ops = await db.outbox.toArray();
        if (
          ops.some(
            (op) =>
              op.userId === uid &&
              op.tipo.includes('pendencia') &&
              (op.payload as { obraId?: string })?.obraId === obra.id,
          )
        )
          throw new Error(
            'Há alterações desta obra aguardando sincronização. Aguarde o envio antes de gerar o PDF atualizado.',
          );
      };
      await verificarFila();
      const recentes = await loadPendencias(obra.id);
      const itens = pendenciasParaPdf(recentes, responsavel, atividadeId);
      const blob = await gerarChecklistPdf(obra.nome, titulo, itens);
      await verificarFila();
      const nome = `checklist-${obra.nome}-${titulo}.pdf`.replace(/[/\\?%*:|"<>]/g, '-');
      setArquivo(new File([blob], nome, { type: 'application/pdf' }));
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Não foi possível gerar o PDF.' });
    } finally {
      setGerando(false);
    }
  }
  function baixar() {
    if (!arquivo) return;
    const url = URL.createObjectURL(arquivo);
    const a = document.createElement('a');
    a.href = url;
    a.download = arquivo.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const podeCompartilhar =
    arquivo && typeof navigator.canShare === 'function' && navigator.canShare({ files: [arquivo] });
  return (
    <BottomSheet
      open
      title="PDF do checklist por responsável"
      onClose={() => {
        if (!gerando) onFechar();
      }}
    >
      <div className={styles.conteudo}>
        <label>
          Responsável
          <select
            disabled={gerando}
            value={responsavel}
            onChange={(e) => {
              setResponsavel(e.target.value);
              setArquivo(null);
            }}
          >
            <option value="todos">Todos os responsáveis</option>
            <option value="">Sem responsável</option>
            {nomes.map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        </label>
        <p>
          {selecionadas.length} pendência(s) aberta(s)
          {atividadeId ? ' desta atividade' : ' desta obra'} · Alta, média e baixa criticidade ·
          Fotos e dados completos · A4 retrato
        </p>
        <button
          type="button"
          disabled={gerando || !selecionadas.length}
          onClick={() => void gerar()}
        >
          {gerando ? 'Preparando PDF e fotos…' : 'Gerar PDF'}
        </button>
        {arquivo ? (
          <>
            <p>PDF pronto. Baixe o arquivo ou compartilhe com o aplicativo desejado.</p>
            <div className={styles.acoes}>
              <button type="button" onClick={baixar}>
                Baixar PDF
              </button>
              {podeCompartilhar ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.share({
                        files: [arquivo],
                        title: 'CONTRO · Pendências do checklist',
                      });
                    } catch (e) {
                      if (!(e instanceof Error && e.name === 'AbortError'))
                        showToast({
                          message:
                            'Não foi possível compartilhar. Baixe o PDF e anexe no WhatsApp.',
                        });
                    }
                  }}
                >
                  Compartilhar PDF
                </button>
              ) : null}
            </div>
            {!podeCompartilhar ? (
              <p>Depois de baixar, anexe o PDF como documento no WhatsApp.</p>
            ) : null}
          </>
        ) : null}
      </div>
    </BottomSheet>
  );
}
