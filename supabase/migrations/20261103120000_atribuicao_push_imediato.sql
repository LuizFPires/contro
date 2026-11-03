-- Reserva impede o envio simultâneo pelo gatilho e pelo cron.
alter table public.aviso_disparo add column processamento_em timestamptz;
create or replace function public.reservar_avisos(p_id uuid default null)
returns setof public.aviso_disparo language sql security definer set search_path = '' as $$
  update public.aviso_disparo a set processamento_em = now()
  where a.id in (
    select d.id from public.aviso_disparo d
    where d.notificado_em is null and (p_id is null or d.id = p_id)
      and (d.processamento_em is null or d.processamento_em < now() - interval '5 minutes')
    order by d.criado_em limit 100 for update skip locked
  ) returning a.*;
$$;
revoke all on function public.reservar_avisos(uuid) from public, anon, authenticated;
grant execute on function public.reservar_avisos(uuid) to service_role;

create or replace function public.enviar_atribuicao_imediata()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_comando text; v_token text;
begin
  if new.tipo <> 'atribuicao' then return new; end if;
  -- Reutiliza a credencial do emissor existente sem expor ao cliente ou aos logs.
  select command into v_comando from cron.job where jobname = 'avisos-enviar' and active;
  v_token := substring(v_comando from 'Bearer ([^'']+)');
  if v_token is null then return new; end if;
  perform net.http_post(
    url := 'https://oaslrtizvfornxjuxpgp.supabase.co/functions/v1/enviar-avisos',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_token),
    body := jsonb_build_object('aviso_id', new.id), timeout_milliseconds := 10000
  );
  return new;
exception when others then
  -- A atribuição continua salva; a fila será retomada pelo cron.
  raise warning 'Envio imediato indisponível; aviso permanece na fila';
  return new;
end;
$$;
revoke all on function public.enviar_atribuicao_imediata() from public, anon, authenticated;
create trigger aviso_atribuicao_imediata after insert on public.aviso_disparo
for each row execute function public.enviar_atribuicao_imediata();
