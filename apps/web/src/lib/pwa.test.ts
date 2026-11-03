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
