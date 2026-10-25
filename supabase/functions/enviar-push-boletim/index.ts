// Edge Function: envia Web Push "Boletim pronto para enviar" aos gestores.
// Chamada pelo pg_cron (ver README). Lê os boletim_disparo ainda não
// notificados, manda o push para as assinaturas dos gestores e marca como
// notificado. Segredos (service role + VAPID) vêm do ambiente da função.
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

  const { data: disparos, error: e1 } = await sb
    .from('boletim_disparo')
    .select('id, edicao, obra:obra_id(nome)')
    .is('notificado_em', null);
  if (e1) return json({ error: e1.message }, 500);
  if (!disparos || disparos.length === 0) return json({ disparos: 0, enviados: 0 });

  const { data: gestores } = await sb
    .from('pessoa')
    .select('user_id')
    .eq('perfil', 'gestor')
    .eq('ativo', true)
    .is('deleted_at', null);
  const userIds = (gestores ?? []).map((g: any) => g.user_id).filter(Boolean);

  const { data: subs } = userIds.length
    ? await sb.from('push_subscription').select('*').in('user_id', userIds)
    : { data: [] as any[] };

  let enviados = 0;
  for (const d of disparos as any[]) {
    const obraNome = d.obra?.nome ?? 'Obra';
    const payload = JSON.stringify({
      title: 'CONTRO · Boletim pronto',
      body: `${obraNome}: ${
        d.edicao === 'fechamento' ? 'fechamento da semana' : 'boletim da semana'
      } pronto para enviar.`,
      url: '/',
      tag: `boletim-${d.id}`,
    });
    for (const s of (subs ?? []) as any[]) {
      // Defesa em profundidade (além do CHECK na tabela): não faz POST fora da allowlist.
      if (!hostPermitido(s.endpoint)) continue;
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        enviados++;
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          await sb.from('push_subscription').delete().eq('endpoint', s.endpoint);
        }
      }
    }
    // Marca como notificado mesmo sem assinantes, para não repetir toda rodada.
    await sb
      .from('boletim_disparo')
      .update({ notificado_em: new Date().toISOString() })
      .eq('id', d.id);
  }

  return json({ disparos: disparos.length, enviados });
});
