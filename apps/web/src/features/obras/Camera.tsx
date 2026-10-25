import { useEffect, useRef, useState } from 'react';
import { Button, Icon } from '@obdc/ui';
import styles from './Camera.module.css';

export interface CameraProps {
  /** Foto do "antes" como ghost (40%) para alinhar o depois. */
  ghostUrl?: string | null;
  titulo: string;
  pendente?: boolean;
  onCapturar: (file: File) => void;
  onCancelar: () => void;
}

/**
 * Câmera in-app via getUserMedia (traseira), com ghost do antes a 40%.
 * Quando getUserMedia não está disponível, cai para a captura nativa de arquivo
 * (sem ghost).
 */
export function Camera({ ghostUrl, titulo, pendente, onCapturar, onCancelar }: CameraProps) {
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
        <button type="button" className={styles.fechar} aria-label="Cancelar" onClick={onCancelar}>
          <Icon name="close" size={24} />
        </button>
        <span className={styles.titulo}>{titulo}</span>
      </div>

      <div className={styles.palco}>
        {erro ? (
          <div className={styles.semCamera}>
            <Icon name="alert" size={28} />
            <p>Câmera indisponível. Use a foto do aparelho.</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} className={styles.video} playsInline muted />
            {ghostUrl ? <img src={ghostUrl} alt="" className={styles.ghost} /> : null}
          </>
        )}
      </div>

      <div className={styles.controles}>
        {erro ? (
          <Button full onClick={() => fileRef.current?.click()} disabled={pendente}>
            {pendente ? 'Enviando…' : 'Escolher foto'}
          </Button>
        ) : (
          <Button full onClick={capturarDoVideo} disabled={!aoVivo || pendente}>
            {pendente ? 'Enviando…' : 'Tirar foto'}
          </Button>
        )}
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
