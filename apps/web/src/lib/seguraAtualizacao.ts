// ---------- Segurar a atualização (relato de campo, 10/11/2026) ----------
// Achar uma versão nova recarrega a página (autoUpdate). Com a câmera ou um lote
// de fotos aberto, isso apagava as fotos ainda não apontadas: quem saía do app
// (ex.: WhatsApp) e voltava, voltava para uma página recarregada. Enquanto
// alguém segura, a checagem espera; ao soltar, ela roda se ficou pendente.
let seguradores = 0;
let checagemPendente = false;
let checarAgora: (() => void) | null = null;

/** A checagem do service worker (registrada em iniciarPwa). */
export function definirChecagem(checar: () => void): void {
  checarAgora = checar;
}

/** Segura a busca de versão nova; devolve a função que solta. */
export function segurarAtualizacao(): () => void {
  seguradores += 1;
  let solto = false;
  return () => {
    if (solto) return;
    solto = true;
    seguradores = Math.max(0, seguradores - 1);
    if (seguradores === 0 && checagemPendente) {
      checagemPendente = false;
      checarAgora?.();
    }
  };
}

/** Roda a checagem agora ou, se alguém segura, guarda para quando soltar. */
export function checarSeLivre(checar: () => void): void {
  if (seguradores > 0) {
    checagemPendente = true;
    checarAgora = checar;
    return;
  }
  checar();
}
