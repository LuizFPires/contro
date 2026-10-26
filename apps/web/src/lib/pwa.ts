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
