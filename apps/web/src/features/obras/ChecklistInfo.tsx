import { BottomSheet } from '@contro/ui';
import styles from './PendenciasAba.module.css';

/** "Como funciona" do Check list (pendências de qualidade da obra). */
export function ChecklistInfo({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  return (
    <BottomSheet open={aberto} title="Como funciona o Check list" onClose={onFechar}>
      <div className={styles.info}>
        <p>
          São os problemas de qualidade encontrados na obra: acabamento malfeito, infiltração, item
          faltando, algo fora do projeto. Cada um fecha com prova de antes e depois.
        </p>
        <ol>
          <li>
            <b>Apontar:</b> toque na câmera, tire a foto do problema (o antes) e diga o local, a
            criticidade e a atividade.
          </li>
          <li>
            <b>Fila:</b> cada item aberto vira um card, das altas para as baixas (criticidade). Para
            a direita (ou "Resolvida"), tire a foto do depois, com o antes em transparência para
            alinhar. Para a esquerda (ou "Adiar"), escolha a data de volta e o motivo: ele sai da
            fila e volta sozinho nessa data.
          </li>
          <li>
            <b>Vistoria:</b> outra pessoa, não quem resolveu, compara o antes e o depois e escolhe
            "Aprovar e fechar" ou "Reabrir".
          </li>
          <li>
            <b>Lista completa:</b> tudo separado em Na fila, Adiadas, Em vistoria e Concluídas.
          </li>
        </ol>
        <p>"Fila zerada" quer dizer que não há nenhum item aberto nesta obra.</p>
      </div>
    </BottomSheet>
  );
}
