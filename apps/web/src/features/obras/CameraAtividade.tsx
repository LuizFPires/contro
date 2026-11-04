import { useToast } from '@contro/ui';
import { Camera } from './Camera';
import type { TarefaObra } from './tarefasObra';
import { useObraCampo } from './useObraCampo';

/**
 * Câmera para concluir a atividade vinculada à tarefa (na obra da tarefa).
 * Usada por Tarefas da equipe e Minhas ações: concluir a tarefa conclui a
 * atividade. Se a atividade já estava concluída, segue como sucesso (a tarefa
 * ainda fecha).
 */
export function CameraAtividade({
  tarefa,
  onFechar,
  onConcluida,
}: {
  tarefa: TarefaObra;
  onFechar: () => void;
  onConcluida: () => void;
}) {
  const { showToast } = useToast();
  const campo = useObraCampo(tarefa.obra_id);
  // Com ou sem foto (regra 3): sem foto, fica "Concluída · sem foto".
  const concluir = (file: File | null) =>
    campo.concluir.mutate(
      { atividadeId: tarefa.vinculo_id as string, file },
      {
        onSuccess: onConcluida,
        onError: (e) => {
          if (/já concluída/i.test((e as { message?: string })?.message ?? '')) onConcluida();
          else showToast({ message: 'Não foi possível concluir a atividade' });
        },
      },
    );
  return (
    <Camera
      kicker="Foto de conclusão"
      titulo="Concluir atividade com foto"
      dica="Uma foto por ambiente. Ela vira o registro da etapa e libera as próximas atividades."
      pendente={campo.concluir.isPending}
      onCancelar={onFechar}
      onCapturar={concluir}
      onSemFoto={() => concluir(null)}
    />
  );
}
