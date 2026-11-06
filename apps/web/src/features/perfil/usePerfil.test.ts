import { beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getUser: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: api.getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: api.maybeSingle }) }) }),
  },
}));
import { carregarPerfil } from './usePerfil';

beforeEach(() => {
  vi.resetAllMocks();
  api.getUser.mockResolvedValue({ data: { user: { id: 'usuario' } }, error: null });
});

it('mantém o gestor ativo quando o perfil é carregado', async () => {
  const perfil = { id: 'pessoa', nome: 'Gestor', perfil: 'gestor', ativo: true };
  api.maybeSingle.mockResolvedValue({ data: perfil, error: null });
  await expect(carregarPerfil()).resolves.toMatchObject(perfil);
});

it('preserva a aprovação pendente quando o banco retorna um perfil inativo', async () => {
  const perfil = { id: 'pessoa', nome: 'Equipe', perfil: 'equipe', ativo: false };
  api.maybeSingle.mockResolvedValue({ data: perfil, error: null });
  await expect(carregarPerfil()).resolves.toMatchObject(perfil);
});

it('preserva os papéis e ambientes adicionados à versão atual do app', async () => {
  api.maybeSingle.mockResolvedValue({
    data: {
      id: 'pessoa',
      nome: 'Gestor',
      perfil: 'gestor',
      ativo: true,
      administrador: true,
      acesso_contorno: false,
      papel_geral: 'coordenador',
      coordenador_contorno: true,
    },
    error: null,
  });
  await expect(carregarPerfil()).resolves.toMatchObject({
    administrador: true,
    acessoContorno: false,
    papelGeral: 'coordenador',
    coordenadorContorno: true,
  });
});

it('propaga falha na consulta em vez de convertê-la em perfil ausente', async () => {
  const erro = new Error('Falha ao consultar o perfil');
  api.maybeSingle.mockResolvedValue({ data: null, error: erro });
  await expect(carregarPerfil()).rejects.toBe(erro);
});

it('propaga falha de autenticação sem consultar a tabela de pessoas', async () => {
  const erro = new Error('Falha ao validar a sessão');
  api.getUser.mockResolvedValue({ data: { user: null }, error: erro });
  await expect(carregarPerfil()).rejects.toBe(erro);
  expect(api.maybeSingle).not.toHaveBeenCalled();
});

it('retorna ausência de perfil quando a consulta termina sem cadastro correspondente', async () => {
  api.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(carregarPerfil()).resolves.toBeNull();
});
