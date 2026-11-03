begin;
select plan(1);
do $$
declare g public.pessoa; e public.pessoa;
begin
  select * into g from public.pessoa where perfil='gestor' and ativo and deleted_at is null limit 1;
  select * into e from public.pessoa where perfil='equipe' and ativo and deleted_at is null and user_id is not null limit 1;
  if g.id is null or e.id is null then raise exception 'Fixture ausente'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',g.user_id,'role','authenticated')::text,true);
  perform public.definir_membro_ativo(e.id,false);
  if not exists(select 1 from public.pessoa where id=e.id and not ativo and desativado_em is not null) then raise exception 'Desativação falhou'; end if;
  perform public.definir_membro_ativo(e.id,true);
  if not exists(select 1 from public.pessoa where id=e.id and ativo and desativado_em is null) then raise exception 'Ativação falhou'; end if;
  begin
    perform public.definir_membro_ativo(g.id,false);
    raise exception 'Auto-desativação permitida';
  exception when check_violation then null;
  end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',e.user_id,'role','authenticated')::text,true);
  begin
    perform public.definir_membro_ativo(g.id,false);
    raise exception 'Equipe gerenciou acesso';
  exception when insufficient_privilege then null;
  end;
  if has_function_privilege('anon','public.definir_membro_ativo(uuid,boolean)','EXECUTE') then raise exception 'Anon autorizado'; end if;
end; $$;
select pass('Gestor gerencia acessos sem auto-desativação; equipe e anon bloqueados');
select * from finish();
rollback;