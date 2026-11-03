import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { VAPID_PUBLIC_KEY, pushConfigurado } from './env';
import { VERSAO_APP } from './pwa';

const chavePreferencia = (uid: string) => `contro:push:desativado:${uid}`;
let operacao: Promise<unknown> = Promise.resolve();
function serializar<T>(fn: () => Promise<T>): Promise<T> {
  const proxima = operacao.then(fn, fn);
  operacao = proxima.catch(() => {});
  return proxima;
}
const avisar = () => window.dispatchEvent(new Event('contro-push'));

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
export function usePush(automatico = false, usuario?: string) {
  const disponivel = suportado && pushConfigurado && Boolean(supabase);
  const [inscrito, setInscrito] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ativar = useCallback(
    async (silencioso = false) => {
      if (!disponivel || !supabase) return;
      const client = supabase;
      setErro(null);
      setOcupado(true);
      try {
        await serializar(async () => {
          const { data: userData } = await client.auth.getUser();
          const userId = userData.user?.id;
          if (!userId) throw new Error('Sessão não encontrada.');
          if (
            silencioso &&
            (Notification.permission !== 'granted' ||
              localStorage.getItem(chavePreferencia(userId)) === VERSAO_APP)
          )
            return;
          const permissao = silencioso
            ? Notification.permission
            : await Notification.requestPermission();
          if (permissao !== 'granted') {
            setErro('Permissão de notificação negada.');
            return;
          }
          const reg = await navigator.serviceWorker.ready;
          const sub =
            (await reg.pushManager.getSubscription()) ??
            (await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            }));
          const json = sub.toJSON();
          const { error } = await client.from('push_subscription').upsert(
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
          localStorage.removeItem(chavePreferencia(userId));
          setInscrito(true);
          avisar();
        });
      } catch {
        setErro('Não foi possível ativar o push neste aparelho.');
      } finally {
        setOcupado(false);
      }
    },
    [disponivel],
  );

  const cancelar = useCallback(async () => {
    if (!disponivel || !supabase) return;
    const client = supabase;
    setOcupado(true);
    setErro(null);
    try {
      await serializar(async () => {
        const { data } = await client.auth.getUser();
        if (!data.user) throw new Error('Sem sessão');
        localStorage.setItem(chavePreferencia(data.user.id), VERSAO_APP);
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const { error } = await client
            .from('push_subscription')
            .delete()
            .eq('endpoint', sub.endpoint);
          if (error) throw error;
          await sub.unsubscribe();
        }
        setInscrito(false);
        avisar();
      });
    } catch {
      setErro('Não foi possível desativar o push.');
    } finally {
      setOcupado(false);
    }
  }, [disponivel]);

  const inscrever = useCallback(() => ativar(false), [ativar]);
  useEffect(() => {
    if (!disponivel) return;
    let vivo = true;
    const ler = async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (vivo) setInscrito(Boolean(sub));
    };
    const atualizar = () => {
      void ler().catch(() => {});
    };
    const recuperar = () => {
      if (
        automatico &&
        document.visibilityState === 'visible' &&
        Notification.permission === 'granted'
      )
        void ativar(true);
      else atualizar();
    };
    recuperar();
    window.addEventListener('contro-push', atualizar);
    window.addEventListener('online', recuperar);
    document.addEventListener('visibilitychange', recuperar);
    return () => {
      vivo = false;
      window.removeEventListener('contro-push', atualizar);
      window.removeEventListener('online', recuperar);
      document.removeEventListener('visibilitychange', recuperar);
    };
  }, [disponivel, automatico, ativar, usuario]);
  return { disponivel, inscrito, ocupado, erro, inscrever, cancelar };
}
