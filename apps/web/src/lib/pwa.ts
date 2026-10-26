// Registro do service worker (PWA).
//
// O plugin está em `registerType: 'autoUpdate'` (ver apps/web/vite.config.ts):
// quando uma nova versão é publicada, o service worker novo assume e a própria
// biblioteca recarrega a página sozinha (evento `activated` + `location.reload`).
//
// O que falta — e é o que este arquivo adiciona — é a CHECAGEM periódica: um app
// instalado que fica aberto por horas não reconsulta o servidor por conta própria,
// então sem isto a versão nova só apareceria ao reabrir o app. Aqui pedimos ao
// navegador para procurar atualização de tempos em tempos e sempre que o app volta
// ao primeiro plano; achando, o fluxo de autoUpdate acima recarrega automaticamente.
import { registerSW } from 'virtual:pwa-register';

const INTERVALO_CHECAGEM = 60 * 60 * 1000; // 1 hora

export function iniciarPwa(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
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
