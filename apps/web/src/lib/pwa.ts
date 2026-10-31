// Registro do service worker (PWA).
//
// O plugin está em `registerType: 'autoUpdate'` (ver apps/web/vite.config.ts):
// quando uma nova versão é publicada, o service worker novo assume e a própria
// biblioteca recarrega a página sozinha (evento `activated` + `location.reload`).
//
// Aqui somamos duas coisas:
//  - a CHECAGEM periódica (1h) e ao voltar o app ao primeiro plano, para um app
//    instalado aberto por horas perceber uma versão nova sem o usuário fazer nada;
//  - `verificarAtualizacao()`, usada pelo "puxar pra atualizar": procura uma versão
//    nova na hora e diz se há uma a caminho (nesse caso o autoUpdate recarrega).
import { registerSW } from 'virtual:pwa-register';

const INTERVALO_CHECAGEM = 60 * 60 * 1000; // 1 hora

let registro: ServiceWorkerRegistration | undefined;

export function iniciarPwa(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      registro = registration;
      if (!registration) return;
      const checar = () => {
        // Offline ou falha de rede: ignora e tenta de novo no próximo ciclo.
        registration.update().catch(() => {});
      };
      setInterval(checar, INTERVALO_CHECAGEM);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checar();
      });
    },
  });
}

// ---------- Botão provisório "Atualizar" (pedido do usuário, 31/10/2026) ----------
// Alguns celulares ficavam presos numa versão antiga. O app compara a própria
// versão com /version.json (fora do cache do service worker) e, se mudou,
// mostra "Nova versão · Atualizar"; o menu do perfil também tem "Atualizar o app".

export const VERSAO_APP = __VERSAO__;

/** Versão publicada no servidor (null se offline ou sem o arquivo, ex.: no dev). */
export async function versaoNoServidor(): Promise<string | null> {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { versao?: string };
    return j.versao ?? null;
  } catch {
    return null;
  }
}

/**
 * Força a versão nova: tira o service worker e o cache dos arquivos do app e
 * recarrega. Não mexe na fila offline nem nas fotos guardadas (ficam no
 * IndexedDB), nem no login.
 */
export async function forcarAtualizacao(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) {
      const nomes = await caches.keys();
      await Promise.all(nomes.map((n) => caches.delete(n)));
    }
  } finally {
    window.location.reload();
  }
}

/**
 * Procura uma versão nova no servidor agora. Retorna `true` quando há uma
 * atualização a caminho — nesse caso o service worker novo assume e a página
 * recarrega sozinha (fluxo do autoUpdate), então quem chamou não precisa fazer
 * mais nada. Retorna `false` quando o app já está na versão mais recente.
 */
export async function verificarAtualizacao(): Promise<boolean> {
  if (!registro) return false;
  try {
    await registro.update();
  } catch {
    return false;
  }
  return Boolean(registro.installing || registro.waiting);
}
