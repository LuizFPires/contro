-- Restaurar modelo (Desfazer da exclusão). SECURITY DEFINER como o excluir_modelo:
-- o update direto sob RLS afetava 0 linhas (a linha excluída fica fora da leitura),
-- então o "Desfazer" não funcionava. Aqui a função ignora o RLS e checa o gestor.
create or replace function restaurar_modelo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor edita modelos' using errcode = '42501';
  end if;
  update public.modelo set deleted_at = null where id = p_id;
end;
$$;
