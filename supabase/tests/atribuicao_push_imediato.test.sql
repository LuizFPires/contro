begin;
select plan(1);
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