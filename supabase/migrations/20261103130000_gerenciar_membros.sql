alter table public.pessoa add column desativado_em timestamptz;
create or replace function public.definir_membro_ativo(p_id uuid, p_ativo boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.contro_e_membro() or public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Apenas gestores ativos podem gerenciar membros' using errcode='42501';
  end if;
  if p_ativo is null then raise exception 'Informe o estado do membro'; end if;
  if p_id = public.contro_pessoa_atual() and not p_ativo then
    raise exception 'Você não pode desativar seu próprio acesso' using errcode='23514';
  end if;
  update public.pessoa set ativo=p_ativo, desativado_em=case when p_ativo then null else now() end
    where id=p_id and deleted_at is null;
  if not found then raise exception 'Membro não encontrado' using errcode='23503'; end if;
end;
$$;
revoke all on function public.definir_membro_ativo(uuid,boolean) from public,anon;
grant execute on function public.definir_membro_ativo(uuid,boolean) to authenticated;
