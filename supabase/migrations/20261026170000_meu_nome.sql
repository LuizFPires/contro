-- "Editar meu nome" (pedido do usuário, 26/10/2026): cada pessoa troca o
-- próprio nome. Exige nome e sobrenome. A tabela pessoa só aceita escrita do
-- gestor (RLS), por isso a troca do próprio nome passa por esta RPC.
create or replace function atualizar_meu_nome(p_nome text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_nome text := regexp_replace(trim(coalesce(p_nome, '')), '\s+', ' ', 'g');
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if array_length(regexp_split_to_array(v_nome, ' '), 1) < 2 or v_nome = '' then
    raise exception 'Informe nome e sobrenome' using errcode = '23514';
  end if;
  update public.pessoa set nome = v_nome where user_id = auth.uid() and deleted_at is null;
  return v_nome;
end;
$$;

revoke all on function atualizar_meu_nome(text) from public, anon;
grant execute on function atualizar_meu_nome(text) to authenticated;
