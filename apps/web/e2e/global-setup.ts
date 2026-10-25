// Gestor de teste para o E2E. Senha só de dev local.
export const GESTOR = { email: 'gestor.e2e@contro.local', senha: 'contro-e2e-2026' };

const API = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54821';
// service_role de dev local do Supabase (público; mesmo em toda instalação local).
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

/** Cria o gestor de E2E (idempotente): usuário no Auth + pessoa perfil gestor. */
export default async function globalSetup(): Promise<void> {
  const headers = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json',
  };
  const resp = await fetch(`${API}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: GESTOR.email,
      password: GESTOR.senha,
      email_confirm: true,
    }),
  });
  const user = (await resp.json()) as { id?: string; user_id?: string };
  const userId = user.id ?? user.user_id;
  // Se o usuário já existia (rerun local), o Auth devolve erro e não há id:
  // a pessoa já foi criada numa execução anterior, então apenas seguimos.
  if (!userId) return;
  await fetch(`${API}/rest/v1/pessoa`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, nome: 'Gestor E2E', perfil: 'gestor' }),
  });
}
