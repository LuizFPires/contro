// Edge Function: envia os avisos por Web Push (reunião, resumo da manhã,
// tarefas do dia, providências). Chamada pelo pg_cron (ver README). Lê os
// aviso_disparo ainda não enviados (gerados por gerar_avisos), manda o push para
// os aparelhos de cada pessoa e marca como enviado. Segredos vêm do ambiente.
// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any -- código Deno; respostas do Supabase são soltas aqui */
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

// Comparação de strings em tempo constante (evita vazar o segredo por timing).
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let r = 0;
  for (let i = 0; i < ab.length; i++) r |= ab[i] ^ bb[i];
  return r === 0;
}

// Anti-SSRF: só hosts conhecidos de serviços de push (espelha o CHECK da tabela).
const HOSTS = [
  /(^|\.)fcm\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];
function hostPermitido(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  // Autentica quem chama (o pg_cron passa Authorization: Bearer <CRON_SECRET>).
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) return json({ error: 'CRON_SECRET ausente' }, 500);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!safeEqual(token, cronSecret)) return json({ error: 'não autorizado' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contro@contorno.app';

  if (!url || !serviceKey) return json({ error: 'Supabase env ausente' }, 500);
  if (!vapidPublic || !vapidPrivate) return json({ error: 'Chaves VAPID ausentes' }, 500);

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const sb = createClient(url, serviceKey);

  let avisoId: string | null = null;
  try {
    const body = await req.json();
    if (body.aviso_id !== undefined) {
      if (
        typeof body.aviso_id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.aviso_id)
      ) {
        return json({ error: 'aviso_id inválido' }, 400);
      }
      avisoId = body.aviso_id;
    }
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const { data: avisos, error: e1 } = await sb.rpc('reservar_avisos', { p_id: avisoId });
  if (e1) return json({ error: e1.message }, 500);
  if (!avisos || avisos.length === 0) return json({ avisos: 0, enviados: 0 });

  const userIds = [...new Set((avisos as any[]).map((a) => a.user_id))];
  const { data: subs } = await sb.from('push_subscription').select('*').in('user_id', userIds);
  const porUser = new Map<string, any[]>();
  for (const s of (subs ?? []) as any[]) {
    porUser.set(s.user_id, [...(porUser.get(s.user_id) ?? []), s]);
  }

  let enviados = 0;
  for (const a of avisos as any[]) {
    let aceitos = 0;
    let falhaTemporaria = false;
    const payload = JSON.stringify({
      title: a.titulo,
      body: a.corpo,
      url: a.url || '/',
      tag: `${a.tipo}-${a.id}`,
    });
    for (const s of porUser.get(a.user_id) ?? []) {
      // Defesa em profundidade (além do CHECK na tabela): não faz POST fora da allowlist.
      if (!hostPermitido(s.endpoint)) continue;
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { urgency: 'high', TTL: 86400 },
        );
        enviados++;
        aceitos++;
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          await sb.from('push_subscription').delete().eq('endpoint', s.endpoint);
        } else {
          falhaTemporaria = true;
        }
      }
    }
    // Falha transitória sem aceite: libera a reserva para nova tentativa pelo cron.
    await sb
      .from('aviso_disparo')
      .update({
        notificado_em: falhaTemporaria && aceitos === 0 ? null : new Date().toISOString(),
        processamento_em: null,
      })
      .eq('id', a.id);
  }

  return json({ avisos: avisos.length, enviados });
});
