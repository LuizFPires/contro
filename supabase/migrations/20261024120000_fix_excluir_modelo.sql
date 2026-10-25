-- Correção: excluir_modelo precisa ser SECURITY DEFINER.
-- Como SECURITY INVOKER, o UPDATE que grava deleted_at era barrado pela política
-- de SELECT (deleted_at is null) aplicada à linha nova. A função já faz a
-- checagem explícita de gestor, então rodar como DEFINER (ignorando a RLS) é
-- seguro e correto para a exclusão lógica.
create or replace function excluir_modelo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor edita modelos' using errcode = '42501';
  end if;
  if (select count(*) from public.modelo where deleted_at is null) <= 1 then
    raise exception 'É preciso manter ao menos um modelo ativo' using errcode = '23514';
  end if;
  update public.modelo set deleted_at = now() where id = p_id and deleted_at is null;
end;
$$;
