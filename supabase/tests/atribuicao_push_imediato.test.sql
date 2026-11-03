begin;
select plan(1);
-- Dados do próprio teste (o CI começa só com o seed: modelos e unidades).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f101', 'fx-gestor-101@contro.test'),
  ('00000000-0000-0000-0000-00000000f102', 'fx-equipe-101@contro.test');
insert into pessoa (user_id, nome, perfil, ativo) values
  ('00000000-0000-0000-0000-00000000f101', 'Fixture Gestor 101', 'gestor', true),
  ('00000000-0000-0000-0000-00000000f102', 'Fixture Equipe 101', 'equipe', true)
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
do $$
declare v_id uuid; v_req bigint; v_count int;
begin
  insert into public.aviso_disparo(tipo,dia,user_id,titulo,corpo,url)
  select 'atribuicao',current_date,user_id,'Teste transacional imediato','Teste','/?ir=minhas' from public.pessoa where user_id is not null and ativo and deleted_at is null limit 1 returning id into v_id;
  if v_id is null then raise exception 'Sem fixture'; end if;
  select count(*) into v_count from net.http_request_queue where convert_from(body,'UTF8')::jsonb->>'aviso_id'=v_id::text;
  if v_count <> 1 then raise exception 'Gatilho não enfileirou HTTP direcionado'; end if;
  select count(*) into v_count from public.reservar_avisos(v_id);
  if v_count <> 1 then raise exception 'Reserva não selecionou o aviso'; end if;
  select count(*) into v_count from public.reservar_avisos(v_id);
  if v_count <> 0 then raise exception 'Reserva permitiu duplicação'; end if;
  update public.aviso_disparo set processamento_em=now()-interval '6 minutes' where id=v_id;
  select count(*) into v_count from public.reservar_avisos(v_id);
  if v_count <> 1 then raise exception 'Reserva vencida não recuperada'; end if;
end; $$;
select pass('Envio imediato direcionado e reserva exclusiva');
select * from finish();
rollback;