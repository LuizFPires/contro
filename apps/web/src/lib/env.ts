export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/** true quando as variáveis do Supabase estão preenchidas. */
export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// URL do pdf-service (boletim/ata em PDF). Sem ela, o app cai no window.print().
export const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL ?? '';
export const pdfServiceConfigurado = Boolean(PDF_SERVICE_URL);
