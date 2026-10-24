import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigurado } from './env';

// Cliente único. Quando as variáveis não estão preenchidas (ex.: dev sem projeto
// ainda), exportamos null e a UI mostra o aviso de "configurar Supabase".
export const supabase: SupabaseClient | null = supabaseConfigurado
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
