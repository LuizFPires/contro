-- Frequência de check-in em quantidade (1 a 5) e período (semanal ou mensal),
-- guardada como 'N/semana', 'N/mes' ou 'nao' (não precisa). 18/11/2026.

alter table public.obra_checkin_frequencia
  drop constraint if exists obra_checkin_frequencia_frequencia_check;

update public.obra_checkin_frequencia
   set frequencia = case frequencia
                      when 'diario' then '5/semana'
                      when '3' then '3/semana'
                      when '2' then '2/semana'
                      when '1' then '1/semana'
                      else frequencia
                    end
 where frequencia in ('diario', '3', '2', '1');

alter table public.obra_checkin_frequencia
  add constraint obra_checkin_frequencia_frequencia_check
  check (frequencia ~ '^[1-5]/(semana|mes)$' or frequencia = 'nao');

create or replace function public.definir_frequencia_checkin(
  p_obra_id uuid,
  p_pessoa_id uuid,
  p_frequencia text,
  p_client_op_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o Gestor define a frequência' using errcode = '42501';
  end if;
  if not public.contro_ve_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if p_frequencia is null or not (p_frequencia ~ '^[1-5]/(semana|mes)$' or p_frequencia = 'nao') then
    raise exception 'Frequência inválida' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pessoa where id = p_pessoa_id and deleted_at is null) then
    raise exception 'Pessoa inválida' using errcode = '23503';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;
  insert into public.obra_checkin_frequencia (obra_id, pessoa_id, desde, frequencia, definido_por)
  values (p_obra_id, p_pessoa_id, (now() at time zone 'America/Sao_Paulo')::date, p_frequencia,
          public.contro_pessoa_atual())
  on conflict (obra_id, pessoa_id, desde) do update
    set frequencia = excluded.frequencia,
        definido_por = excluded.definido_por,
        definido_em = now();
end;
$$;
revoke execute on function public.definir_frequencia_checkin(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.definir_frequencia_checkin(uuid, uuid, text, uuid) to authenticated;
