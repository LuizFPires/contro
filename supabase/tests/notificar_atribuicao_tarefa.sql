begin;
select plan(1);
-- Dados do próprio teste (o CI começa só com o seed: modelos e unidades).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f131', 'fx-gestor-131@contro.test'),
  ('00000000-0000-0000-0000-00000000f132', 'fx-equipe-131@contro.test');
insert into pessoa (user_id, nome, perfil, ativo) values
  ('00000000-0000-0000-0000-00000000f131', 'Fixture Gestor 131', 'gestor', true),
  ('00000000-0000-0000-0000-00000000f132', 'Fixture Equipe 131', 'equipe', true)
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f131","role":"authenticated"}';
select gerar_obra((select id from unidade order by nome limit 1), current_date, 'Obra Fixture 131',
  (select id from modelo where nome = 'Modelo 1 · CDC completo'));
reset role;
set local request.jwt.claims = '';
do $$
declare v_obra uuid; v_p1 uuid; v_p2 uuid; v_t uuid; v_base int; v_count int;
begin
  select id into v_obra from public.obra where deleted_at is null limit 1;
  select id into v_p1 from public.pessoa where ativo and deleted_at is null and user_id is not null order by id limit 1;
  select id into v_p2 from public.pessoa where ativo and deleted_at is null and user_id is not null and id <> v_p1 order by id limit 1;
  if v_obra is null or v_p2 is null then raise exception 'Fixture requer uma obra e dois membros'; end if;
  select count(*) into v_base from public.aviso_disparo where tipo='atribuicao';
  insert into public.tarefa(obra_id,texto,prazo,responsavel_id) values(v_obra,'Teste transacional de atribuição',current_date,v_p1) returning id into v_t;
  select count(*) into v_count from public.aviso_disparo where tipo='atribuicao';
  if v_count <> v_base+1 then raise exception 'Criação não notificou'; end if;
  update public.tarefa set texto='Texto editado',responsavel_id=v_p1 where id=v_t;
  select count(*) into v_count from public.aviso_disparo where tipo='atribuicao';
  if v_count <> v_base+1 then raise exception 'Edição duplicou aviso'; end if;
  update public.tarefa set responsavel_id=v_p2 where id=v_t;
  update public.tarefa set responsavel_id=v_p1 where id=v_t;
  select count(*) into v_count from public.aviso_disparo where tipo='atribuicao';
  if v_count <> v_base+3 then raise exception 'Reatribuições no mesmo dia não notificaram'; end if;
  update public.tarefa set responsavel_id=null where id=v_t;
  update public.tarefa set status='feita',responsavel_id=v_p2 where id=v_t;
  select count(*) into v_count from public.aviso_disparo where tipo='atribuicao';
  if v_count <> v_base+3 then raise exception 'Remoção ou tarefa concluída notificou'; end if;
  if not exists(select 1 from public.aviso_disparo a join public.pessoa p on p.user_id=a.user_id where a.tipo='atribuicao' and a.titulo='CONTRO · Tarefa atribuída a você' and a.url='/?ir=minhas' and p.id=v_p2 and a.corpo like 'Texto editado%') then raise exception 'Destinatário ou conteúdo incorreto'; end if;
  perform public.gerar_avisos();
  perform public.gerar_avisos();
end;
$$;
select pass('Atribuição, reatribuição, ausência de duplicação e compatibilidade dos avisos diários');
select * from finish();
rollback;
