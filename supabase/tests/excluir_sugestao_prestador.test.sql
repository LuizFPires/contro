begin;
select plan(1);
-- Dados do próprio teste (o CI começa só com o seed: modelos e unidades).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f111', 'fx-gestor-111@contro.test'),
  ('00000000-0000-0000-0000-00000000f112', 'fx-equipe-111@contro.test');
insert into pessoa (user_id, nome, perfil, ativo) values
  ('00000000-0000-0000-0000-00000000f111', 'Fixture Gestor 111', 'gestor', true),
  ('00000000-0000-0000-0000-00000000f112', 'Fixture Equipe 111', 'equipe', true)
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

do $$
declare u uuid; n text;
begin
 select user_id into u from public.pessoa where ativo and deleted_at is null and user_id is not null limit 1;
 perform set_config('request.jwt.claim.sub',u::text,true);
 n := public.contro_nome_prestador('QA João excluir 7419');
 insert into public.sugestao(tipo,texto) values ('prestador','QA Joao excluir 7419'),('local','QA João excluir 7419');
 perform public.excluir_sugestao_prestador(' qa JOAO excluir 7419 ');
 if exists(select 1 from public.sugestao where tipo='prestador' and public.contro_chave_prestador(texto)=public.contro_chave_prestador(n) and deleted_at is null) then raise exception 'Variações não excluídas'; end if;
 if not exists(select 1 from public.sugestao where tipo='local' and texto=n and deleted_at is null) then raise exception 'Outro tipo alterado'; end if;
 perform public.contro_nome_prestador('QA Joao excluir 7419');
 if exists(select 1 from public.sugestao where tipo='prestador' and public.contro_chave_prestador(texto)=public.contro_chave_prestador(n) and deleted_at is null) then raise exception 'Sugestão reapareceu'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin
   perform public.excluir_sugestao_prestador(n);
   raise exception 'Permissão não validada';
 exception when insufficient_privilege then null;
 end;
end $$;

select pass('Exclusão normalizada e persistente');
select * from finish();
rollback;