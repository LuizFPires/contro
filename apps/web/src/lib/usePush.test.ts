import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  effects: [] as (() => unknown)[],
  upsert: vi.fn(),
  remove: vi.fn(),
  subscribe: vi.fn(),
  getSubscription: vi.fn(),
  unsubscribe: vi.fn(),
  version: 'v1',
}));
vi.mock('react', () => ({
  useState: (v: unknown) => [v, vi.fn()],
  useCallback: (f: unknown) => f,
  useEffect: (f: () => unknown) => mocks.effects.push(f),
}));
vi.mock('./env', () => ({ VAPID_PUBLIC_KEY: 'YQ', pushConfigurado: true }));
vi.mock('./pwa', () => ({
  get VERSAO_APP() {
    return mocks.version;
  },
}));
vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'rafael' } } }) },
    from: () => ({ upsert: mocks.upsert, delete: () => ({ eq: mocks.remove }) }),
  },
}));
beforeEach(() => {
  mocks.effects = [];
  mocks.version = 'v1';
  vi.clearAllMocks();
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  });
  vi.stubGlobal('Notification', {
    permission: 'granted',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  });
  vi.stubGlobal('window', Object.assign(new EventTarget(), { PushManager: {}, Notification: {} }));
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.unsubscribe.mockResolvedValue(true);
  const sub = {
    endpoint: 'https://push.test',
    toJSON: () => ({ keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: mocks.unsubscribe,
  };
  mocks.getSubscription.mockResolvedValue(sub);
  mocks.subscribe.mockResolvedValue(sub);
  vi.stubGlobal('navigator', {
    userAgent: 'teste',
    serviceWorker: {
      ready: Promise.resolve({
        pushManager: { getSubscription: mocks.getSubscription, subscribe: mocks.subscribe },
      }),
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});
it('mantém a desativação ao reabrir e reativa na próxima versão', async () => {
  const { usePush } = await import('./usePush');
  await usePush().cancelar();
  expect(localStorage.getItem('contro:push:desativado:rafael')).toBe('v1');
  mocks.getSubscription.mockResolvedValue(null);
  usePush(true);
  mocks.effects.at(-1)!();
  await new Promise((r) => setTimeout(r, 10));
  expect(mocks.upsert).not.toHaveBeenCalled();
  mocks.version = 'v2';
  usePush(true);
  mocks.effects.at(-1)!();
  await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalledOnce());
  expect(localStorage.getItem('contro:push:desativado:rafael')).toBeNull();
  expect(Notification.requestPermission).not.toHaveBeenCalled();
});
it('não solicita permissão automaticamente se o Android não autorizou', async () => {
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() });
  const { usePush } = await import('./usePush');
  usePush(true);
  mocks.effects.at(-1)!();
  await new Promise((r) => setTimeout(r, 10));
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(Notification.requestPermission).not.toHaveBeenCalled();
});
