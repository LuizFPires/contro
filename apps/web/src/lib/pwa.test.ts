import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('atualização preserva push', () => {
  it('atualiza sem remover registro ou caches', async () => {
    vi.stubGlobal('__VERSAO__', 'teste');
    const unregister = vi.fn();
    const update = vi.fn().mockResolvedValue(undefined);
    const reload = vi.fn();
    const apagar = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: async () => ({ update, unregister }) },
    });
    vi.stubGlobal('window', { location: { reload } });
    vi.stubGlobal('caches', { delete: apagar });
    const { forcarAtualizacao } = await import('./pwa');
    await forcarAtualizacao();
    expect(update).toHaveBeenCalledOnce();
    expect(unregister).not.toHaveBeenCalled();
    expect(apagar).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
  });
  it('não recarrega nem remove registro quando a rede falha', async () => {
    vi.stubGlobal('__VERSAO__', 'teste');
    const unregister = vi.fn();
    const reload = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: async () => ({
          update: async () => {
            throw Error('offline');
          },
          unregister,
        }),
      },
    });
    vi.stubGlobal('window', { location: { reload } });
    const { forcarAtualizacao } = await import('./pwa');
    await expect(forcarAtualizacao()).rejects.toThrow('offline');
    expect(unregister).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('segurar a atualização (câmera e lote de fotos abertos)', () => {
  it('espera enquanto alguém segura e checa ao soltar o último', async () => {
    vi.stubGlobal('__VERSAO__', 'teste');
    const { segurarAtualizacao, checarSeLivre } = await import('./pwa');
    const checar = vi.fn();
    const soltarA = segurarAtualizacao();
    const soltarB = segurarAtualizacao();
    checarSeLivre(checar);
    expect(checar).not.toHaveBeenCalled();
    soltarA();
    soltarA(); // soltar duas vezes não conta em dobro
    expect(checar).not.toHaveBeenCalled();
    soltarB();
    expect(checar).toHaveBeenCalledOnce();
    checarSeLivre(checar);
    expect(checar).toHaveBeenCalledTimes(2);
  });
});
