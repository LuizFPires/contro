import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { VAPID_PUBLIC_KEY, pushConfigurado } from './env';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const suportado =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/**
 * Assinatura de Web Push deste aparelho (avisos da reunião, do dia e do boletim).
 * Guarda a assinatura em push_subscription; o envio é feito pela Edge Function.
 */
export function usePush() {
  const disponivel = suportado && pushConfigurado && Boolean(supabase);
  const [inscrito, setInscrito] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!disponivel) return;
    let vivo = true;
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (vivo) setInscrito(Boolean(sub));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [disponivel]);

  const inscrever = useCallback(async () => {
    if (!disponivel || !supabase) return;
    setErro(null);
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') {
        setErro('Permissão de notificação negada.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Sessão não encontrada.');
      const { error } = await supabase.from('push_subscription').upsert(
        {
          user_id: userId,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
          user_agent: navigator.userAgent,
        },
        { onConflict: 'endpoint' },
      );
      if (error) throw error;
      setInscrito(true);
    } catch {
      setErro('Não foi possível ativar o push neste aparelho.');
    } finally {
      setOcupado(false);
    }
  }, [disponivel]);

  const cancelar = useCallback(async () => {
    if (!disponivel || !supabase) return;
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscription').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setInscrito(false);
    } catch {
      setErro('Não foi possível desativar o push.');
    } finally {
      setOcupado(false);
    }
  }, [disponivel]);

  return { disponivel, inscrito, ocupado, erro, inscrever, cancelar };
}
