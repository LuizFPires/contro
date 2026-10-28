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
            <b>Pendências:</b> uma foto por vez, das altas para as baixas (criticidade). Deslize
            para a esquerda (ou "Resolvida") para tirar a foto do depois, com o antes em
            transparência para alinhar. Para a direita (ou "Próxima"), passa para a próxima foto.
          </li>
          <li>
            <b>Resolvidos:</b> cada item com o antes e o depois lado a lado. Os que esperam vistoria
            vêm primeiro: outra pessoa, não quem resolveu, escolhe "Aprovar e fechar" ou "Reabrir".
          </li>
          <li>
            <b>Fotos:</b> toque numa foto para ampliar. No "⋯" de cada item: editar, apagar e, no
            vistoriado, voltar para pendente.
          </li>
        </ol>
        <p>"Nada pendente" quer dizer que não há nenhum item aberto nesta obra.</p>
      </div>
    </BottomSheet>
  );
}
