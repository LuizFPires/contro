import { BottomSheet, Button, Icon } from '@contro/ui';
import { pushConfigurado } from '../../lib/env';
import { usePush } from '../../lib/usePush';
import styles from './AvisosCelularSheet.module.css';

/** "Avisos neste celular" (menu do perfil): cada pessoa liga o push no seu aparelho. */
export function AvisosCelularSheet({
  aberto,
  onFechar,
}: {
  aberto: boolean;
  onFechar: () => void;
}) {
  const { disponivel, inscrito, ocupado, erro, inscrever, cancelar } = usePush();

  return (
    <BottomSheet open={aberto} title="Avisos neste celular" onClose={onFechar}>
      <div className={styles.corpo}>
        <p className={styles.texto}>
          Lembretes da reunião, resumo da manhã e as suas tarefas do dia, no horário que o gestor
          definiu.
        </p>

        {!pushConfigurado ? (
          <p className={styles.aviso}>
            <Icon name="alert" size={18} />
            Os avisos ainda não foram ligados no CONTRO. Fale com o gestor.
          </p>
        ) : !disponivel ? (
          <p className={styles.aviso}>
            <Icon name="alert" size={18} />
            Este navegador não recebe avisos. No iPhone, instale o CONTRO na tela inicial
            (Compartilhar, "Adicionar à Tela de Início") e abra por lá.
          </p>
        ) : (
          <>
            <div className={styles.estado}>
              <Icon name={inscrito ? 'checkGrosso' : 'sino'} size={18} />
              {inscrito ? 'Avisos ligados neste celular' : 'Avisos desligados neste celular'}
            </div>
            {inscrito ? (
              <Button variant="tertiary" full disabled={ocupado} onClick={() => void cancelar()}>
                {ocupado ? 'Desligando…' : 'Desligar avisos'}
              </Button>
            ) : (
              <Button full disabled={ocupado} onClick={() => void inscrever()}>
                {ocupado ? 'Ativando…' : 'Ativar avisos'}
              </Button>
            )}
            <p className={styles.dica}>
              O celular pede permissão uma vez. No iPhone, só funciona com o CONTRO instalado na
              tela inicial.
            </p>
          </>
        )}

        {erro ? (
          <p className={styles.aviso}>
            <Icon name="alert" size={18} />
            {erro}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
