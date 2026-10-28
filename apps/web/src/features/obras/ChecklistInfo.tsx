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
            <b>Pendências:</b> em <b>Fotos</b>, uma por vez, das altas para as baixas. Deslize para
            a esquerda (ou "Resolvida") para tirar a foto do depois, com o antes em transparência
            para alinhar; para a direita (ou "Próxima"), passa para a próxima. Em <b>Lista</b>,
            todas agrupadas por criticidade.
          </li>
          <li>
            <b>Resolvidos:</b> tirou a foto do depois, está resolvido. A lista mostra o antes e o
            depois em miniatura; toque para abrir maior.
          </li>
          <li>
            <b>Fotos:</b> toque numa foto para ampliar. No "⋯" de cada item: editar, apagar e, no
            resolvido, voltar para pendente.
          </li>
        </ol>
        <p>"Nada pendente" quer dizer que não há nenhum item aberto nesta obra.</p>
      </div>
    </BottomSheet>
  );
}
