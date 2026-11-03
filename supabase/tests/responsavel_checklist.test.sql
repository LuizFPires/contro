begin;
select plan(1);
-- Dados do próprio teste (o CI começa só com o seed: modelos e unidades).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f151', 'fx-gestor-151@contro.test'),
  ('00000000-0000-0000-0000-00000000f152', 'fx-equipe-151@contro.test');
insert into pessoa (user_id, nome, perfil, ativo) values
  ('00000000-0000-0000-0000-00000000f151', 'Fixture Gestor 151', 'gestor', true),
  ('00000000-0000-0000-0000-00000000f152', 'Fixture Equipe 151', 'equipe', true)
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f151","role":"authenticated"}';
select gerar_obra((select id from unidade order by nome limit 1), current_date, 'Obra Fixture 151',
  (select id from modelo where nome = 'Modelo 1 · CDC completo'));
reset role;
set local request.jwt.claims = '';

do $$
declare u uuid; pessoa_id uuid; obra_id_t uuid; p uuid := gen_random_uuid(); op uuid := gen_random_uuid(); total integer;
begin
 select user_id,id into u,pessoa_id from public.pessoa where ativo and deleted_at is null and user_id is not null limit 1;
 select id into obra_id_t from public.obra where deleted_at is null limit 1;
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into public.pendencia(id,obra_id,titulo) values(p,obra_id_t,'QA checklist responsável');
 perform public.atribuir_pendencia(p,pessoa_id,op);
 perform public.atribuir_pendencia(p,pessoa_id,op);
 if (select responsavel_id from public.pendencia where id=p) is distinct from pessoa_id then raise exception 'Atribuição falhou'; end if;
 select count(*) into total from public.pendencia_evento where pendencia_id=p and tipo='responsavel_alterado';
 if total <> 1 then raise exception 'Idempotência falhou'; end if;
 perform public.atribuir_pendencia(p,null,gen_random_uuid());
 if (select responsavel_id from public.pendencia where id=p) is not null then raise exception 'Remoção falhou'; end if;
 begin
   perform public.atribuir_pendencia(p,gen_random_uuid(),gen_random_uuid());
   raise exception 'Responsável inválido aceito';
 exception when check_violation then null;
 end;
 update public.pendencia set deleted_at=now() where id=p;
 begin
   perform public.atribuir_pendencia(p,pessoa_id,gen_random_uuid());
   raise exception 'Pendência excluída aceita';
 exception when foreign_key_violation then null;
 end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
   perform public.atribuir_pendencia(p,pessoa_id,gen_random_uuid());
   raise exception 'Usuário não autorizado aceito';
 exception when insufficient_privilege then null;
 end;
end $$;

select pass('Atribuição, remoção, idempotência e autorização');
select * from finish();
rollback;