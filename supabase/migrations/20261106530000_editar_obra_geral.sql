-- Editar nome e cidade de uma obra geral (06/11/2026): o Gestor em qualquer obra
-- geral; o Coordenador nas obras dele (faz tudo que o Gestor faz, menos criar
-- obra). Mesmas regras de criar_obra_geral para nome e cidade.
create or replace function editar_obra_geral(p_obra_id uuid, p_nome text, p_cidade text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_cidade text := nullif(btrim(coalesce(p_cidade, '')), '');
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.obra
    where id = p_obra_id and ambiente = 'geral' and deleted_at is null
  ) or not public.contro_ve_obra(p_obra_id) then
    raise exception 'Obra inválida' using errcode = '23503';
  end if;
  if not public.contro_coordena_obra(p_obra_id) then
    raise exception 'Só o Gestor ou o Coordenador da obra edita a obra' using errcode = '42501';
  end if;
  if char_length(v_nome) < 1 or char_length(v_nome) > 80 then
    raise exception 'nome da obra deve ter de 1 a 80 caracteres' using errcode = '22023';
  end if;
  if char_length(coalesce(v_cidade, '')) > 60 then
    raise exception 'cidade deve ter até 60 caracteres' using errcode = '22023';
  end if;
  update public.obra set nome = v_nome, cidade = v_cidade where id = p_obra_id;
end;
$$;
revoke execute on function editar_obra_geral(uuid, text, text) from public, anon;
grant execute on function editar_obra_geral(uuid, text, text) to authenticated;
