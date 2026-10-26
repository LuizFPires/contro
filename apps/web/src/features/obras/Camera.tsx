import { useEffect, useRef, useState } from 'react';
import { Icon } from '@contro/ui';
import styles from './Camera.module.css';

export interface CameraProps {
  /** Foto do "antes" como ghost (40%) para alinhar o depois. */
  ghostUrl?: string | null;
  /** Rótulo turquesa acima do título ("Foto de conclusão", "Foto de depois"…). */
  kicker?: string;
  titulo: string;
  /** Orientação no rodapé do quadro. */
  dica?: string;
  /** Se presente, mostra "Concluir sem foto" abaixo do disparo (foto opcional). */
  onSemFoto?: () => void;
  pendente?: boolean;
  onCapturar: (file: File) => void;
  onCancelar: () => void;
}

/**
 * Câmera in-app via getUserMedia (traseira), com ghost do antes a 40%.
 * Quando getUserMedia não está disponível, cai para a captura nativa de arquivo
 * (sem ghost).
 */
export function Camera({
  ghostUrl,
  kicker,
  titulo,
  dica,
  onSemFoto,
  pendente,
  onCapturar,
  onCancelar,
}: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [aoVivo, setAoVivo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function abrir() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro('sem-camera');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setAoVivo(true);
      } catch {
        setErro('sem-camera');
      }
    }
    void abrir();
    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function capturarDoVideo() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    canvas.toBlob(
      (b) => {
        if (b) onCapturar(new File([b], 'foto.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9,
    );
  }

  function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onCapturar(file);
  }

  return (
    <div className={styles.overlay} role="dialog" aria-label={titulo}>
      <div className={styles.topo}>
        <div className={styles.titulos}>
          {kicker ? <div className={styles.kicker}>{kicker}</div> : null}
          <div className={styles.titulo}>{titulo}</div>
        </div>
        <button
          type="button"
          className={styles.fechar}
          aria-label="Fechar câmera"
          onClick={onCancelar}
        >
          <Icon name="close" size={22} />
        </button>
      </div>

      <div className={styles.palco}>
        {erro ? (
          <div className={styles.semCamera}>
            <Icon name="camera" size={28} />
            <p>Câmera indisponível aqui. Use a foto do aparelho.</p>
          </div>
        ) : (
          <video ref={videoRef} className={styles.video} playsInline muted />
        )}
        {ghostUrl ? (
          <>
            <img src={ghostUrl} alt="" className={styles.ghost} />
            <div className={styles.moldura} aria-hidden="true" />
          </>
        ) : null}
        <div className={styles.grade} aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        {dica ? <div className={styles.dica}>{dica}</div> : null}
      </div>

      <div className={styles.controles}>
        <button
          type="button"
          className={styles.disparo}
          aria-label={pendente ? 'Enviando foto' : erro ? 'Escolher foto' : 'Tirar foto'}
          disabled={pendente || (!erro && !aoVivo)}
          onClick={() => (erro ? fileRef.current?.click() : capturarDoVideo())}
        />
        {onSemFoto ? (
          <button type="button" className={styles.semFoto} disabled={pendente} onClick={onSemFoto}>
            Concluir sem foto
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className={styles.inputOculto}
          onChange={escolherArquivo}
        />
      </div>
    </div>
  );
}
